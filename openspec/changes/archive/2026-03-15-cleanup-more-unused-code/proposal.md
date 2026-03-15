## Why

前端代码库中存在更多未使用的工具文件和重复逻辑，增加维护成本和打包体积。清理这些代码可以减少无用代码，提高项目可维护性。

## What Changes

### 删除未使用的 Utils 文件
- `utils/CanvasRenderer.ts` - 未被任何文件引用
- `utils/sqlParser.ts` - 未被任何文件引用
- `utils/jsonTree.ts` - 未被任何文件引用

### 删除对应的测试文件
- `utils/sqlParser.test.ts`
- `utils/jsonTree.test.ts`

### 检查并移除重复代码模式
- 检查相似函数是否可以合并
- 检查重复的 utility 函数

## Capabilities

### New Capabilities
- 无新功能

### Modified Capabilities
- 无需修改现有 spec

## Impact

- **删除文件数**: 5 个文件 (3 utils + 2 测试)
- **代码行数减少**: 约 400+ 行
- **风险等级**: 低 - 均为未被引用的代码

## Non-Goals

- 不修改业务逻辑
- 不删除可能有潜在用途的代码
- 不进行大规模重构