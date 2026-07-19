import { useEffect, useRef, useState } from 'react';
import type { Broadcaster } from './Chat';

interface Heart {
  id: number;
  emoji: string;
  x: number;
  fromName: string;
}

const EMOJIS = ['❤️', '💕', '💖', '💗', '🌹', '✨', '😘', '💝'];
let counter = 0;

export function FloatingHearts({ channelId, showName = false }: { channelId: string; showName?: boolean }) {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onHeart = (e: Event) => {
      const payload = (e as CustomEvent).detail as { emoji?: string; name: string; nonce?: string };
      if (!payload) return;
      if (payload.nonce && seen.current.has(payload.nonce)) return;
      if (payload.nonce) {
        seen.current.add(payload.nonce);
        if (seen.current.size > 200) seen.current.clear();
      }
      const id = counter++;
      const emoji = payload.emoji ?? EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      const x = 20 + Math.random() * 60;
      setHearts((h) => [...h, { id, emoji, x, fromName: payload.name }]);
      setTimeout(() => setHearts((h) => h.filter((heart) => heart.id !== id)), 4000);
    };
    window.addEventListener('sb:heart', onHeart);
    return () => window.removeEventListener('sb:heart', onHeart);
  }, [channelId]);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden" aria-hidden="true">
      {hearts.map((h) => (
        <span
          key={h.id}
          className="absolute bottom-24 flex flex-col items-center animate-heart-rise"
          style={{ left: `${h.x}%` }}
        >
          <span className="text-3xl">{h.emoji}</span>
          {showName && (
            <span className="text-[9px] text-white/70 bg-black/40 rounded-full px-1.5 py-0.5 mt-0.5 whitespace-nowrap">
              {h.fromName}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function sendHeart(channel: Broadcaster | null, name: string, emoji?: string) {
  const nonce = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  channel?.send({ type: 'broadcast', event: 'heart', payload: { name, emoji, nonce } });
}
