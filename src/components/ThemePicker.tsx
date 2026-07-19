import { useState } from 'react';
import { THEMES, getThemeDef } from '../lib/themes';

export function ThemePicker({ current, isHost, onChange }: { current: string; isHost: boolean; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const def = getThemeDef(current);

  return (
    <div className="relative">
      <button
        onClick={() => isHost && setOpen((o) => !o)}
        className={`text-xs rounded-full px-3 py-1.5 flex items-center gap-1 transition-colors ${
          isHost ? 'bg-white/10 hover:bg-white/20 text-white cursor-pointer' : 'bg-white/5 text-white/50 cursor-default'
        }`}
        title={isHost ? 'Change room theme' : 'Only the host can change the theme'}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span aria-hidden="true">{def.icon}</span>
        <span className="hidden sm:inline">{def.label}</span>
      </button>

      {open && isHost && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="listbox"
            className="absolute right-0 top-full mt-1 z-40 bg-[#141414] border border-white/10 rounded-xl p-1.5 w-40 shadow-xl animate-scale-in"
          >
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="option"
                aria-selected={t.id === current}
                onClick={() => {
                  onChange(t.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  t.id === current ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <span aria-hidden="true">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
