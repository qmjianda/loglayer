import { useState, useCallback, useEffect } from 'react';
import { getBackendUrl, fetchJson } from '../utils';

export type AIProviderType = 'heuristic' | 'openai' | 'ollama';

export interface AISettings {
  provider: AIProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  isConnected: boolean;
}

export interface UseAISettingsReturn {
  settings: AISettings;
  isLoading: boolean;
  error: string | null;
  updateSettings: (newSettings: Partial<AISettings>) => Promise<void>;
  testConnection: () => Promise<{ connected: boolean; message: string }>;
  availableModels: string[];
  loadModels: () => Promise<void>;
}

export function useAISettings(): UseAISettingsReturn {
  const [settings, setSettings] = useState<AISettings>({
    provider: 'heuristic',
    model: 'gpt-4o-mini',
    baseUrl: 'http://localhost:11434',
    isConnected: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      console.debug('[AISettings] Loading config from /api/ai/config...');
      const config = await fetchJson<{ provider: string; model: string; isConnected: boolean; baseUrl?: string }>('/api/ai/config');
      console.debug('[AISettings] Config loaded:', config);
      setSettings({
        provider: config.provider as AIProviderType,
        model: config.model,
        isConnected: config.isConnected,
        baseUrl: config.baseUrl
      });
    } catch (err) {
      console.error('[AISettings] Failed to load AI config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadModels = useCallback(async () => {
    try {
      console.debug('[AISettings] Loading models for provider:', settings.provider);
      const result = await fetchJson<{ models: string[] }>('/api/ai/models');
      console.debug('[AISettings] Models loaded:', result.models);
      setAvailableModels(result.models);
    } catch (err) {
      console.error('[AISettings] Failed to load models:', err);
    }
  }, [settings.provider]);

  const updateSettings = useCallback(async (newSettings: Partial<AISettings>) => {
    try {
      setError(null);
      const merged = { ...settings, ...newSettings };
      setSettings(merged);
      
      const payload: any = {
        provider: merged.provider,
        model: merged.model,
      };
      
      if (merged.apiKey) {
        payload.api_key = merged.apiKey;
      }
      if (merged.baseUrl) {
        payload.base_url = merged.baseUrl;
      }
      
      console.debug('[AISettings] Updating config:', payload);
      await fetchJson('/api/ai/config', 'POST', payload);
      console.debug('[AISettings] Config updated successfully');
    } catch (err) {
      console.error('[AISettings] Failed to update settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  }, [settings]);

  const testConnection = useCallback(async () => {
    try {
      console.debug('[AISettings] Testing connection...');
      const result = await fetchJson<{ connected: boolean; message: string }>('/api/ai/test-connection', 'POST');
      console.debug('[AISettings] Connection test result:', result);
      setSettings(prev => ({ ...prev, isConnected: result.connected }));
      return result;
    } catch (err) {
      console.error('[AISettings] Connection test failed:', err);
      return { connected: false, message: err instanceof Error ? err.message : 'Connection failed' };
    }
  }, []);

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    testConnection,
    availableModels,
    loadModels
  };
}
