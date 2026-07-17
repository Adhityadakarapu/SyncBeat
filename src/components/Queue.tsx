import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { LANGUAGE_TAGS, MOOD_TAGS } from '../lib/utils';
import type { Track } from '../lib/types';

interface QueueProps {
  roomId: string;
  code: string;
  myName: string;
  tracks: Track[];
  isHost: boolean;
  isDj: boolean;
  onPlayTrack: (track: Track) => void;
  onChanged?: () => void;
}

type SortKey = 'votes' | 'added';

export function Queue({ roomId, code, myName, tracks, isHost, isDj, onPlayTrack, onChanged }: QueueProps) {
  const [sort, setSort] = useState<SortKey>('votes');
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [langFilter, setLangFilter] = useState<string | null>(null);

  const canControl = isHost || isDj;

  const queued = useMemo(() => {
    let list = tracks.filter((t) => t.status === 'queue');
    if (moodFilter) list = list.filter((t) => t.mood_tags.includes(moodFilter));
    if (langFilter) list = list.filter((t) => t.language_tags.includes(langFilter));
    list = [...list].sort((a, b) => (sort === 'votes' ? b.net_votes - a.net_votes : +new Date(a.added_at) - +new Date(b.added_at)));
    return list;
  }, [tracks, sort, moodFilter, langFilter]);

  const vote = async (t: Track, dir: number) => {
    const current = t.voters[myName];
    const next = current === dir ? 0 : dir;
    await api.voteTrack(roomId, code, t.id, myName, next);
    onChanged?.();
  };

  const remove = async (t: Track) => {
    await api.removeTrack(roomId, code, t.id);
    onChanged?.();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 pt-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Up Next ({queued.length})</h3>
          <div className="flex bg-white/5 rounded-full p-0.5">
            <button onClick={() => setSort('votes')} className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${sort === 'votes' ? 'bg-teams-600 text-white' : 'text-white/60'}`}>Top</button>
            <button onClick={() => setSort('added')} className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${sort === 'added' ? 'bg-teams-600 text-white' : 'text-white/60'}`}>New</button>
          </div>
        </div>
        {/* filters */}
        <div className="flex flex-wrap gap-1">
          <FilterChip label="All moods" active={moodFilter === null} onClick={() => setMoodFilter(null)} />
          {MOOD_TAGS.map((m) => (
            <FilterChip key={m} label={m} active={moodFilter === m} onClick={() => setMoodFilter(moodFilter === m ? null : m)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <FilterChip label="All langs" active={langFilter === null} onClick={() => setLangFilter(null)} />
          {LANGUAGE_TAGS.map((l) => (
            <FilterChip key={l} label={l} active={langFilter === l} onClick={() => setLangFilter(langFilter === l ? null : l)} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-2 mt-1">
        {queued.length === 0 && (
          <p className="text-center text-white/40 text-sm mt-6">Queue is empty. Add tracks below.</p>
        )}
        {queued.map((t, i) => (
          <QueueRow
            key={t.id}
            track={t}
            rank={i + 1}
            myVote={t.voters[myName] ?? 0}
            canControl={canControl}
            onVote={vote}
            onPlay={() => onPlayTrack(t)}
            onRemove={() => remove(t)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
        active ? 'bg-teams-600 border-teams-500 text-white' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

function QueueRow({
  track, rank, myVote, canControl, onVote, onPlay, onRemove,
}: {
  track: Track;
  rank: number;
  myVote: number;
  canControl: boolean;
  onVote: (t: Track, dir: number) => void;
  onPlay: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-2 transition-colors">
      <span className="text-xs text-white/30 w-4 text-center tabular-nums">{rank}</span>
      <div className="flex flex-col items-center w-12">
        <button
          onClick={() => onVote(track, 1)}
          className={`text-sm leading-none hover:scale-110 transition-transform ${myVote === 1 ? 'text-teams-400' : 'text-white/50'}`}
          aria-label="Upvote"
        >
          ▲
        </button>
        <span className="text-xs font-bold text-white tabular-nums">{track.net_votes}</span>
        <button
          onClick={() => onVote(track, -1)}
          className={`text-sm leading-none hover:scale-110 transition-transform ${myVote === -1 ? 'text-red-400' : 'text-white/50'}`}
          aria-label="Downvote"
        >
          ▼
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{track.title}</p>
        <p className="text-[11px] text-white/40 truncate">
          {track.source === 'youtube' ? 'YouTube' : 'Audio'} · {track.added_by}
        </p>
        {(track.mood_tags.length > 0 || track.language_tags.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {track.mood_tags.map((t) => (
              <span key={t} className="text-[9px] bg-teams-500/20 text-teams-200 px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
            {track.language_tags.map((t) => (
              <span key={t} className="text-[9px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}
      </div>
      {canControl && (
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={onPlay} className="text-[10px] bg-teams-600 hover:bg-teams-500 text-white px-2 py-1 rounded-md" aria-label="Play now">Play</button>
          <button onClick={onRemove} className="text-[10px] bg-white/10 hover:bg-red-600 text-white px-2 py-1 rounded-md" aria-label="Remove">Skip</button>
        </div>
      )}
    </div>
  );
}
