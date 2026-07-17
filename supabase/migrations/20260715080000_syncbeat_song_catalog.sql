/*
# Shared song catalog — "already in the list" quick-add

## Purpose
A global (not per-room) table of songs that anyone has ever added, so future
sessions can pick a song by clicking a title instead of pasting a YouTube
link every time. Seeded here with a couple of verified Telugu tracks; grows
automatically every time someone adds a new track through the app.

## Access model
Read: open to anon/authenticated (it's just a public list of song metadata,
no personal data). Write: through a SECURITY DEFINER RPC that no-ops
(ON CONFLICT DO NOTHING) if the same youtube_id was already catalogued.
*/

create table if not exists song_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  youtube_id text unique,
  language_tags text[] not null default '{}',
  mood_tags text[] not null default '{}',
  added_by text,
  created_at timestamptz not null default now()
);

alter table song_catalog enable row level security;

create policy "allow_read_song_catalog" on song_catalog for select to anon, authenticated using (true);
grant select on song_catalog to anon, authenticated;

create or replace function add_to_catalog(
  p_title text, p_artist text, p_youtube_id text,
  p_language_tags text[], p_mood_tags text[], p_added_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_youtube_id is null or length(trim(p_youtube_id)) = 0 then
    return; -- only catalog YouTube-sourced tracks (audio-file URLs are too one-off to reuse)
  end if;
  insert into song_catalog (title, artist, youtube_id, language_tags, mood_tags, added_by)
  values (p_title, p_artist, p_youtube_id, coalesce(p_language_tags, '{}'), coalesce(p_mood_tags, '{}'), p_added_by)
  on conflict (youtube_id) do nothing;
end;
$$;

grant execute on function add_to_catalog(text, text, text, text[], text[], text) to anon, authenticated;

-- seed with a couple of verified, embeddable Telugu tracks
insert into song_catalog (title, artist, youtube_id, language_tags, mood_tags, added_by)
values
  ('Samajavaragamana', 'Sid Sriram', 'aFl7e6f4Qlg', array['Telugu'], array['Chill'], 'SyncBeat'),
  ('Butta Bomma', 'Armaan Malik', 'zXWJLEE7LeI', array['Telugu'], array['Party'], 'SyncBeat')
on conflict (youtube_id) do nothing;
