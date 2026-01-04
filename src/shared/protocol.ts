import type { Settings, ChatMessage } from './types';

// messages from sidepanel → background
export type SidepanelMessage =
  | { type: 'agent:start'; payload: { instructions: string; screenshot?: string } }
  | { type: 'agent:stop' }
  | { type: 'settings:get' }
  | { type: 'settings:set'; payload: Partial<Settings> }
  | { type: 'ptt:start' }
  | { type: 'ptt:stop' };

// messages from background → sidepanel
export type BackgroundMessage =
  | { type: 'agent:started' }
  | { type: 'agent:stopped' }
  | { type: 'agent:error'; payload: string }
  | { type: 'agent:thinking'; payload: string }
  | { type: 'agent:text'; payload: string }
  | { type: 'agent:flush_streaming_text' }
  | { type: 'agent:tool'; payload: { name: string; input: unknown } }
  | { type: 'agent:tool_result'; payload: { name: string; result: string } }
  | { type: 'agent:screenshot'; payload: string }
  | { type: 'agent:message'; payload: ChatMessage }
  | { type: 'agent:update_message'; payload: { id: string; content?: string; pending?: boolean; type?: string; toolResult?: string; durationMs?: number } }
  | { type: 'agent:rate_limit_wait'; payload: number }
  | { type: 'settings:data'; payload: Settings }
  | { type: 'ptt:interim'; payload: string }
  | { type: 'ptt:final'; payload: string }
  | { type: 'tts:audio'; payload: string };

// messages from background → content script
export type ContentMessage =
  | { type: 'snapshot:get'; payload: { verbose: boolean } }
  | { type: 'text:get' }
  | { type: 'indicator:show' }
  | { type: 'indicator:hide' };

// messages from content script → background
export type ContentResponse =
  | { type: 'snapshot:result'; payload: string }
  | { type: 'text:result'; payload: string };

// messages from background → offscreen
export type OffscreenMessage =
  | { type: 'ptt:start'; payload: { deepgramKey: string } }
  | { type: 'ptt:stop' }
  | { type: 'tts:play'; payload: string };

// messages from offscreen → background
export type OffscreenResponse =
  | { type: 'ptt:interim'; payload: string }
  | { type: 'ptt:final'; payload: string }
  | { type: 'ptt:error'; payload: string }
  | { type: 'tts:done' };
