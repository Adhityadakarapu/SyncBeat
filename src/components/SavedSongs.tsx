import { useEffect, useState } from 'react';
import { api, type CatalogEntry } from '../lib/api';
import { LANGUAGE_TAGS, MOOD_TAGS } from '../lib/utils';
import type { Portal } from '../lib/types';

interface SavedSongsProps {
  roomId: string;
  code: string;
  myName: string;
  portal: Portal;
  onAdded?: () => void;
}

// Every unique song ever added anywhere in the app, deduped by YouTube ID
// (see the `song_catalog` table). This is intentionally NOT per-room — it's
// one shared, always-growing library, visible from both Teams and Duo
// rooms, that any member can click to queue into whichever room they're
// currently in.
export function SavedSongs({ roomId, code, myName, portal, onAdded }: SavedSongsProps) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const accent = portal === 'teams' ? 'teams' : 'duo';

  useEffect(() => {
    let cancelled = false;
    api.getCatalog().then(({ data }) => {
      if (!cancelled) { setCatalog(data ?? []); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = catalog.filter(
    (c) => !filter || c.language_tags.includes(filter) || c.mood_tags.includes(filter),
  );

  const addToRoom = async (entry: CatalogEntry) => {
    setAddingId(entry.id);
    setErr(null);
    const { error } = await api.addTrack(
      roomId, code, `https://www.youtube.com/watch?v=${entry.youtube_id}`, entry.title, myName,
      'youtube', entry.youtube_id, entry.mood_tags, entry.language_tags,
    );
    setAddingId(null);
    if (error) { setErr(error); return; }
    onAdded?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-white/60">Every song ever added, app-wide — click to add to this room</p>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-[11px] bg-white/5 border border-white/15 rounded-md px-1.5 py-1 text-white/70 shrink-0"
        >
          <option value="">All</option>
          {[...LANGUAGE_TAGS, ...MOOD_TAGS].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {err && <p className="text-xs text-red-300">{err}</p>}

      <div className="max-h-72 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-1.5 bg-white/[0.02]">
        {loading && <p className="text-xs text-white/30 italic px-1.5 py-1">Loading saved songs…</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-xs text-white/30 italic px-1.5 py-1">
            No saved songs yet{filter ? ' in this category' : ''}. Add a track from the Add Track tab and it'll show up here for everyone, in every room, from then on.
          </p>
        )}
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => addToRoom(c)}
            disabled={addingId === c.id}
            className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-1.5 rounded-md hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <span className="min-w-0">
              <span className="text-sm text-white truncate block">{c.title}</span>
              {c.artist && <span className="text-[11px] text-white/40 truncate block">{c.artist}</span>}
            </span>
            <span className={`text-[10px] shrink-0 ${accent === 'teams' ? 'text-teams-300' : 'text-duo-300'}`}>
              {addingId === c.id ? 'Adding…' : '+ Add'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
