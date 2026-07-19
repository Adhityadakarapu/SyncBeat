import { useState } from 'react';
import { api } from '../lib/api';
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

  const accent = portal === 'teams' ? 'teams' : 'duo';

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
