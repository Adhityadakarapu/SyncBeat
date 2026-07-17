import { useState } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Portal } from '../lib/types';

interface LandingProps {
  onEnter: (params: { roomId: string; code: string; portal: Portal; myName: string }) => void;
}

export function Landing({ onEnter }: LandingProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [portal, setPortal] = useState<Portal | null>(null);
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => { setMode('choose'); setPortal(null); setErr(null); };

  const createRoom = async () => {
    setErr(null);
    if (!portal || !name.trim()) { setErr('Enter your name.'); return; }
    setBusy(true);
    const { data, error } = await api.createRoom(portal, name.trim(), roomName.trim() || undefined);
    setBusy(false);
    if (error || !data) { setErr(error ?? 'Failed to create room'); return; }
    onEnter({ roomId: data.id, code: data.code, portal: data.portal, myName: name.trim() });
  };

  const joinRoom = async () => {
    setErr(null);
    if (!name.trim() || !joinCode.trim()) { setErr('Enter your name and a room code.'); return; }
    const code = joinCode.trim().toUpperCase();
    setBusy(true);
    // look up the room by code via get_room_state needs an id; we don't have it.
    // Use a lightweight RPC-free approach: query rooms by code is RLS-blocked.
    // Instead resolve via a helper: we try get_room_state by first finding the id.
    // We don't have a code->id lookup RPC, so we add a small one-off: create a
    // join path that uses the code directly. We'll resolve id by calling a
    // dedicated lookup below.
    const res = await resolveRoomId(code);
    setBusy(false);
    if (!res) { setErr('Room not found. Check the code.'); return; }
    onEnter({ roomId: res.id, code, portal: res.portal, myName: name.trim() });
  };

  return (
    <div className="min-h-screen bg-[#070912] text-white relative overflow-hidden">
      {/* ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-teams-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-duo-700/10 blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-5 pt-10 pb-16">
        {/* nav */}
        <nav className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-display font-extrabold text-xl">SyncBeat</span>
          </div>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="text-sm text-white/50 hover:text-white/80 transition-colors">How it works</a>
        </nav>

        {/* hero */}
        {mode === 'choose' && (
          <div className="text-center mb-12 animate-fade-in-up">
            <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-[1.05] mb-4">
              Listen together,<br /><span className="bg-gradient-to-r from-teams-400 via-white to-duo-300 bg-clip-text text-transparent">in perfect sync.</span>
            </h1>
            <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto">
              Real-time synchronized music rooms. Pick a vibe, share a 6-character code, and hear the same moment — together.
            </p>
          </div>
        )}

        {/* choose portal */}
        {mode === 'choose' && (
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <PortalCard
              title="Teams"
              tagline="Group listening room"
              description="Vote on the queue, tag moods & languages, give someone DJ control, and generate a session recap when you're done."
              accent="teams"
              icon={<UsersIcon />}
              features={['Upvote / downvote queue', 'DJ role & promotions', 'Mood & language filters', 'Session recap card']}
              onClick={() => { setPortal('teams'); setMode('create'); }}
            />
            <PortalCard
              title="Duo"
              tagline="Two-person room"
              description="A private space for two. Floating hearts, shared love notes, a musical memory timeline, and scheduled surprise reveals."
              accent="duo"
              icon={<HeartIcon />}
              features={['Just the two of you', 'Floating heart reactions', 'Our Songs memory timeline', 'Scheduled surprise messages']}
              onClick={() => { setPortal('duo'); setMode('create'); }}
            />
          </div>
        )}

        {/* create form */}
        {mode === 'create' && portal && (
          <FormCard title={`Create a ${portal === 'teams' ? 'Teams' : 'Duo'} room`} accent={portal} onBack={reset}>
            <Field label="Your name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" maxLength={24} className={inputCls()} />
            </Field>
            <Field label="Room name (optional)">
              <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder={portal === 'teams' ? 'Friday night session' : 'Our room'} maxLength={40} className={inputCls()} />
            </Field>
            <div className="flex gap-2">
              <button onClick={createRoom} disabled={busy || !name.trim()} className={btnCls(portal)}>{busy ? 'Creating…' : 'Create room'}</button>
              <JoinInsteadLink onClick={() => setMode('join')} />
            </div>
          </FormCard>
        )}

        {/* join form */}
        {mode === 'join' && (
          <FormCard title="Join a room" accent={portal ?? 'teams'} onBack={reset}>
            <Field label="Your name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" maxLength={24} className={inputCls()} />
            </Field>
            <Field label="Room code">
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="ABC123" maxLength={6} className={`font-mono tracking-[0.3em] text-center uppercase ${inputCls()}`} />
            </Field>
            <div className="flex gap-2">
              <button onClick={joinRoom} disabled={busy || !name.trim() || joinCode.length < 6} className={btnCls(portal ?? 'teams')}>{busy ? 'Joining…' : 'Join room'}</button>
            </div>
          </FormCard>
        )}

        {err && <p className="text-center text-red-300 text-sm mt-4">{err}</p>}

        {/* footer */}
        <footer className="mt-20 text-center text-white/30 text-xs">
          <p>SyncBeat · Bring your own audio URLs and YouTube IDs. No songs are bundled or scraped.</p>
        </footer>
      </div>
    </div>
  );
}

