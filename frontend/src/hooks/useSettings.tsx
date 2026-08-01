import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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
  cacheSizeMB: number;
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
  cacheSizeMB: 2048,
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

interface UseSettingsReturn {
  settings: AppSettings;
  resolvedTheme: 'dark' | 'light';
  isLoaded: boolean;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetToDefault: () => void;
}

const SettingsContext = createContext<UseSettingsReturn | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
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
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save settings:', e);
      }
      return updated;
    });
  }, []);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    saveSettings({ [key]: value });
  }, [saveSettings]);

  const resetToDefault = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
  }, [saveSettings]);

  return (
    <SettingsContext.Provider value={{ settings, resolvedTheme, isLoaded, updateSetting, resetToDefault }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): UseSettingsReturn {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
