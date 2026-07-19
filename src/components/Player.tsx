import { useEffect, useRef, useState } from 'react';
import { loadYouTubeApi, waitForPlayerReady } from '../lib/youtube';
import { calcPositionMs, formatTime } from '../lib/utils';
import { AudioBars, DecorativeBars } from './Visualizer';
import type { SyncState, Track } from '../lib/types';

interface PlayerProps {
  sync: SyncState;
  currentTrack: Track | null;
  onPlayStateRequest: (playing: boolean) => void;
  onSeekRequest: (ms: number) => void;
  onEnded: () => void;
  compact?: boolean;
  canControl?: boolean;
}

const DRIFT_THRESHOLD = 300;

export function Player({ sync, currentTrack, onPlayStateRequest, onSeekRequest, onEnded, compact, canControl = true }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytRef = useRef<any>(null);
  const ytDivRef = useRef<HTMLDivElement | null>(null);
  const [ytReady, setYtReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [displayPos, setDisplayPos] = useState(0);
  const [userDragging, setUserDragging] = useState(false);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  const trackRef = useRef(currentTrack);
  trackRef.current = currentTrack;
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const readyRef = useRef(ytReady);
  readyRef.current = ytReady;

  // server position ticker
  useEffect(() => {
    let raf: number;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 200) {
        last = t;
        if (!userDragging) {
          const s = syncRef.current;
          const p = calcPositionMs(s.positionMs, s.isPlaying, new Date(s.updatedAt).toISOString());
          setDisplayPos(p);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [userDragging]);

  // ---- YouTube lifecycle ----
  useEffect(() => {
    if (!currentTrack || currentTrack.source !== 'youtube') return;
    let cancelled = false;
    setLoadingTrack(true);
    loadYouTubeApi().then(async () => {
      await waitForPlayerReady();
      if (cancelled) return;
      if (ytRef.current) {
        try {
          ytRef.current.loadVideoById(currentTrack.youtube_id);
        } catch {
          /* ignore */
        }
        return;
      }
      ytRef.current = new window.YT.Player(ytDivRef.current!, {
        videoId: currentTrack.youtube_id,
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            setYtReady(true);
            setLoadingTrack(false);
          },
          onStateChange: (e: any) => {
            if (e.data === 0) onEnded();
            if (e.data === 1) setLoadingTrack(false);
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, currentTrack?.source, currentTrack?.youtube_id]);

  // when track changes away from youtube, destroy YT
  useEffect(() => {
    if (currentTrack?.source !== 'youtube' && ytRef.current) {
      try {
        ytRef.current.destroy();
      } catch {
        /* ignore */
      }
      ytRef.current = null;
      setYtReady(false);
    }
  }, [currentTrack?.source]);

  // ---- Drift correction loop ----
  useEffect(() => {
    let raf: number;
    let last = 0;
    const correct = (t: number) => {
      if (t - last > 1000) {
        last = t;
        correctDrift();
      }
      raf = requestAnimationFrame(correct);
    };
    raf = requestAnimationFrame(correct);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, ytReady]);

  function correctDrift() {
    const track = trackRef.current;
    const s = syncRef.current;
    if (!track) return;
    const serverPos = calcPositionMs(s.positionMs, s.isPlaying, new Date(s.updatedAt).toISOString());

    if (track.source === 'audio') {
      const el = audioRef.current;
      if (!el || !isFinite(el.duration)) return;
      const localPos = el.currentTime * 1000;
      const drift = Math.abs(localPos - serverPos);
      if (drift > DRIFT_THRESHOLD) {
        el.currentTime = serverPos / 1000;
      }
      if (s.isPlaying && el.paused) {
        el.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
      } else if (!s.isPlaying && !el.paused) {
        el.pause();
      }
    } else if (track.source === 'youtube') {
      const p = ytRef.current;
      if (!p || !readyRef.current || typeof p.getCurrentTime !== 'function') return;
      try {
        const localPos = (p.getCurrentTime() ?? 0) * 1000;
        const drift = Math.abs(localPos - serverPos);
        if (drift > DRIFT_THRESHOLD) {
          p.seekTo(serverPos / 1000, true);
        }
        const state = p.getPlayerState?.();
        // 1=playing, 2=paused, 0=ended, -1=unstarted
        if (s.isPlaying && state !== 1) {
          p.playVideo();
          // YouTube's iframe API doesn't return a promise; check shortly after
          // whether it actually started — if not, the browser silently blocked
          // it, and the listener needs to tap once to unlock playback.
          window.setTimeout(() => {
            const nowState = p.getPlayerState?.();
            setNeedsGesture(nowState !== 1);
          }, 800);
        } else if (!s.isPlaying && state === 1) {
          p.pauseVideo();
        } else if (s.isPlaying && state === 1) {
          setNeedsGesture(false);
        }
      } catch {
        /* ignore */
      }
    }
  }

  // ---- HTML5 audio events ----
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onLoaded = () => setDuration(el.duration * 1000);
    const onEnded2 = () => onEnded();
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('ended', onEnded2);
    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('ended', onEnded2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, currentTrack?.source]);

  const dur = duration || (currentTrack?.source === 'youtube' ? 0 : 0);
  const seek = (ms: number) => {
    setUserDragging(false);
    onSeekRequest(ms);
    const track = trackRef.current;
    if (track?.source === 'audio' && audioRef.current) {
      audioRef.current.currentTime = ms / 1000;
    } else if (track?.source === 'youtube' && ytRef.current) {
      ytRef.current.seekTo(ms / 1000, true);
    }
  };

  // A direct click always satisfies the browser's autoplay-gesture
  // requirement, unlike a play() call triggered from a realtime event.
  const enablePlayback = () => {
    const track = trackRef.current;
    if (track?.source === 'audio' && audioRef.current) {
      audioRef.current.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
    } else if (track?.source === 'youtube' && ytRef.current) {
      try {
        ytRef.current.playVideo();
        setNeedsGesture(false);
      } catch {
        /* ignore */
      }
    }
  };

  if (!currentTrack) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-center ${compact ? 'p-4' : 'p-8'}`}>
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/60">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <p className="text-white/70 text-sm">No track loaded. Add a song to start listening.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      {/* media surface */}
      <div className="relative">
        {needsGesture && sync.isPlaying && (
          <button
            onClick={enablePlayback}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/80 backdrop-blur-sm text-white animate-fade-in"
          >
            <span className="text-3xl">🔊</span>
            <span className="text-sm font-semibold">Tap to join synced playback</span>
            <span className="text-xs text-white/50">Your browser needs one tap to allow audio</span>
          </button>
        )}
        {currentTrack.source === 'audio' ? (
          <div className="aspect-video w-full bg-gradient-to-br from-black/40 to-black/10 flex items-center justify-center">
            <audio ref={audioRef} src={currentTrack.url} preload="auto" className="hidden" crossOrigin="anonymous" />
            <AudioBars audioRef={audioRef} playing={sync.isPlaying} />
          </div>
        ) : (
          <div className="aspect-video w-full bg-black relative">
            <div ref={ytDivRef} className="absolute inset-0 w-full h-full" />
            {loadingTrack && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>
      {currentTrack.source === 'youtube' && (
        <div className="px-3 py-1.5 bg-black/30 border-t border-white/5">
          <DecorativeBars playing={sync.isPlaying} />
        </div>
      )}

      {/* controls */}
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => canControl && onPlayStateRequest(!sync.isPlaying)}
            disabled={!canControl}
            className={`w-11 h-11 rounded-full bg-white text-black flex items-center justify-center transition-transform focus-visible:ring-white shrink-0 ${canControl ? 'hover:scale-105' : 'opacity-40 cursor-not-allowed'}`}
            aria-label={sync.isPlaying ? 'Pause' : 'Play'}
            title={canControl ? undefined : 'Only the DJ can control playback'}
          >
            {sync.isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
            <p className="text-xs text-white/50 truncate">
              added by {currentTrack.added_by}
              {!canControl && <span className="text-white/30"> · DJ controls playback</span>}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] tabular-nums text-white/50 w-10 text-right">{formatTime(displayPos)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(dur, 1)}
            value={Math.min(displayPos, dur || displayPos)}
            onChange={(e) => {
              if (!canControl) return;
              setUserDragging(true);
              setDisplayPos(Number(e.target.value));
            }}
            onPointerUp={(e) => canControl && seek(Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => {
              if (!canControl) return;
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') seek(Number((e.target as HTMLInputElement).value));
            }}
            disabled={!canControl}
            className={`flex-1 accent-white h-1.5 ${canControl ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
            aria-label="Seek"
          />
          <span className="text-[11px] tabular-nums text-white/50 w-10">{formatTime(dur)}</span>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
  );
}
function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
  );
}
