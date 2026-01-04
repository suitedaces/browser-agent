import Anthropic from '@anthropic-ai/sdk';
import type { ProviderAdapter, StreamEvent } from './base.js';
import type { ToolResult } from '../types.js';
import { BROWSER_TOOLS } from '../tools.js';

const SYSTEM_PROMPT = `You are taskhomie, an AI browser assistant. You control the user's browser.

Take action with tools on every turn. Use see_page first to understand the page structure.

Element IDs like "3_42" are from the latest snapshot only. If actions fail, take a new snapshot.

Be concise. Focus on completing the task efficiently.`;

const MAX_ITERATIONS = 50;

export class AnthropicAdapter implements ProviderAdapter {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-5-20250929') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async streamTask(
    instructions: string,
    onEvent: (event: StreamEvent) => void,
    executeTool: (name: string, input: Record<string, unknown>) => Promise<ToolResult>
  ): Promise<void> {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: instructions }
    ];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log(`[anthropic] iteration ${iteration + 1}`);

      // stream response
      const stream = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        tools: BROWSER_TOOLS,
        messages,
        stream: true
      });

      let currentText = '';
      const contentBlocks: Anthropic.ContentBlock[] = [];
      let currentToolUse: { id: string; name: string; input: string } | null = null;

      for await (const event of stream) {
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          currentToolUse = {
            id: event.content_block.id,
            name: event.content_block.name,
            input: ''
          };
          onEvent({
            type: 'tool_use',
            toolId: event.content_block.id,
            toolName: event.content_block.name,
            toolInput: {}
          });
        }

        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            currentText += event.delta.text;
            onEvent({ type: 'text', text: event.delta.text });
          }
          if (event.delta.type === 'input_json_delta' && currentToolUse) {
            currentToolUse.input += event.delta.partial_json;
          }
        }

        if (event.type === 'content_block_stop') {
          if (currentText) {
            contentBlocks.push({ type: 'text', text: currentText, citations: [] });
            currentText = '';
          }
          if (currentToolUse) {
            const input = currentToolUse.input ? JSON.parse(currentToolUse.input) : {};
            contentBlocks.push({
              type: 'tool_use',
              id: currentToolUse.id,
              name: currentToolUse.name,
              input
            });
            currentToolUse = null;
          }
        }
      }

      messages.push({ role: 'assistant', content: contentBlocks });

      // execute tools in parallel
      const toolBlocks = contentBlocks.filter(b => b.type === 'tool_use');
      if (toolBlocks.length === 0) {
        onEvent({ type: 'done' });
        return;
      }

      console.log(`[anthropic] executing ${toolBlocks.length} tool(s) in parallel`);
      const toolResults = await Promise.all(
        toolBlocks.map(async (block) => {
          try {
            const result = await executeTool(block.name, block.input as Record<string, unknown>);
            onEvent({ type: 'tool_result', toolId: block.id, result });

            if (result.image) {
              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: [{
                  type: 'image' as const,
                  source: {
                    type: 'base64' as const,
                    media_type: 'image/jpeg' as const,
                    data: result.image
                  }
                }]
              };
            } else {
              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: result.text || 'Success'
              };
            }
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            onEvent({ type: 'error', error });
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: `Error: ${error}`,
              is_error: true
            };
          }
        })
      );

      messages.push({ role: 'user', content: toolResults });
    }

    onEvent({ type: 'error', error: 'Max iterations reached' });
  }
}
