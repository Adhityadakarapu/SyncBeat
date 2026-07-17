import { useRef, useState } from 'react';
import type { RoomState, Track } from '../lib/types';

interface RecapProps {
  room: RoomState;
  onClose: () => void;
}

interface RecapData {
  tracksPlayed: Track[];
  topVoted: Track | null;
  mostActiveChatter: { name: string; count: number } | null;
  totalMessages: number;
  totalVotes: number;
  sessionLength: string;
}

export function SessionRecap({ room, onClose }: RecapProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

  const data: RecapData = buildRecap(room);

  const shareLink = `${window.location.origin}/#/r/${room.portal}/${room.code}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const downloadImage = async () => {
    const svg = renderSvg(room, data);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syncbeat-recap-${room.code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-label="Session recap">
      <div className="bg-gradient-to-br from-teams-950 to-black rounded-3xl border border-teams-800/50 max-w-md w-full overflow-hidden animate-scale-in">
        <div ref={cardRef} className="p-6 bg-gradient-to-br from-teams-900 to-black">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] uppercase tracking-widest text-teams-300 font-bold">Session Recap</span>
            <span className="text-[10px] text-white/40">{room.code}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white font-display mb-1">{room.name || 'Teams Session'}</h2>
          <p className="text-sm text-teams-200/70 mb-5">{data.sessionLength}</p>

          <Stat label="Tracks played" value={data.tracksPlayed.length} />
          <Stat label="Messages sent" value={data.totalMessages} />
          <Stat label="Votes cast" value={data.totalVotes} />

          <div className="mt-5 space-y-3">
            {data.topVoted && (
              <Highlight title="Top voted track" emoji="🏆">
                <p className="text-white text-sm font-semibold truncate">{data.topVoted.title}</p>
                <p className="text-teams-200/60 text-xs">{data.topVoted.net_votes} net votes</p>
              </Highlight>
            )}
            {data.mostActiveChatter && (
              <Highlight title="Most active chatter" emoji="💬">
                <p className="text-white text-sm font-semibold">{data.mostActiveChatter.name}</p>
                <p className="text-teams-200/60 text-xs">{data.mostActiveChatter.count} messages</p>
              </Highlight>
            )}
          </div>
        </div>

        <div className="p-4 bg-black/40 flex gap-2">
          <button onClick={downloadImage} className="flex-1 py-2.5 rounded-lg bg-teams-600 hover:bg-teams-500 text-white text-sm font-semibold transition-colors">Download card</button>
          <button onClick={copyLink} className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors">{copied ? 'Copied!' : 'Copy link'}</button>
          <button onClick={onClose} className="py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/10">
      <span className="text-sm text-teams-200/70">{label}</span>
      <span className="text-lg font-bold text-white tabular-nums">{value}</span>
    </div>
  );
}

function Highlight({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
      <p className="text-[10px] uppercase tracking-wider text-teams-300/70 mb-1">{emoji} {title}</p>
      {children}
    </div>
  );
}

function buildRecap(room: RoomState): RecapData {
  const tracksPlayed = room.tracks.filter((t) => t.status === 'played' || t.status === 'playing');
  const topVoted = [...room.tracks].sort((a, b) => b.net_votes - a.net_votes)[0] ?? null;
  const userMsgs = room.messages.filter((m) => m.kind === 'user');
  const counts: Record<string, number> = {};
  userMsgs.forEach((m) => { counts[m.sender_name] = (counts[m.sender_name] ?? 0) + 1; });
  const mostActive = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const totalVotes = room.tracks.reduce((s, t) => s + Object.keys(t.voters).length, 0);
  const start = new Date(room.created_at).getTime();
  const mins = Math.max(1, Math.round((Date.now() - start) / 60000));
  const sessionLength = mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
  return {
    tracksPlayed,
    topVoted: topVoted && topVoted.net_votes > 0 ? topVoted : null,
    mostActiveChatter: mostActive ? { name: mostActive[0], count: mostActive[1] } : null,
    totalMessages: userMsgs.length,
    totalVotes,
    sessionLength,
  };
}

function renderSvg(room: RoomState, data: RecapData): string {
  const top = data.topVoted ? data.topVoted.title.slice(0, 40) : '—';
  const chatter = data.mostActiveChatter ? data.mostActiveChatter.name : '—';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#193d8f"/><stop offset="1" stop-color="#0a0a0a"/></linearGradient></defs>
  <rect width="600" height="400" fill="url(#g)"/>
  <text x="32" y="50" fill="#59a6ff" font-family="sans-serif" font-size="13" font-weight="bold" letter-spacing="3">SESSION RECAP · ${room.code}</text>
  <text x="32" y="92" fill="#fff" font-family="sans-serif" font-size="30" font-weight="800">${escapeXml(room.name || 'Teams Session')}</text>
  <text x="32" y="120" fill="#8ec6ff" font-family="sans-serif" font-size="14">${data.sessionLength}</text>
  <text x="32" y="185" fill="#fff" font-family="sans-serif" font-size="16">Tracks played: ${data.tracksPlayed.length}</text>
  <text x="32" y="215" fill="#fff" font-family="sans-serif" font-size="16">Messages: ${data.totalMessages}</text>
  <text x="32" y="245" fill="#fff" font-family="sans-serif" font-size="16">Votes: ${data.totalVotes}</text>
  <text x="32" y="305" fill="#59a6ff" font-family="sans-serif" font-size="12">TOP VOTED</text>
  <text x="32" y="328" fill="#fff" font-family="sans-serif" font-size="15" font-weight="bold">${escapeXml(top)}</text>
  <text x="32" y="360" fill="#59a6ff" font-family="sans-serif" font-size="12">MOST ACTIVE</text>
  <text x="300" y="360" fill="#fff" font-family="sans-serif" font-size="15" font-weight="bold">${escapeXml(chatter)}</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}

export function buildRecapFromRoom(room: RoomState) { return buildRecap(room); }
