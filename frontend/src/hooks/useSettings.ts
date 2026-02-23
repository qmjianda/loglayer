import { useState, useEffect, useCallback } from 'react';

export interface AppSettings {
  autoOpenLastFile: boolean;
  rememberWindowPosition: boolean;
  fileEncoding: string;
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  lineHeight: number;
  showLineNumbers: boolean;
  showRuler: boolean;
  searchRegexDefault: boolean;
  searchCaseSensitiveDefault: boolean;
  searchHighlightAll: boolean;
  searchHistoryLimit: number;
  wordWrap: boolean;
  showWhitespace: boolean;
  virtualScrollBuffer: number;
  layerPresetDefault: string;
  syncLayersOnOpen: boolean;
  backendUrl: string;
  debugMode: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoOpenLastFile: true,
  rememberWindowPosition: true,
  fileEncoding: 'utf-8',
  theme: 'dark',
  fontSize: 12,
  lineHeight: 20,
  showLineNumbers: true,
  showRuler: true,
  searchRegexDefault: false,
  searchCaseSensitiveDefault: false,
  searchHighlightAll: true,
  searchHistoryLimit: 50,
  wordWrap: false,
  showWhitespace: false,
  virtualScrollBuffer: 500,
  layerPresetDefault: '',
  syncLayersOnOpen: true,
  backendUrl: 'http://127.0.0.1:12345',
  debugMode: false,
};

const STORAGE_KEY = 'loglayer_settings';

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const theme = settings.theme === 'system' ? getSystemTheme() : settings.theme;
    setResolvedTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--font-size', `${settings.fontSize}px`);
    document.documentElement.style.setProperty('--line-height', `${settings.lineHeight}px`);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (settings.theme === 'system') {
        const newTheme = getSystemTheme();
        setResolvedTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [settings.theme, settings.fontSize, settings.lineHeight, isLoaded]);

  const saveSettings = useCallback((newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    saveSettings({ [key]: value });
  }, [saveSettings]);

  const resetToDefault = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
  }, [saveSettings]);

  return {
    settings,
    resolvedTheme,
    isLoaded,
    saveSettings,
    updateSetting,
    resetToDefault,
  };
}
