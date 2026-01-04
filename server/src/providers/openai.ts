import OpenAI from 'openai';
import type { ProviderAdapter, StreamEvent } from './base.js';
import type { ToolResult } from '../types.js';
import { OPENAI_BROWSER_TOOLS } from '../tools.js';

const SYSTEM_PROMPT = `You are taskhomie, an AI browser assistant. You control the user's browser.

Take action with tools on every turn. Use see_page first to understand the page structure.

Element IDs like "3_42" are from the latest snapshot only. If actions fail, take a new snapshot.

Be concise. Focus on completing the task efficiently.`;

const MAX_ITERATIONS = 100;

export class OpenAIAdapter implements ProviderAdapter {
  private client: OpenAI;
  private model: string;

  constructor(baseURL: string, apiKey: string, model: string) {
    this.client = new OpenAI({ baseURL, apiKey });
    this.model = model;
  }

  async streamTask(
    instructions: string,
    onEvent: (event: StreamEvent) => void,
    executeTool: (name: string, input: Record<string, unknown>) => Promise<ToolResult>
  ): Promise<void> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: instructions }
    ];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log(`[openai] iteration ${iteration + 1}`);

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: OPENAI_BROWSER_TOOLS,
        stream: true
      });

      let currentText = '';
      const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];
      let currentToolCall: { index: number; id: string; name: string; arguments: string } | null = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // text streaming
        if (delta.content) {
          currentText += delta.content;
          onEvent({ type: 'text', text: delta.content });
        }

        // tool call streaming
        if (delta.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            if (toolCall.index !== undefined) {
              if (currentToolCall && toolCall.index !== currentToolCall.index) {
                // finish previous tool call
                toolCalls.push({
                  id: currentToolCall.id,
                  type: 'function',
                  function: {
                    name: currentToolCall.name,
                    arguments: currentToolCall.arguments
                  }
                });
                currentToolCall = null;
              }

              if (!currentToolCall || toolCall.index !== currentToolCall.index) {
                currentToolCall = {
                  index: toolCall.index,
                  id: toolCall.id || '',
                  name: toolCall.function?.name || '',
                  arguments: toolCall.function?.arguments || ''
                };
                onEvent({
                  type: 'tool_use',
                  toolId: currentToolCall.id,
                  toolName: currentToolCall.name,
                  toolInput: {}
                });
              } else {
                // accumulate arguments
                if (toolCall.function?.arguments) {
                  currentToolCall.arguments += toolCall.function.arguments;
                }
              }
            }
          }
        }
      }

      // finish last tool call
      if (currentToolCall) {
        toolCalls.push({
          id: currentToolCall.id,
          type: 'function',
          function: {
            name: currentToolCall.name,
            arguments: currentToolCall.arguments
          }
        });
      }

      // add assistant message
      const assistantMessage: OpenAI.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: currentText || null
      };
      if (toolCalls.length > 0) {
        assistantMessage.tool_calls = toolCalls;
      }
      messages.push(assistantMessage);

      // execute tools in parallel
      if (toolCalls.length === 0) {
        onEvent({ type: 'done' });
        return;
      }

      console.log(`[openai] executing ${toolCalls.length} tool(s) in parallel`);
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          try {
            if (toolCall.type !== 'function') {
              throw new Error(`Unsupported tool call type: ${toolCall.type}`);
            }
            const args = JSON.parse(toolCall.function.arguments);
            const result = await executeTool(toolCall.function.name, args);
            onEvent({ type: 'tool_result', toolId: toolCall.id, result });

            // openai doesn't support image tool results via url, only text
            const content = result.image ? '[screenshot taken]' : (result.text || 'Success');
            return {
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content
            };
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            onEvent({ type: 'error', error });
            return {
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content: `Error: ${error}`
            };
          }
        })
      );

      messages.push(...toolResults);
    }

    onEvent({ type: 'error', error: 'Max iterations reached' });
  }
}
