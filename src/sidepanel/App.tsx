import React, { useEffect } from 'react';
import ChatView from './components/ChatView';
import Settings from './components/Settings';
import { useAgentStore } from './stores/agentStore';

const SettingsIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);

const CloseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export default function App() {
  const { showSettings, setShowSettings, initListeners, isRunning } = useAgentStore();

  useEffect(() => {
    initListeners();
  }, [initListeners]);

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white">
      <header className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <span className="text-sm font-medium text-white/90">taskhomie</span>
          {isRunning && (
            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 border border-orange-400/30 text-orange-300 rounded-full">
              running
            </span>
          )}
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white/80"
        >
          {showSettings ? <CloseIcon /> : <SettingsIcon />}
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        {showSettings ? <Settings /> : <ChatView />}
      </main>
    </div>
  );
}
