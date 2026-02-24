import React, { useState, useEffect } from 'react';
import { useAISettings, AIProviderType } from '../../hooks/useAISettings';

interface AISettingsPanelProps {
  onClose?: () => void;
}

export const AISettingsPanel: React.FC<AISettingsPanelProps> = ({ onClose }) => {
  const {
    settings,
    isLoading,
    error,
    updateSettings,
    testConnection,
    availableModels,
    loadModels
  } = useAISettings();

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{ connected: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadModels();
  }, [loadModels, settings.provider]);

  const handleProviderChange = (provider: AIProviderType) => {
    updateSettings({ provider, apiKey: undefined });
  };

  const handleModelChange = (model: string) => {
    updateSettings({ model });
  };

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      updateSettings({ apiKey: apiKey.trim() });
      setApiKey('');
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await testConnection();
    setTestResult(result);
    setIsTesting(false);
  };

  const providerOptions: { value: AIProviderType; label: string; desc: string }[] = [
    { value: 'heuristic', label: '启发式 (离线)', desc: '无需网络，使用正则表达式分析' },
    { value: 'openai', label: 'OpenAI (云端)', desc: '使用 GPT 模型，需要 API Key' },
    { value: 'ollama', label: 'Ollama (本地)', desc: '使用本地运行的模型' },
  ];

  if (isLoading) {
    return (
      <div className="p-4 text-center text-theme-muted">
        加载中...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-theme-primary">AI 设置</h2>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-theme-elevated rounded">
            <svg className="w-5 h-5 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Provider Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-theme-primary">AI Provider</label>
        <div className="space-y-2">
          {providerOptions.map(opt => (
            <label
              key={opt.value}
              className={`flex items-start p-3 rounded border cursor-pointer transition-colors ${
                settings.provider === opt.value
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-theme-default hover:border-theme-subtle'
              }`}
            >
              <input
                type="radio"
                name="provider"
                value={opt.value}
                checked={settings.provider === opt.value}
                onChange={() => handleProviderChange(opt.value)}
                className="mt-1 mr-3"
              />
              <div>
                <div className="text-sm font-medium text-theme-primary">{opt.label}</div>
                <div className="text-xs text-theme-muted">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      {settings.provider !== 'heuristic' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-theme-primary">模型</label>
          <select
            value={settings.model}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full px-3 py-2 bg-theme-surface border border-theme-default rounded text-sm text-theme-primary focus:border-blue-500 focus:outline-none"
          >
            {settings.provider === 'openai' && (
              <>
                <option value="gpt-4o-mini">gpt-4o-mini (推荐，性价比高)</option>
                <option value="gpt-4o">gpt-4o (更强能力)</option>
                <option value="gpt-4-turbo">gpt-4-turbo</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo (最便宜)</option>
              </>
            )}
            {settings.provider === 'ollama' && (
              <>
                {availableModels.length > 0 ? (
                  availableModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))
                ) : (
                  <>
                    <option value="llama3.2">llama3.2</option>
                    <option value="llama3">llama3</option>
                    <option value="qwen2.5">qwen2.5</option>
                    <option value="mistral">mistral</option>
                  </>
                )}
              </>
            )}
          </select>
        </div>
      )}

      {/* API Key (for OpenAI) */}
      {settings.provider === 'openai' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-theme-primary">API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-10 bg-theme-surface border border-theme-default rounded text-sm text-theme-primary placeholder-theme-muted focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-primary"
              >
                {showApiKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={handleSaveApiKey}
              disabled={!apiKey.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-theme-default disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
            >
              保存
            </button>
          </div>
          <p className="text-xs text-theme-muted">
            API Key 将安全存储在系统密钥链中
          </p>
        </div>
      )}

      {/* Connection Status */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-theme-primary">连接状态</label>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${settings.isConnected ? 'bg-green-500' : 'bg-orange-500'}`} />
          <span className="text-sm text-theme-secondary">
            {settings.isConnected ? '已连接' : '未连接'}
          </span>
          <button
            onClick={handleTestConnection}
            disabled={isTesting || settings.provider === 'heuristic'}
            className="px-3 py-1 text-xs bg-theme-elevated hover:bg-theme-default disabled:opacity-50 disabled:cursor-not-allowed text-theme-secondary rounded transition-colors"
          >
            {isTesting ? '测试中...' : '测试连接'}
          </button>
        </div>
        {testResult && (
          <div className={`text-xs ${testResult.connected ? 'text-green-400' : 'text-red-400'}`}>
            {testResult.message}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default AISettingsPanel;
