import { useEffect, useState } from 'react';
import { api, type CatalogEntry } from '../lib/api';
import { deriveTitle, LANGUAGE_TAGS, MOOD_TAGS, parseTrackInput } from '../lib/utils';
import type { Portal } from '../lib/types';

interface AddTrackProps {
  roomId: string;
  code: string;
  myName: string;
  portal: Portal;
  onAdded?: () => void;
}

export function AddTrack({ roomId, code, myName, portal, onAdded }: AddTrackProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [mood, setMood] = useState<string[]>([]);
  const [lang, setLang] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogFilter, setCatalogFilter] = useState<string>('Telugu');
  const [addingId, setAddingId] = useState<string | null>(null);

  const accent = portal === 'teams' ? 'teams' : 'duo';

  useEffect(() => {
    api.getCatalog().then(({ data }) => {
      if (data) setCatalog(data);
    });
  }, []);

  const filteredCatalog = catalog.filter(
    (c) => !catalogFilter || c.language_tags.includes(catalogFilter) || c.mood_tags.includes(catalogFilter),
  );

  const quickAdd = async (entry: CatalogEntry) => {
    setAddingId(entry.id);
    setErr(null);
    const { error } = await api.addTrack(
      roomId, code, `https://www.youtube.com/watch?v=${entry.youtube_id}`, entry.title, myName,
      'youtube', entry.youtube_id, entry.mood_tags, entry.language_tags,
    );
    setAddingId(null);
    if (error) {
      setErr(error);
      return;
    }
    onAdded?.();
  };

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const submit = async () => {
    setErr(null);
    const parsed = parseTrackInput(url);
    if (!parsed) {
      setErr('Enter a valid audio URL or YouTube link/ID.');
      return;
    }
    setBusy(true);
    const finalTitle = title.trim() || deriveTitle(url, parsed.source);
    const { error } = await api.addTrack(
      roomId, code, parsed.url, finalTitle, myName,
      parsed.source, parsed.youtubeId, mood, lang,
    );
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    setUrl('');
    setTitle('');
    setMood([]);
    setLang([]);
    if (parsed.source === 'youtube' && parsed.youtubeId) {
      api.addToCatalog(finalTitle, null, parsed.youtubeId, lang, mood, myName);
    }
    onAdded?.();
  };

  const chip = (active: boolean) =>
    `text-xs px-2.5 py-1 rounded-full border transition-colors ${
      active
        ? accent === 'teams' ? 'bg-teams-600 border-teams-500 text-white' : 'bg-duo-700 border-duo-600 text-white'
        : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
    }`;

  return (
    <div className="space-y-3">
      {catalog.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-white/60">Quick add — click a song</p>
            <select
              value={catalogFilter}
              onChange={(e) => setCatalogFilter(e.target.value)}
              className="text-[11px] bg-white/5 border border-white/15 rounded-md px-1.5 py-1 text-white/70"
            >
              <option value="">All</option>
              {[...LANGUAGE_TAGS, ...MOOD_TAGS].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-1.5 bg-white/[0.02]">
            {filteredCatalog.length === 0 && (
              <p className="text-xs text-white/30 italic px-1.5 py-1">No songs in this category yet — add one below and it'll be saved here for next time.</p>
            )}
            {filteredCatalog.map((c) => (
              <button
                key={c.id}
                onClick={() => quickAdd(c)}
                disabled={addingId === c.id}
                className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-1.5 rounded-md hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="text-sm text-white truncate block">{c.title}</span>
                  {c.artist && <span className="text-[11px] text-white/40 truncate block">{c.artist}</span>}
                </span>
                <span className="text-[10px] text-white/40 shrink-0">{addingId === c.id ? 'Adding…' : '+ Add'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-white/10 pt-3">
        <p className="text-xs text-white/50 mb-2">Or paste a new link (it'll be added to the quick list above too)</p>
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Track URL or YouTube ID</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=…  or  https://example.com/song.mp3"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-white/40 outline-none"
        />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Title (optional)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Auto-detected if blank"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-white/40 outline-none"
        />
      </div>
      {portal === 'teams' && (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-white/60 mb-1.5">Mood</p>
            <div className="flex flex-wrap gap-1.5">
              {MOOD_TAGS.map((t) => (
                <button key={t} onClick={() => toggle(mood, setMood, t)} className={chip(mood.includes(t))}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-white/60 mb-1.5">Language</p>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGE_TAGS.map((t) => (
                <button key={t} onClick={() => toggle(lang, setLang, t)} className={chip(lang.includes(t))}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      {err && <p className="text-xs text-red-300">{err}</p>}
      <button
        onClick={submit}
        disabled={busy || !url.trim()}
        className={`w-full py-2.5 rounded-lg font-semibold text-white transition-all disabled:opacity-40 ${
          accent === 'teams' ? 'bg-teams-600 hover:bg-teams-500' : 'bg-duo-700 hover:bg-duo-600'
        }`}
      >
        {busy ? 'Adding…' : 'Add to queue'}
      </button>
    </div>
  );
}
