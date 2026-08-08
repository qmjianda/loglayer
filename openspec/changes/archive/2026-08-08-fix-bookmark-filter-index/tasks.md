# Tasks: fix-bookmark-filter-index

## 1. 验收测试（ATDD 先行，先红）

- [x] 1.1 后端单测 `tests/unit/`：`toggle_bookmark` 按传入行号原样存储（物理行号语义），过滤存在与否不影响存储值
- [x] 1.2 后端单测 `tests/unit/`：`get_nearest_bookmark_index` 在过滤（`visible_indices` 非空）下，以物理行号书签返回正确的可见索引，跳转目标物理行与书签一致
- [x] 1.3 e2e 测试 `tests/e2e/`：先添加 FILTER 图层再打书签 → 点击书签跳转精确滚动到该物理行对应可见位置；双行号 gutter 在过滤下显示物理列+虚拟列、无过滤时虚拟列折叠

## 2. 书签物理锚定（前端写入/渲染端）

- [x] 2.1 `LogRow.tsx`：书签匹配从 `bookmarks[index]`（视觉）改为 `bookmarks[line.index]`（物理）；`line` 为纯字符串形态时退回虚拟索引兜底（D5）
- [x] 2.2 `LogViewer.tsx`：gutter 点击 `onToggleBookmark` 传物理行号（`line.index`）；comment popover 的已存在判断与打开改用物理行号

## 3. 双行号 gutter 实现

- [x] 3.1 `LogRow.tsx`：gutter 重构为双列——物理列（`line.index + 1`，正常亮度）+ 虚拟列（过滤序号，`theme-muted` 0.9em）；★ 星标渲染位移到物理列
- [x] 3.2 `LogRow.tsx`：折叠判定 `lineCount < rawCount` 时显示虚拟列，否则折叠为 0 宽（`width`/`opacity` 150ms transition）
- [x] 3.3 位宽自适应：物理列宽按原始行数位数（下限 3 位）、虚拟列宽按可见行数位数（下限 2 位）动态计算
- [x] 3.4 `LogViewer.tsx`：gutter 总宽度改为动态计算（物理列宽 + 虚拟列宽），`GUTTER_WIDTH` 常量替换；comment popover 的 x 定位随之调整

## 4. 设置项

- [x] 4.1 `hooks/useSettings.ts`：新增 `showVirtualLineNumbers`（默认 `true`）
- [x] 4.2 `SettingsPanel.tsx`：新增"显示虚拟行号"开关并接线到 LogViewer（关闭后即使过滤也不渲染虚拟列）

## 5. 验证与收尾

- [x] 5.1 运行 `python3 -m pytest tests/unit/` 全部通过（含新增书签语义测试）
- [x] 5.2 运行 e2e 测试通过（需起 backend 12345 + vite 3000 + Playwright chromium）
- [x] 5.3 手动验证：真实日志文件加过滤图层 → 打书签 → 点击跳转精确命中；双行号显示/折叠/开关符合预期；`npx tsc --noEmit` 无类型错误

## 6. 回归修复（实现期发现）

- [x] 6.1 修复千万行行号遮挡：gutter 位数按 toLocaleString 千分位显示宽度计算（`gutterDigits`），数字区/虚拟列加 `flexShrink:0`，`computeGutterWidth` 加布局余量
- [x] 6.2 修复书签星标不可见：`.gutter-star` 改用书签金色 `BOOKMARK_INDICATOR`（原继承 gutter 灰 #666 在暗背景不可见），改 `inline-block` 使 12px 槽位生效
- [x] 6.3 修复字号变化下的 gutter 宽度：`computeGutterWidth` 传入 fontSize，字符宽 `gutterCharWidth(fontSize)`、星标槽 `gutterStarSlot(fontSize)` 全部按实际字号计算，无魔数，字号变化随 React 重渲染自动跟随（12→18px 实测 43→60px）
