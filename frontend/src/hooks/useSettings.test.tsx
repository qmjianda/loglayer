import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SettingsProvider, useSettings, DEFAULT_SETTINGS, type AppSettings } from '../hooks/useSettings';

describe('hooks/useSettings', () => {
  let mockLocalStorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLocalStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      document: {
        documentElement: {
          setAttribute: vi.fn(),
          style: {
            setProperty: vi.fn(),
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should have default settings', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('should load settings from localStorage', async () => {
    const savedSettings: Partial<AppSettings> = {
      theme: 'light',
      fontSize: 14,
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedSettings));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.settings.theme).toBe('light');
    expect(result.current.settings.fontSize).toBe(14);
  });

  it('should update single setting', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    await act(async () => {
      result.current.updateSetting('theme', 'light');
    });

    expect(result.current.settings.theme).toBe('light');
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('should reset to default settings', async () => {
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ theme: 'light', fontSize: 14 }));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    await act(async () => {
      result.current.resetToDefault();
    });

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('should resolve system theme to dark', async () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      document: {
        documentElement: {
          setAttribute: vi.fn(),
          style: {
            setProperty: vi.fn(),
          },
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    await act(async () => {
      result.current.updateSetting('theme', 'system');
    });

    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('should resolve system theme to light', async () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      document: {
        documentElement: {
          setAttribute: vi.fn(),
          style: {
            setProperty: vi.fn(),
          },
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    await act(async () => {
      result.current.updateSetting('theme', 'system');
    });

    expect(result.current.resolvedTheme).toBe('light');
  });

  it('should update multiple settings at once via updateSetting', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    await act(async () => {
      result.current.updateSetting('fontSize', 16);
      result.current.updateSetting('lineHeight', 24);
    });

    expect(result.current.settings.fontSize).toBe(16);
    expect(result.current.settings.lineHeight).toBe(24);
  });
});
