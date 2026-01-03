import { runAgent, stopAgent } from './agent';
import { getSettings, setSettings } from './storage';
import type { SidepanelMessage, BackgroundMessage } from '../shared/protocol';

// open sidepanel on action click
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'stop-agent') {
    stopAgent();
  }
});

// message router
chrome.runtime.onMessage.addListener((message: SidepanelMessage, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: SidepanelMessage) {
  switch (message.type) {
    case 'agent:start': {
      const tab = await getActiveTab();
      if (!tab?.id) return { error: 'No active tab' };

      runAgent(tab.id, message.payload.instructions, message.payload.screenshot);
      return { ok: true };
    }

    case 'agent:stop': {
      stopAgent();
      return { ok: true };
    }

    case 'settings:get': {
      const settings = await getSettings();
      return settings;
    }

    case 'settings:set': {
      await setSettings(message.payload);
      return { ok: true };
    }

    case 'ptt:start': {
      await ensureOffscreen();
      const settings = await getSettings();
      chrome.runtime.sendMessage({ type: 'ptt:start', payload: { deepgramKey: settings.deepgramKey } });
      return { ok: true };
    }

    case 'ptt:stop': {
      chrome.runtime.sendMessage({ type: 'ptt:stop' });
      return { ok: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// offscreen document management
let offscreenCreated = false;

async function ensureOffscreen() {
  if (offscreenCreated) return;

  try {
    await chrome.offscreen.createDocument({
      url: 'dist/offscreen/audio.html',
      reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Voice input and TTS playback'
    });
    offscreenCreated = true;
  } catch {
    offscreenCreated = true;
  }
}

// emit to sidepanel
export function emitToSidepanel(message: BackgroundMessage) {
  chrome.runtime.sendMessage(message).catch(() => {
    // sidepanel not open
  });
}
