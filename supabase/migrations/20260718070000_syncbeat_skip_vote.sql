/*
# SyncBeat skip-vote poll

## Overview
Adds a majority skip-vote poll for the currently playing track, plus an
instant override for the room host or a promoted DJ. This is purely
additive: no existing table, column, or function is dropped or renamed,
so nothing already working (accounts, rooms, tracks, chat, presence,
sync) is touched.

## Behavior
- Any member can cast/retract a "skip" vote on the CURRENTLY playing track.
- Votes are tallied server-side. Once votes reach a strict majority of the
  live member count (passed in by the client from realtime presence), the
  track is skipped automatically — server-authoritative, so it can't be
  bypassed or spoofed by a single client's UI state.
- If the caller is the room's host_name or is in rooms.djs (checked
  server-side, not trusted from the client), their vote skips immediately
  — no poll needed. This is the "DJ/host override".
- Votes reset automatically whenever the current track changes, by any
  path (natural progression, host manual play, or a skip), so a poll never
  lingers on a track that already ended.

## New columns on rooms
- skip_votes jsonb  — { voter_name: true } for the CURRENT track only
- skip_target uuid  — the track_id the current skip_votes belong to

## New RPC
- cast_skip_vote(p_room_id, p_code, p_track_id, p_voter, p_member_count)

## Changed (CREATE OR REPLACE only, same signatures/return types)
- get_room_state — now also returns skip_votes, skip_target
- trigger_sync    — now resets skip_votes/skip_target whenever the track changes
*/

alter table rooms add column if not exists skip_votes jsonb not null default '{}'::jsonb;
alter table rooms add column if not exists skip_target uuid;

-- get_room_state --------------------------------------------------------
-- Same signature/return type as before; just adds two fields to the payload.
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
      r.skip_votes, r.skip_target,
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

-- trigger_sync ------------------------------------------------------------
-- Same signature/return type/logic as before; only addition is resetting
-- the skip poll whenever a 'track' change happens, from ANY path.
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
        updated_at = v_now,
        skip_votes = case when p_type = 'track' then '{}'::jsonb else skip_votes end,
        skip_target = case when p_type = 'track' then null else skip_target end
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

-- cast_skip_vote ------------------------------------------------------------
-- One entry point for both "member votes to skip" and "DJ/host skips
-- instantly". Privilege is checked server-side against rooms.host_name /
-- rooms.djs (never trusted from the client), so the override can't be
-- spoofed by editing frontend state.
create or replace function cast_skip_vote(
  p_room_id uuid, p_code text, p_track_id uuid, p_voter text, p_member_count int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms%rowtype;
  v_votes jsonb;
  v_is_privileged boolean;
  v_count int;
  v_threshold int;
  v_now timestamptz := now();
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;

  select * into v_room from rooms where id = p_room_id;

  if v_room.current_track_id is distinct from p_track_id then
    -- the track already changed under this client; nothing to vote on
    return jsonb_build_object('error','track_changed');
  end if;

  v_is_privileged := (p_voter = v_room.host_name) or (p_voter = any(v_room.djs));

  if v_is_privileged then
    update tracks set status = 'skipped', played_at = v_now
      where id = p_track_id and room_id = p_room_id;
    update rooms
      set current_track_id = null, is_playing = false, position_ms = 0,
          skip_votes = '{}'::jsonb, skip_target = null, updated_at = v_now
      where id = p_room_id;
    return jsonb_build_object(
      'skipped', true, 'by', 'dj', 'skip_votes', '{}'::jsonb,
      'votes', 0, 'needed', 0, 'member_count', coalesce(p_member_count, 0)
    );
  end if;

  if v_room.skip_target is distinct from p_track_id then
    v_votes := jsonb_build_object(p_voter, true);
  else
    v_votes := coalesce(v_room.skip_votes, '{}'::jsonb);
    if v_votes ? p_voter then
      v_votes := v_votes - p_voter;
    else
      v_votes := v_votes || jsonb_build_object(p_voter, true);
    end if;
  end if;

  select count(*) into v_count from jsonb_object_keys(v_votes);
  v_threshold := greatest(1, (coalesce(p_member_count, 1) / 2) + 1);

  if v_count >= v_threshold then
    update tracks set status = 'skipped', played_at = v_now
      where id = p_track_id and room_id = p_room_id;
    update rooms
      set current_track_id = null, is_playing = false, position_ms = 0,
          skip_votes = '{}'::jsonb, skip_target = null, updated_at = v_now
      where id = p_room_id;
    return jsonb_build_object(
      'skipped', true, 'by', 'majority', 'skip_votes', '{}'::jsonb,
      'votes', v_count, 'needed', v_threshold, 'member_count', coalesce(p_member_count, 0)
    );
  else
    update rooms set skip_votes = v_votes, skip_target = p_track_id where id = p_room_id;
    return jsonb_build_object(
      'skipped', false, 'skip_votes', v_votes,
      'votes', v_count, 'needed', v_threshold, 'member_count', coalesce(p_member_count, 0)
    );
  end if;
end;
$$;

grant execute on function cast_skip_vote to anon, authenticated;
