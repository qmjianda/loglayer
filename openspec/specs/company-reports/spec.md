# company-reports Specification

## Purpose
落盘报告机制——报告文件格式（`docs/company-reports/<变更名>-<日期>.md`）、存放位置、生成时机（每道闸门）、内容结构（状态 + 证据 + 待决策项）、对话摘要呈现方式，以及报告目录纳入 git 版本控制以保证可追溯性。

## Requirements

### Requirement: 落盘报告机制

模型 SHALL 在每道闸门（规格定稿、实现完成、回归通过）生成落盘报告，存放于 `docs/company-reports/<变更名>-<日期>.md`，并进 git 可追溯；同时以对话摘要形式呈现给老板（一屏可读完）。

#### Scenario: 报告文件按规范路径生成
- **WHEN** 一道闸门通过并生成报告
- **THEN** 报告写入 `docs/company-reports/` 目录，文件名为 `<变更名>-<日期>.md` 格式

#### Scenario: 报告内容包含状态与证据
- **WHEN** 打开任一落盘报告
- **THEN** 报告包含：变更名与阶段、做了什么（改动摘要）、测试/静态门结果证据（含通过/失败输出）、风险与待老板决策项

#### Scenario: 对话同步呈现摘要
- **WHEN** 闸门通过且报告已落盘
- **THEN** 老板在会话中收到一屏摘要，摘要覆盖报告核心内容并指向完整报告文件路径

### Requirement: 报告可追溯性

`docs/company-reports/` 目录 SHALL 随 git 版本管理（不 gitignore），使历史报告可作为公司运营记录回溯。

#### Scenario: 报告目录纳入版本控制
- **WHEN** 检查 `.gitignore` 与 `docs/company-reports/`
- **THEN** `docs/company-reports/` 未被 gitignore，报告文件可被 git 追踪
