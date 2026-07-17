import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { calcPositionMs } from '../lib/utils';
import type { Broadcaster } from '../components/Chat';
import type { Member, RoomState, SyncState, SyncType } from '../lib/types';

export type { SyncState };

export interface SyncEngine {
  room: RoomState | null;
  members: Member[];
  sync: SyncState;
  loading: boolean;
  error: string | null;
  myName: string;
  isHost: boolean;
  isDj: boolean;
  denied: boolean;
  refresh: () => Promise<void>;
  sendSync: (type: SyncType, positionMs?: number, trackId?: string | null) => Promise<void>;
  addSystemMessage: (body: string) => Promise<void>;
  notifyChange: () => void;
  channel: Broadcaster | null;
}

interface EngineOpts {
  roomId: string;
  code: string;
  myName: string;
  onMembersChange?: (count: number) => void;
  /**
   * Hard cap on concurrent presence members (e.g. 2 for a Duo room). When the
   * live presence count exceeds this, everyone except the earliest `capacity`
   * joiners (by joinedAt) is untracked from the channel and flagged via
   * `denied`, so a room can't silently host more people than intended.
   */
  capacity?: number;
}

export function useSyncEngine(opts: EngineOpts): SyncEngine {
  const { roomId, code, myName, onMembersChange, capacity } = opts;
  const [room, setRoom] = useState<RoomState | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [sync, setSync] = useState<SyncState>({
    isPlaying: false,
    positionMs: 0,
    currentTrackId: null,
    updatedAt: Date.now(),
  });

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const roomRef = useRef<RoomState | null>(null);
  const myNameRef = useRef(myName);
  const onMembersRef = useRef(onMembersChange);
  const capacityRef = useRef(capacity);
  onMembersRef.current = onMembersChange;
  myNameRef.current = myName;
  roomRef.current = room;
  capacityRef.current = capacity;

  const refresh = useCallback(async () => {
    const { data, error: err } = await api.getRoomState(roomId, code);
    if (err || !data) {
      setError(err ?? 'Failed to load room');
      setLoading(false);
      return;
    }
    setRoom(data as RoomState);
    setSync({
      isPlaying: data.is_playing,
      positionMs: data.position_ms,
      currentTrackId: data.current_track_id,
      updatedAt: new Date(data.updated_at).getTime(),
    });
    setLoading(false);
    setError(null);
  }, [roomId, code]);

  // initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // realtime channel
  useEffect(() => {
    if (!myName) return;
    const channel = supabase.channel(`room:${roomId}:${code}`, {
      config: { presence: { key: myName }, broadcast: { self: false } },
    });

    channelRef.current = channel;

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const r = payload.new as RoomState;
        setRoom((prev) => (prev ? { ...prev, ...r } : prev));
        setSync({
          isPlaying: r.is_playing,
          positionMs: r.position_ms,
          currentTrackId: r.current_track_id,
          updatedAt: new Date(r.updated_at).getTime(),
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracks', filter: `room_id=eq.${roomId}` }, () => {
        refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, () => {
        refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'track_memories', filter: `room_id=eq.${roomId}` }, () => {
        refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'love_notes', filter: `room_id=eq.${roomId}` }, () => {
        refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_messages', filter: `room_id=eq.${roomId}` }, () => {
        refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'countdowns', filter: `room_id=eq.${roomId}` }, () => {
        refresh();
      })
      .on('broadcast', { event: 'db-changed' }, () => {
        console.log('[SyncBeat] db-changed broadcast received — refreshing');
        refresh();
      })
      .on('broadcast', { event: 'typing' }, (msg) => {
        window.dispatchEvent(new CustomEvent('sb:typing', { detail: msg.payload }));
      })
      .on('broadcast', { event: 'heart' }, (msg) => {
        window.dispatchEvent(new CustomEvent('sb:heart', { detail: msg.payload }));
      })
      .on('broadcast', { event: 'recap' }, (msg) => {
        window.dispatchEvent(new CustomEvent('sb:recap', { detail: msg.payload }));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const list: Member[] = Object.keys(state).map((name) => {
          const meta = (state[name][0] as any) ?? {};
          return { name, isHost: meta.isHost === true, joinedAt: meta.joinedAt ?? Date.now() };
        });
        list.sort((a, b) => a.joinedAt - b.joinedAt);

        const cap = capacityRef.current;
        if (cap && list.length > cap) {
          const allowed = list.slice(0, cap);
          const iAmAllowed = allowed.some((m) => m.name === myNameRef.current);
          if (!iAmAllowed) {
            // This client is the overflow joiner: drop our own presence and
            // flag `denied` so the UI can show a "room is full" state instead
            // of the live room.
            setDenied(true);
            setMembers(allowed);
            onMembersRef.current?.(allowed.length);
            channel.untrack().catch(() => {});
            return;
          }
        }

        setDenied(false);
        setMembers(list);
        onMembersRef.current?.(list.length);
      })
      .subscribe(async (status, err) => {
        console.log('[SyncBeat] realtime channel status:', status, err ?? '');
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: myName, joinedAt: Date.now() });
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setError(`Realtime connection issue: ${status}${err ? ` — ${err.message}` : ''}`);
        }
      });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, code, myName]);

  const sendSync = useCallback(
    async (type: SyncType, positionMs: number = 0, trackId: string | null = null) => {
      const { error: err } = await api.triggerSync(roomId, code, type, positionMs, trackId);
      if (err) {
        setError(err);
        return;
      }
      channelRef.current?.send({ type: 'broadcast', event: 'db-changed', payload: {} });
      refresh();
    },
    [roomId, code, refresh],
  );

  const addSystemMessage = useCallback(
    async (body: string) => {
      await api.sendMessage(roomId, code, myName, body, 'system');
    },
    [roomId, code, myName],
  );

  // join / leave system messages
  useEffect(() => {
    if (!room || !myName) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      api.sendMessage(roomId, code, myName, `${myName} joined the room`, 'system');
    }, 600);
    const handleUnload = () => {
      api.sendMessage(roomId, code, myName, `${myName} left the room`, 'system');
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      cancelled = true;
      clearTimeout(t);
      handleUnload();
      window.removeEventListener('beforeunload', handleUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, myName]);

  const notifyChange = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'db-changed', payload: {} });
    refresh();
  }, [refresh]);

  const isHost = useMemo(() => room?.host_name === myName, [room, myName]);
  const isDj = useMemo(() => Boolean(room?.djs?.includes(myName)), [room, myName]);

  return {
    room,
    members,
    sync,
    loading,
    error,
    myName,
    isHost,
    isDj,
    denied,
    refresh,
    sendSync,
    addSystemMessage,
    notifyChange,
    channel: channelRef.current as unknown as Broadcaster | null,
  };
}

export function useComputedPosition(sync: SyncState, ticking = true): number {
  const [pos, setPos] = useState(() => calcPositionMs(sync.positionMs, sync.isPlaying, new Date(sync.updatedAt).toISOString()));
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    if (!ticking) return;
    let raf: number;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 250) {
        last = t;
        const s = syncRef.current;
        setPos(calcPositionMs(s.positionMs, s.isPlaying, new Date(s.updatedAt).toISOString()));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ticking]);

  useEffect(() => {
    setPos(calcPositionMs(sync.positionMs, sync.isPlaying, new Date(sync.updatedAt).toISOString()));
  }, [sync.positionMs, sync.isPlaying, sync.updatedAt]);

  return pos;
}

export { calcPositionMs };
