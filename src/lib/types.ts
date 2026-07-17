export type Portal = 'teams' | 'duo';
export type TrackSource = 'audio' | 'youtube';
export type TrackStatus = 'queue' | 'playing' | 'played' | 'skipped';
export type SyncType = 'play' | 'pause' | 'seek' | 'track' | 'stop';

export interface Track {
  id: string;
  room_id: string;
  url: string;
  source: TrackSource;
  youtube_id: string | null;
  title: string;
  added_by: string;
  mood_tags: string[];
  language_tags: string[];
  status: TrackStatus;
  net_votes: number;
  voters: Record<string, number>;
  added_at: string;
  played_at: string | null;
}

export interface Message {
  id: string;
  room_id: string;
  sender_name: string;
  kind: 'user' | 'system';
  body: string;
  reactions: Record<string, string[]>;
  created_at: string;
}

export interface TrackMemory {
  id: string;
  room_id: string;
  track_id: string;
  note: string;
  memory_date: string | null;
  created_by: string;
  created_at: string;
}

export interface LoveNote {
  id: string;
  room_id: string;
  author: string;
  body: string;
  created_at: string;
}

export interface ScheduledMessage {
  id: string;
  room_id: string;
  author: string;
  kind: 'message' | 'track';
  body: string;
  track_url: string | null;
  reveal_at: string;
  delivered: boolean;
  created_at: string;
}

export interface Countdown {
  id: string;
  room_id: string;
  title: string;
  target_date: string;
  created_at: string;
}

export interface RoomState {
  id: string;
  code: string;
  portal: Portal;
  name: string | null;
  host_name: string;
  djs: string[];
  current_track_id: string | null;
  is_playing: boolean;
  position_ms: number;
  updated_at: string;
  created_at: string;
  tracks: Track[];
  messages: Message[];
  memories: TrackMemory[];
  love_notes: LoveNote[];
  scheduled: ScheduledMessage[];
  countdowns: Countdown[];
}

export interface Member {
  name: string;
  isHost?: boolean;
  joinedAt: number;
}

export interface SyncState {
  isPlaying: boolean;
  positionMs: number;
  currentTrackId: string | null;
  updatedAt: number;
}
