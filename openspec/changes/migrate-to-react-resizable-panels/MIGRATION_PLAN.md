# 迁移方案：allotment → react-resizable-panels

## 概述

将 LogLayer 的分屏系统从 `allotment` 迁移到 `react-resizable-panels`，以支持垂直+水平混合分屏（VSCode网格布局）。

---

## 当前架构分析

### 1. 数据层（无需修改 ✅）

```typescript
// hooks/useFileManagement.ts - 已支持嵌套树形结构
interface Pane {
  id: string;
  openFileIds: string[];
  activeFileId: string | null;
  direction?: 'horizontal' | 'vertical';  // ✅ 已支持
  children?: Pane[];                      // ✅ 已支持
}
```

### 2. 逻辑层（无需修改 ✅）

```typescript
// hooks/usePaneManagement.ts - 已支持嵌套分屏
- splitPane()      // ✅ 支持 left/right/top/bottom
- removePane()     // ✅ 支持树形删除
- flattenPanes()   // ✅ 树形转平铺
```

### 3. UI层（需要修改 ⚠️）

```typescript
// components/MainContent.tsx - 当前使用 allotment
import { Allotment } from 'allotment';

<Allotment className="flex-1" separator={false}>
  {panes.map((pane) => (
    <Allotment.Pane key={pane.id} minSize={200}>
      <LogViewerPane ... />
    </Allotment.Pane>
  ))}
</Allotment>
```

**问题**: `allotment` 仅支持水平分屏，不支持 `direction` 和 `children` 嵌套。

---

## 迁移方案

### 方案对比

| 方面 | 方案A：直接替换 | 方案B：分阶段迁移 | 推荐 |
|------|----------------|-------------------|------|
| 工作量 | 1-2天 | 3-4天 | **方案A** |
| 风险 | 中等 | 低 | 方案B |
| 回滚难度 | 难 | 易 | 方案B |
| 长期收益 | 高 | 高 | - |

**建议**: 采用 **方案A（直接替换）**，因为：
1. 数据层和逻辑层已完全支持嵌套
2. 仅需修改 UI 渲染层
3. react-resizable-panels API 简洁
4. 有完整的 TypeScript 支持

---

## 详细实施步骤

### Phase 1: 准备阶段（30分钟）

#### 1.1 创建备份分支
```bash
git checkout -b migrate-resizable-panels
git push -u origin migrate-resizable-panels
```

#### 1.2 验证现有测试
```bash
npm test
# 确保所有现有测试通过
```

#### 1.3 安装依赖（已安装，确认版本）
```bash
npm ls react-resizable-panels
# 确认版本 ^4.5.3
```

---

### Phase 2: 核心迁移（2-3小时）

#### 2.1 创建新的分屏渲染组件

**新文件**: `components/ResizablePaneGroup.tsx`

```typescript
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Pane, FileData } from '../hooks/useFileManagement';
import { LogViewerPane } from './LogViewerPane';

interface ResizablePaneGroupProps {
  panes: Pane[];
  files: FileData[];
  activePaneId: string;
  // ... 其他 props
}

export const ResizablePaneGroup: React.FC<ResizablePaneGroupProps> = ({
  panes,
  files,
  activePaneId,
  ...otherProps
}) => {
  // 递归渲染嵌套分屏
  const renderPanes = (paneList: Pane[]): React.ReactNode => {
    if (paneList.length === 0) return null;
    
    // 单个面板直接渲染
    if (paneList.length === 1 && !paneList[0].children) {
      const pane = paneList[0];
      return (
        <Panel key={pane.id} minSize={20}>
          <LogViewerPane 
            pane={pane}
            files={files}
            isPaneActive={activePaneId === pane.id}
            {...otherProps}
          />
        </Panel>
      );
    }
    
    // 获取方向（默认水平）
    const direction = paneList[0].direction || 'horizontal';
    
    return (
      <PanelGroup direction={direction}>
        {paneList.map((pane, index) => (
          <React.Fragment key={pane.id}>
            {pane.children ? (
              // 容器节点：递归渲染
              renderPanes(pane.children)
            ) : (
              // 叶子节点：渲染 LogViewerPane
              <Panel minSize={20}>
                <LogViewerPane 
                  pane={pane}
                  files={files}
                  isPaneActive={activePaneId === pane.id}
                  {...otherProps}
                />
              </Panel>
            )}
            {index < paneList.length - 1 && <PanelResizeHandle />}
          </React.Fragment>
        ))}
      </PanelGroup>
    );
  };
  
  return <div className="flex-1">{renderPanes(panes)}</div>;
};
```

