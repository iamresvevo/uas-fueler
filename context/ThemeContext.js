import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import * as SecureStore from 'expo-secure-store';
import config from '../constants/config';

const STORAGE_KEY = 'uas_fueler_appearance';
const MODES = ['system', 'light', 'dark'];

const lightColors = {
  ...config.colors,
  darker1: 'rgba(16, 24, 32, 0.08)',
  darker3: 'rgba(16, 24, 32, 0.24)',
  darker5: 'rgba(16, 24, 32, 0.48)',
  darker7: 'rgba(16, 24, 32, 0.70)',
  darker9: 'rgba(16, 24, 32, 0.90)',
  lighter05: 'rgba(16, 24, 32, 0.05)',
  lighter1: 'rgba(16, 24, 32, 0.10)',
  lighter3: 'rgba(16, 24, 32, 0.32)',
  lighter5: 'rgba(16, 24, 32, 0.56)',
  lighter9: 'rgba(16, 24, 32, 0.88)',
  white: '#171a1d',
  darklight: '#d3d8dd',
  dark: '#f2f4f6',
  darker: '#e9edf0',
  darkest: '#dfe4e8',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfacePressed: '#e8ecef',
  border: 'rgba(16, 24, 32, 0.12)',
  textMuted: 'rgba(16, 24, 32, 0.64)',
  tile: '#ffffff',
  sheet: '#ffffff',
  yellowDarker: '#7a4e00',
  onAccent: '#ffffff',
  onDark: '#ffffff',
  qrBackground: '#ffffff',
  qrForeground: '#111417',
};

const darkColors = {
  ...config.colors,
  sheet: '#2d3237',
  onAccent: '#ffffff',
  onDark: '#ffffff',
  qrBackground: '#ffffff',
  qrForeground: '#111417',
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState('system');
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then(savedMode => {
      if (MODES.includes(savedMode)) setMode(savedMode);
    }).catch(() => {}).finally(() => setIsThemeReady(true));
  }, []);

  const setThemeMode = useCallback((nextMode) => {
    if (!MODES.includes(nextMode)) return;
    setMode(nextMode);
    SecureStore.setItemAsync(STORAGE_KEY, nextMode).catch(() => {});
  }, []);

  const effectiveMode = mode === 'system'
    ? (systemScheme === 'light' ? 'light' : 'dark')
    : mode;
  const isDark = effectiveMode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  useEffect(() => {
    NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch(() => {});
    NavigationBar.setBackgroundColorAsync(colors.dark).catch(() => {});
  }, [colors.dark, isDark]);

  const value = useMemo(() => ({
    mode,
    modes: MODES,
    effectiveMode,
    isDark,
    colors,
    setThemeMode,
  }), [mode, effectiveMode, isDark, colors, setThemeMode]);

  if (!isThemeReady) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used within ThemeProvider');
  return context;
}

export function useThemedStyles(createStyles) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [createStyles, theme.colors]);
  return { ...theme, styles };
}
