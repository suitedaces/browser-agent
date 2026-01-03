import React, { useState } from 'react';
import { Streamdown } from 'streamdown';
import type { ChatMessage } from '../../shared/types';

interface Props {
  message: ChatMessage;
}

// icons as inline SVGs to avoid dependencies
const icons = {
  mouse: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/>
    </svg>
  ),
  keyboard: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"/>
    </svg>
  ),
  scroll: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h12a2 2 0 002-2v-2H10v2a2 2 0 11-4 0V5a2 2 0 10-4 0v3h4"/>
      <path d="M19 17V5a2 2 0 00-2-2H4"/>
    </svg>
  ),
  camera: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>
  ),
  clock: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  ),
  globe: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),
  layers: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 2,7 12,12 22,7"/>
      <polyline points="2,17 12,22 22,17"/>
      <polyline points="2,12 12,17 22,12"/>
    </svg>
  ),
  click: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9l5 12 1.8-5.2L21 14l-12-5z"/>
      <path d="M7.2 2.2L8 5.1M1 8l3 .5M2.2 2.2L5 5"/>
    </svg>
  ),
  hand: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 00-4 0v1M14 10V4a2 2 0 00-4 0v7"/>
      <path d="M10 10.5V2a2 2 0 00-4 0v9"/>
      <path d="M7 15a6 6 0 0012 0v-4a2 2 0 00-4 0"/>
    </svg>
  ),
  form: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2"/>
      <path d="M7 7h10M7 12h10M7 17h4"/>
    </svg>
  ),
  navigation: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3,11 22,2 13,21 11,13"/>
    </svg>
  ),
  refresh: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6"/>
      <path d="M21 13a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
    </svg>
  ),
  tab: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18"/>
    </svg>
  ),
  error: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  eye: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  chevronDown: (
    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6,9 12,15 18,9"/>
    </svg>
  ),
  chevronUp: (
    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18,15 12,9 6,15"/>
    </svg>
  ),
};

function getActionIcon(msg: ChatMessage) {
  const action = msg.action?.action;
  const content = msg.content.toLowerCase();

  if (action?.includes('click') || action === 'mouse_move' || action === 'left_click_drag')
    return icons.mouse;
  if (action === 'type' || action === 'key') return icons.keyboard;
  if (action === 'scroll') return icons.scroll;
  if (action === 'wait') return icons.clock;
  if (action === 'screenshot') return icons.camera;

  // browser tools
  if (content.includes('snapshot')) return icons.layers;
  if (content.includes('clicked') || content.includes('clicking')) return icons.click;
  if (content.includes('hover')) return icons.hand;
  if (content.includes('filled') || content.includes('filling')) return icons.form;
  if (content.includes('navigat') || content.includes('went back') || content.includes('went forward')) return icons.navigation;
  if (content.includes('reload')) return icons.refresh;
  if (content.includes('waited')) return icons.clock;
  if (content.includes('tab') || content.includes('page')) return icons.tab;

  return icons.eye;
}

