import { useEffect, useState } from 'react';
import { Landing } from './components/Landing';
import { TeamsRoom } from './components/TeamsRoom';
import { DuoRoom } from './components/DuoRoom';
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

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const enterRoom = (p: RoomRoute) => {
    window.location.hash = `/r/${p.portal}/${p.code}/${p.roomId}/${encodeURIComponent(p.myName)}`;
  };

  if (route.route === 'room' && route.room) {
    const r = route.room;
    return r.portal === 'teams'
      ? <TeamsRoom roomId={r.roomId} code={r.code} myName={r.myName} />
      : <DuoRoom roomId={r.roomId} code={r.code} myName={r.myName} />;
  }

  return <Landing onEnter={enterRoom} />;
}
