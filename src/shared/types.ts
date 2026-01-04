// message types
export type MessageType = 'user' | 'assistant' | 'action' | 'bash' | 'thinking' | 'error' | 'info';

export interface ComputerAction {
  action: string;
  coordinate?: [number, number];
  start_coordinate?: [number, number];
  text?: string;
  scroll_direction?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type?: MessageType;
  content: string;
  timestamp: number;
  toolUse?: ToolUse;
  screenshot?: string;
  action?: ComputerAction;
  pending?: boolean;
  bashOutput?: string;
  exitCode?: number;
  toolResult?: string;
  durationMs?: number;
}

export interface ToolUse {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  pending?: boolean;
}

// API types
export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  thinking?: string;
  signature?: string;
  tool_use_id?: string;
  content?: ContentBlock[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

// agent state
export interface AgentState {
  isRunning: boolean;
  messages: ChatMessage[];
  streamingText: string;
  streamingThinking: string;
  error: string | null;
}

// settings
export type ModelOption =
  | 'claude-sonnet-4-5-20250929'
  | 'claude-haiku-4-5-20251001'
  | 'zai-org/GLM-4.7'
  | 'zai-org/GLM-4.6';

export interface Settings {
  model: ModelOption;
  voiceMode: boolean;
  deepgramKey?: string;
  elevenlabsKey?: string;
}

// a11y snapshot
export interface A11yNode {
  uid: string;
  role: string;
  name: string;
  children?: A11yNode[];
}
