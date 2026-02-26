## Why

LogLayer 前端代码存在严重的架构问题：App.tsx (1001行) 和 LogViewer.tsx (968行) 职责过重，混合了状态管理、业务逻辑和 UI 渲染；hooks 目录有 25 个文件，部分功能重叠。这导致维护困难、难以扩展，UI/UX 也不够专业（主题单一、图标不统一、缺少现代交互组件）。

## What Changes

- **重构 LogViewer 组件**：将 968 行拆分为独立的渲染 hooks 和纯函数，职责分离
- **重构 App.tsx**：引入 React Context 拆分全局状态，提取布局组件
- **整理 Hooks**：25 个合并为 15 个核心 hooks，消除功能重叠
- **增强主题系统**：增加 Monokai/Dracula/Nord 等专业主题预设
- **统一图标系统**：使用 lucide-react 替换内联 SVG
- **建立样式 token**：抽取设计系统 token（spacing, shadows, radius, transitions）
- **升级交互组件**：用 Radix UI 重做右键菜单、Dialog 等

## Capabilities

### New Capabilities
- `theme-presets`: 新增专业主题预设（Monokai、Dracula、Nord）
- `icon-system`: 统一图标组件库（lucide-react）
- `style-tokens`: 统一样式设计 token 系统
- `component-library`: 通用基础组件库（Button、Input、Modal 等）

### Modified Capabilities
- `log-viewer`: 重构内部架构，拆分为 hooks + 纯渲染函数
- `app-state`: 使用 Context 拆分全局状态管理

## Impact

- `frontend/src/components/LogViewer.tsx` - 拆分重构
- `frontend/src/App.tsx` - Context 拆分
- `frontend/src/hooks/` - 整理合并
- `frontend/src/theme.ts` - 扩展主题系统
- 新增 `frontend/src/components/common/` - 基础组件库
- 新增 `frontend/src/theme/tokens.ts` - 设计 token
- 需安装: `lucide-react`, `@radix-ui/react-*`, `sonner`
