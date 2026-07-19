import { useEffect, useState } from 'react';
import { Landing } from './components/Landing';
import { Auth } from './components/Auth';
import { TeamsRoom, LeaveRoomConfirm, LoadingScreen } from './components/TeamsRoom';
import { DuoRoom } from './components/DuoRoom';
import { useLeaveRoomGuard } from './hooks/useLeaveRoomGuard';
import { auth } from './lib/auth';
import type { Profile } from './lib/auth';
import { supabase } from './lib/supabase';
import type { Portal } from './lib/types';

interface RoomRoute {
  roomId: string;
  code: string;
  portal: Portal;
  myName: string;
}

function parseHash(): { route: 'landing' | 'room'; room?: RoomRoute } {
  const h = window.location.hash.replace(/^#\/?/, '');
  // expected: /r/:portal/:code  OR  /r/:portal/:code/:roomId/:name
  const parts = h.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0] === 'r') {
    const portal = parts[1] as Portal;
    const code = parts[2]?.toUpperCase() ?? '';
    const roomId = parts[3] ?? '';
    const myName = parts[4] ? decodeURIComponent(parts[4]) : '';
    if (portal && code && roomId && myName) {
      return { route: 'room', room: { roomId, code, portal, myName } };
    }
    if (portal && code) {
      // join link without name/roomid — go to landing with prefilled code
      return { route: 'landing' };
    }
  }
  return { route: 'landing' };
}

export default function App() {
  const [route, setRoute] = useState(parseHash());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Restore an existing session on load, and keep in sync if it's signed
  // out or refreshed elsewhere (e.g. another tab, or token expiry).
  useEffect(() => {
    let cancelled = false;
    auth.getCurrentProfile().then((p) => {
      if (!cancelled) { setProfile(p); setAuthChecked(true); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        return;
      }
      const p = await auth.getCurrentProfile();
      if (!cancelled) setProfile(p);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const enterRoom = (p: RoomRoute) => {
    window.location.hash = `/r/${p.portal}/${p.code}/${p.roomId}/${encodeURIComponent(p.myName)}`;
  };

  const goToLanding = () => { window.location.hash = '/'; };
  const guard = useLeaveRoomGuard(route.route === 'room', goToLanding);

  const signOut = async () => {
    await auth.logOut();
    window.location.hash = '/';
  };

  if (!authChecked) {
    return <LoadingScreen />;
  }

  if (!profile) {
    return <Auth onAuthenticated={setProfile} />;
  }

  if (route.route === 'room' && route.room) {
    const r = route.room;
    return (
      <>
        {r.portal === 'teams'
          ? <TeamsRoom roomId={r.roomId} code={r.code} myName={r.myName} onLogoClick={guard.requestLeave} />
          : <DuoRoom roomId={r.roomId} code={r.code} myName={r.myName} onLogoClick={guard.requestLeave} />}
        {guard.showConfirm && <LeaveRoomConfirm onStay={guard.cancelLeave} onLeave={guard.confirmLeave} />}
      </>
    );
  }

  return <Landing onEnter={enterRoom} myName={profile.username} onSignOut={signOut} />;
}
