import type { ToolResult } from '../types.js';

export interface StreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error';
  text?: string;
  toolName?: string;
  toolId?: string;
  toolInput?: Record<string, unknown>;
  result?: ToolResult;
  error?: string;
}

export interface ProviderAdapter {
  streamTask(
    instructions: string,
    onEvent: (event: StreamEvent) => void,
    executeTool: (name: string, input: Record<string, unknown>) => Promise<ToolResult>
  ): Promise<void>;
}
