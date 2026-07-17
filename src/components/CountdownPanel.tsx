import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatLongDate } from '../lib/utils';
import type { Countdown } from '../lib/types';

export function CountdownPanel({ roomId, code, countdowns, onChanged }: { roomId: string; code: string; countdowns: Countdown[]; onChanged?: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    setErr(null);
    if (!title.trim() || !date) { setErr('Add a title and date.'); return; }
    const { error } = await api.addCountdown(roomId, code, title.trim(), new Date(date).toISOString());
    if (error) { setErr(error); return; }
    setTitle(''); setDate('');
    onChanged?.();
  };

  const active = countdowns[0];

  return (
    <div className="space-y-4">
      {active && <CountdownDisplay title={active.title} target={new Date(active.target_date).getTime()} now={now} />}
      <div className="space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Countdown title (e.g. Our anniversary)" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-duo-400/50 outline-none" />
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-duo-400/50 outline-none [color-scheme:dark]" />
        {err && <p className="text-xs text-red-300">{err}</p>}
        <button onClick={add} disabled={!title.trim() || !date} className="w-full py-2 rounded-lg bg-duo-700 hover:bg-duo-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">Set countdown</button>
      </div>
      {countdowns.length > 1 && (
        <p className="text-[11px] text-white/40">{countdowns.length} countdowns saved · showing the first.</p>
      )}
    </div>
  );
}

function CountdownDisplay({ title, target, now }: { title: string; target: number; now: number }) {
  const diff = target - now;
  if (diff <= 0) {
    return (
      <div className="text-center py-4 animate-scale-in">
        <p className="text-2xl mb-1">🎉</p>
        <p className="text-duo-200 font-display text-lg">{title} is today!</p>
        <p className="text-xs text-white/40 mt-1">{formatLongDate(new Date(target).toISOString())}</p>
      </div>
    );
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <div className="text-center py-3">
      <p className="text-xs uppercase tracking-widest text-gold-300/70 mb-2">{title}</p>
      <div className="flex justify-center gap-2 sm:gap-3">
        <Unit label="days" value={d} />
        <Unit label="hrs" value={h} />
        <Unit label="min" value={m} />
        <Unit label="sec" value={s} />
      </div>
    </div>
  );
}

function Unit({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl sm:text-3xl font-extrabold font-display text-white tabular-nums bg-white/5 rounded-xl w-14 sm:w-16 py-2">{value.toString().padStart(2, '0')}</span>
      <span className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{label}</span>
    </div>
  );
}
