export const palettes = [
  {
    id: 'ocean',
    name: 'Okyanus',
    light: { primary: '#2563EB', primaryDark: '#1E40AF', secondary: '#06B6D4' },
    dark: { primary: '#60A5FA', primaryDark: '#2563EB', secondary: '#22D3EE' },
  },
  {
    id: 'emerald',
    name: 'Zümrüt',
    light: { primary: '#059669', primaryDark: '#047857', secondary: '#0EA5E9' },
    dark: { primary: '#34D399', primaryDark: '#10B981', secondary: '#38BDF8' },
  },
  {
    id: 'sunset',
    name: 'Gün Batımı',
    light: { primary: '#F97316', primaryDark: '#EA580C', secondary: '#EC4899' },
    dark: { primary: '#FDBA74', primaryDark: '#FB923C', secondary: '#FB7185' },
  },
  {
    id: 'grape',
    name: 'Üzüm',
    light: { primary: '#7C3AED', primaryDark: '#6D28D9', secondary: '#A855F7' },
    dark: { primary: '#C4B5FD', primaryDark: '#A78BFA', secondary: '#E879F9' },
  },
  {
    id: 'rose',
    name: 'Gül',
    light: { primary: '#E11D48', primaryDark: '#BE123C', secondary: '#F97316' },
    dark: { primary: '#FB7185', primaryDark: '#F43F5E', secondary: '#FDBA74' },
  },
  {
    id: 'slate',
    name: 'Gece',
    light: { primary: '#0F172A', primaryDark: '#020617', secondary: '#64748B' },
    dark: { primary: '#E2E8F0', primaryDark: '#CBD5E1', secondary: '#94A3B8' },
  },
];

export function getThemeColors({ isDark, paletteId }) {
  const palette =
    palettes.find((p) => p.id === paletteId) ?? palettes.find((p) => p.id === 'ocean') ?? palettes[0];
  const accent = isDark ? palette.dark : palette.light;

  const neutrals = isDark
    ? {
        background: '#0B1220',
        surface: '#111A2B',
        surface2: '#16223A',
        elevated: '#1B2A47',
        textPrimary: '#FAFAFA',
        textSecondary: '#A3A3A3',
        textMuted: '#71717A',
        placeholder: '#71717A',
        border: '#263552',
        divider: '#1B2A47',
        shadow: '#000000',
      }
    : {
        background: '#F6F7FB',
        surface: '#FFFFFF',
        surface2: '#F1F5F9',
        elevated: '#FFFFFF',
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        textMuted: '#94A3B8',
        placeholder: '#94A3B8',
        border: '#E2E8F0',
        divider: '#E2E8F0',
        shadow: '#000000',
      };

  return {
    primary: accent.primary,
    primaryDark: accent.primaryDark,
    primaryLight: isDark ? '#0B1220' : '#EEF2FF',
    secondary: accent.secondary,
    ring: accent.primary,

    ...neutrals,

    success: isDark ? '#34D399' : '#10B981',
    warning: isDark ? '#FBBF24' : '#F59E0B',
    error: isDark ? '#F87171' : '#EF4444',
    info: accent.primary,

    chart1: accent.primary,
    chart2: accent.secondary,
    chart3: isDark ? '#34D399' : '#10B981',
  };
}

export const lightColors = getThemeColors({ isDark: false, paletteId: 'ocean' });
export const darkColors = getThemeColors({ isDark: true, paletteId: 'ocean' });
export const colors = lightColors;
