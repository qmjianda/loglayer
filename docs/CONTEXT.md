# LogLayer 项目上下文快照

> AI 助手必读：本文件是项目的关键上下文，每次新会话开始时请首先阅读。

---

## 一句话描述

**LogLayer** - 高性能日志分析桌面应用，支持 GB 级日志文件的毫秒级搜索和可视化过滤。

---

## 项目定位

| 维度 | 描述 |
|:-----|:-----|
| **产品形态** | 桌面应用 (pywebview + FastAPI) |
| **目标用户** | 开发工程师、运维人员、SRE |
| **核心场景** | 大型日志文件分析、错误追踪、性能优化 |
| **竞争优势** | mmap 索引、Canvas 虚拟滚动、多引擎搜索 |

---

## 技术栈

### 后端
```
Python 3.10+ | FastAPI | mmap | ripgrep | pywebview
```

### 前端
```
React 19 | TypeScript | Vite | Tailwind CSS 4 | HTML5 Canvas
```

### 测试与构建
```
pytest | PyInstaller | npm
```

---

## 核心模块地图

```
backend/
├── bridge.py           # 核心：mmap 索引、文件操作、信号处理
├── main.py            # FastAPI 服务、REST/WS 端点
└── loglayer/
    ├── core.py        # 图层引擎基类
    ├── registry.py    # 图层注册表
    └── builtin/       # 8 种内置图层
        ├── filter.py
        ├── highlight.py
        ├── level.py
        ├── time.py
        ├── range.py
        ├── rowtint.py
        ├── bookmark.py
        └── replace.py

frontend/
├── src/
│   ├── components/
│   │   ├── LogViewer.tsx      # 核心：Canvas 虚拟滚动
│   │   ├── SearchPanel.tsx    # 搜索面板
│   │   ├── LayersPanel.tsx    # 图层管理
│   │   ├── BookmarkPopover.tsx
│   │   └── DynamicUI/         # Schema 驱动 UI
│   ├── hooks/
│   │   ├── useFileManagement.ts
│   │   ├── useLayerManagement.ts
│   │   ├── useSearch.ts
│   │   └── useBookmarks.ts
│   ├── bridge_client.ts       # API 客户端
│   ├── constants.ts           # 常量定义 (新增)
│   └── types.ts               # TypeScript 类型
```

---

## 关键接口

### REST API
```
POST /api/file/open          # 打开文件
POST /api/file/close        # 关闭文件
POST /api/layers/sync       # 同步图层
GET  /api/lines/read        # 读取行范围
POST /api/bookmark/toggle   # 切换书签
GET  /api/platform          # 获取平台信息
```

### WebSocket 信号
```
fileLoaded        # 文件加载完成
pipelineFinished  # 图层处理完成
statsFinished     # 统计完成
operationProgress # 操作进度
```

---

## 关键常量 (constants.ts)

```typescript
export const LOG_VIEWER = {
  LINE_HEIGHT: 20,
  GUTTER_WIDTH: 80,
  BUFFER_NORMAL: 200,
  BUFFER_LARGE: 500,
  VIRTUAL_HEIGHT_LIMIT: 10_000_000,
  MAX_CACHED_LINES: 5000,
  CHAR_WIDTH_DEFAULT: 7.22,
} as const;

export const COLORS = {
  DARK: {
    BACKGROUND: '#1e1e1e',
    SELECTION: 'rgba(245, 158, 11, 0.45)',
    // ...
  },
} as const;
```

---

## 核心类型 (types.ts)

```typescript
interface LogLine {
  index: number;
  content: string;
  highlights?: Highlight[];
  isMarked?: boolean;
  bookmarkComment?: string;
  rowStyle?: RowStyle;
}

interface RowStyle {
  backgroundColor?: string;
  color?: string;
}

interface LayerConfig {
  query?: string;
  regex?: boolean;
  caseSensitive?: boolean;
  color?: string;
}
```

---

## 开发规范

### 代码风格
- **Python**: 4 空格缩进，100 行最大，snake_case
- **TypeScript**: 2 空格缩进，单引号，camelCase
- **组件**: 函数式组件 + Hooks

### 技术模式
- **虚拟滚动**: O(1) 内存渲染
- **图层分离**: `sync_layers()` 数据 / `sync_decorations()` 视觉
- **平台感知**: 通过 `/api/platform` 获取 OS 逻辑

---

## 已知限制

| 限制 | 描述 | 规避方案 |
|:-----|:-----|:---------|
| 大文件滚动 | 1000万行以上需要滚动缩放 | 使用 `useScrollScaling` |
| 内存占用 | 完整加载所有行 | 虚拟滚动 + 按需加载 |
| 搜索精度 | ripgrep 正则 | 纯 Python 正则备选 |

---

## 快速命令

```bash
# 开发
npm run dev              # 前端开发 (port 3000)
python backend/main.py   # 启动完整应用

# 测试
pytest tests/            # 运行测试
pytest tests/unit/       # 单元测试

# 构建
npm run build           # 前端构建
```

---

## 相关文档

| 文档 | 用途 |
|:-----|:-----|
| [AGENTS.md](./AGENTS.md) | AI 开发规范与代码风格 |
| [PROGRESS.md](./PROGRESS.md) | 当前开发进度 |
| [PROJECT_MAP.md](./PROJECT_MAP.md) | 架构变更日志 |
| [TECHNICAL_DECISIONS.md](./TECHNICAL_DECISIONS.md) | 技术决策记录 |

---

*最后更新: 2026-02-21*
