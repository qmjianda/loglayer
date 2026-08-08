## Context

company-run 试点（engineering-foundation）中，工作区存在 102 个未提交文件分属 4 个活跃变更（ai-assistant-features / per-tab-find-widget / refactor-bridge-module / engineering-foundation），company-review 的越界检查（`git diff --name-only` 对照"任务范围"）无法自动判定归属，全部非本变更文件会被误判为越界升级老板，或归属不明时误放行。当前团队形态为**单工作区多 Agent 并发**（多个子 Agent 共享同一 git 工作区），分支/暂存隔离不可行，需要在文档编排层解决归属判定。

## Goals / Non-Goals

**Goals:**
- 为每个变更提供文件级登记表（scope.md），规格阶段生成
- company-review 越界检查升级为"归属并集判定"：命中本变更 ✓ / 命中他变更（不升级）/ 无归属（升级）
- 归属判定经 `openspec-cn list --json` 动态获取活跃变更，适配多 Agent 并发

**Non-Goals:**
- 不引入分支/工作区隔离（当前多 Agent 共享工作区，物理隔离破坏协作）
- 不做文件级别的 git 归属追踪（stash/暂存区分离，工作区已混改不可行）
- 不修改任何业务代码

## Decisions

### D1: scope.md 作为变更级文件登记表

每个活跃变更在规格阶段生成 `openspec/changes/<name>/scope.md`，格式：

```markdown
# Scope: <变更名>

## 新增
- .github/workflows/ci.yml
- backend/__init__.py

## 修改
- package.json
- docs/README.md
- frontend/src/store/          # 目录级
- frontend/src/**/*.tsx        # glob 通配

## 删除
- <路径或模式>
```

**理由**：纯文档层、零侵入现有命令；登记在变更目录内随变更归档，生命周期一致。
**备选**：独立 `scope-registry/` 目录（跨变更共享）——否决，违背"数据源即状态"原则，状态应贴变更走。

### D2: 归属并集判定算法（company-review 越界检查重写）

```
diff_files = git diff --name-only + git status --short (未跟踪)
my_scope   = read(openspec/changes/<name>/scope.md)          # 缺失 → 提示回归规格阶段
active     = openspec-cn list --json                          # 活跃变更清单
others     = [read(scope.md) for c in active if c != <name>]  # 缺失的按"无登记"处理

for f in diff_files:
    if match(f, my_scope):      → 本变更工作 ✓
    elif any(match(f, s) for s in others):
                                → 其他变更工作（标记，不升级）
    else:                       → 无归属 → 越界升级老板
```

**理由**：并集匹配正确处理多变更并发；"他变更不升级"消除试点中的误报；"无归属升级"保留防呆。
**备选**：仅对照本变更 scope（他变更文件全当越界）——否决，正是试点暴露的缺陷。

### D3: scope.md 生成时机 = 规格阶段产出物完成后

company-spec 步骤 3（产出物齐全）后追加：生成 scope.md。理由：产出物确定影响范围后登记最准确；review 时校验存在性作为 DoD 前置项。

### D4: 归属判定需所有活跃变更 scope（并集）

经 `openspec-cn list --json` 动态获取活跃变更，逐一读 scope.md；缺失的按"无登记、不参与并集"处理并在汇报提示。理由：不依赖静态名单，适配变更增删。

## Risks / Trade-offs

- [scope.md 维护不及时 → 归属误判] → company-spec 强制生成 + company-review 校验存在 + DoD 含 scope 项
- [glob 模式误匹配] → scope 用保守模式（目录/精确路径优先，通配需显式）；汇报附判定依据可审计
- [他变更 scope 不完整 → 其文件被误判无归属] → 误判方向为"升级老板"（安全侧），老板可人工放行
- [命令文件本身变更归属] → company-* 命令与手册的修改由本变更 scope.md 登记

## Migration Plan

1. 本变更落地：scope.md 模板 + company-spec/review 改造 + 手册更新 + 验收测试
2. 为本变更自身生成 scope.md（示范）
3. 为其他活跃变更（ai-assistant-features 等）补生成 scope.md
4. 后续新变更经 company-spec 自动生成

## Open Questions

- 无
