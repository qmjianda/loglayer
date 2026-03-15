## Why

前端代码库中存在未被使用或重复的代码，增加了维护成本和打包体积。这些无用代码包括：未引用的 hooks、未使用的测试文件、以及潜在的重复逻辑。清理这些代码可以减少维护负担，但需要谨慎验证确保不影响现有功能。

## What Changes

### 删除未使用的 Hooks (安全删除)
- `hooks/useLoadingState.ts` - 未被任何组件导入
- `hooks/useLogStats.ts` - 未被任何组件导入  
- `hooks/useKeyboardShortcuts.ts` - 未被任何组件导入
- `hooks/useSearchHistory.ts` - 未被任何组件导入
- `hooks/usePlatformInfo.ts` - 未被任何组件导入

### 删除对应的测试文件 (安全删除)
- `hooks/useLoadingState.test.ts`
- `hooks/useLogStats.test.ts`
- `hooks/useSearchHistory.test.ts`
- `hooks/usePlatformInfo.test.ts`

### 修复代码问题
- 移除 `App.tsx` 中的调试用 console.log (行 358-365)
- 修正 `hooks/index.ts` 中误导性注释

## Capabilities

### New Capabilities
- 无新功能

### Modified Capabilities
- 无需修改现有 spec

## Impact

- **删除文件数**: 9 个文件 (5 hooks + 4 测试)
- **代码行数减少**: 约 350+ 行
- **风险等级**: 低 - 均为未被引用的代码，删除不影响现有功能
- **验证方式**: 运行 `npm run build` 确认无编译错误

## Non-Goals

- 不修改 React.FC 写法 (需要大量测试验证)
- 不进行大规模重构
- 不删除可能有潜在用途的代码