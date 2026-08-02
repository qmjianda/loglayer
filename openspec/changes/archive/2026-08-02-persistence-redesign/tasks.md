# persistence-redesign Tasks

## 1. 后端存储底座

- [x] 1.1 新建 `backend/loglayer/workspace_store.py`：SQLite 存储类，含 `schema_version`、`kv`、`files` 表
- [x] 1.2 实现 schema 版本记录与事务原子写（`BEGIN/COMMIT`）
- [x] 1.3 实现 KV 读写（`get(key)`/`put(key, value)` 原子写）与文件历史读写（`upsert_file`/`get_files`/`set_was_open`）
- [x] 1.4 在 `backend/main.py` 新增状态 API：`GET/PUT /api/workspace/state`、`GET/PUT /api/workspace/files`
- [x] 1.5 `bridge.py` 的 `save_workspace_config`/`load_workspace_config` 改为内部转 workspace_store（保持兼容壳）
- [x] 1.6 启动时检测并删除旧 `.loglayer/config.json` 与 `.loglayer/cache.db`

## 2. 布局标识稳定化

- [x] 2.1 新增工具 `panelIdForFile(uri)`：基于 path 的稳定 hash id（`log-view-<hash>`）
- [x] 2.2 `EditorArea` 与 `App.openFileInEditor` 中所有 `log-${fileId}` 改为 `panelIdForFile(uri)`
- [x] 2.3 布局恢复：`fromJSON` 前按 `panels[].params.uri` 重映射旧 view id 为稳定 id（兼容旧布局数据）
- [x] 2.4 修复 `useEffect`：文件列表未加载（`openFiles.length===0`）时不清理面板

## 3. 布局持久化迁移

- [x] 3.1 `EditorArea` 增加 `initialLayout` prop + `onLayoutChange` 回调（布局经后端 API 读写）
- [x] 3.2 `useWorkspaceConfig` 的 `saveConfig`/`loadConfig` 改为读写 `kv['layout']`，移除 localStorage 布局
- [x] 3.3 `App` 接线：layout state 从 config 加载、传给 EditorArea、接收 onLayoutChange
- [x] 3.4 移除 `LAYOUT_STORAGE_KEY` localStorage 读写（BREAKING）

## 4. 书签与设置接入底座

- [x] 4.1 书签持久化到 `kv['bookmarks.<file>']`（`useBookmarks` 读写走后端 API）
- [x] 4.2 设置（`useSettings`）可选项：持久化 UI 偏好到 `kv['settings']`（设备级 vs 工作区级决策后）— 决策：保持设备级 localStorage，不入 workspace.db（符合 proposal 设备级/工作区级分离）

## 5. 验证

- [x] 5.1 手动验证：打开 3 文件叠放 → 刷新 → 重开工作区，布局一致不分屏（已用临时 e2e 自动化验证：文件夹工作区打开 2 文件 → 布局写入 kv['layout']（稳定 log-view id）→ 刷新 → 两面板完整恢复）
- [x] 5.2 手动验证：拖拽分屏 → 刷新 → 布局保持（恢复机制已验证；用户已桌面端目测确认通过）
- [x] 5.3 验证旧 `config.json` / `cache.db` 被删除，新 `workspace.db` 正常读写（已通过后端集成脚本 + 单测验证）
- [x] 5.4 跑 `python3 -m pytest tests/unit/` 与 `npx tsc --noEmit`
- [x] 5.5 跑 e2e（`test_cache_reopen_ui`、`test_large_file_rendering`）
