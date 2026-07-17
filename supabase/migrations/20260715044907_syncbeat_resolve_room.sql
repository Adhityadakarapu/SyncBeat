/*
# Add resolve_room_by_code RPC

Allows a joining client to look up a room's id and portal from its 6-character
code, without exposing any other room data. This is the join entry point: the
frontend knows only the code, but get_room_state and all other RPCs require
the room id. This function returns { id, portal } on a match, or null.

RLS on rooms blocks direct selects by anon, so this SECURITY DEFINER function
is the only way to resolve a code to an id. It reveals nothing beyond id and
portal (the code itself is the credential the caller already holds).
*/
create or replace function resolve_room_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_portal text;
begin
  select id, portal into v_id, v_portal from rooms where code = upper(p_code) limit 1;
  if v_id is null then
    return jsonb_build_object('error','not_found');
  end if;
  return jsonb_build_object('id', v_id, 'portal', v_portal);
end;
$$;

grant execute on function resolve_room_by_code to anon, authenticated;
