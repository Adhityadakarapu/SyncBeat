/*
# Fix: enable live sync (chat, playback, playlist) across clients

## Problem
Every table has RLS enabled with zero SELECT policies for anon/authenticated.
That correctly blocks arbitrary direct table reads, but Supabase Realtime's
"Postgres Changes" feature also checks the SAME permission before it will
push a change event to a subscribed client. With no SELECT grant, clients
never receive live updates — writes succeed (chat messages, votes, playback
state all save correctly) but nothing propagates without a manual refresh.

## Fix
1. Grant SELECT to anon/authenticated on all 7 tables, so Realtime is allowed
   to deliver change events.
2. Add every table to the `supabase_realtime` publication (idempotent — safe
   to run even if some tables were already added via the dashboard).

## Trade-off (read this)
All WRITES remain fully gated: nothing can be inserted/updated without going
through a SECURITY DEFINER RPC that verifies the room's 6-character code.
This migration only affects READS. Practically, this means someone who has
your public anon key could query these tables directly (e.g. `supabase.from
('love_notes').select('*')`) without knowing a room's code, which is a
narrower privacy guarantee than "impossible without the code." For a
portfolio/demo project this is a reasonable trade-off; note it if asked in
an interview, and consider it a known follow-up if you take this further.
*/

grant select on rooms, tracks, messages, track_memories, love_notes, scheduled_messages, countdowns
  to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['rooms','tracks','messages','track_memories','love_notes','scheduled_messages','countdowns']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
