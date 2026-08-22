## Why

当前日志分析依赖用户手动设置时间范围、过滤器和高亮规则，效率低下。用户需要智能分析功能来：
1. 自动识别日志时间戳格式，无需手动配置
2. 智能推荐时间范围，基于日志内容中的异常时间段
3. 通过自然语言或选中内容让 AI 分析日志模式

**关键约束**：AI 仅分析用户提供的内容（选中文本、粘贴到聊天框的文本），不自动分析整个文件，保护隐私。无 AI 时软件功能完全不受影响。

## What Changes

### 新增功能

1. **AI 助手面板**
   - 侧边栏可展开的 AI 聊天面板
   - 支持粘贴日志进行分析
   - 支持选中日志后右键 "Send to AI"
   - 显示 AI 分析结果和建议

2. **AI 时间戳检测**
   - 时间范围图层添加 "AI 智能检测" 按钮
   - 自动分析日志样本，识别时间戳格式
   - 自动填充建议的起始/结束时间

3. **AI 时间范围建议**
   - 基于日志内容分析，标记高密度区域
   - 点击建议的时间段，一键应用过滤器
   - 识别错误/警告聚集的时间段

4. **设置面板集成**
   - AI Provider 选择：本地 (Ollama) / 云端 (OpenAI)
   - API Key 配置（加密存储）
   - 本地模型选择（支持 llama3, qwen 等）
   - 云端模型选择（gpt-4o-mini, gpt-4o 等）

### 技术变更

- 新增 `backend/ai/` 模块
- 新增 `POST /api/ai/*` 端点
- 新增 `useAIChat` React Hook
- 前端组件：AIChatPanel, AITimePicker

## Capabilities

### New Capabilities

- `ai-chat`: AI 助手聊天功能，分析用户提供的内容
- `ai-timestamp-detection`: 自动检测日志时间戳格式
- `ai-time-range-suggestion`: 智能推荐时间范围
- `ai-settings`: 设置面板中的 AI 配置

### Modified Capabilities

- 无（现有功能不受影响）

## Impact

### 前端
- `frontend/src/components/AIChatPanel.tsx` - 新增
- `frontend/src/hooks/useAIChat.ts` - 新增
- `frontend/src/components/SettingsPanel.tsx` - 添加 AI 设置
- `frontend/src/components/TimeRangePicker.tsx` - 添加 AI 按钮
- `frontend/src/App.tsx` - 集成 AI 面板

### 后端
- `backend/ai/service.py` - AI 服务主模块
- `backend/ai/providers/` - AI Provider 抽象
- `backend/ai/providers/local.py` - Ollama 支持
- `backend/ai/providers/cloud.py` - OpenAI 支持
- `backend/ai/providers/heuristic.py` - 离线回退方案
- `backend/ai/timestamp.py` - 时间戳检测
- `backend/ai/endpoints.py` - FastAPI 路由

### API
- `POST /api/ai/chat` - AI 聊天
- `POST /api/ai/detect-timestamp` - 时间戳检测
- `POST /api/ai/suggest-time-range` - 时间范围建议
- `GET /api/ai/models` - 可用模型列表
- `POST /api/ai/test-connection` - 测试连接

### 依赖
- `openai` - OpenAI API
- `ollama` (可选) - 本地模型
- `pydantic` - 配置模型
