import type { Settings } from '../shared/types';

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  voiceMode: false
};

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

export async function setSettings(partial: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ settings: updated });
}

export async function getConversations(): Promise<unknown[]> {
  const result = await chrome.storage.local.get('conversations');
  return result.conversations || [];
}

export async function saveConversation(conversation: unknown): Promise<void> {
  const conversations = await getConversations();
  conversations.unshift(conversation);
  await chrome.storage.local.set({ conversations: conversations.slice(0, 50) });
}
