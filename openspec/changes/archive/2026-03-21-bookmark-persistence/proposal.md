# Proposal: Bookmark Persistence

## Why

书签当前仅保存在内存中，关闭文件后丢失。用户期望书签像图层预设一样持久化到 `.loglayer/` 目录，以便：
- 关闭文件后重新打开时恢复书签
- 在团队成员间共享书签（如果 `.loglayer/` 被提交到版本控制）
- 避免重要标记丢失

## What Changes

### 书签存储
- 书签保存到 `{project}/.loglayer/bookmarks/{file_hash}.json`
- 每个文件一个书签文件，格式：`{"42": "Error here", "137": ""}`
- 文件打开时自动加载，修改时自动保存

### API 变更
- `toggle_bookmark` 后自动保存到 `.loglayer/`
- `open_file` 时自动加载书签
- `close_file` 时可选保存

### 新增 API
- `POST /api/save_bookmarks` - 手动保存书签
- `POST /api/load_bookmarks` - 手动加载书签

## Capabilities

### New Capabilities
- `bookmark-persistence`: 书签持久化到文件系统

### Modified Capabilities
- `bookmark-operations`: 扩展现有书签操作，添加持久化支持

## Impact

### Affected Files
- `backend/bridge.py` - 添加书签保存/加载逻辑
- `backend/search_mixin.py` - BookmarkPipeline 添加持久化方法
- `frontend/src/bridge_client.ts` - 添加保存/加载 API

### Non-goals
- 书签同步到云端
- 书签版本历史
- 跨项目书签共享