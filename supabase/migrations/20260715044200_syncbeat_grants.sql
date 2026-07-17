/*
# Grant execute on SyncBeat RPCs

Allows the anon-key frontend to call all public SECURITY DEFINER functions
created in syncbeat_schema. Without this, anon callers (the frontend) get
permission denied. All room-scoped RPCs still enforce access via the room
code, so granting execute does not expose data — a caller without the code
receives an `invalid_room_or_code` error from every room-scoped function.
*/
grant execute on function create_room to anon, authenticated;
grant execute on function syncbeat_verify to anon, authenticated;
grant execute on function get_room_state to anon, authenticated;
grant execute on function trigger_sync to anon, authenticated;
grant execute on function add_track to anon, authenticated;
grant execute on function remove_track to anon, authenticated;
grant execute on function vote_track to anon, authenticated;
grant execute on function send_message to anon, authenticated;
grant execute on function toggle_reaction to anon, authenticated;
grant execute on function set_dj to anon, authenticated;
grant execute on function add_memory to anon, authenticated;
grant execute on function add_love_note to anon, authenticated;
grant execute on function add_scheduled to anon, authenticated;
grant execute on function mark_scheduled_delivered to anon, authenticated;
grant execute on function add_countdown to anon, authenticated;
