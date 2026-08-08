# Design: fix-bookmark-filter-index

## Context

`logviewer-architecture-revamp` 将 LogViewer 渲染改为"过滤后可见行（虚拟索引）"后，书签的三条消费链路（跳转 `physicalToVisualIndex`、预览 `getLinesByIndices`、最近书签 `get_nearest_bookmark_index`）仍按物理行号解释书签 key，而写入/渲染端已改为虚拟索引——过滤视图下语义错位，书签跳转命中错误位置。

本变更的修复方向（已与用户确认）：**书签统一锚定物理行号**；行号侧边栏改为物理行号，并新增可折叠的虚拟行号列（双行号显示）。

## Decisions

### D1: 书签锚定物理行号（方案 B）

| 链路 | 现状 | 变更后 |
|---|---|---|
| 写入（gutter 点击 / comment 判断） | 传虚拟索引 | 传物理行号（`line.index`） |
| 渲染（`bookmarks[...]` 匹配、★ 星标） | 虚拟索引匹配 | 物理行号匹配 |
| 跳转（`useBookmarks.jumpTo` → `physicalToVisualIndex`） | 物理假设 | **不变**（本就正确） |
| 预览（`getLinesByIndices` → `offsets[key]`） | 物理假设 | **不变** |
| F2 最近书签（`get_nearest_bookmark_index`） | 物理假设 | **不变** |

后端 `toggle_bookmark` / `get_nearest_bookmark_index` / `get_lines_by_indices` 均为物理行号语义，零改动；用单测锁定语义防止回归。

### D2: 双行号 gutter —— 双列并排（物理主 | 虚拟辅）

```
过滤激活时：                    无过滤时（虚拟列折叠）：
┌──────────────────────┐       ┌──────────────────────┐
│  10     1   │ 内容    │       │  10         │ 内容    │
│  12     2   │ 内容    │       │  11         │ 内容    │
│  14     3   │ 内容    │       │  12         │ 内容    │
└──────────────────────┘       └──────────────────────┘
```

- **物理列（主）**：`line.index + 1`，正常亮度，右对齐。
- **虚拟列（辅）**：过滤结果序号（从 1 连续），`theme-muted` 弱化 + 0.9em 小字号，右对齐，与物理列以虚线分隔。
- **无过滤折叠**：可见行数 == 原始行数时虚拟列宽度折叠为 0（`width`/`opacity` 150ms transition），gutter 回退单列，避免显示冗余数字。
- **位宽自适应**：物理列宽按原始行数位数固定（下限 3 位，参照 glogg `maxDisplayLineNumber` 策略，切换过滤时物理列宽不变）；虚拟列宽按可见行数位数（下限 2 位）。
- **★ 星标**渲染在物理列（书签锚物理，星标跟物理走）。

**业界参照**（librarian 调研）：日志查看器领域（glogg / klogg / LogExpert / Logical Log Viewer）过滤视图均只显示物理行号，无双行号先例——本设计为创新点；最接近的双列实现为 **VS Code Diff Editor inline 模式**（original | modified 双列 gutter）；"主次区分 + 当前行高亮"参照 VS Code 行号机制。VS Code Double Line Numbers 扩展的 gutterIcon hack 方案（宽度受限、遮挡断点图标）**不采用**。

### D3: 折叠判定信号

以 **可见行数 vs 原始行数** 判定过滤状态：

```
过滤激活 = lineCount < rawCount
```

- 覆盖 FILTER 图层与搜索 FILTER 模式（`pipelineFinished` 已更新 `lineCount`）。
- HIGHLIGHT / TRANSFORM / FOLDER 图层不改变行数，不会误展开虚拟列。

### D4: 设置项

- `useSettings` 新增 `showVirtualLineNumbers`（默认 `true`）。
- SettingsPanel 新增开关"显示虚拟行号"。
- 关闭后即使存在过滤也不渲染虚拟列。

### D5: 边界与兜底

- **bridgedLines 字符串形态**：`LogRow` 收到的行数据存在纯字符串形态（无 `index` 字段，无法取物理行号），此时物理列**退化显示虚拟序号**（与现状一致），书签匹配退回虚拟索引；对象形态走物理语义。
- **gutter 宽度动态化**：现有 `GUTTER_WIDTH` 常量 → 由物理列宽 + 虚拟列宽（可折叠为 0）动态计算；comment popover 的 x 定位随之调整。
- **Ctrl+G 跳转行号语义**（物理 vs 虚拟）与本次变更无关，保持现状，不在本变更范围（避免蔓延）。

## Alternatives Considered

### A1: 消费端统一为虚拟索引（最小改动）
仅改 `jumpTo` / `get_lines_by_indices` / `get_nearest_bookmark_index` 为虚拟语义。
**否决**：书签锚定"视图位置"而非"日志行"，过滤条件一变书签即漂移；持久化重开后语义不稳定。方案 B（D1）语义坚固且后端零改动。

### A2: 单列物理行号 + 状态栏显示虚拟序号（glogg 模式）
**否决**：用户明确要求物理与虚拟行号**同时逐行可见**，状态栏无法满足"逐行对照"。

### A3: gutterIcon hack 双列（VS Code 扩展方式）
**否决**：宽度受限、与断点/图标遮挡冲突，不适合日志查看器。

## Implementation Notes

- **前端改动**：
  - `LogViewer.tsx`：gutter 点击传物理行号、书签判断/comment 改物理、gutter 宽度动态化。
  - `logViewer/LogRow.tsx`：双列 gutter 渲染、★ 星标位移至物理列、书签按物理行号匹配、字符串兜底。
  - `hooks/useSettings.ts` + `SettingsPanel.tsx`：`showVirtualLineNumbers` 设置。
- **后端**：零改动，补单测（`tests/unit/`）锁定书签物理语义。
- **e2e**（`tests/e2e/`）：过滤视图下书签添加→跳转精确命中；双行号显示 / 折叠 / 设置开关。

## Prototype

`/tmp/opencode/dual-line-number.html`（探索期原型，已确认方案可行性）：双列布局、折叠过渡、虚拟行号开关、书签★锚定物理行号均已在原型中验证。
