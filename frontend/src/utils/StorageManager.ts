type StorageKey = 
  | 'loglayer_settings'
  | 'loglayer_presets'
  | 'loglayer_rpp_last_path'
  | 'loglayer_search_history';

interface StorageDefaults {
  'loglayer_settings': Record<string, unknown>;
  'loglayer_presets': unknown[];
  'loglayer_rpp_last_path': string;
  'loglayer_search_history': string[];
}

const DEFAULTS: StorageDefaults = {
  'loglayer_settings': {},
  'loglayer_presets': [],
  'loglayer_rpp_last_path': '',
  'loglayer_search_history': [],
};

export const StorageManager = {
  get<K extends StorageKey>(key: K): StorageDefaults[K] | null {
    try {
      const value = localStorage.getItem(key);
      if (!value) return DEFAULTS[key] as StorageDefaults[K];
      return JSON.parse(value);
    } catch {
      console.warn(`[StorageManager] Failed to parse ${key}, using default`);
      return DEFAULTS[key] as StorageDefaults[K];
    }
  },

  set<K extends StorageKey>(key: K, value: StorageDefaults[K]): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`[StorageManager] Failed to save ${key}:`, e);
    }
  },

  remove(key: StorageKey): void {
    localStorage.removeItem(key);
  },
};