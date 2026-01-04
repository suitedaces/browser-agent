import type { WebSocket } from 'ws';
import type { ExtensionMessage, ServerMessage, ToolResult } from './types.js';
import type { ProviderAdapter } from './providers/base.js';
import { AnthropicAdapter } from './providers/anthropic.js';
import { OpenAIAdapter } from './providers/openai.js';

export class AgentSession {
  private ws: WebSocket;
  private provider: ProviderAdapter;
  private pendingTools: Map<string, { resolve: (result: ToolResult) => void; reject: (error: Error) => void }> = new Map();
  private currentSnapshotId = 0;
  public currentModel: string;

  constructor(ws: WebSocket, config: { anthropicKey?: string; basetenKey?: string; model?: string }) {
    this.ws = ws;

    // create provider adapter
    const model = config.model || 'claude-sonnet-4-5-20250929';
    this.currentModel = model;
    if (model.includes('GLM') || model.includes('glm')) {
      if (!config.basetenKey) throw new Error('BASETEN_API_KEY required for GLM models');
      this.provider = new OpenAIAdapter('https://inference.baseten.co/v1', config.basetenKey, model);
      console.log(`[session] using baseten with model: ${model}`);
    } else {
      if (!config.anthropicKey) throw new Error('ANTHROPIC_API_KEY required for Claude models');
      this.provider = new AnthropicAdapter(config.anthropicKey, model);
      console.log(`[session] using anthropic with model: ${model}`);
    }

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
    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async callExtensionTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      this.pendingTools.set(id, { resolve, reject });
      this.send({ type: 'tool_request', id, name, input });

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
      await this.provider.streamTask(
        instructions,
        (event) => {
          switch (event.type) {
            case 'text':
              this.send({ type: 'agent_event', event: { type: 'text', text: event.text! } });
              break;
            case 'tool_use':
              this.send({
                type: 'agent_event',
                event: { type: 'tool_use', id: event.toolId!, name: event.toolName!, input: event.toolInput! }
              });
              break;
            case 'tool_result':
              this.send({ type: 'agent_event', event: { type: 'tool_result', id: event.toolId!, result: event.result! } });
              break;
            case 'done':
              this.send({ type: 'agent_event', event: { type: 'done' } });
              break;
            case 'error':
              this.send({ type: 'agent_event', event: { type: 'error', error: event.error! } });
              break;
          }
        },
        (name, input) => this.callExtensionTool(name, input)
      );
    } catch (e) {
      console.error('[session] error:', e);
      const error = e instanceof Error ? e.message : String(e);
      this.send({ type: 'agent_event', event: { type: 'error', error } });
    }
  }
}
