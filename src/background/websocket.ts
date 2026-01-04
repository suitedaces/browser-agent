import { executeTool, setSnapshotId } from './tools';
import { emitToSidepanel } from './index';

type ServerMessage =
  | { type: 'tool_request'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'agent_event'; event: AgentEvent }
  | { type: 'error'; message: string };

type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; result: any }
  | { type: 'done' }
  | { type: 'error'; error: string };

type ExtensionMessage =
  | { type: 'tool_result'; id: string; result: { text?: string; image?: string } }
  | { type: 'snapshot_update'; snapshotId: number }
  | { type: 'start_task'; instructions: string };

const WS_URL = 'ws://localhost:3000';

let ws: WebSocket | null = null;
let currentTabId: number | null = null;
let isRunning = false;
let reconnectTimeout: number | null = null;

// track pending tool messages for updates
const pendingToolMessages: Map<string, string> = new Map();

// format tool use into message for display
function formatToolMessage(toolName: string, input: Record<string, unknown>, pending: boolean): Partial<any> {
  switch (toolName) {
    case 'see_page':
      return {
        type: 'action',
        content: pending ? 'Taking snapshot' : 'Took snapshot',
        pending
      };

    case 'page_action': {
      if (input.click) {
        return {
          type: 'action',
          content: pending ? `Clicking element ${input.click}` : `Clicked element ${input.click}`,
          pending
        };
      }
      if (input.right_click) {
        return {
          type: 'action',
          content: pending ? `Right-clicking element ${input.right_click}` : `Right-clicked element ${input.right_click}`,
          pending
        };
      }
      if (input.double_click) {
        return {
          type: 'action',
          content: pending ? `Double-clicking element ${input.double_click}` : `Double-clicked element ${input.double_click}`,
          pending
        };
      }
      if (input.type_into) {
        const text = input.text as string;
        return {
          type: 'action',
          content: pending ? `Typing "${text}"` : `Typed "${text}"`,
          pending
        };
      }
      if (input.hover) {
        return {
          type: 'action',
          content: pending ? `Hovering element ${input.hover}` : `Hovered element ${input.hover}`,
          pending
        };
      }
      if (input.scroll) {
        return {
          type: 'action',
          content: pending ? `Scrolling ${input.scroll}` : `Scrolled ${input.scroll}`,
          pending
        };
      }
      if (input.press_key) {
        return {
          type: 'action',
          content: pending ? `Pressing ${input.press_key}` : `Pressed ${input.press_key}`,
          pending
        };
      }
      return {
        type: 'action',
        content: pending ? 'Performing action' : 'Performed action',
        pending
      };
    }

    case 'browser_navigate': {
      if (input.go_to_url) {
        const url = input.go_to_url as string;
        return {
          type: 'action',
          content: pending ? `Navigating to ${url}` : `Navigated to ${url}`,
          pending
        };
      }
      return {
        type: 'action',
        content: pending ? 'Navigating' : 'Navigated',
        pending
      };
    }

    case 'get_page_text':
      return {
        type: 'action',
        content: pending ? 'Getting page text' : 'Got page text',
        pending
      };

    case 'find':
      return {
        type: 'action',
        content: pending ? 'Finding elements' : 'Found elements',
        pending
      };

    case 'run_javascript':
      return {
        type: 'action',
        content: pending ? 'Running javascript' : 'Ran javascript',
        pending
      };

    default:
      return {
        type: 'action',
        content: pending ? `Running ${toolName}` : `Ran ${toolName}`,
        pending
      };
  }
}

function connect() {
  if (ws?.readyState === WebSocket.OPEN) {
    return;
  }

  console.log('[ws] connecting to', WS_URL);

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[ws] connected');
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    ws.onmessage = async (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        await handleServerMessage(msg);
      } catch (e) {
        console.error('[ws] message parse error:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('[ws] error:', error);
    };

    ws.onclose = () => {
      console.log('[ws] disconnected');
      ws = null;

      // try to reconnect if we were running a task
      if (isRunning) {
        reconnectTimeout = setTimeout(() => {
          console.log('[ws] attempting to reconnect...');
          connect();
        }, 2000) as unknown as number;
      }
    };
  } catch (e) {
    console.error('[ws] connection failed:', e);
  }
}

