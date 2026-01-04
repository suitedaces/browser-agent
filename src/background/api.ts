import type { Message, ContentBlock } from '../shared/types';
import { getSettings } from './storage';
import { API_URL, API_VERSION, BETA_HEADER, MAX_TOKENS, THINKING_BUDGET } from '../shared/constants';

export interface StreamCallbacks {
  onThinking: (text: string) => void;
  onText: (text: string) => void;
  onToolUse: (id: string, name: string, input: unknown) => void;
  onDone: (content: ContentBlock[]) => void;
  onError: (error: string) => void;
  onRateLimitWait?: (secondsRemaining: number) => void;
}

async function makeRequest(
  apiKey: string,
  body: unknown,
  attempt: number = 1,
  onWait?: (secondsRemaining: number) => void
): Promise<Response> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      'anthropic-beta': BETA_HEADER,
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });

  // handle rate limiting with exponential backoff
  if (response.status === 429 && attempt < 4) {
    const retryAfter = response.headers.get('retry-after');
    const waitMs = retryAfter
      ? parseInt(retryAfter) * 1000
      : Math.pow(2, attempt) * 1000; // exponential backoff: 2s, 4s, 8s

    console.log(`[api] rate limited, retrying in ${waitMs}ms (attempt ${attempt}/3)`);

    // countdown timer
    if (onWait) {
      const endTime = Date.now() + waitMs;
      const interval = setInterval(() => {
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        if (remaining <= 0) {
          clearInterval(interval);
        } else {
          onWait(remaining);
        }
      }, 100);

      await new Promise(r => setTimeout(r, waitMs));
      clearInterval(interval);
    } else {
      await new Promise(r => setTimeout(r, waitMs));
    }

    return makeRequest(apiKey, body, attempt + 1, onWait);
  }

  return response;
}

export async function streamMessage(
  messages: Message[],
  tools: unknown[],
  systemPrompt: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const settings = await getSettings();
  if (!settings.apiKey) {
    callbacks.onError('API key not set');
    return;
  }

  const body = {
    model: settings.model,
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    tools,
    messages,
    stream: true,
    thinking: { type: 'enabled', budget_tokens: THINKING_BUDGET }
  };

  console.log('[api] sending request to', API_URL);
  console.log('[api] model:', settings.model);
  console.log('[api] messages count:', messages.length);
  // log thinking blocks in messages to debug signature issue
  for (const msg of messages) {
    for (const block of msg.content) {
      if (block.type === 'thinking') {
        console.log('[api] outgoing thinking block sig length:', (block as { signature?: string }).signature?.length || 0);
      }
    }
  }

  const response = await makeRequest(settings.apiKey, body, 1, callbacks.onRateLimitWait);

  console.log('[api] response status:', response.status);

  if (!response.ok) {
    const text = await response.text();
    console.log('[api] error response:', text);

    if (response.status === 429) {
      callbacks.onError('Rate limit exceeded after retries. Please wait a moment and try again.');
    } else {
      callbacks.onError(`API error: ${response.status} ${text}`);
    }
    return;
  }

  console.log('[api] streaming started');

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const contentBlocks: ContentBlock[] = [];
  const currentText: string[] = [];
  const currentThinking: string[] = [];
  const thinkingSignatures: string[] = [];
  const toolInfo: Map<number, { id: string; name: string; json: string }> = new Map();
  const blockTypes: Map<number, string> = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const event = JSON.parse(data);
        const eventType = event.type;

        if (eventType === 'content_block_start') {
          const index = event.index;
          const block = event.content_block;
          console.log('[api] block start:', block.type);
          blockTypes.set(index, block.type);

          if (block.type === 'tool_use') {
            console.log('[api] tool_use:', block.name);
            toolInfo.set(index, { id: block.id, name: block.name, json: '' });
            callbacks.onToolUse(block.id, block.name, {});
          }
        }

        if (eventType === 'content_block_delta') {
          const index = event.index;
          const delta = event.delta;
          console.log('[api] delta:', delta.type);

          if (delta.type === 'thinking_delta') {
            currentThinking[index] = (currentThinking[index] || '') + delta.thinking;
            callbacks.onThinking(delta.thinking);
          }

          if (delta.type === 'signature_delta') {
            console.log('[api] GOT SIGNATURE, len:', delta.signature?.length);
            thinkingSignatures[index] = (thinkingSignatures[index] || '') + delta.signature;
          }

          if (delta.type === 'text_delta') {
            currentText[index] = (currentText[index] || '') + delta.text;
            callbacks.onText(delta.text);
          }

          if (delta.type === 'input_json_delta') {
            const info = toolInfo.get(index);
            if (info) {
              info.json += delta.partial_json;
            }
          }
        }

        if (eventType === 'content_block_stop') {
          const index = event.index;
          const type = blockTypes.get(index);

          if (type === 'thinking' && currentThinking[index]) {
            console.log('[api] thinking block signature length:', thinkingSignatures[index]?.length || 0);
            contentBlocks.push({
              type: 'thinking',
              thinking: currentThinking[index],
              signature: thinkingSignatures[index] || ''
            });
          }

          if (type === 'text' && currentText[index]) {
            contentBlocks.push({ type: 'text', text: currentText[index] });
          }

          if (type === 'tool_use') {
            const info = toolInfo.get(index);
            if (info) {
              const input = info.json ? JSON.parse(info.json) : {};
              contentBlocks.push({ type: 'tool_use', id: info.id, name: info.name, input });
            }
          }
        }

        if (eventType === 'message_stop') {
          console.log('[api] message complete, blocks:', contentBlocks.length);
          callbacks.onDone(contentBlocks);
        }
      } catch {
        // parse error, skip
      }
    }
  }
}
