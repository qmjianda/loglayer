# LogLayer API Reference

> REST API 端点和 WebSocket 信号文档

---

## 基础信息

- **Base URL**: `http://127.0.0.1:12345`
- **Content-Type**: `application/json`
- **WebSocket**: `ws://127.0.0.1:12345/ws`

---

## 文件操作

### POST /api/open_file

打开日志文件并建立索引。

**Request:**
```json
{
  "file_id": "uuid-string",
  "path": "/path/to/file.log"
}
```

**Response:** `boolean`

---

### POST /api/close_file

关闭已打开的文件。

**Request:**
```json
{
  "file_id": "uuid-string"
}
```

**Response:** `null`

---

### GET /api/file_info

获取文件信息（大小、行数、修改时间）。

**Query:**
- `file_id`: 文件 ID

**Response:**
```json
{
  "path": "/path/to/file.log",
  "size": 1048576,
  "mtime": 1700000000,
  "lineCount": 50000
}
```

---

## 图层操作

### POST /api/sync_all

同步所有图层和搜索配置。

**Request:**
```json
{
  "file_id": "uuid-string",
  "layers": "[{...}]",
  "search": "{...}"
}
```

**Response:** `boolean`

---

### POST /api/sync_layers

同步数据图层（过滤、转换）。

**Request:**
```json
{
  "file_id": "uuid-string",
  "layers": "[{...}]"
}
```

**Response:** `boolean`

---

### POST /api/sync_decorations

同步视觉图层（高亮、装饰）。

**Request:**
```json
{
  "file_id": "uuid-string",
  "layers": "[{...}]"
}
```

**Response:** `boolean`

---

### GET /api/get_layer_registry

获取所有已注册图层的信息。

**Response:**
```json
[
  {
    "type": "FILTER",
    "display_name": "过滤",
    "description": "按关键词过滤日志",
    "icon": "filter",
    "ui_schema": [...],
    "is_builtin": true
  }
]
```

---

## 行数据

### GET /api/read_processed_lines

读取处理后的行数据。

**Query:**
- `file_id`: 文件 ID
- `start`: 起始行号
- `count`: 行数

**Response:**
```json
[
  {
    "index": 0,
    "content": "2024-01-01 INFO: Application started",
    "highlights": [...],
    "isMarked": false
  }
]
```

---

### POST /api/get_lines_by_indices

按索引获取多行内容。

**Request:**
```json
{
  "file_id": "uuid-string",
  "indices": [0, 10, 20]
}
```

**Response:** `string[]`

---

## 搜索

### POST /api/search_ripgrep

使用 ripgrep 执行搜索。

**Request:**
```json
{
  "file_id": "uuid-string",
  "query": "ERROR",
  "regex": false,
  "case_sensitive": false
}
```

**Response:** `boolean` (搜索是否成功)

---

### GET /api/get_search_match_index

获取指定排名的搜索匹配行号。

**Query:**
- `file_id`: 文件 ID
- `rank`: 匹配排名 (0-based)

**Response:** `number` (行号)

---

### GET /api/get_search_matches_range

获取范围内的搜索匹配。

**Query:**
- `file_id`: 文件 ID
- `start_rank`: 起始排名
- `count`: 数量

**Response:** `number[]` (行号数组)

---

## 书签

### POST /api/toggle_bookmark

切换行书签状态。

**Request:**
```json
{
  "file_id": "uuid-string",
  "line_index": 42
}
```

**Response:** `{"42": "comment"}` (书签映射)

---

### GET /api/get_bookmarks

获取所有书签。

**Query:**
- `file_id`: 文件 ID

**Response:** `{"line_index": "comment", ...}`

---

### POST /api/update_bookmark_comment

更新书签注释。

**Request:**
```json
{
  "file_id": "uuid-string",
  "line_index": 42,
  "comment": "Important line"
}
```

**Response:** 书签映射

---

### POST /api/clear_bookmarks

清除所有书签。

**Request:**
```json
{
  "file_id": "uuid-string"
}
```

**Response:** `{}`

---

## 工作区

### GET /api/select_files

打开文件选择对话框。

**Response:** `string` (JSON 数组字符串)

---

### GET /api/select_folder

打开文件夹选择对话框。

**Response:** `string` (路径)

---

### POST /api/save_workspace_config

保存工作区配置。

**Request:**
```json
{
  "folder_path": "/path/to/workspace",
  "config": "{...}"
}
```

**Response:** `boolean`

---

### GET /api/load_workspace_config

加载工作区配置。

**Query:**
- `folder_path`: 工作区路径

**Response:** `string` (JSON 配置)

---

## 统计与分析

### GET /api/log_level_stats

获取日志级别统计。

**Query:**
- `file_id`: 文件 ID

**Response:**
```json
{
  "ERROR": 150,
  "WARN": 500,
  "INFO": 5000,
  "DEBUG": 10000
}
```

---

### GET /api/analyze_log_pattern

分析日志模式。

**Query:**
- `file_id`: 文件 ID
- `sample_size`: 采样数量 (默认 100)

**Response:**
```json
{
  "patterns": [...],
  "suggested_layers": [...]
}
```

---

### GET /api/suggest_layers

智能图层建议。

**Query:**
- `file_id`: 文件 ID

**Response:**
```json
{
  "suggestions": [
    {"type": "LEVEL", "confidence": 0.9},
    {"type": "TIMESTAMP", "confidence": 0.85}
  ]
}
```

---

## 系统信息

### GET /api/platform

获取平台信息。

**Response:**
```json
{
  "os": "Windows",
  "hasNativeDialogs": true
}
```

---

### GET /api/system_metrics

获取系统资源指标。

**Response:**
```json
{
  "cpu_percent": 25.5,
  "memory_percent": 45.2,
  "memory_used_mb": 1024,
  "memory_total_mb": 2048
}
```

---

### GET /api/worker_config

获取工作线程配置。

**Response:**
```json
{
  "max_workers": 4,
  "cpu_count": 8
}
```

---

### POST /api/worker_config

设置工作线程配置。

**Request:**
```json
{
  "max_workers": 8
}
```

**Response:** `null`

---

## 导出

### POST /api/export_logs

导出日志。

**Request:**
```json
{
  "file_id": "uuid-string",
  "output_path": "/path/to/export.txt",
  "format": "txt"
}
```

**Response:** `string` (导出路径)

---

## WebSocket 信号

连接到 `/ws` 接收实时信号。

### fileLoaded

文件加载完成时触发。

```json
{
  "signal": "fileLoaded",
  "args": ["file_id", "{\"name\": \"app.log\", \"lineCount\": 10000}"]
}
```

---

### pipelineFinished

图层处理完成时触发。

```json
{
  "signal": "pipelineFinished",
  "args": ["file_id", 8500, 42]
}
```

参数: `file_id`, `new_total_lines`, `search_match_count`

---

### statsFinished

统计完成时触发。

```json
{
  "signal": "statsFinished",
  "args": ["file_id", "{\"ERROR\": 10, \"WARN\": 50}"]
}
```

---

### operationStarted

后台操作开始时触发。

```json
{
  "signal": "operationStarted",
  "args": ["file_id", "indexing"]
}
```

---

### operationProgress

操作进度更新时触发。

```json
{
  "signal": "operationProgress",
  "args": ["file_id", "indexing", 75]
}
```

---

### operationError

操作出错时触发。

```json
{
  "signal": "operationError",
  "args": ["file_id", "Failed to open file"]
}
```

---

## 错误响应

所有端点在出错时返回：

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

*最后更新: 2026-03-20*