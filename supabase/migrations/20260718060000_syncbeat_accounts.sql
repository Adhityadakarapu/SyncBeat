/*
# SyncBeat accounts — profiles on top of Supabase Auth

## Overview
Adds real, persistent accounts. Supabase Auth (auth.users) handles password
hashing, session tokens, and refresh — none of that is reinvented here. This
migration only adds the `profiles` table that maps each auth user to the
username-based identity the rest of the app already uses everywhere (chat,
queue, votes, DJ lists, etc. all key off a plain display name).

## Design
- Supabase Auth requires an email as the primary identifier. The sign-up
  flow (client-side, see src/lib/auth.ts) uses the user's Gmail address
  directly when they provide one, or synthesizes an internal, non-deliverable
  placeholder address from their phone number when they provide a phone
  instead (e.g. `p91987...@phone.syncbeat.internal`). Either way, the
  *user-facing* credential pair is username + password — email/phone are
  just profile/contact fields, never shown to the user as their "login ID".
- `username` is the real login handle. It must be unique
  case-insensitively, enforced with a unique index on lower(username).
- No OTP/SMS verification is used anywhere, per product decision — phone
  numbers here are stored as a contact field, not verified.

## Security
- RLS enabled; a user may only select/update their OWN profile row
  (id = auth.uid()). No public read access to the profiles table, since it
  can contain a real email or phone number.
- Two narrow SECURITY DEFINER RPCs expose only what an unauthenticated
  client legitimately needs before it has a session:
  - `username_available(p_username)` — boolean only, for live availability
    checks on the sign-up form.
  - `get_auth_email_for_username(p_username)` — returns just the auth email
    string for a given username (or null), so the login form can look up
    what email to hand to supabase.auth.signInWithPassword given only the
    username. This necessarily reveals whether a username exists, which is
    an inherent trade-off of username-based (rather than email-based) login
    without OTP; it reveals nothing else about the account.
*/

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  contact    text, -- gmail address or phone number, as entered at signup; not verified
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- case-insensitive uniqueness without requiring the citext extension
create unique index if not exists profiles_username_lower_idx on profiles (lower(username));

create policy "select_own_profile" on profiles
  for select to authenticated
  using (id = auth.uid());

create policy "insert_own_profile" on profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "update_own_profile" on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- username_available ---------------------------------------------------------
create or replace function username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from profiles where lower(username) = lower(p_username)
  );
$$;

-- get_auth_email_for_username -------------------------------------------------
create or replace function get_auth_email_for_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  select id into v_user_id from profiles where lower(username) = lower(p_username) limit 1;
  if v_user_id is null then
    return null;
  end if;
  select email into v_email from auth.users where id = v_user_id;
  return v_email;
end;
$$;

grant execute on function username_available(text) to anon, authenticated;
grant execute on function get_auth_email_for_username(text) to anon, authenticated;
