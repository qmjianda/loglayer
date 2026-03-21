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

## 测试

### 目录结构
```
tests/                          # Python 后端测试
├── logs/                      # 测试日志文件
│   ├── large_dummy.log        # 小型测试文件 (300KB)
│   └── large_test.log         # 大型测试文件 (1.3GB)
└── unit/                      # 单元测试

e2e/                            # Playwright E2E 测试
├── fixtures.ts                # Page Objects
├── selectors/                 # UI 选择器
├── utils/                     # 测试工具
├── keyboard-shortcuts.test.ts # 键盘快捷键
├── bookmark-operations.test.ts# 书签功能
├── pane-management.test.ts    # 分屏管理
├── error-handling.test.ts     # 错误处理
├── drag-drop.test.ts          # 拖拽操作
└── browser-use/               # AI UI/UX 测试
    ├── scripts/
    │   ├── verify-qwen.sh     # 验证 Qwen 配置
    │   ├── ai-exploration.sh  # AI 探索测试
    │   └── smoke-test.sh      # 冒烟测试
    └── reports/               # 测试报告
```

### 测试命令
```bash
# 统一测试入口 (推荐)
python tools/run_all_tests.py              # TypeScript + pytest
python tools/run_all_tests.py --e2e        # 包含 E2E
python tools/run_all_tests.py --browser-use  # 包含 AI 测试
npm run test:all                           # 同上 (npm 入口)

# 单独测试
pytest tests/ -v                           # 后端测试
cd frontend && npx tsc --noEmit            # 前端类型检查
npx playwright test e2e/                   # E2E 测试
```

### 测试执行规则 ⚠️

**完成任务后必须执行测试验证：**

1. **前端代码变更** → 运行 `npx tsc --noEmit`
2. **后端代码变更** → 运行 `pytest tests/ -v`
3. **UI/交互代码变更** → 运行 E2E 测试

**E2E 测试前置条件：**
```bash
# 1. 启动后端 (无 UI 模式)
python backend/main.py --no-ui &

# 2. 等待后端启动 (约 2 秒)
sleep 2

# 3. 运行 E2E 测试
npx playwright test e2e/
```

**测试文件选择器：**
- 文件输入: `input[type="file"]:not([webkitdirectory])`
- 文件夹输入: `input[type="file"][webkitdirectory]`

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

*2026-03-21*

---

## 完成任务检查清单 ✅

每次完成代码变更后，**必须**执行以下验证：

```bash
# 推荐: 统一测试入口
python tools/run_all_tests.py              # TypeScript + pytest

# 包含 E2E 测试 (需要先启动后端)
python backend/main.py --no-ui &
sleep 2
python tools/run_all_tests.py --e2e

# 包含 AI 探索测试 (需要配置 QWEN_URL 和 QWEN_API_KEY)
python tools/run_all_tests.py --browser-use
```

**测试报告位置**: `test-results/test-report.html`

**禁止跳过测试验证。** 如测试失败，必须修复或说明原因。

---

## 测试类型对比

| 类型 | 工具 | 用途 | 执行时机 |
|------|------|------|----------|
| 类型检查 | `tsc --noEmit` | TypeScript 类型验证 | 每次前端变更 |
| 后端测试 | `pytest` | Python 单元测试 | 每次后端变更 |
| E2E 测试 | Playwright | 自动化回归测试 | UI/交互变更 |
| AI 探索测试 | browser-use | UI/UX 智能探索 | 重要功能变更 |

### AI UI/UX 测试详解

**配置环境变量** (在 `~/.bashrc` 中):
```bash
export QWEN_URL="https://coding.dashscope.aliyuncs.com/v1"
export QWEN_API_KEY="sk-your-api-key"
```

**运行 AI 探索测试**:
```bash
# 验证配置
bash e2e/browser-use/scripts/verify-qwen.sh

# 运行完整探索
bash e2e/browser-use/scripts/ai-exploration.sh

# 指定模型
MODEL_NAME=qwen-max bash e2e/browser-use/scripts/ai-exploration.sh
```

**AI 探索测试覆盖**:
- 侧边栏所有面板功能
- 键盘快捷键验证
- 视觉布局检查
- 交互流程测试
- 问题发现和建议
