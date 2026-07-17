/*
# SyncBeat initial schema

## Overview
SyncBeat is a real-time synchronized music listening app with two portals:
"Teams" (group listening rooms) and "Duo" (two-person rooms). This migration
creates the full persistence layer and a set of SECURITY DEFINER RPCs that
act as the server-authoritative API (the equivalent of Express route
handlers + Socket.io event handlers).

## Access model (no accounts)
There is no sign-in screen. Users create or join a room with a 6-character
code. The code is the access credential: every RPC that reads or writes room
data verifies the caller supplied the correct code before doing anything.
This enforces Duo privacy (love notes, memories, scheduled messages) at the
database level — no cross-room or public visibility is possible without a
room's code.

## Tables
1. rooms — room metadata + authoritative playback state (source of truth):
   is_playing, position_ms, current_track_id, updated_at. updated_at +
   position_ms let every client compute the current position and correct drift.
2. tracks — queued/played tracks. Supports audio URLs and YouTube IDs. Carries
   mood/language tags and denormalized net_votes + voters jsonb so vote
   re-sorts propagate as a single row update.
3. messages — chat and system (join/leave) messages, with reactions jsonb.
4. track_memories (Duo) — "Our Songs": private note + date on a track.
5. love_notes (Duo) — persistent private notes board for the two partners.
6. scheduled_messages (Duo) — message/track queued to reveal at a future time.
7. countdowns (Duo) — shared countdown to a chosen date.

## Security
- RLS ENABLED on every table; NO policies granted to anon/authenticated, so
  direct table access from the anon key is fully blocked.
- All reads/writes go through SECURITY DEFINER RPCs (owned by postgres,
  bypassing RLS). Each room-scoped RPC verifies the supplied code matches
  rooms.code before acting. The 6-char code is the sole access credential.

## RPCs
- create_room / get_room_state / trigger_sync / add_track / remove_track /
  vote_track / send_message / toggle_reaction / set_dj / add_memory /
  add_love_note / add_scheduled / mark_scheduled_delivered / add_countdown
*/

create extension if not exists pgcrypto;

