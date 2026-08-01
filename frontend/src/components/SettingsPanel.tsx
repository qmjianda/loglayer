import { useState } from 'react';
import { useSettings, AppSettings } from '../hooks/useSettings';
import { AISettingsPanel } from './DynamicUI/AISettings';
import { clearCache, setCacheConfig } from '../bridge_client';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { settings: globalSettings, updateSetting: globalUpdate, resetToDefault } = useSettings();
  const [activeTab, setActiveTab] = useState<string>('general');
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const hasChanges = localSettings !== null;

  const currentSettings = localSettings ?? globalSettings;

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!localSettings) {
      setLocalSettings({ ...globalSettings, [key]: value });
    } else {
      setLocalSettings({ ...localSettings, [key]: value });
    }
  };

  const saveSettings = () => {
    if (localSettings) {
      Object.entries(localSettings).forEach(([key, value]) => {
        globalUpdate(key as keyof AppSettings, value);
      });
      // 同步缓存大小配置到后端并触发 LRU 淘汰
      setCacheConfig(localSettings.cacheSizeMB);
      setLocalSettings(null);
    }
    onClose();
  };

  const handleClearCache = async () => {
    await clearCache();
    setLocalSettings(null);
  };

  const cancel = () => {
    setLocalSettings(null);
    onClose();
  };

  const handleResetToDefault = () => {
    resetToDefault();
    setLocalSettings(null);
  };

  const tabs = [
    { id: 'general', label: '通用', icon: '⚙️' },
    { id: 'appearance', label: '外观', icon: '🎨' },
    { id: 'search', label: '搜索', icon: '🔍' },
    { id: 'viewer', label: '查看器', icon: '📄' },
    { id: 'layers', label: '图层', icon: '📑' },
    { id: 'ai', label: 'AI', icon: '🤖' },
    { id: 'advanced', label: '高级', icon: '🔧' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={cancel}>
      <div 
        className="bg-theme-surface border border-theme-default rounded-lg shadow-2xl w-[700px] h-[550px] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-subtle shrink-0">
          <h2 className="text-sm font-semibold text-theme-primary">设置</h2>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-yellow-500">有未保存的更改</span>
            )}
            <button onClick={cancel} className="text-theme-secondary hover:text-theme-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 侧边栏 */}
          <div className="w-40 border-r border-theme-subtle p-2 shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-theme-primary' 
                    : 'text-theme-secondary hover:bg-theme-hover'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 设置内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            
            {/* 通用设置 */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <Section title="启动">
                  <Toggle
                    label="自动打开上次文件"
                    description="启动时自动打开上次关闭的文件"
                    checked={currentSettings.autoOpenLastFile}
                    onChange={v => handleChange('autoOpenLastFile', v)}
                  />
                  <Toggle
                    label="记住窗口位置和大小"
                    description="重启后恢复上次窗口状态"
                    checked={currentSettings.rememberWindowPosition}
                    onChange={v => handleChange('rememberWindowPosition', v)}
                  />
                </Section>

                <Section title="文件">
                  <Select
                    label="文件编码"
                    value={currentSettings.fileEncoding}
                    options={[
                      { value: 'utf-8', label: 'UTF-8' },
                      { value: 'gbk', label: 'GBK (简体中文)' },
                      { value: 'gb2312', label: 'GB2312' },
                      { value: 'ascii', label: 'ASCII' },
                    ]}
                    onChange={v => handleChange('fileEncoding', v)}
                  />
                </Section>
              </div>
            )}

            {/* 外观设置 */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <Section title="主题">
                  <div className="flex gap-2">
                    {(['dark', 'light', 'system'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => handleChange('theme', t)}
                        className={`px-4 py-3 text-sm rounded border flex-1 ${
                          currentSettings.theme === t
                            ? 'border-blue-500 bg-blue-500/20 text-theme-primary'
                            : 'border-theme-default text-theme-secondary hover:border-gray-500'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-lg mb-1">{t === 'dark' ? '🌙' : t === 'light' ? '☀️' : '💻'}</div>
                          <div>{t === 'dark' ? '深色' : t === 'light' ? '亮色' : '跟随系统'}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>

                <Section title="字体">
                  <NumberInput
                    label="字体大小"
                    value={currentSettings.fontSize}
                    min={10}
                    max={24}
                    unit="px"
                    onChange={v => handleChange('fontSize', v)}
                  />
                  <NumberInput
                    label="行高"
                    value={currentSettings.lineHeight}
                    min={14}
                    max={40}
                    unit="px"
                    onChange={v => handleChange('lineHeight', v)}
                  />
                </Section>

                <Section title="显示">
                  <Toggle
                    label="显示行号"
                    description="在左侧显示行号"
                    checked={currentSettings.showLineNumbers}
                    onChange={v => handleChange('showLineNumbers', v)}
                  />
                  <Toggle
                    label="显示标尺"
                    description="显示垂直参考线"
                    checked={currentSettings.showRuler}
                    onChange={v => handleChange('showRuler', v)}
                  />
                </Section>
              </div>
            )}

            {/* 搜索设置 */}
            {activeTab === 'search' && (
              <div className="space-y-6">
                <Section title="默认搜索选项">
                  <Toggle
                    label="默认使用正则表达式"
                    description="搜索框默认启用正则模式"
                    checked={currentSettings.searchRegexDefault}
                    onChange={v => handleChange('searchRegexDefault', v)}
                  />
                  <Toggle
                    label="默认区分大小写"
                    description="搜索框默认启用大小写敏感"
                    checked={currentSettings.searchCaseSensitiveDefault}
                    onChange={v => handleChange('searchCaseSensitiveDefault', v)}
                  />
                </Section>

                <Section title="高亮">
                  <Toggle
                    label="高亮所有匹配"
                    description="在文件中高亮所有搜索匹配项"
                    checked={currentSettings.searchHighlightAll}
                    onChange={v => handleChange('searchHighlightAll', v)}
                  />
                </Section>

                <Section title="历史记录">
                  <NumberInput
                    label="搜索历史记录数"
                    value={currentSettings.searchHistoryLimit}
                    min={10}
                    max={200}
                    onChange={v => handleChange('searchHistoryLimit', v)}
                  />
                </Section>
              </div>
            )}

            {/* 查看器设置 */}
            {activeTab === 'viewer' && (
              <div className="space-y-6">
                <Section title="文本显示">
                  <Toggle
                    label="自动换行"
                    description="长行自动换行显示"
                    checked={currentSettings.wordWrap}
                    onChange={v => handleChange('wordWrap', v)}
                  />
                  <Toggle
                    label="显示空白字符"
                    description="显示空格和制表符"
                    checked={currentSettings.showWhitespace}
                    onChange={v => handleChange('showWhitespace', v)}
                  />
                </Section>

                <Section title="性能">
                  <NumberInput
                    label="虚拟滚动缓冲区"
                    value={currentSettings.virtualScrollBuffer}
                    min={100}
                    max={1000}
                    description="滚动时预加载的行数（越大越流畅但更占内存）"
                    onChange={v => handleChange('virtualScrollBuffer', v)}
                  />
                </Section>
              </div>
            )}

            {/* 图层设置 */}
            {activeTab === 'layers' && (
              <div className="space-y-6">
                <Section title="图层">
                  <Toggle
                    label="打开文件时同步图层"
                    description="重新打开文件时自动恢复上次图层"
                    checked={currentSettings.syncLayersOnOpen}
                    onChange={v => handleChange('syncLayersOnOpen', v)}
                  />
                </Section>
              </div>
            )}

            {/* AI 设置 */}
            {activeTab === 'ai' && (
              <AISettingsPanel />
            )}

            {/* 高级设置 */}
            {activeTab === 'advanced' && (
              <div className="space-y-6">
                <Section title="连接">
                  <TextInput
                    label="后端服务器地址"
                    value={currentSettings.backendUrl}
                    placeholder="http://127.0.0.1:12345"
                    onChange={v => handleChange('backendUrl', v)}
                  />
                </Section>

                <Section title="开发者">
                  <Toggle
                    label="调试模式"
                    description="显示性能监控和详细日志"
                    checked={currentSettings.debugMode}
                    onChange={v => handleChange('debugMode', v)}
                  />
                </Section>

                <Section title="数据">
                  <button
                    onClick={resetToDefault}
                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-theme-primary rounded"
                  >
                    重置所有设置为默认
                  </button>
                </Section>

                <Section title="缓存">
                  <NumberInput
                    label="缓存大小"
                    value={currentSettings.cacheSizeMB}
                    min={128}
                    max={16384}
                    unit="MB"
                    description="行偏移索引缓存上限（LRU 淘汰），最少保留 1 个文件"
                    onChange={v => handleChange('cacheSizeMB', v)}
                  />
                  <button
                    onClick={handleClearCache}
                    className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-500 text-theme-primary rounded"
                  >
                    清空缓存
                  </button>
                </Section>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-theme-subtle shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-theme-secondary hover:text-theme-primary"
          >
            取消
          </button>
          <button
            onClick={saveSettings}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-theme-primary rounded"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

// 辅助组件
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-xs font-semibold text-theme-muted uppercase mb-3">{title}</h3>
    <div className="space-y-3">{children}</div>
  </div>
);

const Toggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      className="mt-1 w-4 h-4 rounded accent-blue-500"
    />
    <div>
      <div className="text-sm text-theme-primary">{label}</div>
      {description && <div className="text-xs text-theme-muted">{description}</div>}
    </div>
  </label>
);

const Select: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div>
    <div className="text-sm text-theme-primary mb-1">{label}</div>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-theme-base border border-theme-default rounded px-3 py-2 text-sm text-theme-primary"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const NumberInput: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  description?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, unit, description, onChange }) => (
  <div>
    <div className="flex items-center gap-2">
      <span className="text-sm text-theme-primary">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="w-20 bg-theme-base border border-theme-default rounded px-2 py-1 text-sm text-theme-primary"
      />
      {unit && <span className="text-xs text-theme-muted">{unit}</span>}
    </div>
    {description && <div className="text-xs text-theme-muted mt-1">{description}</div>}
  </div>
);

const TextInput: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <div>
    <div className="text-sm text-theme-primary mb-1">{label}</div>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-theme-base border border-theme-default rounded px-3 py-2 text-sm text-theme-primary"
    />
  </div>
);
