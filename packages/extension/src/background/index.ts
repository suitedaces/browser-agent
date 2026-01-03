const RELAY_URL = 'ws://localhost:19988/extension'

type TabSession = {
  tabId: number
  sessionId: string
  targetId: string
}

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const sessions = new Map<number, TabSession>()
const pendingRequests = new Map<number, (result: unknown) => void>()

// connect to relay server
function connect() {
  if (ws?.readyState === WebSocket.OPEN) return

  ws = new WebSocket(RELAY_URL)

  ws.onopen = () => {
    console.log('connected to relay')
    // attach to active tabs
    chrome.tabs.query({ active: true }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
          attachToTab(tab.id)
        }
      }
    })
  }

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data)

    // response to our message
    if (msg.id !== undefined && pendingRequests.has(msg.id)) {
      pendingRequests.get(msg.id)!(msg.result ?? msg.error)
      pendingRequests.delete(msg.id)
      return
    }

    // command from relay (cdp command to execute)
    if (msg.method === 'cdp') {
      const { method, params, sessionId } = msg.params
      const session = Array.from(sessions.values()).find(s => s.sessionId === sessionId)

      if (!session) {
        send({ id: msg.id, error: 'session not found' })
        return
      }

      try {
        const result = await chrome.debugger.sendCommand(
          { tabId: session.tabId },
          method,
          params
        )
        send({ id: msg.id, result })
      } catch (e) {
        send({ id: msg.id, error: (e as Error).message })
      }
      return
    }

    // ping
    if (msg.method === 'ping') {
      send({ method: 'pong' })
    }
  }

  ws.onclose = () => {
    console.log('disconnected from relay')
    ws = null
    scheduleReconnect()
  }

  ws.onerror = (e) => {
    console.error('relay error', e)
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, 3000)
}

function send(msg: unknown) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

// attach debugger to tab
async function attachToTab(tabId: number) {
  if (sessions.has(tabId)) return

  try {
    await chrome.debugger.attach({ tabId }, '1.3')

    // enable necessary domains
    await chrome.debugger.sendCommand({ tabId }, 'Page.enable')
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable')
    await chrome.debugger.sendCommand({ tabId }, 'DOM.enable')

    const tab = await chrome.tabs.get(tabId)
    const sessionId = `session-${tabId}-${Date.now()}`
    const targetId = `target-${tabId}`

    sessions.set(tabId, { tabId, sessionId, targetId })

    // notify relay
    send({
      method: 'cdp:event',
      params: {
        method: 'Target.attachedToTarget',
        params: {
          sessionId,
          targetInfo: {
            targetId,
            type: 'page',
            title: tab.title || '',
            url: tab.url || '',
            attached: true
          },
          waitingForDebugger: false
        }
      }
    })

    console.log(`attached to tab ${tabId}`)
  } catch (e) {
    console.error(`failed to attach to tab ${tabId}:`, e)
  }
}

function detachFromTab(tabId: number) {
  const session = sessions.get(tabId)
  if (!session) return

  sessions.delete(tabId)

  send({
    method: 'cdp:event',
    params: {
      method: 'Target.detachedFromTarget',
      params: { sessionId: session.sessionId }
    }
  })

  try {
    chrome.debugger.detach({ tabId })
  } catch (e) {
    // ignore
  }
}

// forward CDP events to relay
chrome.debugger.onEvent.addListener((source, method, params) => {
  const session = sessions.get(source.tabId!)
  if (!session) return

  send({
    method: 'cdp:event',
    params: { method, params, sessionId: session.sessionId }
  })
})

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) {
    detachFromTab(source.tabId)
  }
})

// track tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const session = sessions.get(tabId)
  if (session && changeInfo.url) {
    send({
      method: 'cdp:event',
      params: {
        method: 'Target.targetInfoChanged',
        params: {
          targetInfo: {
            targetId: session.targetId,
            type: 'page',
            title: tab.title || '',
            url: changeInfo.url,
            attached: true
          }
        }
      }
    })
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  detachFromTab(tabId)
})

// open sidepanel on action click
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id })
  }
})

// start connection
connect()
