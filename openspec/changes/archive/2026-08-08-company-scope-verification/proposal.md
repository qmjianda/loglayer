## Why

company-run 试点（engineering-foundation）暴露模型级缺陷：单工作区多变更并发时（当前 4 个活跃变更共享工作区），`git diff --name-only` 的改动文件分属多个变更，company-review 的越界检查无法自动判定文件归属——只能把全部非本变更文件当"越界"升级老板，或在归属不明时误放行。试点中工作区 102 个未提交文件无法自动区分归属，人工判定成本高、易错。

## What Changes

- 新增**变更级文件登记表** `openspec/changes/<变更名>/scope.md`：登记该变更预期影响的文件路径模式（目录/文件/通配），在规格阶段（company-spec）产出物完成后生成
- 改造 **company-review 越界检查**为"归属并集判定"：
  1. `git diff --name-only` 收集改动文件
  2. 对照本变更 scope.md → 命中 = 本变更工作 ✓
  3. 未命中但命中其他活跃变更的 scope.md → 标记"其他变更工作"，不升级
  4. 未命中任何变更 scope → 越界 → 升级老板（附证据）
- 归属判定需读取所有活跃变更的 scope.md 做并集匹配（`openspec-cn list --json` 定位活跃变更）
- 手册 `docs/COMPANY_MODEL.md` 同步更新越界检查规则说明
- 新增 `scope.md` 生成模板（company-spec 步骤中产出物完成时写入）

## Capabilities

### New Capabilities

- `company-scope-registry`: 变更级文件登记表机制——scope.md 的格式、生成时机（规格阶段）、存放位置，以及 company-review 归属并集判定的行为（命中本变更/命中他变更/无归属三类判定与升级规则）

### Modified Capabilities

<!-- 无既有 spec 需求变更（company-commands/company-operating-model 为本变更新增能力，归档后按需补 delta） -->

## Impact

- **新增**：`openspec/changes/<name>/scope.md` 模板（每变更一个）；`tests/unit/test_company_scope.py`（验收测试）
- **修改**：`.opencode/commands/company-spec.md`（规格阶段生成 scope.md）、`.opencode/commands/company-review.md`（越界检查改为归属并集判定）、`docs/COMPANY_MODEL.md`（防呆规则越界检查说明更新）
- **受影响**：无业务代码；纯命令编排层与文档
- **风险**：scope.md 维护不及时会导致归属误判 → 由 company-spec 阶段强制生成 + review 时校验 scope.md 存在
