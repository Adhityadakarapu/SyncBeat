import { useEffect, useMemo, useState } from 'react';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { api } from '../lib/api';
import { Player } from './Player';
import { Queue } from './Queue';
import { Chat } from './Chat';
import { Members } from './Members';
import { AddTrack } from './AddTrack';
import { SavedSongs } from './SavedSongs';
import { SessionRecap } from './SessionRecap';
import { SkipPoll } from './SkipPoll';
import { FloatingHearts, sendHeart } from './FloatingHearts';
import { ThemePicker } from './ThemePicker';
import { getThemeDef } from '../lib/themes';
import { startAmbient, stopAmbient } from '../lib/ambient';
import { useRoomPage } from '../hooks/useRoomPage';

export function TeamsRoom({ roomId, code, myName, onLogoClick }: { roomId: string; code: string; myName: string; onLogoClick?: () => void }) {
  const { room, members, sync, loading, error, isHost, isDj, refresh, sendSync, channel, notifyChange } = useSyncEngine({
    roomId, code, myName,
  });
  const [showRecap, setShowRecap] = useState(false);
  const [tab, setTab] = useState<'queue' | 'saved' | 'add'>('queue');
  const [ambientOn, setAmbientOn] = useState(false);
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

  // synthesized ambient pad, matching the room's current theme — local to
  // this listener only, not synced (each person can mute it for themselves)
  useEffect(() => {
    if (!ambientOn || !room) {
      stopAmbient();
      return;
    }
    startAmbient(room.theme ?? 'classic');
    return () => stopAmbient();
    // Intentionally depends on room.theme only, not the whole `room` object —
    // room updates on every playback/queue/chat change via realtime, and we
    // only want the ambient pad to restart when the theme itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambientOn, room?.theme]);

  if (loading) return <RoomShell><LoadingScreen /></RoomShell>;
  if (error || !room) return <RoomShell><ErrorScreen message={error ?? 'Room not found'} /></RoomShell>;

  const onPlayStateRequest = (playing: boolean) => sendSync(playing ? 'play' : 'pause', currentTrack ? livePos() : 0);
  const onSeekRequest = (ms: number) => sendSync('seek', ms);
  const onEnded = () => sendSync('track', 0, null);
  const onPlayTrack = (t: { id: string }) => sendSync('track', 0, t.id);
  const onToggleDj = async (name: string, promote: boolean) => { await api.setDj(roomId, code, name, promote); refresh(); notifyChange(); };
  const onTransferHost = async (name: string) => { await api.transferHost(roomId, code, name); refresh(); notifyChange(); };
  const onThemeChange = async (theme: string) => { await api.setRoomTheme(roomId, code, myName, theme); notifyChange(); };

  function livePos(): number {
    if (!currentTrack) return 0;
    if (currentTrack.source === 'audio') {
      const el = document.querySelector('audio');
      if (el) return el.currentTime * 1000;
    }
    return sync.positionMs;
  }

  const themeDef = getThemeDef(room.theme);

  return (
    <RoomShell>
      <div
        className={`min-h-screen text-white ${themeDef.gradient ? '' : 'bg-gradient-to-br from-teams-950 via-black to-black'}`}
        style={themeDef.gradient ? { background: themeDef.gradient } : undefined}
      >
        <FloatingHearts channelId={roomId} showName />
        <RoomHeader
          room={room} members={members} accent="teams" onRecap={() => setShowRecap(true)} onLogoClick={onLogoClick}
          isHost={isHost} onThemeChange={onThemeChange}
          ambientOn={ambientOn} onToggleAmbient={() => setAmbientOn((v) => !v)}
        />
        <div className="max-w-7xl mx-auto px-4 pb-24 grid lg:grid-cols-[1fr_360px] gap-4">
          {/* left: player + chat */}
          <div className="space-y-4">
            <Player sync={sync} currentTrack={currentTrack} onPlayStateRequest={onPlayStateRequest} onSeekRequest={onSeekRequest} onEnded={onEnded} canControl={isHost || isDj} />
            <div className="flex items-center justify-center gap-2 py-1">
              {['🔥', '🎉', '👏', '😂', '🙌', '💯'].map((e) => (
                <button
                  key={e}
                  onClick={() => sendHeart(channel, myName, e)}
                  className="w-10 h-10 rounded-full bg-teams-900/40 border border-teams-700/30 hover:bg-teams-800/50 hover:scale-110 transition-all text-lg flex items-center justify-center focus-visible:ring-2 focus-visible:ring-teams-400"
                  aria-label={`Send ${e} reaction`}
                >
                  {e}
                </button>
              ))}
            </div>
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
                    <div className="pt-2">
                      <SkipPoll
                        roomId={roomId}
                        code={code}
                        myName={myName}
                        track={currentTrack}
                        skipVotes={room.skip_votes}
                        skipTarget={room.skip_target}
                        memberCount={members.length}
                        isHost={isHost}
                        isDj={isDj}
                        onChanged={notifyChange}
                      />
                    </div>
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
            <Panel title="Add a track">
              <div className="flex bg-white/5 rounded-full p-0.5 mb-3">
                <button onClick={() => setTab('queue')} className={`flex-1 text-xs py-1.5 rounded-full transition-colors ${tab === 'queue' ? 'bg-teams-600 text-white' : 'text-white/60'}`}>Queue</button>
                <button onClick={() => setTab('saved')} className={`flex-1 text-xs py-1.5 rounded-full transition-colors ${tab === 'saved' ? 'bg-teams-600 text-white' : 'text-white/60'}`}>Saved Songs</button>
                <button onClick={() => setTab('add')} className={`flex-1 text-xs py-1.5 rounded-full transition-colors ${tab === 'add' ? 'bg-teams-600 text-white' : 'text-white/60'}`}>Add track</button>
              </div>
              {tab === 'add' && (
                <AddTrack roomId={roomId} code={code} myName={myName} portal="teams" onAdded={() => { setTab('queue'); notifyChange(); }} />
              )}
              {tab === 'saved' && (
                <SavedSongs roomId={roomId} code={code} myName={myName} portal="teams" onAdded={() => { setTab('queue'); notifyChange(); }} />
              )}
              {tab === 'queue' && (
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

export function LeaveRoomConfirm({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Confirm leaving room">
      <div className="max-w-sm w-full bg-[#141414] rounded-3xl border border-white/10 p-6 text-center animate-scale-in">
        <div className="text-3xl mb-3">🚪</div>
        <h2 className="text-white text-lg font-bold mb-2">Leave this room?</h2>
        <p className="text-white/60 text-sm mb-5">You'll stop syncing with everyone here. You can rejoin later with the room code.</p>
        <div className="flex gap-3">
          <button onClick={onStay} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors">Stay</button>
          <button onClick={onLeave} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">Leave room</button>
        </div>
      </div>
    </div>
  );
}

// Copies text to the clipboard, falling back to a hidden-textarea +
// execCommand trick for insecure contexts / browsers where the async
// Clipboard API is unavailable or blocked. Returns whether it succeeded,
// so callers can show accurate copy confirmation instead of assuming success.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy fallback below
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function RoomHeader({
  room, members, accent, onRecap, onLogoClick, isHost, onThemeChange, ambientOn, onToggleAmbient,
}: {
  room: { code: string; portal: string; name: string | null; host_name: string; theme?: string };
  members: { name: string }[];
  accent: 'teams' | 'duo';
  onRecap?: () => void;
  onLogoClick?: () => void;
  isHost?: boolean;
  onThemeChange?: (theme: string) => void;
  ambientOn?: boolean;
  onToggleAmbient?: () => void;
}) {
  const ring = accent === 'teams' ? 'text-teams-300' : 'text-duo-300';
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(`${window.location.origin}/#/r/${room.portal}/${room.code}`);
    setCopied(ok);
    setCopyFailed(!ok);
    window.setTimeout(() => { setCopied(false); setCopyFailed(false); }, 2000);
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/30 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {onLogoClick ? (
            <button onClick={onLogoClick} className={`text-lg font-extrabold font-display ${ring} shrink-0`}>SyncBeat</button>
          ) : (
            <a href="/#/" className={`text-lg font-extrabold font-display ${ring} shrink-0`}>SyncBeat</a>
          )}
          <span className="text-white/30">/</span>
          <span className="text-sm text-white/70 truncate">{room.name || (room.portal === 'teams' ? 'Teams Room' : 'Duo Room')}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-white/70 tabular-nums">{members.length}</span>
          </div>
          <div className="relative">
            <button
              onClick={handleCopy}
              className={`text-xs rounded-full px-3 py-1.5 text-white transition-colors ${copied ? 'bg-green-600' : 'bg-white/10 hover:bg-white/20'}`}
              title="Copy join link"
              aria-live="polite"
            >
              {copied ? 'Copied ✓' : room.code}
            </button>
            {copyFailed && (
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] text-red-300 bg-black/80 rounded px-2 py-1 whitespace-nowrap">
                Couldn't copy — select and copy manually
              </span>
            )}
          </div>
          {onToggleAmbient && (
            <button
              onClick={onToggleAmbient}
              className={`text-xs rounded-full px-3 py-1.5 transition-colors ${ambientOn ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/10 text-white/60'}`}
              title={ambientOn ? 'Turn off ambient sound' : 'Turn on ambient sound (synthesized, matches the room theme)'}
              aria-pressed={ambientOn}
            >
              {ambientOn ? '🔊' : '🔈'}
            </button>
          )}
          {onThemeChange && (
            <ThemePicker current={room.theme ?? 'classic'} isHost={Boolean(isHost)} onChange={onThemeChange} />
          )}
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
