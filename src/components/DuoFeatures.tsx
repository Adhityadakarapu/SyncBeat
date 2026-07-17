import { useState } from 'react';
import { api } from '../lib/api';
import { avatarHue, formatClock, formatLongDate } from '../lib/utils';
import type { LoveNote } from '../lib/types';

export function LoveNotesBoard({ roomId, code, myName, notes, onChanged }: { roomId: string; code: string; myName: string; notes: LoveNote[]; onChanged?: () => void }) {
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    setErr(null);
    if (!body.trim()) return;
    const { error } = await api.addLoveNote(roomId, code, myName, body.trim());
    if (error) { setErr(error); return; }
    setBody('');
    onChanged?.();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">Leave a short note for your partner to find next time they open this room. Only the two of you can see these.</p>
      <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
        {notes.length === 0 && <p className="text-center text-white/30 text-sm py-4">No notes yet. Write the first one below.</p>}
        {[...notes].reverse().map((n) => (
          <div key={n.id} className="bg-gradient-to-br from-duo-900/40 to-duo-950/20 border border-duo-800/30 rounded-xl p-3 animate-fade-in-up">
            <p className="text-sm text-white/90 leading-relaxed">{n.body}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-gold-300/70">from {n.author}</span>
              <span className="text-[10px] text-white/30">{formatLongDate(n.created_at)} · {formatClock(n.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Write a love note…"
          maxLength={280}
          className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-duo-400/50 outline-none"
        />
        <button onClick={add} disabled={!body.trim()} className="px-4 rounded-full bg-duo-700 hover:bg-duo-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">Leave</button>
      </div>
      {err && <p className="text-xs text-red-300">{err}</p>}
    </div>
  );
}

export function OurSongs({ roomId, code, myName, memories, tracks, onPlayTrack, onChanged }: {
  roomId: string;
  code: string;
  myName: string;
  memories: import('../lib/types').TrackMemory[];
  tracks: import('../lib/types').Track[];
  onPlayTrack: (id: string) => void;
  onChanged?: () => void;
}) {
  const [trackId, setTrackId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const played = tracks.filter((t) => t.status === 'played' || t.status === 'playing');

  const add = async () => {
    setErr(null);
    if (!trackId || !note.trim()) { setErr('Pick a track and write a note.'); return; }
    const { error } = await api.addMemory(roomId, code, trackId, note.trim(), date || null, myName);
    if (error) { setErr(error); return; }
    setTrackId(''); setNote(''); setDate('');
    onChanged?.();
  };

  const trackFor = (id: string) => tracks.find((t) => t.id === id);

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">Tag a song with a memory and a date — "the song from our first trip." Builds a shared timeline only the two of you can see.</p>
      <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar pr-1">
        {memories.length === 0 && <p className="text-center text-white/30 text-sm py-4">No memories tagged yet.</p>}
        {[...memories].reverse().map((m) => {
          const t = trackFor(m.track_id);
          return (
            <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-3 animate-fade-in-up">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-white leading-relaxed">"{m.note}"</p>
                  <p className="text-[11px] text-gold-300/70 mt-1">— {m.created_by}{m.memory_date ? ` · ${formatLongDate(m.memory_date)}` : ''}</p>
                  {t && (
                    <button onClick={() => onPlayTrack(t.id)} className="text-[11px] text-duo-300 hover:underline mt-1 truncate block max-w-full">
                      ▶ {t.title}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-2 border-t border-white/10 pt-3">
        <p className="text-[11px] uppercase tracking-wider text-white/40">Tag a new memory</p>
        <select value={trackId} onChange={(e) => setTrackId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-duo-400/50 outline-none">
          <option value="">Choose a played song…</option>
          {played.map((t) => <option key={t.id} value={t.id} className="bg-duo-950">{t.title}</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What memory does this song hold?" maxLength={200} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-duo-400/50 outline-none" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-duo-400/50 outline-none [color-scheme:dark]" />
        {err && <p className="text-xs text-red-300">{err}</p>}
        <button onClick={add} disabled={!trackId || !note.trim()} className="w-full py-2 rounded-lg bg-duo-700 hover:bg-duo-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">Save memory</button>
      </div>
    </div>
  );
}

export function ScheduledSurprises({ roomId, code, myName, scheduled, onChanged }: {
  roomId: string;
  code: string;
  myName: string;
  scheduled: import('../lib/types').ScheduledMessage[];
  onChanged?: () => void;
}) {
  const [kind, setKind] = useState<'message' | 'track'>('message');
  const [body, setBody] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [revealAt, setRevealAt] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    setErr(null);
    if (!body.trim() || !revealAt) { setErr('Add a message and a reveal date/time.'); return; }
    const { error } = await api.addScheduled(roomId, code, myName, kind, body.trim(), kind === 'track' ? trackUrl.trim() : null, new Date(revealAt).toISOString());
    if (error) { setErr(error); return; }
    setBody(''); setTrackUrl(''); setRevealAt('');
    onChanged?.();
  };

  const pending = scheduled.filter((s) => !s.delivered);

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">Queue a message or track to reveal at a future date — an anniversary surprise, delivered automatically even if written days ahead.</p>
      <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
        {pending.length === 0 && <p className="text-center text-white/30 text-sm py-4">No scheduled surprises.</p>}
        {pending.map((s) => (
          <div key={s.id} className="bg-gold-500/10 border border-gold-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-gold-300/80 bg-gold-500/20 px-2 py-0.5 rounded-full">{s.kind === 'track' ? 'Track' : 'Message'}</span>
              <span className="text-[11px] text-white/50">reveals {formatLongDate(s.reveal_at)}</span>
            </div>
            <p className="text-sm text-white/70 truncate">{s.body}</p>
            <p className="text-[10px] text-white/30 mt-1">from {s.author} · {formatClock(s.reveal_at)}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t border-white/10 pt-3">
        <p className="text-[11px] uppercase tracking-wider text-white/40">Schedule a surprise</p>
        <div className="flex bg-white/5 rounded-full p-0.5">
          <button onClick={() => setKind('message')} className={`flex-1 text-xs py-1.5 rounded-full transition-colors ${kind === 'message' ? 'bg-duo-700 text-white' : 'text-white/60'}`}>Message</button>
          <button onClick={() => setKind('track')} className={`flex-1 text-xs py-1.5 rounded-full transition-colors ${kind === 'track' ? 'bg-duo-700 text-white' : 'text-white/60'}`}>Track</button>
        </div>
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === 'message' ? 'Your surprise message…' : 'Track title / note…'} maxLength={200} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-duo-400/50 outline-none" />
        {kind === 'track' && (
          <input value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)} placeholder="Track URL (YouTube or audio)" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-duo-400/50 outline-none" />
        )}
        <input type="datetime-local" value={revealAt} onChange={(e) => setRevealAt(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-duo-400/50 outline-none [color-scheme:dark]" />
        {err && <p className="text-xs text-red-300">{err}</p>}
        <button onClick={add} disabled={!body.trim() || !revealAt} className="w-full py-2 rounded-lg bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">Schedule surprise</button>
      </div>
    </div>
  );
}

export { avatarHue };
