# LogViewer Module

> Canvas 虚拟滚动渲染引擎 - 高性能日志显示

---

## 概述

LogViewer 是 LogLayer 的核心组件，使用 HTML5 Canvas 实现高性能虚拟滚动，支持百万行级别日志的流畅渲染。

---

## 关键特性

| 特性 | 描述 |
|------|------|
| **虚拟滚动** | O(1) 渲染，只绘制可见区域 |
| **60 FPS** | 使用 requestAnimationFrame 优化 |
| **高 DPI 支持** | 自动检测设备像素比 |
| **文本选择** | 模拟原生选择行为 |
| **高亮叠加** | 多层高亮渲染 |

---

## 架构

```
LogViewer.tsx (1133 行)
├── Canvas 渲染
│   ├── renderFrame()     - 主渲染循环
│   ├── renderText()      - 文本绘制
│   └── renderHighlights() - 高亮绘制
├── 滚动处理
│   ├── handleScroll()    - 滚动事件
│   └── updateVisibleRange() - 计算可见范围
├── 事件处理
│   ├── handleClick()     - 点击事件
│   ├── handleMouseDown() - 鼠标按下
│   └── handleKeyDown()   - 键盘事件
└── 数据管理
    ├── loadLines()       - 加载行数据
    └── updateCache()     - 更新缓存
```

---

## 核心 Props

```typescript
interface LogViewerProps {
  fileId: string;
  lineCount: number;
  searchMatchCount: number;
  currentMatchNumber: number;
  scrollToIndex: number | null;
  highlightedIndex: number | null;
  processedCache: ProcessedCache;
  settings: AppSettings;
  resolvedTheme: 'dark' | 'light';
  onLineClick: (index: number) => void;
  onSelectedTextChange: (text: string) => void;
}
```

---

## 渲染流程

```
1. 接收 props 更新
      ↓
2. 计算可见范围 (startIndex, endIndex)
      ↓
3. 从 backend 请求行数据
      ↓
4. 绘制 Canvas
   ├── 清除画布
   ├── 绘制行号
   ├── 绘制文本
   └── 绘制高亮
      ↓
5. 等待下一帧
```

---

## 常量配置

```typescript
const LINE_HEIGHT = 20;
const GUTTER_WIDTH = 80;
const BUFFER_NORMAL = 200;
const BUFFER_LARGE = 500;
const MAX_CACHED_LINES = 5000;
```

---

## 事件处理

### 滚动同步

```typescript
// 使用 native 滚动 + Canvas 绘制
<div onScroll={handleScroll}>
  <canvas ref={canvasRef} />
  {/* 占位元素提供滚动条 */}
  <div style={{ height: lineCount * LINE_HEIGHT }} />
</div>
```

### 文本选择

通过监听 mousedown/mouseup/mousemove 实现：
1. 记录起始位置
2. 计算字符偏移
3. 绘制选择背景
4. 复制到剪贴板

---

## 相关文件

- `frontend/src/components/LogViewer.tsx` - 主组件
- `frontend/src/constants.ts` - 常量定义
- `frontend/src/theme.ts` - 颜色主题
- `frontend/src/hooks/useBookmarkLogic.ts` - 书签逻辑

---

## 性能优化

1. **虚拟滚动**: 只渲染可见行 + 缓冲区
2. **缓存**: LRU 缓存已加载行
3. **防抖**: 滚动事件防抖处理
4. **requestAnimationFrame**: 确保流畅渲染