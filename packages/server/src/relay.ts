import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import type { WSContext } from 'hono/ws'

type Target = {
  sessionId: string
  targetId: string
  url: string
  title: string
}

type PendingRequest = {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
}

export type RelayServer = {
  port: number
  close: () => void
}

export async function startRelay(port = 19988): Promise<RelayServer> {
  const targets = new Map<string, Target>()
  const playwrightClients = new Map<string, WSContext>()
  let extensionWs: WSContext | null = null

  const pendingRequests = new Map<number, PendingRequest>()
  let messageId = 0

  // send command to extension and wait for response
  async function sendToExtension(method: string, params?: unknown): Promise<unknown> {
    if (!extensionWs) throw new Error('extension not connected')

    const id = ++messageId
    extensionWs.send(JSON.stringify({ id, method, params }))

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(id)
        reject(new Error(`timeout: ${method}`))
      }, 30000)

      pendingRequests.set(id, {
        resolve: (result) => { clearTimeout(timeout); resolve(result) },
        reject: (error) => { clearTimeout(timeout); reject(error) }
      })
    })
  }

  // broadcast to all playwright clients
  function sendToPlaywright(message: unknown, clientId?: string) {
    const data = JSON.stringify(message)
    if (clientId) {
      playwrightClients.get(clientId)?.send(data)
    } else {
      for (const client of playwrightClients.values()) {
        client.send(data)
      }
    }
  }

  // route CDP commands - some handled locally, most forwarded to extension
  async function routeCommand(method: string, params: unknown, sessionId?: string) {
    // browser info - respond locally
    if (method === 'Browser.getVersion') {
      return {
        protocolVersion: '1.3',
        product: 'Chrome/Extension-Bridge',
        revision: '1.0.0',
        userAgent: 'taskhomie/1.0.0',
        jsVersion: 'V8'
      }
    }

    // target management - use our tracked state
    if (method === 'Target.getTargets') {
      return {
        targetInfos: Array.from(targets.values()).map(t => ({
          targetId: t.targetId,
          type: 'page',
          title: t.title,
          url: t.url,
          attached: true
        }))
      }
    }

    if (method === 'Target.attachToTarget') {
      const targetId = (params as { targetId: string }).targetId
      for (const target of targets.values()) {
        if (target.targetId === targetId) {
          return { sessionId: target.sessionId }
        }
      }
      throw new Error(`target ${targetId} not found`)
    }

    if (method === 'Target.getTargetInfo') {
      const targetId = (params as { targetId?: string })?.targetId
      if (targetId) {
        for (const target of targets.values()) {
          if (target.targetId === targetId) {
            return { targetInfo: { ...target, type: 'page', attached: true } }
          }
        }
      }
      if (sessionId) {
        const target = targets.get(sessionId)
        if (target) return { targetInfo: { ...target, type: 'page', attached: true } }
      }
    }

    // no-ops
    if (method === 'Target.setAutoAttach' || method === 'Target.setDiscoverTargets' || method === 'Browser.setDownloadBehavior') {
      return {}
    }

    // forward everything else to extension
    return await sendToExtension('cdp', { method, params, sessionId })
  }

  const app = new Hono()
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

  app.get('/', (c) => c.text('taskhomie relay'))

  // playwright connects here
  app.get('/cdp/:clientId?', upgradeWebSocket((c) => {
    const clientId = c.req.param('clientId') || `client-${Date.now()}`

    return {
      onOpen(_, ws) {
        playwrightClients.set(clientId, ws)
        console.log(`playwright connected: ${clientId}`)

        // send existing targets
        for (const target of targets.values()) {
          ws.send(JSON.stringify({
            method: 'Target.attachedToTarget',
            params: {
              sessionId: target.sessionId,
              targetInfo: { ...target, type: 'page', attached: true },
              waitingForDebugger: false
            }
          }))
        }
      },

      async onMessage(event) {
        const msg = JSON.parse(event.data.toString())
        const { id, method, params, sessionId } = msg

        if (!extensionWs) {
          sendToPlaywright({ id, error: { message: 'extension not connected' } }, clientId)
          return
        }

        try {
          const result = await routeCommand(method, params, sessionId)
          sendToPlaywright({ id, sessionId, result }, clientId)
        } catch (e) {
          sendToPlaywright({ id, sessionId, error: { message: (e as Error).message } }, clientId)
        }
      },

      onClose() {
        playwrightClients.delete(clientId)
        console.log(`playwright disconnected: ${clientId}`)
      }
    }
  }))

  // extension connects here
  app.get('/extension', upgradeWebSocket(() => {
    return {
      onOpen(_, ws) {
        if (extensionWs) {
          extensionWs.close(4001, 'replaced')
          targets.clear()
        }
        extensionWs = ws
        console.log('extension connected')
      },

      onMessage(event) {
        const msg = JSON.parse(event.data.toString())

        // response to our request
        if (msg.id !== undefined) {
          const pending = pendingRequests.get(msg.id)
          if (pending) {
            pendingRequests.delete(msg.id)
            if (msg.error) pending.reject(new Error(msg.error))
            else pending.resolve(msg.result)
          }
          return
        }

        // cdp event from extension
        if (msg.method === 'cdp:event') {
          const { method, params, sessionId } = msg.params

          // track targets
          if (method === 'Target.attachedToTarget') {
            const { sessionId: sid, targetInfo } = params
            targets.set(sid, {
              sessionId: sid,
              targetId: targetInfo.targetId,
              url: targetInfo.url,
              title: targetInfo.title
            })
          }

          if (method === 'Target.detachedFromTarget') {
            targets.delete(params.sessionId)
          }

          if (method === 'Target.targetInfoChanged') {
            const target = Array.from(targets.values()).find(t => t.targetId === params.targetInfo.targetId)
            if (target) {
              target.url = params.targetInfo.url
              target.title = params.targetInfo.title
            }
          }

          // forward to all playwright clients
          sendToPlaywright({ method, params, sessionId })
        }
      },

      onClose() {
        console.log('extension disconnected')
        extensionWs = null
        targets.clear()
        for (const client of playwrightClients.values()) {
          client.close(1000, 'extension disconnected')
        }
        playwrightClients.clear()
      }
    }
  }))

  const server = serve({ fetch: app.fetch, port })
  injectWebSocket(server)

  console.log(`relay running on ws://localhost:${port}`)
  console.log(`  extension: ws://localhost:${port}/extension`)
  console.log(`  playwright: ws://localhost:${port}/cdp`)

  return {
    port,
    close: () => server.close()
  }
}
