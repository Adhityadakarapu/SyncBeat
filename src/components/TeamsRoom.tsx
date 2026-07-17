import { useEffect, useMemo, useState } from 'react';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { api } from '../lib/api';
import { Player } from './Player';
import { Queue } from './Queue';
import { Chat } from './Chat';
import { Members } from './Members';
import { AddTrack } from './AddTrack';
import { SessionRecap } from './SessionRecap';
import { useRoomPage } from '../hooks/useRoomPage';

export function TeamsRoom({ roomId, code, myName }: { roomId: string; code: string; myName: string }) {
  const { room, members, sync, loading, error, isHost, isDj, refresh, sendSync, channel, notifyChange } = useSyncEngine({
    roomId, code, myName,
  });
  const [showRecap, setShowRecap] = useState(false);
  const [tab, setTab] = useState<'queue' | 'add'>('queue');
  useRoomPage();

  const currentTrack = useMemo(
    () => room?.tracks.find((t) => t.id === sync.currentTrackId) ?? null,
    [room?.tracks, sync.currentTrackId],
  );

  // auto-play next top-voted track when current ends
  useEffect(() => {
    if (sync.currentTrackId !== null) return;
    if (!room) return;
    const next = [...room.tracks]
      .filter((t) => t.status === 'queue')
      .sort((a, b) => b.net_votes - a.net_votes)[0];
    if (next) sendSync('track', 0, next.id);
  }, [sync.currentTrackId, room, sendSync]);

  if (loading) return <RoomShell><LoadingScreen /></RoomShell>;
  if (error || !room) return <RoomShell><ErrorScreen message={error ?? 'Room not found'} /></RoomShell>;

  const onPlayStateRequest = (playing: boolean) => sendSync(playing ? 'play' : 'pause', currentTrack ? livePos() : 0);
  const onSeekRequest = (ms: number) => sendSync('seek', ms);
  const onEnded = () => sendSync('track', 0, null);
  const onPlayTrack = (t: { id: string }) => sendSync('track', 0, t.id);
  const onToggleDj = async (name: string, promote: boolean) => { await api.setDj(roomId, code, name, promote); refresh(); notifyChange(); };
  const onTransferHost = async (name: string) => { await api.transferHost(roomId, code, name); refresh(); notifyChange(); };

  function livePos(): number {
    if (!currentTrack) return 0;
    if (currentTrack.source === 'audio') {
      const el = document.querySelector('audio');
      if (el) return el.currentTime * 1000;
    }
    return sync.positionMs;
  }

  return (
    <RoomShell>
      <div className="min-h-screen bg-gradient-to-br from-teams-950 via-black to-black text-white">
        <RoomHeader room={room} members={members} accent="teams" onRecap={() => setShowRecap(true)} />
        <div className="max-w-7xl mx-auto px-4 pb-24 grid lg:grid-cols-[1fr_360px] gap-4">
          {/* left: player + chat */}
          <div className="space-y-4">
            <Player sync={sync} currentTrack={currentTrack} onPlayStateRequest={onPlayStateRequest} onSeekRequest={onSeekRequest} onEnded={onEnded} canControl={isHost || isDj} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Panel title="Members" badge={`${members.length} online`}>
                <Members members={members} hostName={room.host_name} djs={room.djs} myName={myName} accent="teams" onToggleDj={onToggleDj} onTransferHost={onTransferHost} isHost={isHost} />
              </Panel>
              <Panel title="Now Playing" badge={isDj ? 'DJ mode' : undefined}>
                {currentTrack ? (
                  <div className="text-sm text-white/80 space-y-1">
                    <p className="font-semibold truncate">{currentTrack.title}</p>
                    <p className="text-white/50 text-xs">added by {currentTrack.added_by}</p>
                    {currentTrack.mood_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {currentTrack.mood_tags.map((t) => <span key={t} className="text-[10px] bg-teams-500/20 text-teams-200 px-2 py-0.5 rounded-full">{t}</span>)}
                        {currentTrack.language_tags.map((t) => <span key={t} className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full">{t}</span>)}
                      </div>
                    )}
                  </div>
                ) : <p className="text-white/40 text-sm">Nothing playing.</p>}
              </Panel>
            </div>
            <Panel title="Chat" className="h-[340px]">
              <Chat roomId={roomId} code={code} myName={myName} messages={room.messages} accent="teams" channel={channel} onChanged={notifyChange} />
            </Panel>
          </div>

          {/* right: queue + add track */}
          <div className="space-y-4">
            <Panel title="Queue" className="h-[420px]">
              <Queue roomId={roomId} code={code} myName={myName} tracks={room.tracks} isHost={isHost} isDj={isDj} onPlayTrack={onPlayTrack} onChanged={notifyChange} />
            </Panel>
            <Panel title={tab === 'queue' ? 'Add a track' : 'Add a track'}>
              <div className="flex bg-white/5 rounded-full p-0.5 mb-3">
                <button onClick={() => setTab('queue')} className={`flex-1 text-xs py-1.5 rounded-full transition-colors ${tab === 'queue' ? 'bg-teams-600 text-white' : 'text-white/60'}`}>Queue</button>
                <button onClick={() => setTab('add')} className={`flex-1 text-xs py-1.5 rounded-full transition-colors ${tab === 'add' ? 'bg-teams-600 text-white' : 'text-white/60'}`}>Add track</button>
              </div>
              {tab === 'add' ? (
                <AddTrack roomId={roomId} code={code} myName={myName} portal="teams" onAdded={() => { setTab('queue'); notifyChange(); }} />
              ) : (
                <p className="text-xs text-white/40">Vote on tracks above to decide what plays next. {(isHost || isDj) && 'As host/DJ you can play or skip any track.'}</p>
              )}
            </Panel>
          </div>
        </div>
        {showRecap && <SessionRecap room={room} onClose={() => setShowRecap(false)} />}
      </div>
    </RoomShell>
  );
}

export function RoomShell({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}

export function RoomHeader({ room, members, accent, onRecap }: { room: { code: string; portal: string; name: string | null; host_name: string }; members: { name: string }[]; accent: 'teams' | 'duo'; onRecap?: () => void }) {
  const ring = accent === 'teams' ? 'text-teams-300' : 'text-duo-300';
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/30 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <a href="/#/" className={`text-lg font-extrabold font-display ${ring} shrink-0`}>SyncBeat</a>
          <span className="text-white/30">/</span>
          <span className="text-sm text-white/70 truncate">{room.name || (room.portal === 'teams' ? 'Teams Room' : 'Duo Room')}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-white/70 tabular-nums">{members.length}</span>
          </div>
          <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/#/r/${room.portal}/${room.code}`)} className="text-xs bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5 text-white transition-colors" title="Copy join link">
            {room.code}
          </button>
          {onRecap && <button onClick={onRecap} className="text-xs bg-teams-600 hover:bg-teams-500 rounded-full px-3 py-1.5 text-white transition-colors">Recap</button>}
        </div>
      </div>
    </header>
  );
}

export function Panel({ title, badge, className, children }: { title: string; badge?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl bg-white/5 border border-white/10 flex flex-col ${className ?? ''}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {badge && <span className="text-[10px] uppercase tracking-wider text-white/50 bg-white/5 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </section>
  );
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-teams-500/30 border-t-teams-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-white/60 text-sm">Loading room…</p>
      </div>
    </div>
  );
}

export function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-6">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-red-400 text-2xl">!</span>
        </div>
        <p className="text-white font-semibold mb-1">Couldn't enter the room</p>
        <p className="text-white/50 text-sm mb-4">{message}</p>
        <a href="/#/" className="inline-block bg-white/10 hover:bg-white/20 rounded-lg px-4 py-2 text-white text-sm transition-colors">Back to home</a>
      </div>
    </div>
  );
}
