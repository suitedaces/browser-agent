import React, { useRef, useEffect, useState } from 'react';
import { Streamdown } from 'streamdown';
import { useAgentStore } from '../stores/agentStore';
import Message from './Message';

export default function ChatView() {
  const {
    messages,
    streamingText,
    streamingThinking,
    inputText,
    setInputText,
    submit,
    stop,
    isRunning
  } = useAgentStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // auto-scroll during streaming
  useEffect(() => {
    if (!streamingText && !streamingThinking) return;
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [streamingText, streamingThinking]);

  // focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = '24px';
    target.style.height = Math.min(target.scrollHeight, 100) + 'px';
  };

  return (
    <div className="flex flex-col h-full">
      {/* messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !streamingText && !streamingThinking ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30">
            <svg className="w-10 h-10 text-white/20 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2"/>
              <circle cx="12" cy="5" r="2"/>
              <path d="M12 7v4"/>
              <line x1="8" y1="16" x2="8" y2="16"/>
              <line x1="16" y1="16" x2="16" y2="16"/>
            </svg>
            <p className="text-sm">What would you like me to do?</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <Message key={msg.id} message={msg} />
            ))}

            {/* streaming thinking */}
            {streamingThinking && (
              <ThinkingBubble content={streamingThinking} isStreaming={isRunning} />
            )}

            {/* streaming text */}
            {streamingText && (
              <div className="text-[13px] leading-relaxed text-white/90">
                <Streamdown isAnimating={isRunning}>{streamingText}</Streamdown>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* input area */}
      <div className="p-3 pt-0 shrink-0">
        {isRunning ? (
          <button
            onClick={stop}
            className="w-full py-3 flex items-center justify-center gap-2 rounded-xl bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <span className="w-3 h-3 bg-red-400 rounded-sm" />
            <span className="text-[12px]">Stop agent</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder="What should I do?"
              rows={1}
              className="flex-1 bg-transparent text-white text-[13px] placeholder-white/30 resize-none focus:outline-none min-h-[24px] max-h-[100px] py-1 px-1"
              style={{ height: '24px' }}
            />
            <button
              onClick={() => submit()}
              disabled={!inputText.trim()}
              className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                inputText.trim()
                  ? 'bg-orange-500/30 border border-orange-400/30 text-orange-300 hover:bg-orange-500/40'
                  : 'bg-white/5 border border-white/10 text-white/20'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isStreaming) return;
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [content, isStreaming]);

  return (
    <div className="w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors mb-1"
      >
        <svg className={`w-2.5 h-2.5 ${isStreaming ? 'animate-pulse' : ''}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2zm1.61-9.96c-2.06-.3-3.88.97-4.43 2.79-.18.58.26 1.17.87 1.17h.2c.41 0 .74-.29.88-.67.32-.89 1.27-1.5 2.3-1.28.95.2 1.65 1.13 1.57 2.1-.1 1.34-1.62 1.63-2.45 2.88 0 .01-.01.01-.01.02-.01.02-.02.03-.03.05-.09.15-.18.32-.25.5-.01.03-.03.05-.04.08-.01.02-.01.04-.02.07-.12.34-.2.75-.2 1.25h2c0-.42.11-.77.28-1.07.02-.03.03-.06.05-.09.08-.14.18-.27.28-.39.01-.01.02-.03.03-.04.1-.12.21-.23.33-.34.96-.91 2.26-1.65 1.99-3.56-.24-1.74-1.61-3.21-3.35-3.47z"/>
        </svg>
        <span>thinking</span>
        {isStreaming && <span className="animate-pulse">...</span>}
        <svg className={`w-2.5 h-2.5 ml-1 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        ref={scrollRef}
        className={`text-[11px] leading-relaxed text-white/50 overflow-hidden transition-all ${expanded ? 'max-h-[300px]' : 'max-h-[60px]'} overflow-y-auto`}
      >
        <Streamdown isAnimating={isStreaming}>{content}</Streamdown>
      </div>
    </div>
  );
}
