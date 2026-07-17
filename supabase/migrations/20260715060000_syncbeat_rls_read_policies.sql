/*
# Fix: add RLS SELECT policies so live (not just on-refresh) sync works

## Why "works on refresh but not live"
`get_room_state` is a SECURITY DEFINER function, so it bypasses Row-Level
Security entirely — that's why a manual refresh always shows fresh data.
But the realtime "push new changes to other tabs" feature runs as the
actual anon role and IS subject to RLS. Granting table-level SELECT (last
fix) is necessary but not sufficient: with RLS enabled and zero policies,
Postgres denies all rows by default regardless of the table-level grant.
This adds the actual policy that allows rows to be read, which is what lets
live updates reach other clients instead of only regular refreshes.

## Trade-off (same as last time, worth restating)
This makes rows in these tables genuinely readable by anyone with the
public anon key, independent of the room code — writes remain fully gated
by the code-verifying RPCs. Acceptable for a portfolio/demo project.
*/

create policy "allow_read_rooms" on rooms for select to anon, authenticated using (true);
create policy "allow_read_tracks" on tracks for select to anon, authenticated using (true);
create policy "allow_read_messages" on messages for select to anon, authenticated using (true);
create policy "allow_read_track_memories" on track_memories for select to anon, authenticated using (true);
create policy "allow_read_love_notes" on love_notes for select to anon, authenticated using (true);
create policy "allow_read_scheduled_messages" on scheduled_messages for select to anon, authenticated using (true);
create policy "allow_read_countdowns" on countdowns for select to anon, authenticated using (true);
