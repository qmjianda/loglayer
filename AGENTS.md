# AGENTS.md - LogLayer Agent Guidelines

> 基于 [vibe-coding-cn](https://github.com/tukuaiai/vibe-coding-cn) 方法论

---

## 核心哲学 (必读)

| 原则 | 描述 |
|:-----|:-----|
| **上下文第一** | 垃圾进，垃圾出。先读 PROGRESS.md、CONTEXT.md |
| **规划驱动** | 先结构后代码。技术债务还不完 |
| **胶水编程** | 能抄不写，能连不造，复用成熟轮子 |
| **目的主导** | 一切围绕用户价值，不是为了写代码而写代码 |
| **AI 能做的交给 AI** | 凡是 AI 能做的，就不要人工做 |

---

## 新会话开始流程

```
1. 阅读 PROGRESS.md     → 了解当前工作状态
2. 阅读 CONTEXT.md     → 了解项目整体情况
3. 阅读 TECHNICAL_DECISIONS.md → 了解技术决策背景
4. (可选) AI_SESSION.md → 使用合适的模板
```

---

## Build / Test Commands

### Python Backend
- **Run all tests**: `pytest tests/`
- **Run specific test**: `pytest tests/test_name.py`
- **Run integration tests**: `pytest tests/integration/`
- **Run unit tests**: `pytest tests/unit/`
- **Run with coverage**: `pytest tests/ --cov=backend --cov-report=html`

### Frontend
- **Development**: `npm run dev`
- **Build**: `npm run build`
- **Type Check**: `npx tsc --noEmit`

### Package
- **Install deps**: `python tools/install_deps.py`
- **Package (Win)**: `tools/package.bat`
- **Standalone EXE**: `tools/package_exe.bat`

---

## Skill 系统

### 核心 Skill

| Skill | 用途 | 调用方式 |
|:------|:-----|:---------|
| **vite-dev** | 前端开发 | `npm run dev` 启动后调试 |
| **pytest-test** | 测试编写 | `pytest tests/` 运行验证 |
| **bug-repro** | Bug 复现 | 参考 `tests/repro/` 模式 |
| **ui-ux-review** | UI/UX 评审 | 检查 AGENTS.md UI/UX 规范 |

### Skill 调用规范

```markdown
当需要 [功能] 时：
1. 检查是否有对应 Skill
2. 加载 Skill 指令
3. 按照 Skill 指引执行
4. 更新 PROGRESS.md
```

---

## Code Style Guidelines

### Python

**Imports**:
- Standard library first, then third-party, then local
- Use explicit imports: `from typing import List, Optional`
- Group: `asyncio` + `threading` + `uvicorn` + `fastapi` + `pydantic` + local

```python
import os
import sys
import json
import asyncio
import threading

import uvicorn
import webview
from fastapi import FastAPI, WebSocket
from pydantic import BaseModel

from bridge import FileBridge
```

**Formatting**:
- 4 spaces indentation
- Max line length: 100 chars
- Use blank lines to separate logical sections (2 blank lines between top-level defs)

**Types**:
- Use Pydantic `BaseModel` for API request/response
- Use `typing` module: `List[str]`, `Optional[int]`, `Dict[str, Any]`
- Type hints on function signatures

**Naming**:
- `snake_case` for functions/variables
- `PascalCase` for classes
- `_private` prefix for internal methods

**Error Handling**:
- Wrap async operations in try/except
- Use specific exception types
- Log errors with context: `print(f"[Module] Error: {e}")`

**Patterns**:
- Use `@asynccontextmanager` for FastAPI lifespan
- WebSocket: `ConnectionManager` class with connect/disconnect/broadcast
- Thread-safe: `asyncio.run_coroutine_threadsafe()` for cross-thread comm

---

### TypeScript / React

**Imports**:
- Relative imports first, then packages
- Use explicit named imports

```typescript
import { useState, useEffect } from 'react';
import { FileBridgeAPI } from './types';
```

**Formatting**:
- 2 spaces indentation
- Single quotes for strings
- Trailing commas

**Types**:
- Use TypeScript interfaces for API types
- Define in `types.ts`
- Avoid `any`, use `unknown` if needed

**Naming**:
- `camelCase` for variables/functions
- `PascalCase` for components
- `kebab-case` for CSS classes

**Components**:
- Functional components with hooks
- Extract custom hooks to `hooks/` folder
- Use `.tsx` for components, `.ts` for logic

**State Management**:
- Use React Context for global state
- Local state with `useState`
- Derived state computed in render

---

## Key Technical Patterns

### Virtualization
All log viewing MUST use virtual scrolling (O(1) rendering).

### Layer System
- `sync_layers()` - data-altering operations
- `sync_decorations()` - visual-only changes

### Platform Awareness
Use `/api/platform` endpoint for OS-specific logic.

### Resource Sensitivity
Document CPU/Memory impact when modifying mmap indexing.

---

## Development Workflow

### 流程 (参考 vibe-coding-cn)

```
1. 需求分析 → 明确"做什么"
2. 上下文准备 → 读 PROGRESS.md, CONTEXT.md
3. 技术方案 → 必要时记录到 TECHNICAL_DECISIONS.md
4. 实施 → 代码 + 测试
5. 验证 → TypeScript + pytest
6. 文档更新 → 更新 PROGRESS.md
```

### 关键约束

| 约束 | 说明 |
|:-----|:-----|
| 一次只改一个模块 | 避免引入复杂 |
| 先文档后代码 | 便于后续维护 |
| Bug 需复现 | 必须提供最小复现 |
| 类型安全优先 | 避免 `any` |

---

## UI/UX Guidelines

- No emoji icons (use SVGs/Lucide)
- All clickable elements: `cursor-pointer`
- Stable hover states (no layout shifts)
- Ensure contrast in Light/Dark modes
- 键盘优先: 常用操作应有快捷键

---

## 快速入口

> AI 助手必读：新会话开始时，请先阅读 docs/ 目录下的文档

| 文档 | 用途 |
|:-----|:-----|
| [docs/PROGRESS.md](./docs/PROGRESS.md) | 当前开发进度 |
| [docs/CONTEXT.md](./docs/CONTEXT.md) | 项目上下文快照 |
| [docs/TECHNICAL_DECISIONS.md](./docs/TECHNICAL_DECISIONS.md) | 技术决策记录 |
| [docs/AI_SESSION.md](./docs/AI_SESSION.md) | 会话模板 |
| [PROJECT_MAP.md](./PROJECT_MAP.md) | 架构地图 |
