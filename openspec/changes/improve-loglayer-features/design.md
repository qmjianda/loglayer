# Design: improve-loglayer-features

## Context

LogLayer 是一款高性能日志分析桌面应用，基于 pywebview + FastAPI + React 构建。当前版本已实现核心功能：

- 虚拟滚动支持千万行文件
- 8 种内置图层（filter, highlight, level, time, range, rowtint, bookmark, replace）
- 主题系统（暗色/亮色/系统）
- 设置面板

**当前问题**：
1. 性能监控仅有空壳 hook，用户无法感知系统状态
2. 搜索结果无直观计数和位置指示
3. Canvas 渲染和 RemotePathPicker 仍使用硬编码颜色
4. 设置变更无实时预览

## Goals / Non-Goals

### Goals
1. 实现性能监控面板，显示 FPS、内存、缓存状态
2. 实现搜索状态指示器，显示匹配数和当前位置
3. 完成主题系统，移除所有硬编码颜色
4. 设置面板支持实时预览

### Non-Goals
- 后端性能优化（仅前端改进）
- 新图层类型开发
- 用户认证系统
- 云同步功能

## Decisions

### 1. 性能监控实现方式

**决策**: 使用 StatusBar 集成性能指示器，而非独立面板

**理由**:
- 空间占用最小化
- 用户随时可见
- 实现复杂度低

**备选方案**:
- 独立面板 → 空间占用大，用户需主动打开
- 浮窗 → 可能遮挡内容

### 2. 主题系统实现方式

**决策**: 继续使用 CSS 变量 + Tailwind 兼容类

**理由**:
- 已有基础设施完善
- 与 Tailwind 生态兼容
- 切换主题只需修改 `data-theme` 属性

**备选方案**:
- CSS-in-JS → 增加复杂度
- Tailwind dark: 前缀 → 需要配置 JIT

### 3. Canvas 颜色管理

**决策**: 使用 `constants.ts` 中的 `COLORS` 对象，根据主题动态选择

```typescript
const colors = resolvedTheme === 'light' ? COLORS.LIGHT : COLORS.DARK;
```

**理由**:
- Canvas 无法直接使用 CSS 变量
- constants.ts 已定义完整颜色方案
- 集中管理便于维护

### 4. 搜索状态指示器位置

**决策**: 集成到 SearchPanel 内部

**理由**:
- 与搜索功能关联紧密
- 用户自然关注区域
- 不占用额外空间

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Canvas 渲染性能 | 主题切换可能闪烁 | 使用 requestAnimationFrame |
| 内存监控不准确 | `performance.memory` 非标准 API | 添加降级处理 |
| 主题切换延迟 | 大量组件需要重新渲染 | 使用 React.memo 优化 |

## Migration Plan

1. **Phase 1**: 完成 RemotePathPicker.css 主题适配（独立改动，可先合并）
2. **Phase 2**: 实现性能监控 StatusBar 指示器
3. **Phase 3**: 实现搜索状态指示器
4. **Phase 4**: Canvas 颜色主题化
5. **Phase 5**: 设置实时预览

### 回滚策略
- 每个 Phase 独立可回滚
- 使用 Git 分支管理
- 合并前运行测试

## Open Questions

1. 性能监控刷新频率？建议 1 秒更新一次，避免影响性能
2. 内存显示单位？建议 MB，精确到小数点后 1 位
3. 搜索结果上限？建议显示前 10000 条计数，避免大文件性能问题
