import { streamMessage, StreamCallbacks } from './api';
import { executeTool, TOOLS, setElementMap } from './tools';
import { emitToSidepanel } from './index';
import type { Message, ContentBlock, ChatMessage, MessageType } from '../shared/types';
import * as cdp from './cdp';
import { MAX_ITERATIONS } from '../shared/constants';

// format tool use into message for display
function formatToolMessage(toolName: string, input: Record<string, unknown>, pending: boolean): Partial<ChatMessage> {
  switch (toolName) {
    case 'see_page':
      return {
        type: 'action',
        content: pending ? 'Taking snapshot' : 'Took snapshot',
        pending
      };

    case 'page_action': {
      const action = input.action as string;
      const elementId = input.element_id as string | undefined;
      const text = input.text as string | undefined;
      const key = input.key as string | undefined;
      const direction = input.direction as string | undefined;
      const coords = input.coords as { x: number; y: number } | undefined;

      let content = '';
      if (action === 'click') {
        content = pending ? `Clicking element ${elementId}` : `Clicked element ${elementId}`;
      } else if (action === 'fill') {
        const preview = text && text.length > 30 ? text.slice(0, 30) + '...' : text;
        content = pending ? `Filling "${preview}"` : `Filled "${preview}"`;
      } else if (action === 'hover') {
        content = pending ? `Hovering element ${elementId}` : `Hovered element ${elementId}`;
      } else if (action === 'press_key') {
        content = pending ? `Pressing ${key}` : `Pressed ${key}`;
      } else if (action === 'scroll') {
        content = pending ? `Scrolling ${direction || 'down'}` : `Scrolled ${direction || 'down'}`;
      } else if (action === 'wait') {
        content = pending ? 'Waiting' : 'Waited';
      } else if (action === 'click_coords') {
        content = pending ? `Clicking (${coords?.x}, ${coords?.y})` : `Clicked (${coords?.x}, ${coords?.y})`;
      } else {
        content = pending ? `Performing ${action}` : `Performed ${action}`;
      }

      return { type: 'action', content, pending };
    }

    case 'browser_navigate': {
      const action = input.action as string;
      const url = input.url as string | undefined;

      if (action === 'goto' && url) {
        let domain = '';
        try {
          domain = new URL(url).hostname.replace('www.', '');
        } catch { domain = url.slice(0, 30); }
        return {
          type: 'action',
          content: pending ? `Navigating to ||${domain}||` : `Navigated to ||${domain}||`,
          pending
        };
      } else if (action === 'back') {
        return { type: 'action', content: pending ? 'Going back' : 'Went back', pending };
      } else if (action === 'forward') {
        return { type: 'action', content: pending ? 'Going forward' : 'Went forward', pending };
      } else if (action === 'reload') {
        return { type: 'action', content: pending ? 'Reloading page' : 'Reloaded page', pending };
      } else if (action === 'new_tab') {
        return { type: 'action', content: pending ? 'Opening new tab' : 'Opened new tab', pending };
      } else if (action === 'close_tab') {
        return { type: 'action', content: pending ? 'Closing tab' : 'Closed tab', pending };
      } else if (action === 'switch_tab') {
        return { type: 'action', content: pending ? 'Switching tab' : 'Switched tab', pending };
      }

      return { type: 'action', content: pending ? `Navigating (${action})` : `Navigated (${action})`, pending };
    }

    default:
      return {
        type: 'action',
        content: pending ? `Running ${toolName}` : `Ran ${toolName}`,
        pending
      };
  }
}

let running = false;
let currentTabId: number | null = null;

const SYSTEM_PROMPT = `You are taskhomie, an AI browser assistant. You control the user's browser.

Take action with tools on every turn. Use see_page first to understand the page structure.

Element IDs like "3_42" are from the latest snapshot only. If actions fail, take a new snapshot.

Be concise. Focus on completing the task efficiently.`;

export function isAgentRunning(): boolean {
  return running;
}

export function stopAgent(): void {
  running = false;
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { type: 'indicator:hide' }).catch(() => {});
    cdp.detach().catch(() => {});
  }
  emitToSidepanel({ type: 'agent:stopped' });
}

// listen for element map updates from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'elementMap:update') {
    setElementMap(message.payload.map, message.payload.snapshotId);
  }
});

