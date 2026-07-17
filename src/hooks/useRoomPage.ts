import { useEffect } from 'react';

export function useRoomPage() {
  useEffect(() => {
    document.title = 'SyncBeat — Room';
    return () => {
      document.title = 'SyncBeat — Listen Together, In Sync';
    };
  }, []);
}
