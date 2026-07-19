export interface ThemeDef {
  id: string;
  label: string;
  icon: string;
  /** CSS background value. Empty string means "use the portal's own default look". */
  gradient: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'classic', label: 'Classic', icon: '🎧', gradient: '' },
  { id: 'night', label: 'Night', icon: '🌙', gradient: 'linear-gradient(160deg, #05070f 0%, #0b1024 45%, #000000 100%)' },
  { id: 'sunset', label: 'Sunset', icon: '🌅', gradient: 'linear-gradient(160deg, #3a0f1f 0%, #7a2e1f 35%, #b5501f 60%, #1a0a10 100%)' },
  { id: 'neon', label: 'Neon', icon: '💜', gradient: 'linear-gradient(160deg, #05010f 0%, #200a3a 30%, #4a0a4a 55%, #000000 100%)' },
  { id: 'forest', label: 'Forest', icon: '🌲', gradient: 'linear-gradient(160deg, #04140d 0%, #0a2418 40%, #123a26 65%, #000000 100%)' },
];

export function getThemeDef(id: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