function BashBlock({ msg }: { msg: ChatMessage }) {
  const [expanded, setExpanded] = useState(true);
  const hasOutput = msg.bashOutput !== undefined;
  const isSuccess = msg.exitCode === 0;
  const isError = msg.exitCode !== undefined && msg.exitCode !== 0;

  return (
    <div className="rounded-md overflow-hidden bg-[#0d1117] border border-[#30363d]">
      <div className="px-2 py-1.5 font-mono flex items-center gap-2">
        <span className="text-[#3fb950] text-[11px] select-none">$</span>
        <span className={`text-[11px] text-[#e6edf3] break-all flex-1 select-text ${msg.pending ? "sweep-text" : ""}`}>
          {msg.content}
        </span>
        {msg.pending && <span className="text-[8px] text-[#8b949e] animate-pulse shrink-0">...</span>}
        {hasOutput && msg.exitCode !== undefined && (
          <span className={`text-[8px] font-mono shrink-0 ${isSuccess ? "text-[#3fb950]" : "text-[#f85149]"}`}>
            {msg.exitCode}
          </span>
        )}
      </div>

      {hasOutput && (
        <>
          <div className="border-t border-[#30363d]">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-2 py-0.5 flex items-center gap-1 text-[8px] text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
            >
              {expanded ? icons.chevronUp : icons.chevronDown}
              output
            </button>
          </div>
          {expanded && (
            <pre className={`px-2 py-1.5 text-[10px] leading-relaxed break-words whitespace-pre-wrap max-h-[120px] overflow-y-auto select-text ${
              isError ? "text-[#f85149]" : "text-[#8b949e]"
            }`}>
              {msg.bashOutput}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

function ScreenshotBlock({ msg }: { msg: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => msg.screenshot && setExpanded(!expanded)}
        className="flex items-center gap-2 text-white/50 hover:text-white/70 transition-colors"
      >
        {icons.camera}
        <span className={`text-[13px] ${msg.pending ? "sweep-text italic" : ""}`}>
          {msg.pending ? "Taking screenshot" : "Took screenshot"}
        </span>
        {msg.screenshot && (
          <span className="text-white/30">
            {expanded ? icons.chevronUp : icons.chevronDown}
          </span>
        )}
      </button>
      {expanded && msg.screenshot && (
        <div className="mt-1.5 rounded-lg overflow-hidden bg-black/40">
          <img
            src={`data:image/jpeg;base64,${msg.screenshot}`}
            alt="Screenshot"
            className="w-full h-auto"
          />
        </div>
      )}
    </div>
  );
}

function formatActionContent(msg: ChatMessage): React.ReactNode {
  const action = msg.action;
  if (!action) return msg.content;

  const coord = action.coordinate;
  const actionType = action.action;
  const text = action.text;

  switch (actionType) {
    case 'left_click':
      if (coord) {
        const label = msg.pending ? 'Clicking' : 'Clicked';
        return <>{label} <sub className="text-[10px] opacity-60">({coord[0]}, {coord[1]})</sub></>;
      }
      return msg.pending ? 'Clicking' : 'Clicked';

    case 'right_click':
      return msg.pending ? 'Right clicking' : 'Right clicked';

    case 'double_click':
      if (coord) {
        const label = msg.pending ? 'Double clicking' : 'Double clicked';
        return <>{label} <sub className="text-[10px] opacity-60">({coord[0]}, {coord[1]})</sub></>;
      }
      return msg.pending ? 'Double clicking' : 'Double clicked';

    case 'mouse_move':
      if (coord) {
        const label = msg.pending ? 'Moving to' : 'Moved to';
        return <>{label} <sub className="text-[10px] opacity-60">({coord[0]}, {coord[1]})</sub></>;
      }
      return msg.pending ? 'Moving mouse' : 'Moved mouse';

    case 'left_click_drag':
      if (action.start_coordinate && coord) {
        const label = msg.pending ? 'Dragging' : 'Dragged';
        return <>{label} <sub className="text-[10px] opacity-60">({action.start_coordinate[0]}, {action.start_coordinate[1]}) → ({coord[0]}, {coord[1]})</sub></>;
      }
      return msg.pending ? 'Dragging' : 'Dragged';

    case 'type':
      if (text) {
        const preview = text.length > 30 ? `${text.slice(0, 30)}...` : text;
        return msg.pending ? `Typing: "${preview}"` : `Typed: "${preview}"`;
      }
      return msg.pending ? 'Typing' : 'Typed';

    case 'key':
      if (text) return msg.pending ? `Pressing ${text}` : `Pressed ${text}`;
      return msg.pending ? 'Pressing key' : 'Pressed key';

    case 'scroll': {
      const dir = action.scroll_direction || 'down';
      return msg.pending ? `Scrolling ${dir}` : `Scrolled ${dir}`;
    }

    case 'wait':
      return msg.pending ? 'Waiting' : 'Waited';

    case 'screenshot':
      return msg.pending ? 'Taking screenshot' : 'Took screenshot';

    default:
      return msg.content;
  }
}

function ToolResultBlock({ msg }: { msg: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);

  // show for any tool with result or duration
  if (!msg.toolResult && msg.durationMs === undefined) return null;

  const isScreenshot = msg.toolResult === '[screenshot]';

  return (
    <div className="mt-1">
      <button
        onClick={() => !isScreenshot && setExpanded(!expanded)}
        className={`flex items-center gap-1 text-[9px] text-white/30 ${!isScreenshot ? 'hover:text-white/50' : ''} transition-colors`}
      >
        {!isScreenshot && (expanded ? icons.chevronUp : icons.chevronDown)}
        {msg.toolResult && !isScreenshot && <span>result</span>}
        {msg.durationMs !== undefined && (
          <span className="text-white/20">{msg.durationMs}ms</span>
        )}
      </button>
      {expanded && msg.toolResult && !isScreenshot && (
        <pre className="mt-1 px-2 py-1.5 text-[10px] leading-relaxed text-white/50 bg-white/5 rounded border border-white/5 max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words select-text">
          {msg.toolResult}
        </pre>
      )}
    </div>
  );
}

export default function Message({ message }: Props) {
  const isUser = message.role === 'user';
  const msgType = message.type;

  // bash block
  if (msgType === 'bash') {
    return <BashBlock msg={message} />;
  }

  // screenshot action
  if (msgType === 'action' && message.action?.action === 'screenshot') {
    return <ScreenshotBlock msg={message} />;
  }

  const isAction = msgType === 'action';
  const isError = msgType === 'error';
  const showSweep = isAction && message.pending;
  const icon = isAction ? getActionIcon(message) : (isError ? icons.error : null);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={isUser ? 'bg-white/10 border-white/20 px-3 py-2 rounded-2xl border backdrop-blur-sm max-w-[85%]' : 'max-w-full'}>
        {/* user screenshot */}
        {isUser && message.screenshot && (
          <div className="mb-2 rounded-lg overflow-hidden">
            <img
              src={`data:image/jpeg;base64,${message.screenshot}`}
              alt="Context"
              className="w-full max-w-[300px] h-auto rounded-lg"
            />
          </div>
        )}

        <div className="flex items-start gap-2">
          {icon && <span className={`mt-0.5 ${isError ? 'text-red-400' : 'text-white/50'}`}>{icon}</span>}
          <div className="flex-1 min-w-0">
            <div className={`text-[13px] leading-relaxed break-words select-text ${
              isError ? 'text-red-400' :
              isAction ? (message.pending ? 'text-white/50 italic' : 'text-white/50') :
              'text-white/90'
            }`}>
              {showSweep && <span className="sweep-text">{formatActionContent(message)}</span>}
              {isAction && !showSweep && formatActionContent(message)}
              {!isAction && !isUser && <Streamdown isAnimating={false}>{message.content}</Streamdown>}
              {!isAction && isUser && message.content}
            </div>
            {/* collapsible tool result with timing */}
            {isAction && !message.pending && <ToolResultBlock msg={message} />}
          </div>
        </div>
      </div>
    </div>
  );
}
