# Design: fix-search-mode-parity

## Context

见 `proposal.md` — Why。当前搜索状态在前后端之间是"部分透传"：

- 前端 per-tab store 完整保存 `{ regex, caseSensitive, wholeWord, mode }`（`frontend/src/store/searchStore.ts`）。
- `useSearch.ts` 构造 `searchConf` 时只发送 `{ query, regex, caseSensitive }`。
- 后端 `search_matching.py` 已实现 `-w`（整词）分支，但永远收不到该字段。
- 后端管线把"图层过滤结果"（`visible_indices`，`None` 表示全可见）与"搜索匹配物理行号"（`search_matches`）分开计算、分开缓存；`mode` 完全不存在于后端。
- 前端日志视图的行总数来自 `pipelineFinished` 的 `indices_len`，即"可见行数"；FILTER 图层已经通过该信号缩减行数，因此过滤模式可以复用同一机制，无需新增前端虚拟化逻辑。

约束：

- 性能红线：过滤模式不得引入第二次 rg 扫描；求交必须是线性、低内存（大文件可能有百万级匹配）。
- 缓存红线：图层过滤缓存按 `(file_path, layers_hash)` 复用，不能被某个搜索词污染。
- 兼容性：`/api/sync_all`、`/api/sync_layers` 的 `search_json` 只增字段；旧客户端不传 `wholeWord`/`mode` 时行为保持现状（高亮、整词关闭）。

## Goals / Non-Goals

**Goals:**

- 整词选项从 UI 到后端匹配集全链路生效，匹配计数/导航/高亮一致。
- 过滤模式真正隐藏不匹配行，并与 FILTER 图层正确叠加。
- 复用现有搜索缓存与图层过滤缓存；模式切换不重新扫描文件。
- 行为可被单测与 e2e 逐条追溯到 spec 的 WHEN/THEN。

**Non-Goals:**

- 不改变统计（ERROR/WARN 计数）的口径：统计仍针对文件整体，不随过滤模式缩减。
- 不实现跨文件/目录搜索。
- 不新增搜索模式（仍只有 `highlight` / `filter` 两种）。
- 不改变 `jump-navigation` 契约；过滤模式下的导航沿用现有居中/不滚动规则。

## Decisions

### D1. 过滤在管线收敛点做，而不是在 worker 或前端

**决策**：在 `FileBridge._on_pipeline_finished` 统一收敛：先保存"图层基础可见集"，写缓存用基础集，再按搜索配置计算最终 `visible_indices`。

所有会发出 `pipelineFinished` 的路径（真实计算、双缓存命中、仅过滤缓存命中）都经过同一个 `_apply_search_filter(session)`：

```
base = session.base_visible_indices        # None = 全可见
matches = session.search_matches           # 有序物理行号数组
if search_config.mode == "filter" and query:
    visible = matches if base is None else intersect_sorted(base, matches)
    search_matches = visible        # 匹配集收敛到可见集，计数/导航与可见行一致
else:
    visible = base
session.visible_indices = visible
```

**理由**：

- Worker 内做会把带搜索过滤的可见集写进图层缓存，污染后续高亮模式。
- 前端做需要自己维护"物理行 → 视觉行"映射，与后端 `physical_to_visual_index` 形成双权威，违背现有架构。
- 收敛点统一处理，避免三条 emit 路径各写一份逻辑。

**备选方案**：

- *把搜索过滤实现为系统 FILTER 图层*：会二次 rg 扫描、污染用户图层列表与持久化，且 per-tab 状态与文件级图层生命周期不匹配。拒绝。
- *把 mode/query 并入图层缓存键*：缓存键爆炸，且百万行数组重复存储。拒绝。

### D2. 基础可见集与最终可见集分离

**决策**：`LogSession` 新增 `base_visible_indices`，语义是"仅图层过滤后的可见集"；`visible_indices` 保持"当前实际渲染的可见集"（下游 API、导出、搜索映射、诊断都继续读它）。

写入规则：

