import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { getThemeColors, palettes } from './colors';

const THEME_KEY = 'zigran_theme_mode';
const PALETTE_KEY = 'zigran_theme_palette';

const ThemeContext = createContext({
  isDark: false,
  paletteId: 'ocean',
  palettes,
  colors: getThemeColors({ isDark: false, paletteId: 'ocean' }),
  navTheme: NavigationDefaultTheme,
  setIsDark: () => {},
  toggleTheme: () => {},
  setPaletteId: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDarkState] = useState(false);
  const [paletteId, setPaletteIdState] = useState('ocean');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedMode, storedPalette] = await Promise.all([
          SecureStore.getItemAsync(THEME_KEY),
          SecureStore.getItemAsync(PALETTE_KEY),
        ]);
        if (cancelled) return;
        setIsDarkState(storedMode === 'dark');
        if (storedPalette) setPaletteIdState(String(storedPalette));
      } catch {
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setIsDark = useCallback(async (next) => {
    const value = Boolean(next);
    setIsDarkState(value);
    try {
      await SecureStore.setItemAsync(THEME_KEY, value ? 'dark' : 'light');
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkState((prev) => {
      const next = !prev;
      SecureStore.setItemAsync(THEME_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }, []);

  const setPaletteId = useCallback(async (next) => {
    const value = String(next || 'ocean');
    setPaletteIdState(value);
    try {
      await SecureStore.setItemAsync(PALETTE_KEY, value);
    } catch {}
  }, []);

  const themeColors = useMemo(() => getThemeColors({ isDark, paletteId }), [isDark, paletteId]);

  const navTheme = useMemo(
    () => {
      const base = isDark ? NavigationDarkTheme : NavigationDefaultTheme;
      return {
        ...base,
        dark: isDark,
        colors: {
          ...base.colors,
          primary: themeColors.primary,
          background: themeColors.background,
          card: themeColors.surface,
          text: themeColors.textPrimary,
          border: themeColors.border,
          notification: themeColors.secondary,
        },
      };
    },
    [isDark, themeColors],
  );

  const value = useMemo(
    () => ({
      isDark,
      paletteId,
      palettes,
      colors: themeColors,
      navTheme,
      hydrated,
      setIsDark,
      toggleTheme,
      setPaletteId,
    }),
    [isDark, navTheme, setIsDark, toggleTheme, hydrated, themeColors, paletteId, setPaletteId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
