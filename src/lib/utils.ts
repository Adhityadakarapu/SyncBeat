import type { TrackSource } from './types';

export const MOOD_TAGS = ['Party', 'Chill', 'Workout', 'Focus', 'Road Trip', 'Romantic', 'Sad', 'Hype'];
export const LANGUAGE_TAGS = ['English', 'Hindi', 'Telugu', 'Tamil', 'Punjabi', 'Korean', 'Spanish'];

export function parseTrackInput(raw: string): { source: TrackSource; url: string; youtubeId: string | null } | null {
  const url = raw.trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      return { source: 'youtube', url, youtubeId: u.pathname.slice(1) || null };
    }
    if (u.hostname.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return { source: 'youtube', url, youtubeId: v };
    }
    if (u.hostname.endsWith('yandex.ru') || u.hostname.endsWith('yandex.com')) {
      return null;
    }
    return { source: 'audio', url, youtubeId: null };
  } catch {
    // bare 11-char id treated as youtube
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return { source: 'youtube', url: `https://www.youtube.com/watch?v=${url}`, youtubeId: url };
    }
    return null;
  }
}

export function deriveTitle(raw: string, source: TrackSource): string {
  if (source === 'youtube') {
    const p = parseTrackInput(raw);
    if (p?.youtubeId) return `YouTube · ${p.youtubeId}`;
  }
  try {
    const u = new URL(raw);
    const seg = u.pathname.split('/').filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : 'Audio track';
  } catch {
    return 'Audio track';
  }
}

export function formatTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatLongDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] ?? '') + (p[1]?.[0] ?? p[0]?.[1] ?? '');
}

export function avatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

const REACTION_EMOJIS = ['❤️', '🔥', '😂', '👍', '🎉', '😮', '😢', '💯'];

export function calcPositionMs(position_ms: number, is_playing: boolean, updated_at: string, now: number = Date.now()): number {
  if (!is_playing) return position_ms;
  const serverMs = new Date(updated_at).getTime();
  const elapsed = Math.max(0, now - serverMs);
  return position_ms + elapsed;
}

export { REACTION_EMOJIS };
