import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { avatarHue, formatClock, initials, REACTION_EMOJIS } from '../lib/utils';
import type { Message } from '../lib/types';

interface ChatProps {
  roomId: string;
  code: string;
  myName: string;
  messages: Message[];
  accent: 'teams' | 'duo';
  channel: Broadcaster | null;
  onChanged?: () => void;
}

export interface Broadcaster {
  send: (msg: { type: 'broadcast' | 'presence'; event: string; payload: unknown }) => Promise<unknown>;
}

export function Chat({ roomId, code, myName, messages, accent, channel, onChanged }: ChatProps) {
  const [input, setInput] = useState('');
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<Record<string, number>>({});
  const lastLen = useRef(0);

  // auto-scroll
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // typing listeners
  useEffect(() => {
    const onTyping = (e: Event) => {
      const payload = (e as CustomEvent).detail as { name: string };
      if (!payload || payload.name === myName) return;
      setTypingNames((prev) => (prev.includes(payload.name) ? prev : [...prev, payload.name]));
      window.clearTimeout(typingTimer.current[payload.name]);
      typingTimer.current[payload.name] = window.setTimeout(() => {
        setTypingNames((prev) => prev.filter((n) => n !== payload.name));
      }, 3000);
    };
    window.addEventListener('sb:typing', onTyping);
    return () => window.removeEventListener('sb:typing', onTyping);
  }, [myName]);

  const broadcastTyping = () => {
    channel?.send({ type: 'broadcast', event: 'typing', payload: { name: myName } });
  };

  const send = async () => {
    const body = input.trim();
    if (!body) return;
    setInput('');
    await api.sendMessage(roomId, code, myName, body);
    onChanged?.();
  };

  const onInputChange = (v: string) => {
    setInput(v);
    if (v.length > lastLen.current) broadcastTyping();
    lastLen.current = v.length;
  };

  const react = async (msg: Message, emoji: string) => {
    await api.toggleReaction(roomId, code, msg.id, emoji, myName);
    onChanged?.();
  };

  const bubbleAccent = accent === 'teams' ? 'bg-teams-600/80' : 'bg-duo-700/80';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={listRef} className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-white/40 text-sm mt-8">No messages yet. Say hello!</p>
        )}
        {messages.map((m) => (
          <MessageRow
            key={m.id}
            msg={m}
            mine={m.sender_name === myName}
            bubbleAccent={bubbleAccent}
            onReact={react}
          />
        ))}
        {typingNames.length > 0 && (
          <div className="flex items-center gap-2 text-white/50 text-xs px-1">
            <span className="flex gap-0.5">
              <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
            </span>
            {typingNames.join(', ')} typing…
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Type a message…"
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/50 outline-none"
            aria-label="Chat message"
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-40 hover:scale-105 transition-transform focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  msg, mine, bubbleAccent, onReact,
}: {
  msg: Message;
  mine: boolean;
  bubbleAccent: string;
  onReact: (m: Message, e: string) => void;
}) {
  const [showReactions, setShowReactions] = useState(false);

  if (msg.kind === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-white/40 bg-white/5 rounded-full px-3 py-1">{msg.body}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} group`}>
      <div className={`flex items-center gap-2 max-w-[85%] ${mine ? 'flex-row-reverse' : ''}`}>
        {!mine && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{ background: `hsl(${avatarHue(msg.sender_name)} 55% 45%)` }}
          >
            {initials(msg.sender_name)}
          </div>
        )}
        <div className="relative">
          <div className={`rounded-2xl px-3.5 py-2 text-sm ${mine ? bubbleAccent : 'bg-white/10'} text-white`}>
            <p className="break-words leading-snug">{msg.body}</p>
          </div>
          {/* reactions */}
          {Object.keys(msg.reactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${mine ? 'justify-end' : ''}`}>
              {Object.entries(msg.reactions).map(([emoji, names]) => (
                <button
                  key={emoji}
                  onClick={() => onReact(msg, emoji)}
                  className="text-xs bg-white/10 hover:bg-white/20 rounded-full px-2 py-0.5 transition-colors"
                  title={names.join(', ')}
                >
                  {emoji} {names.length}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowReactions((s) => !s)}
            className="absolute -top-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs bg-white/15 hover:bg-white/25 rounded-full w-5 h-5 flex items-center justify-center text-white"
            style={{ [mine ? 'left' : 'right']: '-8px' } as React.CSSProperties}
            aria-label="Add reaction"
          >
            <SmileIcon />
          </button>
          {showReactions && (
            <div className={`absolute z-10 mt-1 bg-black/90 backdrop-blur rounded-full px-2 py-1.5 flex gap-1 ${mine ? 'right-0' : 'left-0'}`}>
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact(msg, emoji);
                    setShowReactions(false);
                  }}
                  className="text-base hover:scale-125 transition-transform"
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <span className={`text-[10px] text-white/30 mt-0.5 ${mine ? 'mr-9' : 'ml-9'}`}>{formatClock(msg.created_at)}</span>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-white/60"
      style={{ animation: `pulse-slow 1s ease-in-out ${delay}s infinite` }}
    />
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
  );
}
function SmileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
  );
}
