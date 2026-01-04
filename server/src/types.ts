// messages from extension → server
export type ExtensionMessage =
  | { type: 'tool_result'; id: string; result: { text?: string; image?: string } }
  | { type: 'snapshot_update'; snapshotId: number }
  | { type: 'screenshot'; data: string };

// messages from server → extension
export type ServerMessage =
  | { type: 'tool_request'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'agent_event'; event: AgentEvent }
  | { type: 'error'; message: string };

export type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; result: any }
  | { type: 'done' }
  | { type: 'error'; error: string };

export interface ToolResult {
  text?: string;
  image?: string;
}
