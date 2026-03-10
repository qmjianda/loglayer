import React, { useState, useEffect } from 'react';
import { useAISettings, AIProviderType, AIModelParams, DEFAULT_MODEL_PARAMS } from '../../hooks/useAISettings';

// Tab types
type SettingsTab = 'model' | 'params' | 'about';

interface AISettingsPanelProps {
  onClose?: () => void;
}

const providerOptions: { value: AIProviderType; label: string; icon: string; desc: string }[] = [
  { value: 'heuristic', label: '启发式', icon: '⚡', desc: '离线分析，无需网络' },
  { value: 'openai', label: 'OpenAI', icon: '🔮', desc: 'GPT 系列模型' },
  { value: 'ollama', label: 'Ollama', icon: '🐳', desc: '本地大模型' },
  { value: 'custom', label: '自定义', icon: '🔧', desc: 'OpenAI 兼容 API' },
];

const ollamaModels = ['llama3.2', 'llama3', 'qwen2.5', 'mistral', 'phi3', 'codellama'];
const openaiModels = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (推荐)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

export const AISettingsPanel: React.FC<AISettingsPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('model');
  const {
    settings,
    isLoading,
    error,
    updateSettings,
    updateParams,
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

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await testConnection();
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      updateSettings({ apiKey: apiKey.trim() });
      setApiKey('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-theme-muted">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[500px]">
      {/* Left Sidebar */}
      <div className="w-48 bg-theme-header border-r border-theme-subtle flex flex-col">
        <div className="p-4 border-b border-theme-subtle">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-theme-primary">AI 设置</span>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <TabButton
            active={activeTab === 'model'}
            onClick={() => setActiveTab('model')}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
            label="模型设置"
          />
          <TabButton
            active={activeTab === 'params'}
            onClick={() => setActiveTab('params')}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            }
            label="模型参数"
          />
          <TabButton
            active={activeTab === 'about'}
            onClick={() => setActiveTab('about')}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="关于"
          />
        </nav>

        {/* Connection Status */}
        <div className="p-3 border-t border-theme-subtle">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${settings.isConnected ? 'bg-green-500' : 'bg-orange-500'} ${settings.isConnected ? 'animate-pulse' : ''}`} />
            <span className="text-xs text-theme-muted">
              {settings.isConnected ? '已连接' : '未连接'}
            </span>
          </div>
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'model' && (
          <ModelSettingsContent
            settings={settings}
            providerOptions={providerOptions}
            availableModels={availableModels}
            apiKey={apiKey}
            showApiKey={showApiKey}
            testResult={testResult}
            isTesting={isTesting}
            onProviderChange={handleProviderChange}
            onModelChange={(model) => updateSettings({ model })}
            onBaseUrlChange={(baseUrl) => updateSettings({ baseUrl })}
            onApiKeyChange={setApiKey}
            onShowApiKeyToggle={() => setShowApiKey(!showApiKey)}
            onSaveApiKey={handleSaveApiKey}
            onTestConnection={handleTestConnection}
          />
        )}
        {activeTab === 'params' && (
          <ParamsSettingsContent
            params={settings.params}
            provider={settings.provider}
            onParamsChange={updateParams}
          />
        )}
        {activeTab === 'about' && (
          <AboutContent />
        )}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 hover:bg-theme-elevated rounded-lg transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {error && (
        <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-500/90 text-white text-sm rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
};

// Tab Button Component
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
      active
        ? 'bg-blue-600/20 text-blue-400'
        : 'text-theme-secondary hover:bg-theme-elevated hover:text-theme-primary'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// Model Settings Content
const ModelSettingsContent: React.FC<{
  settings: ReturnType<typeof useAISettings>['settings'];
  providerOptions: typeof providerOptions;
  availableModels: string[];
  apiKey: string;
  showApiKey: boolean;
  testResult: { connected: boolean; message: string } | null;
  isTesting: boolean;
  onProviderChange: (p: AIProviderType) => void;
  onModelChange: (m: string) => void;
  onBaseUrlChange: (u: string) => void;
  onApiKeyChange: (k: string) => void;
  onShowApiKeyToggle: () => void;
  onSaveApiKey: () => void;
  onTestConnection: () => void;
}> = ({
  settings,
  providerOptions,
  availableModels,
  apiKey,
  showApiKey,
  testResult,
  isTesting,
  onProviderChange,
  onModelChange,
  onBaseUrlChange,
  onApiKeyChange,
  onShowApiKeyToggle,
  onSaveApiKey,
  onTestConnection,
}) => (
  <div className="p-4 space-y-5">
    {/* Provider Selection */}
    <div>
      <label className="block text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">AI Provider</label>
      <div className="grid grid-cols-2 gap-2">
        {providerOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => onProviderChange(opt.value)}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              settings.provider === opt.value
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-theme-default hover:border-theme-subtle hover:bg-theme-elevated'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{opt.icon}</span>
              <span className="text-sm font-medium text-theme-primary">{opt.label}</span>
            </div>
            <p className="text-xs text-theme-muted">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>

    {/* Model Selection */}
    {settings.provider !== 'heuristic' && (
      <div>
        <label className="block text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">模型</label>
        <select
          value={settings.model}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full px-3 py-2.5 bg-theme-surface border border-theme-default rounded-lg text-sm text-theme-primary focus:border-blue-500 focus:outline-none cursor-pointer"
        >
          {settings.provider === 'openai' && openaiModels.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
          {settings.provider === 'ollama' && (
            availableModels.length > 0 ? (
              availableModels.map(m => <option key={m} value={m}>{m}</option>)
            ) : (
              ollamaModels.map(m => <option key={m} value={m}>{m}</option>)
            )
          )}
          {settings.provider === 'custom' && availableModels.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    )}

    {/* Base URL */}
    {(settings.provider === 'openai' || settings.provider === 'custom' || settings.provider === 'ollama') && (
      <div>
        <label className="block text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">
          {settings.provider === 'ollama' ? '服务地址' : 'API 地址'}
        </label>
        <input
          type="text"
          value={settings.baseUrl || ''}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder={
            settings.provider === 'ollama' 
              ? 'http://localhost:11434'
              : settings.provider === 'custom'
              ? 'https://api.siliconflow.cn/v1'
              : 'https://api.openai.com/v1'
          }
          className="w-full px-3 py-2.5 bg-theme-surface border border-theme-default rounded-lg text-sm text-theme-primary placeholder-theme-muted focus:border-blue-500 focus:outline-none"
        />
      </div>
    )}

    {/* API Key */}
    {(settings.provider === 'openai' || settings.provider === 'custom') && (
      <div>
        <label className="block text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">API Key</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2.5 pr-10 bg-theme-surface border border-theme-default rounded-lg text-sm text-theme-primary placeholder-theme-muted focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={onShowApiKeyToggle}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-primary cursor-pointer"
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
            onClick={onSaveApiKey}
            disabled={!apiKey.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-theme-default disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            保存
          </button>
        </div>
      </div>
    )}

    {/* Test Connection */}
    {settings.provider !== 'heuristic' && (
      <div className="pt-2 border-t border-theme-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onTestConnection}
              disabled={isTesting}
              className="px-4 py-2 bg-theme-elevated hover:bg-theme-default disabled:opacity-50 disabled:cursor-not-allowed text-theme-primary text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {isTesting ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  测试中...
                </span>
              ) : (
                '测试连接'
              )}
            </button>
            {testResult && (
              <span className={`text-xs ${testResult.connected ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
);

// Params Settings Content
const ParamsSettingsContent: React.FC<{
  params: AIModelParams;
  provider: AIProviderType;
  onParamsChange: (p: Partial<AIModelParams>) => void;
}> = ({ params, provider, onParamsChange }) => {
  if (provider === 'heuristic') {
    return (
      <div className="p-4 flex items-center justify-center h-64 text-theme-muted">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-theme-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">启发式模式无需配置模型参数</p>
        </div>
      </div>
    );
  }

  const paramConfig = [
    { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.1, desc: '控制输出的随机性，值越高越随机' },
    { key: 'maxTokens', label: '最大 Tokens', min: 256, max: 128000, step: 256, desc: '单次回复的最大 token 数' },
    { key: 'topP', label: 'Top P', min: 0, max: 1, step: 0.1, desc: '核采样参数，值越大约保守' },
    { key: 'topK', label: 'Top K', min: 1, max: 100, step: 1, desc: '保留最高概率的 K 个词' },
    { key: 'presencePenalty', label: '存在惩罚', min: -2, max: 2, step: 0.1, desc: '减少重复词出现' },
    { key: 'frequencyPenalty', label: '频率惩罚', min: -2, max: 2, step: 0.1, desc: '降低高频词权重' },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-theme-primary mb-1">模型参数</h3>
        <p className="text-xs text-theme-muted">调整模型生成行为（部分模型可能不支持所有参数）</p>
      </div>

      {paramConfig.map(({ key, label, min, max, step, desc }) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-theme-primary">{label}</label>
            <span className="text-xs text-theme-muted font-mono bg-theme-elevated px-2 py-0.5 rounded">
              {params[key as keyof AIModelParams]}
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={params[key as keyof AIModelParams] as number}
            onChange={(e) => onParamsChange({ [key]: parseFloat(e.target.value) })}
            className="w-full h-2 bg-theme-default rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <p className="text-xs text-theme-muted">{desc}</p>
        </div>
      ))}

      <button
        onClick={() => onParamsChange(DEFAULT_MODEL_PARAMS)}
        className="w-full mt-4 px-3 py-2 bg-theme-elevated hover:bg-theme-default text-theme-secondary text-sm rounded-lg transition-colors cursor-pointer"
      >
        恢复默认参数
      </button>
    </div>
  );
};

// About Content
const AboutContent: React.FC = () => (
  <div className="p-4 space-y-4">
    <div className="text-center py-6">
      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-theme-primary">LogLayer AI</h3>
      <p className="text-xs text-theme-muted mt-1">智能日志分析助手</p>
    </div>

    <div className="space-y-2 text-sm">
      <div className="flex justify-between py-2 border-b border-theme-subtle">
        <span className="text-theme-muted">版本</span>
        <span className="text-theme-primary">1.0.0</span>
      </div>
      <div className="flex justify-between py-2 border-b border-theme-subtle">
        <span className="text-theme-muted">功能</span>
        <span className="text-theme-primary">日志分析 / 异常检测 / 智能建议</span>
      </div>
    </div>

    <div className="pt-4 border-t border-theme-subtle">
      <p className="text-xs text-theme-muted text-center">
        基于 AI 大模型理解日志内容，提供智能分析和建议
      </p>
    </div>
  </div>
);

export default AISettingsPanel;
