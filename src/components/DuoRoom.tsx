import { useEffect, useMemo, useRef, useState } from 'react';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { api } from '../lib/api';
import { Player } from './Player';
import { Chat } from './Chat';
import { Members } from './Members';
import { AddTrack } from './AddTrack';
import { FloatingHearts, sendHeart } from './FloatingHearts';
import { CountdownPanel } from './CountdownPanel';
import { LoveNotesBoard, OurSongs, ScheduledSurprises } from './DuoFeatures';
import { RoomShell, RoomHeader, Panel, LoadingScreen, ErrorScreen } from './TeamsRoom';
import type { ScheduledMessage } from '../lib/types';
import { useRoomPage } from '../hooks/useRoomPage';

const DUO_CAP = 2;
type DuoTab = 'songs' | 'notes' | 'surprise' | 'countdown' | 'add';

export function DuoRoom({ roomId, code, myName }: { roomId: string; code: string; myName: string }) {
  const { room, members, sync, loading, error, channel, sendSync, denied, notifyChange, isHost } = useSyncEngine({
    roomId, code, myName, capacity: DUO_CAP,
  });
  const [tab, setTab] = useState<DuoTab>('songs');
  const [reveal, setReveal] = useState<ScheduledMessage | null>(null);
  const shownReveals = useRef<Set<string>>(new Set());
  useRoomPage();

  const currentTrack = useMemo(
    () => room?.tracks.find((t) => t.id === sync.currentTrackId) ?? null,
    [room?.tracks, sync.currentTrackId],
  );

  // auto-play first queued track when none playing
  useEffect(() => {
    if (sync.currentTrackId !== null || !room) return;
    const next = room.tracks.find((t) => t.status === 'queue');
    if (next) sendSync('track', 0, next.id);
  }, [sync.currentTrackId, room, sendSync]);

  // scheduled surprise delivery checker — each tab tracks which reveals it has
  // already shown itself, independent of the shared `delivered` flag. Using
  // only `delivered` meant whichever partner's tab happened to mark it first
  // would show the reveal, and the other partner's tab — seeing `delivered:
  // true` on its next refresh — would never show it at all.
  useEffect(() => {
    if (!room) return;
    const interval = setInterval(async () => {
      const due = room.scheduled.find(
        (s) => new Date(s.reveal_at).getTime() <= Date.now() && !shownReveals.current.has(s.id),
      );
      if (due) {
        shownReveals.current.add(due.id);
        setReveal(due);
        if (!due.delivered) {
          await api.markScheduledDelivered(roomId, code, due.id);
          notifyChange();
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [room, roomId, code, notifyChange]);

  if (loading) return <RoomShell><LoadingScreen /></RoomShell>;
  if (error || !room) return <RoomShell><ErrorScreen message={error ?? 'Room not found'} /></RoomShell>;
  if (denied) return <RoomShell><RoomFullScreen /></RoomShell>;

  const waiting = members.length < DUO_CAP;
  const onPlayStateRequest = (playing: boolean) => sendSync(playing ? 'play' : 'pause', currentTrack ? livePos() : 0);
  const onSeekRequest = (ms: number) => sendSync('seek', ms);
  const onEnded = () => sendSync('track', 0, null);
  const onPlayTrack = (id: string) => sendSync('track', 0, id);
  const onTransferHost = async (name: string) => { await api.transferHost(roomId, code, name); notifyChange(); };

  function livePos(): number {
    if (currentTrack?.source === 'audio') {
      const el = document.querySelector('audio');
      if (el) return el.currentTime * 1000;
    }
    return sync.positionMs;
  }

  const tabs: { id: DuoTab; label: string }[] = [
    { id: 'songs', label: 'Our Songs' },
    { id: 'notes', label: 'Love Notes' },
    { id: 'surprise', label: 'Surprise' },
    { id: 'countdown', label: 'Countdown' },
    { id: 'add', label: 'Add Track' },
  ];

  return (
    <RoomShell>
      <div className="min-h-screen bg-gradient-to-br from-duo-950 via-[#1a0a10] to-black text-white relative">
        <FloatingHearts channelId={roomId} />
        <RoomHeader room={room} members={members} accent="duo" />
{/* A quiet dedication — Duo only */}
<div className="text-center pt-5 pb-1 px-4 animate-fade-in">
  <p className="font-display italic text-[13px] sm:text-sm text-duo-200/70 tracking-wide">
    <span className="text-duo-400/80">❈</span>
    <span className="mx-2">This little corner of the internet is dedicated to you, Pooja</span>
    <span className="text-duo-400/80">❈</span>
  </p>
</div>
        {/* Waiting banner */}
        {waiting && (
          <div className="max-w-2xl mx-auto px-4 pt-6">
            <div className="rounded-2xl bg-duo-900/30 border border-duo-700/30 px-5 py-4 flex items-center gap-4 animate-fade-in">
              <div className="relative w-12 h-12 shrink-0">
                <span className="absolute inset-0 rounded-full bg-duo-500/30 animate-pulse_slow" />
                <span className="absolute inset-1.5 rounded-full bg-duo-500/50 animate-pulse_slow" style={{ animationDelay: '0.3s' }} />
                <span className="absolute inset-3 rounded-full bg-duo-400 flex items-center justify-center text-lg">❤</span>
              </div>
              <div>
                <p className="text-duo-100 font-semibold">Waiting for your partner…</p>
                <p className="text-duo-200/60 text-xs mt-0.5">Share the code <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/#/r/duo/${room.code}`)} className="font-mono text-gold-300 underline">{room.code}</button> with the one you love.</p>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto px-4 pb-24 pt-6 space-y-4">
          {/* Player */}
          <div className="rounded-3xl overflow-hidden border border-duo-800/30 shadow-2xl shadow-duo-950/40">
            <Player sync={sync} currentTrack={currentTrack} onPlayStateRequest={onPlayStateRequest} onSeekRequest={onSeekRequest} onEnded={onEnded} canControl={isHost} />
          </div>

          {/* Heart reaction bar */}
          <div className="flex items-center justify-center gap-2 py-1">
            {['❤️', '💕', '🌹', '✨', '😘'].map((e) => (
              <button
                key={e}
                onClick={() => sendHeart(channel, myName, e)}
                className="w-11 h-11 rounded-full bg-duo-900/40 border border-duo-700/30 hover:bg-duo-800/50 hover:scale-110 transition-all text-xl flex items-center justify-center focus-visible:ring-2 focus-visible:ring-duo-400"
                aria-label={`Send ${e}`}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Members */}
          <Panel title="Together" badge={`${members.length}/${DUO_CAP}`}>
            <div className="p-4">
              <Members members={members} hostName={room.host_name} djs={[]} myName={myName} accent="duo" capacity={DUO_CAP} isHost={isHost} onTransferHost={onTransferHost} />
            </div>
          </Panel>

          {/* Duo feature tabs */}
          <Panel title="Your Space">
            <div className="flex overflow-x-auto no-scrollbar border-b border-white/10">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    tab === t.id ? 'border-duo-500 text-duo-200' : 'border-transparent text-white/50 hover:text-white/80'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-4">
              {tab === 'songs' && <OurSongs roomId={roomId} code={code} myName={myName} memories={room.memories} tracks={room.tracks} onPlayTrack={onPlayTrack} onChanged={notifyChange} />}
              {tab === 'notes' && <LoveNotesBoard roomId={roomId} code={code} myName={myName} notes={room.love_notes} onChanged={notifyChange} />}
              {tab === 'surprise' && <ScheduledSurprises roomId={roomId} code={code} myName={myName} scheduled={room.scheduled} onChanged={notifyChange} />}
              {tab === 'countdown' && <CountdownPanel roomId={roomId} code={code} countdowns={room.countdowns} onChanged={notifyChange} />}
              {tab === 'add' && <AddTrack roomId={roomId} code={code} myName={myName} portal="duo" onAdded={notifyChange} />}
            </div>
          </Panel>

          {/* Chat */}
          <Panel title="Between Us" className="h-[320px]">
            <Chat roomId={roomId} code={code} myName={myName} messages={room.messages} accent="duo" channel={channel} onChanged={notifyChange} />
          </Panel>
        </div>

        {/* Surprise reveal modal */}
        {reveal && <SurpriseReveal surprise={reveal} onClose={() => setReveal(null)} />}
      </div>
    </RoomShell>
  );
}

function RoomFullScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-duo-950 via-[#1a0a10] to-black text-white px-4">
      <div className="max-w-sm w-full text-center animate-fade-in-up">
        <div className="text-4xl mb-4">💔</div>
        <h2 className="text-xl font-display font-bold text-duo-100 mb-2">This room is already full</h2>
        <p className="text-duo-200/60 text-sm mb-6">
          A Duo room only has space for two. It looks like both spots here are already taken.
        </p>
        <a
          href="/"
          className="inline-block px-5 py-2.5 rounded-xl bg-duo-700 hover:bg-duo-600 text-white text-sm font-semibold transition-colors"
        >
          Start your own room
        </a>
      </div>
    </div>
  );
}

function SurpriseReveal({ surprise, onClose }: { surprise: ScheduledMessage; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" role="dialog" aria-label="Surprise message">
      <div className="max-w-sm w-full bg-gradient-to-br from-duo-900 to-black rounded-3xl border border-gold-500/30 p-6 text-center animate-scale-in">
        <div className="text-4xl mb-3">🎁</div>
        <p className="text-gold-300 text-xs uppercase tracking-widest mb-2">A surprise from {surprise.author}</p>
        <p className="text-white text-lg leading-relaxed mb-4">{surprise.body}</p>
        {surprise.kind === 'track' && surprise.track_url && (
          <button onClick={onClose} className="block w-full mb-3 py-2.5 rounded-xl bg-duo-700 hover:bg-duo-600 text-white text-sm font-semibold transition-colors">
            Play the surprise track
          </button>
        )}
        <button onClick={onClose} className="text-sm text-white/50 hover:text-white/80 transition-colors">Close</button>
      </div>
    </div>
  );
}

// silence unused import in some builds
