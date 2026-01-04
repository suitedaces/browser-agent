import React from 'react';
import { useAgentStore } from '../stores/agentStore';
import type { Settings as SettingsType } from '../../shared/types';

export default function Settings() {
  const { settings, saveSettings, setShowSettings } = useAgentStore();

  if (!settings) return <div className="p-4 text-white/50">Loading...</div>;

  return (
    <div className="p-4 space-y-5">
      <div>
        <label className="block text-[11px] text-white/40 mb-1.5 uppercase tracking-wide">Model</label>
        <select
          value={settings.model}
          onChange={(e) => saveSettings({ model: e.target.value as SettingsType['model'] })}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white/90 focus:outline-none focus:border-orange-400/50 transition-colors"
        >
          <optgroup label="Claude (Anthropic)">
            <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
          </optgroup>
          <optgroup label="GLM (Baseten)">
            <option value="zai-org/GLM-4.7">GLM-4.7</option>
            <option value="zai-org/GLM-4.6">GLM-4.6</option>
          </optgroup>
        </select>
      </div>

      <div className="flex items-center gap-3 py-2">
        <div className="relative">
          <input
            type="checkbox"
            id="voiceMode"
            checked={settings.voiceMode}
            onChange={(e) => saveSettings({ voiceMode: e.target.checked })}
            className="sr-only peer"
          />
          <label
            htmlFor="voiceMode"
            className="block w-10 h-6 bg-white/10 rounded-full cursor-pointer transition-colors peer-checked:bg-orange-500/50"
          />
          <label
            htmlFor="voiceMode"
            className="absolute left-1 top-1 w-4 h-4 bg-white/70 rounded-full transition-transform peer-checked:translate-x-4 peer-checked:bg-white cursor-pointer"
          />
        </div>
        <label htmlFor="voiceMode" className="text-[13px] text-white/70 cursor-pointer">Enable voice mode</label>
      </div>

      {settings.voiceMode && (
        <div className="space-y-4 pl-4 border-l border-white/10">
          <div>
            <label className="block text-[11px] text-white/40 mb-1.5 uppercase tracking-wide">Deepgram API Key</label>
            <input
              type="password"
              value={settings.deepgramKey || ''}
              onChange={(e) => saveSettings({ deepgramKey: e.target.value })}
              placeholder="..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white/90 placeholder-white/30 focus:outline-none focus:border-orange-400/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] text-white/40 mb-1.5 uppercase tracking-wide">ElevenLabs API Key</label>
            <input
              type="password"
              value={settings.elevenlabsKey || ''}
              onChange={(e) => saveSettings({ elevenlabsKey: e.target.value })}
              placeholder="..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white/90 placeholder-white/30 focus:outline-none focus:border-orange-400/50 transition-colors"
            />
          </div>
        </div>
      )}

      <button
        onClick={() => setShowSettings(false)}
        className="w-full py-2.5 bg-orange-500/20 border border-orange-400/30 text-orange-300 hover:bg-orange-500/30 rounded-xl font-medium text-[13px] transition-colors"
      >
        Done
      </button>
    </div>
  );
}
