## Context

LogLayer 前端代码当前状态：
- `App.tsx` 1001 行，混合状态管理、业务逻辑、UI
- `LogViewer.tsx` 968 行，Canvas 渲染、交互、选择逻辑全在一起
- `hooks/` 25 个文件，部分功能重叠（useSearch/useSearchLogic, useFileWatch/useLoadingState）
- 主题只有 dark/light 两种，配色单调
- 图标使用内联 SVG，风格不统一
- 缺少现代交互组件（Toast、Popover、Dropdown）

**约束**：
- 逐步迁移，避免大规模重写
- 保持性能不退化（Canvas 虚拟滚动是关键路径）

## Goals / Non-Goals

**Goals:**
- 拆分 LogViewer 为独立渲染 hooks + 纯函数，降低耦合
- 拆分 App.tsx 引入 React Context，降低复杂度
- 整理 hooks 数量从 25 到 15，消除重叠
- 引入专业主题预设（Monokai、Dracula、Nord）
- 统一使用 lucide-react 图标
- 建立样式 token 系统
- 升级右键菜单为 Radix UI

**Non-Goals:**
- 不改变后端 API
- 不重构后端代码
- 不添加新的业务功能
- 不做移动端响应式优化

## Decisions

### D1: LogViewer 拆分方案
**决定**: 使用 custom hooks 拆分 + 纯渲染函数

**理由**: 
- React hooks 是官方推荐模式
- 保持现有 Canvas 性能优化
- 便于单元测试

**备选方案**:
- 使用 @tanstack/react-virtual: 需重写虚拟滚动，可能引入性能问题
- 使用 Monaco Editor: 过于重量级，不适合纯日志展示

### D2: 状态管理方案
**决定**: 使用 React Context 替代 props drilling

**理由**:
- 无需引入 Redux/Zustand，保持轻量
- 与现有 hooks 模式兼容
- 适合本项目规模

**备选方案**:
- Redux: 过于重量
- Zustand: 需学习新 API

### D3: 组件库方案
**决定**: Radix UI + Headless UI

**理由**:
- 无样式，易定制
- 完整的键盘无障碍支持
- 与 Tailwind CSS 完美配合

**备选方案**:
- Shadcn/ui: 基于 Radix，更完整但需学习新模式
- Headless UI: 功能较 Radix 少

### D4: 主题系统方案
**决定**: 扩展现有 theme.ts + 新增 presets.ts

**理由**:
- 保持现有架构不变
- 渐进式增强
- 便于用户自定义

### D5: 图标方案
**决定**: 完全替换为 lucide-react

**理由**:
- 2000+ 图标，覆盖全面
- Tree-shaking 友好
- 统一专业风格

**备选方案**:
- Heroicons: 图标数量少
- FontAwesome: 过于重量

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|:-----|:-----|:---------|
| 拆分后性能下降 | Canvas 渲染可能变慢 | 使用 useMemo/useCallback 优化，保留 RAF |
| Context 重渲染 | 状态变更触发全量重渲染 | 使用 useMemo 包裹 value，拆分 Context |
| Radix 学习曲线 | 团队需熟悉新组件 | 仅用于复杂交互（右键菜单、Dialog） |
| 主题切换兼容性 | 现有图层颜色可能不匹配 | 提供主题适配指南 |

## Migration Plan

**Phase 1: Hooks 整理** (不改变组件结构)
1. 合并 useSearch + useSearchLogic → useSearch
2. 合并 useFileWatch + useLoadingState → useFileState
3. 合并 useScrollPrediction + usePerformanceOptimization → useVirtualScroll
4. 移动 useDrag + useRemotePathPicker → useFileManagement

**Phase 2: LogViewer 拆分**
1. 提取 useCanvasRender hook
2. 提取 useSelection hook  
3. 提取 useContextMenu hook
4. 创建 CanvasRenderer.ts 纯函数

**Phase 3: App.tsx 重构**
1. 创建 FileContext.tsx
2. 创建 LayerContext.tsx
3. 拆分 MainLayout.tsx
4. 迁移状态到 Context

**Phase 4: UI/UX 增强**
1. 安装 lucide-react, @radix-ui/react-*, sonner
2. 创建 theme/presets.ts
3. 创建 styles/tokens.ts
4. 替换图标
5. 重做右键菜单

**Rollback**: 使用 Git 分支管理，随时可回滚
