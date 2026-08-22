# Scope: ai-assistant-features

## 新增

- frontend/src/components/AIChatPanel.tsx
- frontend/src/hooks/useAIChat.ts
- backend/ai/                                 # AI 服务模块目录
- backend/ai/service.py
- backend/ai/providers/
- backend/ai/providers/local.py
- backend/ai/providers/cloud.py
- backend/ai/providers/heuristic.py
- backend/ai/timestamp.py
- backend/ai/endpoints.py                     # AI API 端点

## 修改

- frontend/src/App.tsx
- frontend/src/components/SettingsPanel.tsx
- frontend/src/components/TimeRangePicker.tsx
- frontend/src/bridge_client.ts
- backend/main.py                             # AI 路由挂载
- AGENTS.md

## 删除

- （无）
