# AGENTS.md - LogLayer AI Guide

> OpenCode 必读：完整文档 `docs/INDEX.md`

---

## 项目
**LogLayer** - 高性能日志分析桌面应用 (Python FastAPI + React + pywebview)

---

## UI 布局
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

左侧图标栏: 工作区│搜索│统计│AI助手│帮助│设置
侧边栏面板: 工作区(文件树)│AI助手(聊天)│统计│搜索│帮助
浮动面板: 设置(6选项卡)│快捷键│命令面板(Ctrl+P)

**详细布局**: `docs/UI/README.md` (MAIN.md|SIDEBAR.md|MODALS.md)

---

## 目录
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

## 命令
```bash
npm run dev; python backend/main.py  # 开发
pytest tests/; npx tsc --noEmit      # 测试
tools/package_offline.py            # 打包
```

---

## 关键模式
| 模式 | 说明 |
|:-----|:-----|
| 虚拟滚动 | O(1) 渲染，Canvas |
| Layer | sync_layers/decorations 分离 |
| 平台 | /api/platform |
| 类型 | 禁止 as any |

---

## 代码风格
Python: 4 空格, snake_case, Pydantic BaseModel
TypeScript: 2 空格, camelCase, 函数组件 + Hooks

---

## 类型同步

前后端类型必须保持同步。详细映射见 `docs/TYPE_SYNC.md`。

**添加新类型的步骤：**

1. 在 `backend/loglayer/schemas.py` 添加 Pydantic 模型
2. 在 `frontend/src/types.ts` 添加对应 TypeScript interface
3. 添加 `// Mirror: backend/loglayer/schemas.py::TypeName` 注释
4. 更新 `docs/TYPE_SYNC.md` 文档
5. CI 会自动检查类型数量是否匹配

**命名约定：**
- Python: `snake_case` (file_id, line_index)
- TypeScript: `camelCase` (fileId, lineIndex)
- `bridge_client.ts` 自动处理转换

---

## 工作流 (OpenSpec)
```
1. openspec new <change>   → 创建变更
2. openspec continue       → 实施变更
3. openspec verify         → 验证变更
4. openspec archive        → 归档变更
```

---

## 文档
| 场景 | 文档 |
|:-----|:-----|
| 技术栈/模块 | docs/CONTEXT.md |
| 界面布局 | docs/UI/README.md |
| 技术决策 | docs/TECHNICAL_DECISIONS.md |
| 图层开发 | docs/guides/LAYER_DEV_GUIDE.md |
| 类型同步 | docs/TYPE_SYNC.md |
| 模块设计 | docs/modules/*.md |
| 完整索引 | docs/INDEX.md |

*2026-03-14*
