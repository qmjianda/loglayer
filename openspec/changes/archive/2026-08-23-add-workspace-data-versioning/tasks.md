# add-workspace-data-versioning 任务

## 1. 验收测试（先红后绿）

- [x] 1.1 单测（`tests/unit/test_workspace_store.py` 增补）：无版本记录的旧库 → `ensure_data_version` 清空 kv/files 并写入当前版本；版本一致 → 数据原样保留
- [x] 1.2 单测：重置原子性——构造 kv/files 有数据的库，模拟旧版本触发重置后，kv 与 files 同时为空且 schema_version 为新值

## 2. 核心实现

- [x] 2.1 `workspace_store.py`：新增 `DATA_VERSION: int = 2` 常量与 `ensure_data_version(store)` 入口函数（读版本 → 不一致则事务内清空 kv/files + 推进版本戳 + `[WorkspaceStore]` 日志）
- [x] 2.2 `_init_schema` 移除无条件版本覆写，改为建表后调用版本保障入口；`SCHEMA_VERSION` 字符串常量迁移/废弃

## 3. 验证与收尾

- [x] 3.1 运行 1.1–1.2 单测转绿 + 既有 workspace/cache 相关单测无回归
- [x] 3.2 手动验证：用现存脏 `.loglayer` 启动后端，日志出现 `[WorkspaceStore]` 重置记录，前端布局为空、文件历史为空，Ctrl+F 在新开面板上正常（等价验证：种子遗留脏库（v1+脏布局+文件历史）经真实 WorkspaceStore 打开——日志输出"数据版本不一致（1 -> 2），已重置"，kv/files 清空；重开不误清。前端 Ctrl+F 已由 fix 变更 e2e 覆盖）