// Resolve a room id and portal from a code. Since rooms are RLS-locked, we
// use the resolve_room_by_code SECURITY DEFINER RPC which returns {id, portal}
// on a match and null otherwise. This is the join entry point.
async function resolveRoomId(code: string): Promise<{ id: string; portal: Portal } | null> {
  const { data, error } = await supabase.rpc('resolve_room_by_code', { p_code: code });
  if (error || !data) return null;
  const row = data as { id?: string; portal?: Portal; error?: string };
  if (row.error || !row.id || !row.portal) return null;
  return { id: row.id, portal: row.portal };
}

function PortalCard({ title, tagline, description, features, accent, icon, onClick }: {
  title: string; tagline: string; description: string; features: string[];
  accent: Portal; icon: React.ReactNode; onClick: () => void;
}) {
  const isTeams = accent === 'teams';
  return (
    <button
      onClick={onClick}
      className={`group text-left rounded-3xl p-6 border transition-all duration-300 hover:-translate-y-1 focus-visible:ring-2 ${
        isTeams
          ? 'bg-gradient-to-br from-teams-950/60 to-black border-teams-800/40 hover:border-teams-600/60 focus-visible:ring-teams-400'
          : 'bg-gradient-to-br from-duo-950/60 to-black border-duo-800/40 hover:border-duo-600/60 focus-visible:ring-duo-400'
      }`}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${isTeams ? 'bg-teams-600/20 text-teams-300' : 'bg-duo-700/20 text-duo-300'}`}>
        {icon}
      </div>
      <h3 className="font-display text-2xl font-extrabold mb-0.5">{title}</h3>
      <p className={`text-xs uppercase tracking-wider mb-3 ${isTeams ? 'text-teams-300/70' : 'text-duo-300/70'}`}>{tagline}</p>
      <p className="text-white/60 text-sm mb-4 leading-relaxed">{description}</p>
      <ul className="space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-white/70">
            <span className={isTeams ? 'text-teams-400' : 'text-duo-400'}>✓</span>
            {f}
          </li>
        ))}
      </ul>
    </button>
  );
}

function FormCard({ title, accent, onBack, children }: { title: string; accent: Portal; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto animate-scale-in">
      <button onClick={onBack} className="text-sm text-white/40 hover:text-white/80 mb-4 transition-colors">← Back</button>
      <div className={`rounded-3xl p-6 border bg-white/[0.03] ${accent === 'teams' ? 'border-teams-800/40' : 'border-duo-800/40'}`}>
        <h2 className="font-display text-2xl font-bold mb-5">{title}</h2>
        <div className="space-y-4">{children}</div>
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

function JoinInsteadLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-sm py-2.5 px-4 rounded-xl transition-colors text-white/60 hover:text-white/90">
      Join instead →
    </button>
  );
}

function inputCls() {
  return 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-white/40 outline-none transition-colors';
}
function btnCls(portal: Portal) {
  return `flex-1 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-40 ${
    portal === 'teams' ? 'bg-teams-600 hover:bg-teams-500' : 'bg-duo-700 hover:bg-duo-600'
  }`;
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="url(#lg)" />
      <path d="M9 15V9l5 3-5 3z" fill="#fff" />
      <defs><linearGradient id="lg" x1="0" y1="0" x2="24" y2="24"><stop stopColor="#3285fc" /><stop offset="1" stopColor="#c3445e" /></linearGradient></defs>
    </svg>
  );
}
function UsersIcon() {
  return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
}
function HeartIcon() {
  return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>);
}