#### 2.2 修改 MainContent.tsx

**当前代码**:
```typescript
import { Allotment } from 'allotment';

<Allotment className="flex-1" separator={false}>
  {panes.map((pane) => (
    <Allotment.Pane key={pane.id} minSize={200}>
      <LogViewerPane ... />
    </Allotment.Pane>
  ))}
</Allotment>
```

**修改后**:
```typescript
import { ResizablePaneGroup } from './ResizablePaneGroup';

<ResizablePaneGroup
  panes={panes}
  files={files}
  activePaneId={activePaneId}
  {...otherProps}
/>
```

#### 2.3 添加样式

**新文件**: `styles/resizable-panels.css`

```css
/* react-resizable-panels 基础样式 */
[data-resize-handle] {
  position: relative;
  background: var(--border-subtle);
  transition: background 0.2s;
}

[data-resize-handle]:hover {
  background: var(--primary);
}

[data-resize-handle][data-resize-handle-active] {
  background: var(--primary);
}

/* 水平分隔符 */
[data-resize-handle][data-panel-group-direction="horizontal"] {
  width: 4px;
  cursor: col-resize;
}

/* 垂直分隔符 */
[data-resize-handle][data-panel-group-direction="vertical"] {
  height: 4px;
  cursor: row-resize;
}

/* 无障碍：聚焦样式 */
[data-resize-handle]:focus {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}
```

在 `App.tsx` 中导入:
```typescript
import './styles/resizable-panels.css';
```

---

### Phase 3: 功能增强（1-2小时）

#### 3.1 支持分屏方向切换

**修改** `usePaneManagement.ts`:
```typescript
// 添加切换方向功能
const toggleDirection = useCallback((paneId: string) => {
  setPanes(prev => {
    const toggleInTree = (items: Pane[]): Pane[] => {
      return items.map(item => {
        if (item.id === paneId && item.children) {
          return {
            ...item,
            direction: item.direction === 'horizontal' ? 'vertical' : 'horizontal'
          };
        }
        if (item.children) {
          return { ...item, children: toggleInTree(item.children) };
        }
        return item;
      });
    };
    return toggleInTree(prev);
  });
}, [setPanes]);
```

#### 3.2 添加命令面板快捷键

**修改** `AppCommands.tsx`:
```typescript
{
  id: 'pane.splitRight',
  label: 'Split Pane Right',
  shortcut: 'Ctrl+\\',
  action: () => splitPane(activePaneId, undefined, 'right'),
},
{
  id: 'pane.splitBottom',
  label: 'Split Pane Bottom',
  shortcut: 'Ctrl+Shift+\\',
  action: () => splitPane(activePaneId, undefined, 'bottom'),
}
```

#### 3.3 状态持久化增强

**修改** `useWorkspaceConfig.ts`:
```typescript
// 保存面板尺寸
const saveLayout = useCallback(() => {
  const layout = {
    panes,
    activePaneId,
    // react-resizable-panels 会自动保存尺寸到 localStorage
  };
  localStorage.setItem('loglayer-layout', JSON.stringify(layout));
}, [panes, activePaneId]);
```

---

### Phase 4: 清理与优化（1小时）

#### 4.1 移除 allotment 依赖

```bash
npm uninstall allotment
```

