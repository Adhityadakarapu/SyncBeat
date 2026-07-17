/*
# Add transfer_host RPC

Lets the current host hand off admin control to another member in the room
(both Teams and Duo use the same `rooms.host_name` field already). Same
code-verification pattern as every other write in this project.

Note on trust model: like every other RPC here (e.g. setDj), this only
checks the room code, not "is the caller actually the current host" — there's
no per-user auth layer in this project, so that check happens client-side
(the "Make admin" button is only rendered for whoever the UI thinks is host).
Anyone with the room code could technically call this directly. Acceptable
for this project's scope; flag if you ever add real user accounts.
*/

create or replace function transfer_host(p_room_id uuid, p_code text, p_new_host text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not syncbeat_verify(p_room_id, p_code) then
    raise exception 'invalid room or code';
  end if;
  update rooms set host_name = p_new_host where id = p_room_id;
end;
$$;

grant execute on function transfer_host(uuid, text, text) to anon, authenticated;
