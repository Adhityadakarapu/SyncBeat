/*
# SyncBeat room themes

## Overview
Adds a per-room background theme, host-controlled and synced live to every
member via the same realtime path already used for playback/queue/chat.
Purely additive — one new column, one new RPC, and CREATE OR REPLACE on
get_room_state only to add the field to its payload. Nothing existing is
dropped, renamed, or behaviorally changed.

## New column on rooms
- theme text not null default 'classic'  — one of a fixed whitelist enforced
  server-side (see cast_room_theme below); unknown/missing values fall back
  to 'classic' on the frontend regardless, so this can never break rendering.

## New RPC
- set_room_theme(p_room_id, p_code, p_actor, p_theme)
  Host-only, enforced server-side against rooms.host_name (never trusted
  from the client) — the same pattern already used for the skip-vote DJ
  override.
*/

alter table rooms add column if not exists theme text not null default 'classic';

-- get_room_state ------------------------------------------------------------
-- Same signature/return type as before; adds `theme` to the payload.
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
      r.skip_votes, r.skip_target, r.theme,
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

-- set_room_theme --------------------------------------------------------------
create or replace function set_room_theme(p_room_id uuid, p_code text, p_actor text, p_theme text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host text;
begin
  if not syncbeat_verify(p_room_id, p_code) then
    return jsonb_build_object('error','invalid_room_or_code');
  end if;

  select host_name into v_host from rooms where id = p_room_id;
  if v_host is distinct from p_actor then
    return jsonb_build_object('error','not_host');
  end if;

  if p_theme not in ('classic','night','sunset','neon','forest') then
    return jsonb_build_object('error','invalid_theme');
  end if;

  update rooms set theme = p_theme where id = p_room_id;
  return jsonb_build_object('theme', p_theme);
end;
$$;

grant execute on function set_room_theme to anon, authenticated;