#### 4.2 删除相关样式

```bash
# 删除 allotment 样式导入
# 在 App.tsx 中移除: import 'allotment/dist/style.css';
```

#### 4.3 更新类型定义

确保所有 Pane 类型使用新的结构:
```typescript
// types.ts
export interface Pane {
  id: string;
  openFileIds: string[];
  activeFileId: string | null;
  direction?: 'horizontal' | 'vertical';
  children?: Pane[];
}
```

---

## 测试策略

### 单元测试

```typescript
// __tests__/ResizablePaneGroup.test.tsx
describe('ResizablePaneGroup', () => {
  it('renders single pane correctly', () => {
    const panes = [{ id: '1', openFileIds: ['file1'], activeFileId: 'file1' }];
    render(<ResizablePaneGroup panes={panes} ... />);
    expect(screen.getByTestId('log-viewer-pane')).toBeInTheDocument();
  });
  
  it('renders nested panes with correct direction', () => {
    const panes = [{
      id: 'group1',
      direction: 'horizontal',
      children: [
        { id: '1', openFileIds: ['file1'], activeFileId: 'file1' },
        { id: '2', openFileIds: ['file2'], activeFileId: 'file2' }
      ]
    }];
    render(<ResizablePaneGroup panes={panes} ... />);
    expect(screen.getAllByTestId('log-viewer-pane')).toHaveLength(2);
  });
  
  it('handles empty panes gracefully', () => {
    render(<ResizablePaneGroup panes={[]} ... />);
    expect(screen.getByText('No open files')).toBeInTheDocument();
  });
});
```

### 手动测试清单

- [ ] 单个面板正常显示
- [ ] 水平分屏（左右）正常工作
- [ ] 垂直分屏（上下）正常工作
- [ ] 嵌套分屏（2x2网格）正常工作
- [ ] 拖拽调整尺寸正常工作
- [ ] 分屏后文件在正确位置打开
- [ ] 关闭面板正常工作
- [ ] 键盘快捷键正常工作
- [ ] 布局持久化正常工作
- [ ] 深色/浅色主题样式正确

---

## 回滚方案

如果迁移出现问题，快速回滚步骤：

```bash
# 方式1：Git 回滚
git checkout main
npm install

# 方式2：保留分支
git checkout -b revert-resizable-panels
git revert <迁移 commit>
```

---

## 预期收益

### 功能收益
- ✅ 支持垂直分屏（上下布局）
- ✅ 支持 2x2 网格布局
- ✅ 支持任意嵌套组合
- ✅ 更好的性能（<10KB vs 30KB+）

### 技术收益
- ✅ React 核心团队维护
- ✅ 更好的 TypeScript 支持
- ✅ 完整的无障碍支持
- ✅ 更活跃的社区

### 用户体验
- ✅ 更灵活的布局选项
- ✅ 更流畅的拖拽体验
- ✅ 键盘导航支持

---

## 时间线

| 阶段 | 预计时间 | 产出 |
|------|----------|------|
| Phase 1: 准备 | 30分钟 | 备份分支，测试通过 |
| Phase 2: 核心迁移 | 2-3小时 | 新组件，MainContent更新 |
| Phase 3: 功能增强 | 1-2小时 | 方向切换，快捷键，持久化 |
| Phase 4: 清理优化 | 1小时 | 移除allotment，测试通过 |
| **总计** | **4-6小时** | 完整迁移完成 |

---

## 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 嵌套渲染性能问题 | 中 | 高 | 使用 React.memo，虚拟滚动 |
| 现有布局损坏 | 低 | 高 | 备份分支，渐进式测试 |
| 样式冲突 | 中 | 中 | 使用 CSS 变量，隔离样式 |
| 无障碍退化 | 低 | 中 | 添加 ARIA 属性，键盘测试 |

---

*创建时间: 2026-03-16*  
*迁移目标: allotment → react-resizable-panels v4.5.3*