export async function runAgent(tabId: number, instructions: string, contextScreenshot?: string): Promise<void> {
  if (running) {
    stopAgent();
    await new Promise(r => setTimeout(r, 100));
  }

  running = true;
  currentTabId = tabId;

  emitToSidepanel({ type: 'agent:started' });

  // show indicator
  chrome.tabs.sendMessage(tabId, { type: 'indicator:show' }).catch(() => {});

  const messages: Message[] = [];

  // add user message
  const userContent: ContentBlock[] = [];
  if (contextScreenshot) {
    userContent.push({
      type: 'text',
      text: '[Screenshot attached]'
    });
  }
  userContent.push({ type: 'text', text: instructions });
  messages.push({ role: 'user', content: userContent });

  // emit user message
  emitToSidepanel({
    type: 'agent:message',
    payload: {
      id: crypto.randomUUID(),
      role: 'user',
      content: instructions,
      timestamp: Date.now(),
      screenshot: contextScreenshot
    }
  });

  let iteration = 0;

  while (running && iteration < MAX_ITERATIONS) {
    iteration++;

    // track pending tool messages for updates
    const pendingToolMessages: Map<string, string> = new Map();

    const callbacks: StreamCallbacks = {
      onThinking: (text) => emitToSidepanel({ type: 'agent:thinking', payload: text }),
      onText: (text) => emitToSidepanel({ type: 'agent:text', payload: text }),
      onToolUse: (id, name, input) => {
        const msgId = crypto.randomUUID();
        pendingToolMessages.set(id, msgId);

        const formatted = formatToolMessage(name, input as Record<string, unknown>, true);
        emitToSidepanel({
          type: 'agent:message',
          payload: {
            id: msgId,
            role: 'assistant',
            type: formatted.type || 'action',
            content: formatted.content || '',
            timestamp: Date.now(),
            pending: true
          }
        });
      },
      onDone: () => {},
      onError: (error) => {
        emitToSidepanel({
          type: 'agent:message',
          payload: {
            id: crypto.randomUUID(),
            role: 'assistant',
            type: 'error',
            content: error,
            timestamp: Date.now()
          }
        });
        running = false;
      }
    };

    let responseContent: ContentBlock[] = [];

    await new Promise<void>((resolve) => {
      callbacks.onDone = (content) => {
        responseContent = content;
        resolve();
      };

      streamMessage(messages, TOOLS, SYSTEM_PROMPT, callbacks);
    });

    if (!running) break;

    // add assistant response
    messages.push({ role: 'assistant', content: responseContent });

    // process tool uses
    const toolResults: ContentBlock[] = [];

    for (const block of responseContent) {
      if (!running) break;

      if (block.type === 'tool_use') {
        const msgId = pendingToolMessages.get(block.id!);
        const startTime = performance.now();

        try {
          const result = await executeTool(tabId, block.name!, block.input!);
          const durationMs = Math.round(performance.now() - startTime);

          // truncate result for display (keep full for API)
          const resultText = result.image ? '[screenshot]' : (result.text || '');
          const displayResult = resultText.length > 2000
            ? resultText.slice(0, 2000) + `\n... (${resultText.length - 2000} more chars)`
            : resultText;

          if (result.image) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: [{ type: 'text', text: '[screenshot]' }]
            });
          } else {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: [{ type: 'text', text: result.text || '' }]
            });
          }

          // update pending message to completed with result
          if (msgId) {
            const formatted = formatToolMessage(block.name!, block.input as Record<string, unknown>, false);
            emitToSidepanel({
              type: 'agent:update_message',
              payload: {
                id: msgId,
                content: formatted.content || '',
                pending: false,
                toolResult: displayResult,
                durationMs
              }
            });
          }

          console.log(`[agent] ${block.name} completed in ${durationMs}ms`);
        } catch (e) {
          const durationMs = Math.round(performance.now() - startTime);
          const error = e instanceof Error ? e.message : String(e);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: [{ type: 'text', text: `Error: ${error}` }]
          });

          // update message with error
          if (msgId) {
            emitToSidepanel({
              type: 'agent:update_message',
              payload: {
                id: msgId,
                content: `Error: ${error}`,
                pending: false,
                type: 'error',
                durationMs
              }
            });
          }

          console.log(`[agent] ${block.name} failed in ${durationMs}ms: ${error}`);
        }
      }
    }

    // if no tools used, task complete - emit the assistant's final text response
    if (toolResults.length === 0) {
      const textBlock = responseContent.find(b => b.type === 'text');
      if (textBlock?.text) {
        emitToSidepanel({
          type: 'agent:message',
          payload: {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: textBlock.text,
            timestamp: Date.now()
          }
        });
      }
      break;
    }

    // add tool results
    messages.push({ role: 'user', content: toolResults });
  }

  stopAgent();
}
