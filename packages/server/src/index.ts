import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { cors } from 'hono/cors'
import { streamText } from 'hono/streaming'
import { startRelay } from './relay.js'
import { runAgent } from './agent.js'

const PORT = parseInt(process.env.PORT || '19988')
const CDP_ENDPOINT = `ws://localhost:${PORT}/cdp`

async function main() {
  // start the relay (handles /cdp and /extension websockets)
  await startRelay(PORT)

  // add HTTP routes for the sidepanel
  const app = new Hono()
  app.use('*', cors())

  app.get('/', (c) => c.text('taskhomie server'))

  app.get('/status', (c) => c.json({ ok: true }))

  app.post('/agent', async (c) => {
    const { task } = await c.req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return c.json({ error: 'ANTHROPIC_API_KEY not set' }, 500)
    }

    if (!task) {
      return c.json({ error: 'task required' }, 400)
    }

    return streamText(c, async (stream) => {
      await runAgent({
        cdpEndpoint: CDP_ENDPOINT,
        apiKey,
        task,
        onUpdate: async (msg) => {
          await stream.writeln(msg)
        }
      })
    })
  })

  // start HTTP server on a different port (relay uses 19988 for websockets)
  const httpPort = PORT + 1
  serve({ fetch: app.fetch, port: httpPort })
  console.log(`http api on http://localhost:${httpPort}`)
}

main().catch(console.error)