-- rooms ---------------------------------------------------------------------
create table if not exists rooms (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  portal          text not null check (portal in ('teams','duo')),
  name            text,
  host_name       text not null,
  djs             text[] not null default '{}',
  current_track_id uuid,
  is_playing      boolean not null default false,
  position_ms     bigint not null default 0,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
alter table rooms enable row level security;
create index if not exists rooms_code_idx on rooms (code);

-- tracks --------------------------------------------------------------------
create table if not exists tracks (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references rooms(id) on delete cascade,
  url           text not null,
  source        text not null check (source in ('audio','youtube')),
  youtube_id    text,
  title         text not null default 'Untitled track',
  added_by      text not null,
  mood_tags     text[] not null default '{}',
  language_tags text[] not null default '{}',
  status        text not null default 'queue' check (status in ('queue','playing','played','skipped')),
  net_votes     integer not null default 0,
  voters        jsonb not null default '{}'::jsonb,
  added_at      timestamptz not null default now(),
  played_at     timestamptz
);
alter table tracks enable row level security;
create index if not exists tracks_room_idx on tracks (room_id);

-- messages ------------------------------------------------------------------
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  sender_name text not null,
  kind        text not null default 'user' check (kind in ('user','system')),
  body        text not null,
  reactions   jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table messages enable row level security;
create index if not exists messages_room_idx on messages (room_id, created_at);

-- track_memories (Duo "Our Songs") ------------------------------------------
create table if not exists track_memories (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  track_id     uuid not null references tracks(id) on delete cascade,
  note         text not null,
  memory_date  date,
  created_by   text not null,
  created_at   timestamptz not null default now()
);
alter table track_memories enable row level security;
create index if not exists track_memories_room_idx on track_memories (room_id);

-- love_notes (Duo) ----------------------------------------------------------
create table if not exists love_notes (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms(id) on delete cascade,
  author     text not null,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table love_notes enable row level security;
create index if not exists love_notes_room_idx on love_notes (room_id);

-- scheduled_messages (Duo) --------------------------------------------------
create table if not exists scheduled_messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  author      text not null,
  kind        text not null default 'message' check (kind in ('message','track')),
  body        text not null,
  track_url   text,
  reveal_at   timestamptz not null,
  delivered   boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table scheduled_messages enable row level security;
create index if not exists scheduled_room_idx on scheduled_messages (room_id);
create index if not exists scheduled_reveal_idx on scheduled_messages (reveal_at) where delivered = false;

-- countdowns (Duo) ----------------------------------------------------------
create table if not exists countdowns (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  title       text not null,
  target_date timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table countdowns enable row level security;
create index if not exists countdowns_room_idx on countdowns (room_id);

-- ===========================================================================
-- RPCs (all SECURITY DEFINER; all room-scoped ones verify the code)
-- ===========================================================================

-- create_room ---------------------------------------------------------------
create or replace function create_room(p_portal text, p_host_name text, p_room_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := '';
  v_id uuid;
  i int;
  v_exists int;
  v_attempts int := 0;
begin
  if p_portal not in ('teams','duo') then
    return jsonb_build_object('error','invalid_portal');
  end if;
  if coalesce(p_host_name,'') = '' then
    return jsonb_build_object('error','missing_name');
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random()*32)::int, 1);
    end loop;
    select 1 into v_exists from rooms where code = v_code limit 1;
    exit when v_exists is null;
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      return jsonb_build_object('error','code_generation_failed');
    end if;
  end loop;

  insert into rooms (code, portal, name, host_name)
    values (v_code, p_portal, p_room_name, p_host_name)
    returning id into v_id;

  return jsonb_build_object('id', v_id, 'code', v_code, 'portal', p_portal);
end;
$$;

-- verify helper -------------------------------------------------------------
create or replace function syncbeat_verify(p_room_id uuid, p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from rooms where id = p_room_id and code = p_code);
$$;

-- get_room_state ------------------------------------------------------------
create or replace function get_room_state(p_room_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room jsonb;
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;

  select to_jsonb(r) into v_room
  from (
    select
      r.id, r.code, r.portal, r.name, r.host_name, r.djs,
      r.current_track_id, r.is_playing, r.position_ms, r.updated_at, r.created_at,
      coalesce((select jsonb_agg(to_jsonb(t) order by t.added_at) from tracks t where t.room_id = p_room_id), '[]'::jsonb) as tracks,
      coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from messages m where m.room_id = p_room_id), '[]'::jsonb) as messages,
      coalesce((select jsonb_agg(to_jsonb(mem) order by mem.created_at) from track_memories mem where mem.room_id = p_room_id), '[]'::jsonb) as memories,
      coalesce((select jsonb_agg(to_jsonb(ln) order by ln.created_at) from love_notes ln where ln.room_id = p_room_id), '[]'::jsonb) as love_notes,
      coalesce((select jsonb_agg(to_jsonb(sm) order by sm.reveal_at) from scheduled_messages sm where sm.room_id = p_room_id), '[]'::jsonb) as scheduled,
      coalesce((select jsonb_agg(to_jsonb(c) order by c.target_date) from countdowns c where c.room_id = p_room_id), '[]'::jsonb) as countdowns
    from rooms r
    where r.id = p_room_id
  ) r;

  return v_room;
end;
$$;

-- trigger_sync --------------------------------------------------------------
create or replace function trigger_sync(
  p_room_id uuid, p_code text, p_type text,
  p_position_ms bigint, p_track_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms%rowtype;
  v_is_playing boolean;
  v_pos bigint;
  v_track_id uuid;
  v_now timestamptz := now();
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;

  select * into v_room from rooms where id = p_room_id;
  v_is_playing := v_room.is_playing;
  v_pos := coalesce(p_position_ms, 0);
  v_track_id := v_room.current_track_id;

  if p_type = 'play' then
    v_is_playing := true;
    v_pos := coalesce(p_position_ms, 0);
  elsif p_type = 'pause' then
    v_is_playing := false;
    v_pos := coalesce(p_position_ms, 0);
  elsif p_type = 'seek' then
    v_pos := coalesce(p_position_ms, 0);
  elsif p_type = 'track' then
    v_track_id := p_track_id;
    v_pos := 0;
    v_is_playing := true;
  elsif p_type = 'stop' then
    v_is_playing := false;
    v_pos := 0;
  else
    return jsonb_build_object('error','invalid_type');
  end if;

  update rooms
    set is_playing = v_is_playing,
        position_ms = v_pos,
        current_track_id = v_track_id,
        updated_at = v_now
    where id = p_room_id;

  if p_type = 'track' and p_track_id is not null then
    update tracks set status = 'played', played_at = v_now
      where id = p_track_id and room_id = p_room_id;
  end if;

  return jsonb_build_object(
    'room_id', p_room_id,
    'is_playing', v_is_playing,
    'position_ms', v_pos,
    'current_track_id', v_track_id,
    'updated_at', v_now
  );
end;
$$;

-- add_track -----------------------------------------------------------------
create or replace function add_track(
  p_room_id uuid, p_code text, p_url text, p_title text,
  p_added_by text, p_source text, p_youtube_id text,
  p_mood_tags text[] default '{}', p_language_tags text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row tracks%rowtype;
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;
  if p_source not in ('audio','youtube') then
    return jsonb_build_object('error','invalid_source');
  end if;
  insert into tracks (room_id, url, source, youtube_id, title, added_by, mood_tags, language_tags)
    values (p_room_id, p_url, p_source, p_youtube_id, p_title, p_added_by, p_mood_tags, p_language_tags)
    returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

-- remove_track --------------------------------------------------------------
create or replace function remove_track(p_room_id uuid, p_code text, p_track_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;
  delete from tracks where id = p_track_id and room_id = p_room_id;
  return jsonb_build_object('id', p_track_id, 'removed', true);
end;
$$;

-- vote_track ----------------------------------------------------------------
create or replace function vote_track(
  p_room_id uuid, p_code text, p_track_id uuid, p_voter text, p_direction int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voters jsonb;
  v_net int;
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;
  select voters into v_voters from tracks where id = p_track_id and room_id = p_room_id;
  if not found then
    return jsonb_build_object('error','track_not_found');
  end if;

  if p_direction = 0 then
    v_voters := v_voters - p_voter;
  else
    v_voters := jsonb_set(v_voters, array[p_voter], to_jsonb(p_direction), true);
  end if;

  select coalesce(sum(value::int), 0) into v_net from jsonb_each_text(v_voters);

  update tracks set voters = v_voters, net_votes = v_net
    where id = p_track_id and room_id = p_room_id;

  return jsonb_build_object('id', p_track_id, 'voters', v_voters, 'net_votes', v_net);
end;
$$;

-- send_message --------------------------------------------------------------
create or replace function send_message(
  p_room_id uuid, p_code text, p_sender text, p_body text, p_kind text default 'user'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row messages%rowtype;
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;
  if p_kind not in ('user','system') then
    return jsonb_build_object('error','invalid_kind');
  end if;
  insert into messages (room_id, sender_name, kind, body)
    values (p_room_id, p_sender, p_kind, p_body)
    returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

-- toggle_reaction -----------------------------------------------------------
create or replace function toggle_reaction(
  p_room_id uuid, p_code text, p_message_id uuid, p_emoji text, p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reactions jsonb;
  v_list jsonb;
  v_idx int;
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;
  select reactions into v_reactions from messages where id = p_message_id and room_id = p_room_id;
  if not found then
    return jsonb_build_object('error','message_not_found');
  end if;

  v_list := coalesce(v_reactions -> p_emoji, '[]'::jsonb);
  select idx - 1 into v_idx
    from jsonb_array_elements(v_list) with ordinality arr(val, idx)
    where val #>> '{}' = p_name limit 1;

  if v_idx is not null then
    v_list := v_list - v_idx;
  else
    v_list := v_list || to_jsonb(p_name);
  end if;

  if jsonb_array_length(v_list) = 0 then
    v_reactions := v_reactions - p_emoji;
  else
    v_reactions := jsonb_set(v_reactions, array[p_emoji], v_list, true);
  end if;

  update messages set reactions = v_reactions where id = p_message_id;

  return jsonb_build_object('id', p_message_id, 'reactions', v_reactions);
end;
$$;

-- set_dj --------------------------------------------------------------------
create or replace function set_dj(
  p_room_id uuid, p_code text, p_name text, p_promote boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_djs text[];
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;
  select djs into v_djs from rooms where id = p_room_id;
  if p_promote then
    if not v_djs ? p_name then
      v_djs := array_append(v_djs, p_name);
    end if;
  else
    v_djs := array_remove(v_djs, p_name);
  end if;
  update rooms set djs = v_djs where id = p_room_id;
  return jsonb_build_object('djs', v_djs);
end;
$$;

-- add_memory (Duo) ----------------------------------------------------------
create or replace function add_memory(
  p_room_id uuid, p_code text, p_track_id uuid, p_note text,
  p_memory_date date, p_created_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row track_memories%rowtype;
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;
  insert into track_memories (room_id, track_id, note, memory_date, created_by)
    values (p_room_id, p_track_id, p_note, p_memory_date, p_created_by)
    returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

-- add_love_note (Duo) -------------------------------------------------------
create or replace function add_love_note(
  p_room_id uuid, p_code text, p_author text, p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row love_notes%rowtype;
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;
  insert into love_notes (room_id, author, body)
    values (p_room_id, p_author, p_body)
    returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

-- add_scheduled (Duo) -------------------------------------------------------
create or replace function add_scheduled(
  p_room_id uuid, p_code text, p_author text, p_kind text,
  p_body text, p_track_url text, p_reveal_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row scheduled_messages%rowtype;
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;
  if p_kind not in ('message','track') then
    return jsonb_build_object('error','invalid_kind');
  end if;
  insert into scheduled_messages (room_id, author, kind, body, track_url, reveal_at)
    values (p_room_id, p_author, p_kind, p_body, p_track_url, p_reveal_at)
    returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

-- mark_scheduled_delivered (Duo) -------------------------------------------
create or replace function mark_scheduled_delivered(
  p_room_id uuid, p_code text, p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;
  update scheduled_messages set delivered = true where id = p_id and room_id = p_room_id;
  return jsonb_build_object('id', p_id, 'delivered', true);
end;
$$;

-- add_countdown (Duo) -------------------------------------------------------
create or replace function add_countdown(
  p_room_id uuid, p_code text, p_title text, p_target_date timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row countdowns%rowtype;
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;
  insert into countdowns (room_id, title, target_date)
    values (p_room_id, p_title, p_target_date)
    returning * into v_row;
  return to_jsonb(v_row);
end;
$$;
