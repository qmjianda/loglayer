# company-scope-registry Specification

## Purpose
变更级文件登记表（`openspec/changes/<变更名>/scope.md`）机制——格式、生成时机（规格阶段）、存放位置，以及 company-review 越界检查的归属并集判定行为（命中本变更 / 命中其他活跃变更 / 无归属三类判定与升级规则）。解决单工作区多变更并发时文件归属无法自动判定的问题。

## Requirements

### Requirement: 变更级文件登记表

每个活跃变更 SHALL 在规格阶段生成 `openspec/changes/<变更名>/scope.md` 文件登记表，列出该变更预期影响/修改的文件路径模式（支持目录、文件路径、glob 通配符），作为越界检查的归属判定依据。

#### Scenario: 规格阶段生成 scope.md

- **WHEN** company-spec 完成变更产出物（proposal/specs/design/tasks）
- **THEN** 生成 `openspec/changes/<变更名>/scope.md`，包含该变更预期影响的文件路径模式清单
- **AND** 登记表按类型分组（新增/修改/删除），每项为文件路径或目录/通配模式

#### Scenario: scope.md 缺失时 review 提示

- **WHEN** company-review 越界检查时发现该变更缺少 scope.md
- **THEN** 提示先生成登记表（回归规格阶段），不直接以"越界"误判改动文件

### Requirement: 越界检查归属并集判定

company-review 的越界检查 SHALL 将改动文件与**所有活跃变更**的 scope.md 做并集归属判定，输出三类结论：命中本变更（放行）、命中其他活跃变更（标记为其他变更工作，不升级）、未命中任何变更（越界升级老板）。

#### Scenario: 改动文件命中本变更 scope

- **WHEN** git diff 中某文件命中本变更 scope.md 的路径模式
- **THEN** 判定为本变更工作，放行且不升级

#### Scenario: 改动文件命中其他活跃变更 scope

- **WHEN** git diff 中某文件未命中本变更 scope 但命中其他活跃变更（经 `openspec-cn list --json` 定位）的 scope.md
- **THEN** 判定为其他变更的进行中工作，在汇报中标记"其他变更工作，非越界"
- **AND** 不触发越界升级

#### Scenario: 改动文件无任何归属

- **WHEN** git diff 中某文件未命中本变更 scope 也未命中任何活跃变更 scope
- **THEN** 判定为越界（无归属改动），升级给老板，附 diff 清单与判定依据

#### Scenario: 无归属判定需要活跃变更清单

- **WHEN** 执行归属判定
- **THEN** 经 `openspec-cn list --json` 获取活跃变更清单并逐一读取其 scope.md
- **AND** 任一活跃变更缺失 scope.md 时，该变更视为无登记（不参与并集匹配），并在汇报中提示

### Requirement: 手册同步越界检查规则

`docs/COMPANY_MODEL.md` SHALL 更新防呆规则中"越界检查"的说明，反映归属并集判定逻辑与 scope.md 登记机制。

#### Scenario: 手册描述归属判定

- **WHEN** 阅读手册的越界检查规则
- **THEN** 手册描述三类归属判定（本变更/他变更/无归属）与 scope.md 登记机制
- **AND** 说明他变更文件不触发升级
