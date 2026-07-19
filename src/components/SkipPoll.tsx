import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Track } from '../lib/types';

interface SkipPollProps {
  roomId: string;
  code: string;
  myName: string;
  track: Track;
  skipVotes: Record<string, boolean>;
  skipTarget: string | null;
  memberCount: number;
  isHost: boolean;
  isDj: boolean;
  onChanged?: () => void;
}

export function SkipPoll({ roomId, code, myName, track, skipVotes, skipTarget, memberCount, isHost, isDj, onChanged }: SkipPollProps) {
  const [busy, setBusy] = useState(false);

  const votesForThisTrack = skipTarget === track.id ? skipVotes : {};
  const voteCount = Object.keys(votesForThisTrack).length;
  const myVoted = Boolean(votesForThisTrack[myName]);
  const needed = useMemo(() => Math.max(1, Math.floor(memberCount / 2) + 1), [memberCount]);
  const canOverride = isHost || isDj;

  const cast = async () => {
    setBusy(true);
    await api.castSkipVote(roomId, code, track.id, myName, memberCount);
    setBusy(false);
    onChanged?.();
  };

  const pct = Math.min(100, Math.round((voteCount / needed) * 100));

  return (
    <div
      className="rounded-xl border border-teams-500/30 bg-teams-500/10 px-3 py-2.5 space-y-2"
      role="group"
      aria-label="Skip this track poll"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-teams-200">
          {canOverride ? 'DJ controls' : 'Skip poll'}
        </p>
        {!canOverride && (
          <span className="text-[10px] text-white/50 tabular-nums">{voteCount}/{needed} to skip</span>
        )}
      </div>

      {!canOverride && (
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-teams-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      )}

      <button
        onClick={cast}
        disabled={busy}
        className={`w-full text-xs font-semibold rounded-lg py-1.5 transition-colors disabled:opacity-50 ${
          canOverride
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : myVoted
              ? 'bg-teams-500 text-white'
              : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
      >
        {canOverride ? 'Skip now' : myVoted ? 'Voted to skip — tap to undo' : 'Vote to skip this track'}
      </button>
    </div>
  );
}
