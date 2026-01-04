import { create } from 'zustand';
import type { ChatMessage, Settings } from '../../shared/types';
import type { BackgroundMessage } from '../../shared/protocol';

interface AgentStore {
  isRunning: boolean;
  messages: ChatMessage[];
  streamingText: string;
  streamingThinking: string;
  inputText: string;
  showSettings: boolean;
  settings: Settings | null;
  rateLimitWait: number;

  setInputText: (text: string) => void;
  setShowSettings: (show: boolean) => void;
  submit: () => Promise<void>;
  stop: () => void;
  initListeners: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: Partial<Settings>) => Promise<void>;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  isRunning: false,
  messages: [],
  streamingText: '',
  streamingThinking: '',
  inputText: '',
  showSettings: false,
  settings: null,
  rateLimitWait: 0,

  setInputText: (text) => set({ inputText: text }),
  setShowSettings: (show) => set({ showSettings: show }),

  submit: async () => {
    const { inputText, isRunning } = get();
    if (!inputText.trim() || isRunning) return;

    set({ inputText: '', streamingText: '', streamingThinking: '' });

    await chrome.runtime.sendMessage({
      type: 'agent:start',
      payload: { instructions: inputText }
    });
  },

  stop: () => {
    chrome.runtime.sendMessage({ type: 'agent:stop' });
  },

  initListeners: () => {
    chrome.runtime.onMessage.addListener((message: BackgroundMessage) => {
      switch (message.type) {
        case 'agent:started':
          set({ isRunning: true });
          break;

        case 'agent:stopped':
          set({
            isRunning: false,
            streamingText: '',
            streamingThinking: ''
          });
          break;

        case 'agent:error':
          set({ isRunning: false });
          break;

        case 'agent:thinking':
          set(s => ({ streamingThinking: s.streamingThinking + message.payload }));
          break;

        case 'agent:text':
          set(s => ({ streamingText: s.streamingText + message.payload }));
          break;

        case 'agent:flush_streaming_text':
          set(s => {
            // save accumulated streaming text as a message before clearing
            if (!s.streamingText) return s;

            return {
              messages: [...s.messages, {
                id: crypto.randomUUID(),
                role: 'assistant' as const,
                content: s.streamingText,
                timestamp: Date.now()
              }],
              streamingText: ''
            };
          });
          break;

        case 'agent:message':
          set(s => ({
            messages: [...s.messages, message.payload]
          }));
          break;

        case 'agent:update_message':
          set(s => ({
            messages: s.messages.map(m =>
              m.id === message.payload.id
                ? {
                    ...m,
                    content: message.payload.content ?? m.content,
                    pending: message.payload.pending ?? m.pending,
                    type: (message.payload.type as any) ?? m.type,
                    toolResult: message.payload.toolResult ?? m.toolResult,
                    durationMs: message.payload.durationMs ?? m.durationMs
                  }
                : m
            )
          }));
          break;

        case 'agent:rate_limit_wait':
          set({ rateLimitWait: message.payload });
          break;

        case 'agent:screenshot':
          break;
      }
    });

    get().loadSettings();
  },

  loadSettings: async () => {
    const settings = await chrome.runtime.sendMessage({ type: 'settings:get' });
    set({ settings, showSettings: !settings.apiKey });
  },

  saveSettings: async (partial) => {
    await chrome.runtime.sendMessage({ type: 'settings:set', payload: partial });
    const settings = await chrome.runtime.sendMessage({ type: 'settings:get' });
    set({ settings });
  }
}));
