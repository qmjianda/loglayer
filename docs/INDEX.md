# LogLayer 文档索引

> AI 助手必读：本文档是项目的唯一入口

---

## 快速入口

| 场景 | 文档 | 说明 |
|:-----|:-----|:-----|
| **新会话开始** | `AGENTS.md` (根目录) | 项目概览、命令、约束 |
| **技术参考** | `docs/CONTEXT.md` | 技术栈、模块、API |
| **架构地图** | `docs/PROJECT_MAP.md` | 系统架构、模块拓扑 |
| **技术决策** | `docs/TECHNICAL_DECISIONS.md` | TD-001~ 决策记录 |
| **命令速查** | `docs/CHEATSHEET.md` | 常用命令快速参考 |
| **界面布局** | `docs/UI/README.md` | UI 组件文档 |
| **图层开发** | `docs/guides/LAYER_DEV_GUIDE.md` | 图层开发指南 |
| **部署指南** | `docs/guides/DEPLOY.md` | 打包与部署 |
| **性能优化** | `docs/guides/optimization/` | 索引优化、性能追踪 |

---

## 项目概览

**LogLayer** - 高性能日志分析桌面应用 (Python FastAPI + React + pywebview)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  LogLayer  large_test.log                                         ─ □ ✕   │
├───────┬───────────────────────────────────────────────────────────────┬────┤
│       │ large_test.log                                          [⚙] │ 📂 │
│  ◈    │                                                               │    │
│  💡   │        LogViewer (Canvas)                                     │    │
│  📊   │        Virtual Scrolling, 60FPS @ 1M+ lines                 │    │
│  🤖   │                                                               │    │
│  ?    │                                                               │    │
│       │                                                               │    │
│  ⚙    │                                                               │    │
├───────┴───────────────────────────────────────────────────────────────┴────┤
│ 正在建立索引...  CPU:1.3%│MEM:85.2%  UTF-8  Ln 1, Col 1                     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
loglayer/
├── AGENTS.md                    # AI 入口
├── backend/                     # Python FastAPI
│   ├── bridge.py               # mmap 索引
│   ├── main.py                # FastAPI 入口
│   └── loglayer/              # 图层引擎
├── frontend/src/                # React + TypeScript
│   ├── App.tsx               # 主入口
│   ├── components/           # UI 组件
│   └── hooks/               # 业务 Hooks
├── docs/
│   ├── INDEX.md            # 文档索引
│   ├── CONTEXT.md          # 技术参考
│   ├── PROJECT_MAP.md      # 架构地图
│   ├── TECHNICAL_DECISIONS.md
│   ├── CHEATSHEET.md       # 命令速查
│   ├── assets/            # 截图、图片
│   ├── UI/               # 界面文档
│   └── guides/          # 开发指南
│       ├── DEPLOY.md
│       ├── LAYER_DEV_GUIDE.md
│       └── optimization/
└── openspec/               # 变更追踪
```

---

## 核心模块

### 后端
| 文件 | 职责 |
|:-----|:-----|
| `backend/bridge.py` | mmap 索引、文件操作 |
| `backend/main.py` | FastAPI、REST/WS 路由 |
| `backend/loglayer/core.py` | Layer 基类 |
| `backend/loglayer/builtin/*.py` | 12 种图层 |

### 前端
| 文件 | 职责 |
|:-----|:-----|
| `frontend/src/App.tsx` | 状态编排 |
| `frontend/src/components/LogViewer.tsx` | Canvas 虚拟滚动 |
| `frontend/src/hooks/*.ts` | 业务 Hooks |

---

## 关键模式

- **虚拟滚动**: O(1) 渲染，Canvas
- **Layer 分离**: `sync_layers()` 数据 / `sync_decorations()` 视觉
- **平台感知**: `/api/platform`
- **类型安全**: 禁止 `as any`

---

## 命令

```bash
npm run dev; python backend/main.py  # 开发
pytest tests/; npx tsc --noEmit      # 测试
tools/package_offline.py            # 打包
```

---

## OpenSpec 工作流

```bash
# 查看当前变更
openspec list

# 创建新变更
openspec new <name>

# 继续变更
openspec continue <id>
```

*2026-03-14*