async function handleServerMessage(msg: ServerMessage) {
  switch (msg.type) {
    case 'tool_request': {
      if (!currentTabId) {
        console.error('[ws] no current tab for tool execution');
        return;
      }

      console.log('[ws] executing tool:', msg.name);
      const startTime = performance.now();

      // show pending tool message in UI
      const msgId = crypto.randomUUID();
      pendingToolMessages.set(msg.id, msgId);

      const formatted = formatToolMessage(msg.name, msg.input, true);
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

      try {
        const result = await executeTool(currentTabId, msg.name, msg.input);
        const durationMs = Math.round(performance.now() - startTime);

        // send result back to server
        send({
          type: 'tool_result',
          id: msg.id,
          result
        });

        // update UI message
        const resultText = result.image ? '[screenshot]' : (result.text || '');
        const displayResult = resultText.length > 2000
          ? resultText.slice(0, 2000) + `\n... (${resultText.length - 2000} more chars)`
          : resultText;

        const formattedComplete = formatToolMessage(msg.name, msg.input, false);
        emitToSidepanel({
          type: 'agent:update_message',
          payload: {
            id: msgId,
            content: formattedComplete.content || '',
            pending: false,
            toolResult: displayResult,
            durationMs
          }
        });

        if (result.image) {
          emitToSidepanel({ type: 'agent:screenshot', payload: result.image });
        }
      } catch (e) {
        const durationMs = Math.round(performance.now() - startTime);
        const error = e instanceof Error ? e.message : String(e);

        // send error to server
        send({
          type: 'tool_result',
          id: msg.id,
          result: { text: `Error: ${error}` }
        });

        // update UI message
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
      break;
    }

    case 'agent_event': {
      const event = msg.event;

      switch (event.type) {
        case 'thinking':
          emitToSidepanel({ type: 'agent:thinking', payload: event.text });
          break;

        case 'text':
          emitToSidepanel({ type: 'agent:text', payload: event.text });
          break;

        case 'tool_use':
          // already handled in tool_request
          break;

        case 'tool_result':
          // already handled when we sent tool_result
          break;

        case 'done':
          stopAgent();
          break;

        case 'error':
          emitToSidepanel({
            type: 'agent:message',
            payload: {
              id: crypto.randomUUID(),
              role: 'assistant',
              type: 'error',
              content: event.error,
              timestamp: Date.now()
            }
          });
          stopAgent();
          break;
      }
      break;
    }

    case 'error': {
      emitToSidepanel({
        type: 'agent:message',
        payload: {
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'error',
          content: msg.message,
          timestamp: Date.now()
        }
      });
      stopAgent();
      break;
    }
  }
}

function send(msg: ExtensionMessage) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    console.error('[ws] cannot send, not connected');
  }
}

export function isAgentRunning(): boolean {
  return isRunning;
}

export function stopAgent(): void {
  isRunning = false;
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { type: 'indicator:hide' }).catch(() => {});
  }
  emitToSidepanel({ type: 'agent:stopped' });
}

export async function runAgent(tabId: number, instructions: string, contextScreenshot?: string): Promise<void> {
  if (isRunning) {
    stopAgent();
    await new Promise(r => setTimeout(r, 100));
  }

  // connect if not connected
  connect();

  // wait for connection
  if (ws?.readyState !== WebSocket.OPEN) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

      const checkConnection = () => {
        if (ws?.readyState === WebSocket.OPEN) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  isRunning = true;
  currentTabId = tabId;

  emitToSidepanel({ type: 'agent:started' });

  // show indicator
  chrome.tabs.sendMessage(tabId, { type: 'indicator:show' }).catch(() => {});

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

  // send task to server
  send({
    type: 'start_task',
    instructions
  });
}

// listen for snapshot id updates from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'snapshot:update') {
    setSnapshotId(message.payload.snapshotId);
    send({
      type: 'snapshot_update',
      snapshotId: message.payload.snapshotId
    });
  }
});
