# Bridge Module

> 前后端通信层 - REST + Signal 混合架构

---

## 概述

Bridge 是 LogLayer 的前后端通信层，使用 REST API + Signal 信号机制实现数据同步。

---

## 通信模式

| 模式 | 用途 | 特点 |
|------|------|------|
| **REST API** | 同步操作 (打开文件、同步图层) | 请求-响应 |
| **Signal** | 异步通知 (文件加载完成、处理完成) | 事件驱动 |

---

## REST API 端点

```
POST /api/file/open          # 打开文件
POST /api/file/close         # 关闭文件
POST /api/layers/sync        # 同步图层配置
POST /api/layers/sync_all    # 同步图层+搜索
POST /api/layers/sync_decorations # 仅同步视觉层
GET  /api/lines/read         # 读取行数据
POST /api/bookmark/toggle    # 切换书签
GET  /api/bookmark/get       # 获取书签
GET  /api/platform           # 平台信息
GET  /api/registry           # 图层注册表
POST /api/search/ripgrep     # ripgrep 搜索
```

---

## Signal 信号

| Signal | 触发时机 | 数据 |
|--------|----------|------|
| `fileLoaded` | 文件加载完成 | 文件名、大小、行数 |
| `pipelineFinished` | 图层处理完成 | 新行数、匹配数 |
| `statsFinished` | 统计完成 | 级别分布 |
| `operationStarted` | 操作开始 | 操作名 |
| `operationProgress` | 操作进度 | 百分比 |
| `operationError` | 操作错误 | 错误信息 |
| `workspaceOpened` | 工作区打开 | 路径 |

---

## 客户端 API

```typescript
// bridge_client.ts
export async function openFile(fileId: string, path: string): Promise<boolean>
export async function closeFile(fileId: string): Promise<void>
export async function syncAll(fileId: string, layers: LogLayer[], search: SearchConfig): Promise<void>
export async function readProcessedLines(fileId: string, start: number, count: number): Promise<LogLine[]>
export async function searchRipgrep(fileId: string, query: string, regex: boolean, caseSensitive: boolean): Promise<boolean>
```

---

## 类型转换

Python 和 TypeScript 使用不同的命名约定：

| Python (snake_case) | TypeScript (camelCase) |
|---------------------|------------------------|
| `file_id` | `fileId` |
| `line_index` | `lineIndex` |
| `case_sensitive` | `caseSensitive` |

`bridge_client.ts` 自动处理转换。

---

## 后端实现

```python
# bridge.py - FileBridge 类
class FileBridge:
    def open_file(self, file_id: str, path: str) -> bool
    def close_file(self, file_id: str) -> None
    def sync_layers(self, file_id: str, layers_json: str) -> bool
    def read_processed_lines(self, file_id: str, start: int, count: int) -> str
    # ... 40+ 方法
```

---

## 相关文件

- `backend/bridge.py` - FileBridge 实现
- `backend/main.py` - FastAPI 路由
- `frontend/src/bridge_client.ts` - 客户端 API
- `frontend/src/types.ts` - 共享类型