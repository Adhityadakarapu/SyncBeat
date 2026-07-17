import { supabase } from './supabase';
import type { RoomState, Portal, TrackSource } from './types';

type RpcResult<T> = { data: T | null; error: string | null };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { data: null, error: error.message };
  const d = data as unknown as T;
  if (d && typeof d === 'object' && 'error' in (d as Record<string, unknown>)) {
    return { data: null, error: (d as Record<string, unknown>).error as string };
  }
  return { data: d, error: null };
}

export interface CreateRoomResult {
  id: string;
  code: string;
  portal: Portal;
}

export const api = {
  async createRoom(portal: Portal, hostName: string, roomName?: string): Promise<RpcResult<CreateRoomResult>> {
    return rpc<CreateRoomResult>('create_room', {
      p_portal: portal,
      p_host_name: hostName,
      p_room_name: roomName ?? null,
    });
  },

  async getRoomState(roomId: string, code: string): Promise<RpcResult<RoomState>> {
    return rpc<RoomState>('get_room_state', { p_room_id: roomId, p_code: code });
  },

  async triggerSync(
    roomId: string, code: string, type: string, positionMs: number, trackId?: string | null,
  ): Promise<RpcResult<{ is_playing: boolean; position_ms: number; current_track_id: string | null; updated_at: string }>> {
    return rpc('trigger_sync', {
      p_room_id: roomId, p_code: code, p_type: type,
      p_position_ms: positionMs, p_track_id: trackId ?? null,
    });
  },

  async addTrack(
    roomId: string, code: string, url: string, title: string, addedBy: string,
    source: TrackSource, youtubeId: string | null,
    moodTags: string[], languageTags: string[],
  ): Promise<RpcResult<unknown>> {
    return rpc('add_track', {
      p_room_id: roomId, p_code: code, p_url: url, p_title: title,
      p_added_by: addedBy, p_source: source, p_youtube_id: youtubeId,
      p_mood_tags: moodTags, p_language_tags: languageTags,
    });
  },

  async removeTrack(roomId: string, code: string, trackId: string): Promise<RpcResult<unknown>> {
    return rpc('remove_track', { p_room_id: roomId, p_code: code, p_track_id: trackId });
  },

  async voteTrack(roomId: string, code: string, trackId: string, voter: string, direction: number): Promise<RpcResult<unknown>> {
    return rpc('vote_track', { p_room_id: roomId, p_code: code, p_track_id: trackId, p_voter: voter, p_direction: direction });
  },

  async sendMessage(roomId: string, code: string, sender: string, body: string, kind: 'user' | 'system' = 'user'): Promise<RpcResult<unknown>> {
    return rpc('send_message', { p_room_id: roomId, p_code: code, p_sender: sender, p_body: body, p_kind: kind });
  },

  async toggleReaction(roomId: string, code: string, messageId: string, emoji: string, name: string): Promise<RpcResult<unknown>> {
    return rpc('toggle_reaction', { p_room_id: roomId, p_code: code, p_message_id: messageId, p_emoji: emoji, p_name: name });
  },

  async setDj(roomId: string, code: string, name: string, promote: boolean): Promise<RpcResult<{ djs: string[] }>> {
    return rpc('set_dj', { p_room_id: roomId, p_code: code, p_name: name, p_promote: promote });
  },

  async addMemory(roomId: string, code: string, trackId: string, note: string, date: string | null, createdBy: string): Promise<RpcResult<unknown>> {
    return rpc('add_memory', { p_room_id: roomId, p_code: code, p_track_id: trackId, p_note: note, p_memory_date: date, p_created_by: createdBy });
  },

  async addLoveNote(roomId: string, code: string, author: string, body: string): Promise<RpcResult<unknown>> {
    return rpc('add_love_note', { p_room_id: roomId, p_code: code, p_author: author, p_body: body });
  },

  async addScheduled(roomId: string, code: string, author: string, kind: 'message' | 'track', body: string, trackUrl: string | null, revealAt: string): Promise<RpcResult<unknown>> {
    return rpc('add_scheduled', { p_room_id: roomId, p_code: code, p_author: author, p_kind: kind, p_body: body, p_track_url: trackUrl, p_reveal_at: revealAt });
  },

  async markScheduledDelivered(roomId: string, code: string, id: string): Promise<RpcResult<unknown>> {
    return rpc('mark_scheduled_delivered', { p_room_id: roomId, p_code: code, p_id: id });
  },

  async addCountdown(roomId: string, code: string, title: string, targetDate: string): Promise<RpcResult<unknown>> {
    return rpc('add_countdown', { p_room_id: roomId, p_code: code, p_title: title, p_target_date: targetDate });
  },

  async transferHost(roomId: string, code: string, newHost: string): Promise<RpcResult<unknown>> {
    return rpc('transfer_host', { p_room_id: roomId, p_code: code, p_new_host: newHost });
  },

  async getCatalog(): Promise<{ data: CatalogEntry[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('song_catalog')
      .select('id, title, artist, youtube_id, language_tags, mood_tags')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return { data: null, error: error.message };
    return { data: data as CatalogEntry[], error: null };
  },

  async addToCatalog(title: string, artist: string | null, youtubeId: string | null, languageTags: string[], moodTags: string[], addedBy: string): Promise<RpcResult<unknown>> {
    return rpc('add_to_catalog', {
      p_title: title, p_artist: artist, p_youtube_id: youtubeId,
      p_language_tags: languageTags, p_mood_tags: moodTags, p_added_by: addedBy,
    });
  },
};

export interface CatalogEntry {
  id: string;
  title: string;
  artist: string | null;
  youtube_id: string;
  language_tags: string[];
  mood_tags: string[];
}
