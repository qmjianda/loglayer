import { useState, useCallback, useEffect } from 'react';
import { getBackendUrl, fetchJson } from '../utils';

export type AIProviderType = 'heuristic' | 'openai' | 'ollama';

export interface AISettings {
  provider: AIProviderType;
  model: string;
  apiKey?: string;
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
      const config = await fetchJson<{ provider: string; model: string; isConnected: boolean }>('/api/ai/config');
      setSettings({
        provider: config.provider as AIProviderType,
        model: config.model,
        isConnected: config.isConnected
      });
    } catch (err) {
      console.error('Failed to load AI config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadModels = useCallback(async () => {
    try {
      const result = await fetchJson<{ models: string[] }>('/api/ai/models');
      setAvailableModels(result.models);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<AISettings>) => {
    try {
      setError(null);
      const merged = { ...settings, ...newSettings };
      await fetchJson('/api/ai/config', 'POST', {
        provider: merged.provider,
        model: merged.model,
        api_key: merged.apiKey
      });
      setSettings(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  }, [settings]);

  const testConnection = useCallback(async () => {
    try {
      const result = await fetchJson<{ connected: boolean; message: string }>('/api/ai/test-connection', 'POST');
      setSettings(prev => ({ ...prev, isConnected: result.connected }));
      return result;
    } catch (err) {
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
