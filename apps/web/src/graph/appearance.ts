export type ThemeMode = 'light' | 'dark';
export type Appearance = { text: string; secondary: string; selected: string; inactive: string; labelSize: number; labelBackground: string; accentA: string; accentB: string };
export const appearanceDefaults: Record<ThemeMode, Appearance> = {
  light: { text: '#47364f', secondary: '#716575', selected: '#7050a0', inactive: '#c5b9cb', labelSize: 14, labelBackground: '#fffcfd', accentA: '#2563eb', accentB: '#18c7bd' },
  dark: { text: '#eee4f2', secondary: '#beb3c4', selected: '#bca3e3', inactive: '#62586b', labelSize: 14, labelBackground: '#26242b', accentA: '#8270b8', accentB: '#4d9aab' },
};
export const validColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function readAppearance(mode: ThemeMode): Appearance {
  const result = { ...appearanceDefaults[mode] };
  try {
    const saved = JSON.parse(localStorage.getItem(`pnet-appearance-v1-${mode}`) || '{}');
    for (const key of ['text', 'secondary', 'selected', 'inactive', 'accentA', 'accentB'] as const) if (validColor(saved?.[key])) result[key] = saved[key];
    if (Number.isFinite(saved?.labelSize)) result.labelSize = Math.max(10, Math.min(26, saved.labelSize));
  } catch { /* Browser storage may be unavailable. */ }
  return result;
}
