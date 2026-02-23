# Proposal: improve-loglayer-features

## Why

LogLayer 经过多轮迭代，核心功能已稳定。但存在以下改进空间：

1. **性能监控缺失** - 已有 `usePerformanceOptimization` hook 但未实际使用，用户无法感知系统状态
2. **搜索体验不完整** - 搜索高亮和导航可以更直观
3. **主题系统不彻底** - RemotePathPicker.css 和 Canvas 渲染仍有硬编码颜色
4. **插件系统雏形** - 已有 Layer 插件系统，但缺乏可视化管理和市场

这些改进将提升用户体验，使其更接近生产级工具。

## What Changes

### 新增功能
1. **性能监控面板** - 显示 FPS、内存使用、缓存命中率、虚拟滚动状态
2. **搜索状态指示器** - 显示搜索结果数量、当前位置、匹配高亮计数
3. **RemotePathPicker 主题适配** - 使用 CSS 变量，支持亮色主题

### 优化功能
1. **Canvas 渲染颜色主题化** - LogViewer 中的颜色使用主题变量
2. **搜索高亮增强** - 添加结果计数、匹配统计
3. **设置面板预览** - 实时预览设置变更效果

### 代码改进
1. 完善 `usePerformanceOptimization` hook 实现
2. 提取所有硬编码颜色为主题变量

## Capabilities

### New Capabilities
- `performance-monitor`: 实时性能监控面板，显示 FPS、内存、缓存状态
- `search-status-bar`: 搜索结果状态指示器
- `theme-completion`: 主题系统完善，覆盖所有组件

### Modified Capabilities
- `settings-system`: 现有设置系统增强实时预览
- `layer-management`: 图层管理面板优化

## Impact

### 前端影响
- 新增 `PerformanceMonitor.tsx` 组件
- 修改 `LogViewer.tsx` Canvas 颜色主题化
- 修改 `SearchPanel.tsx` 添加状态指示器
- 修改 `RemotePathPicker.css` 使用 CSS 变量
- 修改 `index.css` 添加性能监控样式

### 后端影响
- 无（纯前端改进）

### 依赖
- React 19
- TypeScript
- Tailwind CSS 4

### 风险
- Canvas 渲染颜色修改需严格测试
- 性能监控不应影响实际性能
