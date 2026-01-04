import Anthropic from '@anthropic-ai/sdk';
import type { WebSocket } from 'ws';
import type { ExtensionMessage, ServerMessage, ToolResult } from './types.js';
import { BROWSER_TOOLS } from './tools.js';

const SYSTEM_PROMPT = `You are taskhomie, an AI browser assistant. You control the user's browser.

Take action with tools on every turn. Use see_page first to understand the page structure.

Element IDs like "3_42" are from the latest snapshot only. If actions fail, take a new snapshot.

Be concise. Focus on completing the task efficiently.`;

const MAX_ITERATIONS = 25;

export class AgentSession {
  private ws: WebSocket;
  private client: Anthropic;
  private pendingTools: Map<string, { resolve: (result: ToolResult) => void; reject: (error: Error) => void }> = new Map();
  private currentSnapshotId = 0;

  constructor(ws: WebSocket, apiKey: string) {
    this.ws = ws;
    this.client = new Anthropic({ apiKey });

    // listen for messages from extension
    ws.on('message', (data: Buffer) => {
      try {
        const msg: ExtensionMessage = JSON.parse(data.toString());
        this.handleExtensionMessage(msg);
      } catch (e) {
        console.error('[session] parse error:', e);
      }
    });

    ws.on('close', () => {
      console.log('[session] extension disconnected');
      // reject all pending tools
      for (const [id, pending] of this.pendingTools) {
        pending.reject(new Error('Connection closed'));
      }
      this.pendingTools.clear();
    });
  }

  private handleExtensionMessage(msg: ExtensionMessage) {
    switch (msg.type) {
      case 'tool_result': {
        const pending = this.pendingTools.get(msg.id);
        if (pending) {
          pending.resolve(msg.result);
          this.pendingTools.delete(msg.id);
        }
        break;
      }
      case 'snapshot_update': {
        this.currentSnapshotId = msg.snapshotId;
        break;
      }
    }
  }

  private send(msg: ServerMessage) {
    if (this.ws.readyState === 1) { // OPEN
      this.ws.send(JSON.stringify(msg));
    }
  }

  // call tool on extension, wait for result
  private async callExtensionTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      this.pendingTools.set(id, { resolve, reject });

      // send tool request to extension
      this.send({ type: 'tool_request', id, name, input });

      // timeout after 30s
      setTimeout(() => {
        if (this.pendingTools.has(id)) {
          this.pendingTools.delete(id);
          reject(new Error(`Tool ${name} timed out`));
        }
      }, 30000);
    });
  }

  async runTask(instructions: string) {
    try {
      const messages: Anthropic.MessageParam[] = [
        {
          role: 'user',
          content: instructions
        }
      ];

      // emit to extension that we're starting
      this.send({
        type: 'agent_event',
        event: { type: 'text', text: `Starting task: ${instructions}` }
      });

      let iteration = 0;

      while (iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`[session] iteration ${iteration}`);

        // create streaming request
        const stream = await this.client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          tools: BROWSER_TOOLS,
          messages,
          stream: true
        });

        let currentText = '';
        const contentBlocks: Anthropic.ContentBlock[] = [];
        let currentToolUse: { id: string; name: string; input: string } | null = null;

        // process stream
        for await (const event of stream) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: ''
              };
              // emit tool use event
              this.send({
                type: 'agent_event',
                event: {
                  type: 'tool_use',
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input: {}
                }
              });
            }
          }

          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              currentText += event.delta.text;
              this.send({
                type: 'agent_event',
                event: { type: 'text', text: event.delta.text }
              });
            }

            if (event.delta.type === 'input_json_delta' && currentToolUse) {
              currentToolUse.input += event.delta.partial_json;
            }
          }

          if (event.type === 'content_block_stop') {
            if (currentText) {
              contentBlocks.push({
                type: 'text',
                text: currentText,
                citations: []
              });
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

        // add assistant response to messages
        messages.push({
          role: 'assistant',
          content: contentBlocks
        });

        // execute tools
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        let hasTools = false;

        for (const block of contentBlocks) {
          if (block.type === 'tool_use') {
            hasTools = true;
            console.log(`[session] executing tool: ${block.name}`);

            try {
              const result = await this.callExtensionTool(block.name, block.input as Record<string, unknown>);

              if (result.image) {
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: [
                    {
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: 'image/png',
                        data: result.image
                      }
                    }
                  ]
                });
              } else {
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: result.text || 'Success'
                });
              }

              this.send({
                type: 'agent_event',
                event: { type: 'tool_result', id: block.id, result }
              });
            } catch (e) {
              const error = e instanceof Error ? e.message : String(e);
              console.error(`[session] tool error:`, error);

              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Error: ${error}`,
                is_error: true
              });

              this.send({
                type: 'agent_event',
                event: { type: 'error', error }
              });
            }
          }
        }

        // if no tools, we're done
        if (!hasTools) {
          console.log('[session] task complete');
          this.send({
            type: 'agent_event',
            event: { type: 'done' }
          });
          break;
        }

        // add tool results to conversation
        messages.push({
          role: 'user',
          content: toolResults
        });
      }

      if (iteration >= MAX_ITERATIONS) {
        this.send({
          type: 'agent_event',
          event: { type: 'error', error: 'Max iterations reached' }
        });
      }
    } catch (e) {
      console.error('[session] error:', e);
      const error = e instanceof Error ? e.message : String(e);
      this.send({
        type: 'agent_event',
        event: { type: 'error', error }
      });
    }
  }
}