| 场景 | base | visible |
|:--|:--|:--|
| 无图层、无搜索 | `None` | `None` |
| 有图层、高亮模式 | 图层结果 | 同 base |
| 有图层、过滤模式 | 图层结果 | `intersect(base, matches)` |
| 无图层、过滤模式 | `None` | `matches`（复制为独立数组） |
| 清空搜索 | 图层结果 / `None` | 同 base |

图层过滤缓存的读写只使用 `base_visible_indices`；`compute_layers_hash` / `compute_query_hash` 均不变。

### D3. 求交使用有序数组双指针

**决策**：新增纯函数 `intersect_sorted_indices(base, matches)`，输入为两个升序 `array('I')`，输出升序交集。O(n+m) 时间、O(k) 额外内存，不构造 `set`（百万级匹配时 set 内存与哈希开销不可接受）。

空结果返回 `array('I')`（长度为 0），前端按 0 行渲染并显示"无结果"状态；现有 FILTER 图层已支持空可见集。

### D4. 搜索配置字段命名沿用现有 JSON camelCase

**决策**：`search_json` 增加 `wholeWord: boolean` 与 `mode: "highlight" | "filter"`；后端读取时用 `.get(..., False/"highlight")` 保持向后兼容。`compute_query_hash` 继续只哈希匹配相关字段（query/regex/caseSensitive/wholeWord），**不加入 mode**，这样高亮/过滤切换复用同一份搜索缓存。

**备选方案**：把 mode 纳入 query hash——切换模式会重跑 rg，明显更慢，收益为零。拒绝。

### D5. 遗留 `/api/search_ripgrep` 同步补齐可选参数

**决策**：`FileBridge.search_ripgrep` 增加 `whole_word=False` 与 `mode="highlight"` 可选参数，REST 层与 `bridge_client.ts` 同步；虽然主路径已走 `sync_all`，但保留接口语义一致，避免外部调用方与 UI 结果不同。

### D6. 前端只补传输，不新增状态

**决策**：`useSearch.ts` 的 `searchConf` 补齐 `wholeWord`、`mode`；`searchStore`、`EditorFindWidget`、`SearchPanel` 的现有状态与交互不变。测试断言 `syncAll` 收到的 search 对象字段完整。

## Risks / Trade-offs

- **[缓存污染] 把搜索过滤结果写进图层缓存** → 用 `base_visible_indices` 专供缓存读写，代码审查与单测覆盖"过滤模式写缓存后，切回高亮仍得到完整图层结果"。
- **[行数语义混淆] `file.lineCount` 在过滤模式下变成匹配行数** → 这是现有 FILTER 图层已采用的约定；保留 `rawLineCount` 供行号/统计使用，e2e 断言过滤模式下行数与匹配数一致、清除后恢复。
- **[大匹配集内存] 交集数组额外占用 4B/行** → 双指针输出 array('I')；100 万匹配约 4MB，可接受；不复制 base（base 即 `None` 时直接复用 matches，但需注意后续不可原地修改，必要时复制一次）。
- **[模式切换开销] 每次切换触发 sync_all** → 双缓存命中路径不启动 worker，仅做 O(n+m) 求交；实测 1.3GB / 百万匹配应在数十毫秒级，纳入基准观察项。
- **[向后兼容] 旧前端不传 mode** → 后端默认 `highlight`，行为与现在一致。
- **[规范归档] MODIFIED 需求必须整段替换** → 已按 `openspec/specs` 原文复制后修改，归档前用 `openspec validate --strict` 复核。

## Migration Plan

1. 后端先落地字段透传 + 求交 + 缓存分离，旧前端不受影响（mode 缺省为 highlight）。
2. 前端补齐 `searchConf` 字段并补测试；此时过滤模式开始生效。
3. 无需数据迁移；`.loglayer/` 工作区格式不变（mode/wholeWord 属会话内搜索状态，不持久化到工作区）。
4. 回滚：整体 revert 本次变更即可；缓存结构未变，旧版本可继续读取。

## Open Questions

（无）
