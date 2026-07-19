import { useState } from 'react';
import { auth, validateUsername, validateContact } from '../lib/auth';
import type { Profile } from '../lib/auth';

export function Auth({ onAuthenticated }: { onAuthenticated: (profile: Profile) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);

    if (mode === 'signup') {
      const usernameErr = validateUsername(username);
      if (usernameErr) { setErr(usernameErr); return; }
      const contactErr = validateContact(contact);
      if (contactErr) { setErr(contactErr); return; }
      if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
      if (password !== confirm) { setErr('Passwords do not match.'); return; }

      setBusy(true);
      const { error } = await auth.signUp(username, password, contact);
      if (error) { setBusy(false); setErr(error); return; }
      const profile = await auth.getCurrentProfile();
      setBusy(false);
      if (!profile) { setErr('Signed up, but something went wrong loading your account. Try logging in.'); setMode('login'); return; }
      onAuthenticated(profile);
      return;
    }

    if (!username.trim() || !password) { setErr('Enter your username and password.'); return; }
    setBusy(true);
    const { error } = await auth.logIn(username, password);
    if (error) { setBusy(false); setErr(error); return; }
    const profile = await auth.getCurrentProfile();
    setBusy(false);
    if (!profile) { setErr('Logged in, but something went wrong loading your account.'); return; }
    onAuthenticated(profile);
  };

  const switchMode = (m: 'login' | 'signup') => {
    setMode(m);
    setErr(null);
    setPassword('');
    setConfirm('');
  };

  return (
    <div className="min-h-screen bg-[#070912] text-white relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-teams-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-duo-700/10 blur-[120px]" />
      </div>

      <div className="relative max-w-md w-full animate-scale-in">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-extrabold mb-1">SyncBeat</h1>
          <p className="text-white/50 text-sm">Sign in to keep listening, in sync.</p>
        </div>

        <div className="rounded-3xl p-6 border border-white/10 bg-white/[0.03]">
          <div className="flex bg-white/5 rounded-full p-0.5 mb-5">
            <button onClick={() => switchMode('login')} className={`flex-1 text-sm py-2 rounded-full transition-colors ${mode === 'login' ? 'bg-teams-600 text-white' : 'text-white/60'}`}>Log in</button>
            <button onClick={() => switchMode('signup')} className={`flex-1 text-sm py-2 rounded-full transition-colors ${mode === 'signup' ? 'bg-teams-600 text-white' : 'text-white/60'}`}>Sign up</button>
          </div>

          <div className="space-y-4">
            <Field label="Username">
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. alex_23" maxLength={20} className={inputCls()} autoComplete="username" />
            </Field>

            {mode === 'signup' && (
              <Field label="Gmail address or phone number">
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@gmail.com or +91 98765 43210" className={inputCls()} autoComplete="email" />
              </Field>
            )}

            <Field label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls()} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
            </Field>

            {mode === 'signup' && (
              <Field label="Confirm password">
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className={inputCls()} autoComplete="new-password" />
              </Field>
            )}

            <button
              onClick={submit}
              disabled={busy || !username.trim() || !password || (mode === 'signup' && (!contact.trim() || !confirm))}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-40 bg-teams-600 hover:bg-teams-500"
            >
              {busy ? (mode === 'signup' ? 'Creating account…' : 'Logging in…') : (mode === 'signup' ? 'Create account' : 'Log in')}
            </button>

            {err && <p className="text-center text-red-300 text-sm">{err}</p>}
          </div>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          You'll stay signed in on this device — no need to log in again next time.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-white/60 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function inputCls() {
  return 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-white/40 outline-none transition-colors';
}
