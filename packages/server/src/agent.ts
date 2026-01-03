import { chromium, type Page, type BrowserContext } from 'playwright-core'
import Anthropic from '@anthropic-ai/sdk'

type AgentState = {
  page: Page
  context: BrowserContext
  logs: string[]
}

const SYSTEM_PROMPT = `You are a browser automation agent. You control the user's browser to complete tasks.

You have one tool: execute - runs JavaScript/Playwright code to interact with the browser.

Available in scope:
- page: Playwright Page object
- context: Playwright BrowserContext
- accessibilitySnapshot(): returns page structure with aria-ref markers

The snapshot returns YAML like:
- navigation [ref=e1]:
    - link "Home" [ref=e2]
    - link "About" [ref=e3]
- main [ref=e4]:
    - textbox "Email" [ref=e5]
    - button "Submit" [ref=e6]

To interact, use aria-ref locators:
await page.locator('[aria-ref="e5"]').fill('test@example.com')
await page.locator('[aria-ref="e6"]').click()

Always call accessibilitySnapshot() first to understand the page structure.
Be concise. Focus on completing the task efficiently.`

const tools: Anthropic.Tool[] = [
  {
    name: 'execute',
    description: 'Execute Playwright/JavaScript code to interact with the browser. Use accessibilitySnapshot() to see page structure, then interact via aria-ref locators.',
    input_schema: {
      type: 'object' as const,
      properties: {
        code: {
          type: 'string',
          description: 'The code to execute. Has access to: page, context, accessibilitySnapshot()'
        }
      },
      required: ['code']
    }
  }
]

async function executeCode(code: string, state: AgentState): Promise<string> {
  const { page, context } = state

  // helper to get accessibility snapshot
  const accessibilitySnapshot = async () => {
    // @ts-expect-error - internal playwright api
    return await page._snapshotForAI()
  }

  try {
    // create async function and execute
    const fn = new Function('page', 'context', 'accessibilitySnapshot', `
      return (async () => {
        ${code}
      })()
    `)
    const result = await fn(page, context, accessibilitySnapshot)
    return result !== undefined ? JSON.stringify(result, null, 2) : 'ok'
  } catch (e) {
    return `error: ${(e as Error).message}`
  }
}

export async function runAgent(opts: {
  cdpEndpoint: string
  apiKey: string
  task: string
  onUpdate?: (msg: string) => void
}) {
  const { cdpEndpoint, apiKey, task, onUpdate } = opts

  const client = new Anthropic({ apiKey })
  const browser = await chromium.connectOverCDP(cdpEndpoint)
  const context = browser.contexts()[0] || await browser.newContext()
  const page = context.pages()[0] || await context.newPage()

  const state: AgentState = { page, context, logs: [] }

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: task }
  ]

  onUpdate?.(`starting task: ${task}`)

  for (let i = 0; i < 50; i++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools,
      messages
    })

    // collect assistant content
    const assistantContent: Anthropic.ContentBlock[] = []
    let hasToolUse = false

    for (const block of response.content) {
      assistantContent.push(block)

      if (block.type === 'text') {
        onUpdate?.(block.text)
      }

      if (block.type === 'tool_use') {
        hasToolUse = true
      }
    }

    messages.push({ role: 'assistant', content: assistantContent })

    if (!hasToolUse || response.stop_reason === 'end_turn') {
      onUpdate?.('task complete')
      break
    }

    // execute tools
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        onUpdate?.(`executing: ${(block.input as { code: string }).code.slice(0, 100)}...`)
        const result = await executeCode((block.input as { code: string }).code, state)
        onUpdate?.(`result: ${result.slice(0, 200)}`)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result
        })
      }
    }

    messages.push({ role: 'user', content: toolResults })
  }

  return { success: true }
}
