import { supabase } from './supabase';

export interface Profile {
  id: string;
  username: string;
  contact: string | null;
}

type AuthResult = { error: string | null };

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

function isEmailLike(contact: string): boolean {
  return contact.includes('@');
}

// Supabase Auth needs a real email shape as the identifier. When the user
// gives a phone number instead of an email, we synthesize a non-deliverable
// placeholder address so Supabase's email/password auth still works under
// the hood — the user never sees or uses this, they only ever use their
// username + password.
function emailForContact(contact: string): string | null {
  const trimmed = contact.trim();
  if (isEmailLike(trimmed)) {
    return EMAIL_RE.test(trimmed) ? trimmed.toLowerCase() : null;
  }
  const digits = sanitizePhone(trimmed);
  if (digits.length < 7) return null;
  return `p${digits}@phone.syncbeat.internal`;
}

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return 'Username must be 3–20 characters: letters, numbers, or underscore only.';
  }
  return null;
}

export function validateContact(contact: string): string | null {
  if (!contact.trim()) return 'Enter a Gmail address or phone number.';
  if (emailForContact(contact) === null) {
    return 'Enter a valid email address or a phone number with at least 7 digits.';
  }
  return null;
}

export const auth = {
  async signUp(username: string, password: string, contact: string): Promise<AuthResult> {
    const usernameErr = validateUsername(username);
    if (usernameErr) return { error: usernameErr };
    const contactErr = validateContact(contact);
    if (contactErr) return { error: contactErr };
    if (password.length < 6) return { error: 'Password must be at least 6 characters.' };

    const email = emailForContact(contact)!;

    const { data: available, error: availErr } = await supabase.rpc('username_available', { p_username: username });
    if (availErr) return { error: availErr.message };
    if (!available) return { error: 'That username is already taken.' };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        return { error: 'That contact is already linked to an account.' };
      }
      return { error: error.message };
    }
    if (!data.user) return { error: 'Sign up failed. Please try again.' };
    if (!data.session) {
      // Email confirmation is turned on in the Supabase Auth settings. This
      // app expects an immediate, no-OTP session, so this needs to be
      // disabled (Authentication → Providers → Email → "Confirm email").
      return { error: 'Account created, but sign-in confirmation is required by the server configuration. Ask the app owner to disable email confirmation in Supabase Auth settings.' };
    }

    const { error: profileErr } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, username, contact: contact.trim() });
    if (profileErr) {
      // Roll the session back out rather than leaving a signed-in user
      // with no profile row, which the rest of the app assumes exists.
      await supabase.auth.signOut();
      if (/duplicate key|unique/i.test(profileErr.message)) {
        return { error: 'That username is already taken.' };
      }
      return { error: profileErr.message };
    }

    return { error: null };
  },

  async logIn(username: string, password: string): Promise<AuthResult> {
    if (!username.trim() || !password) return { error: 'Enter your username and password.' };

    const { data: email, error: lookupErr } = await supabase.rpc('get_auth_email_for_username', { p_username: username.trim() });
    if (lookupErr) return { error: lookupErr.message };
    if (!email) return { error: 'Incorrect username or password.' };

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'Incorrect username or password.' };
    return { error: null };
  },

  async logOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  // Reads the signed-in user's profile (id/username/contact). Returns null
  // if there is no active session or no matching profile row.
  async getCurrentProfile(): Promise<Profile | null> {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, contact')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !data) return null;
    return data as Profile;
  },
};
