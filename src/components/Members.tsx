import { avatarHue, initials } from '../lib/utils';
import type { Member } from '../lib/types';

interface MembersProps {
  members: Member[];
  hostName: string;
  djs: string[];
  myName: string;
  accent: 'teams' | 'duo';
  onToggleDj?: (name: string, promote: boolean) => void;
  onTransferHost?: (name: string) => void;
  isHost?: boolean;
  capacity?: number;
}

export function Members({ members, hostName, djs, myName, accent, onToggleDj, onTransferHost, isHost, capacity }: MembersProps) {
  const ring = accent === 'teams' ? 'ring-teams-400/50' : 'ring-duo-400/50';
  return (
    <div className="space-y-1.5">
      {members.map((m) => {
        const isDJ = djs.includes(m.name);
        const isRoomHost = m.name === hostName;
        return (
          <div key={m.name} className="flex items-center gap-2.5 group">
            <div className="relative">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ${ring}`}
                style={{ background: `hsl(${avatarHue(m.name)} 55% 45%)` }}
              >
                {initials(m.name)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-black/30" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-white truncate">{m.name}</span>
                {isRoomHost && (
                  <span className="text-[9px] uppercase tracking-wider bg-gold-500/30 text-gold-200 px-1.5 py-0.5 rounded-full font-bold">DJ</span>
                )}
                {isDJ && (
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold ${accent === 'teams' ? 'bg-teams-500/30 text-teams-200' : 'bg-duo-500/30 text-duo-200'}`}>DJ</span>
                )}
                {m.name === myName && <span className="text-[10px] text-white/40">you</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {onTransferHost && isHost && m.name !== hostName && (
                <button
                  onClick={() => {
                    if (window.confirm(`Make ${m.name} the DJ? You'll lose playback control.`)) {
                      onTransferHost(m.name);
                    }
                  }}
                  className="text-[10px] px-2 py-1 rounded-md bg-gold-600/80 hover:bg-gold-500 text-white"
                >
                  Transfer DJ
                </button>
              )}
              {onToggleDj && isHost && m.name !== hostName && (
                <button
                  onClick={() => onToggleDj(m.name, !isDJ)}
                  className="text-[10px] px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white"
                >
                  {isDJ ? 'Demote' : 'Make DJ'}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {capacity && members.length < capacity && (
        <p className="text-xs text-white/40 italic pt-1">Waiting for {capacity - members.length} more…</p>
      )}
    </div>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.35,
        background: `hsl(${avatarHue(name)} 55% 45%)`,
      }}
    >
      {initials(name)}
    </div>
  );
}
