## 1. e2e 服务生命周期改造

- [x] 1.1 conftest servers fixture 删除 CLI 预加载（backend 以 `--no-ui` 无文件参数启动）
- [x] 1.2 新增 `LOGLAYER_E2E_REUSE=1` 复用模式（跳过杀进程/重启，直接探测复用）
- [x] 1.3 就绪探测并行化（`_wait_all`），总超时 120s→15s，失败输出服务日志
- [x] 1.4 page fixture 由 `networkidle` 改为 `domcontentloaded` + 显式等待应用就绪
- [x] 1.5 page fixture 授予剪贴板权限（headless chromium 复制路径反馈所需）

## 2. 大文件测试隔离（heavy）

- [x] 2.1 `test_large_file_rendering.py` 全部测试加 `pytest.mark.heavy`（文件级 pytestmark）
- [x] 2.2 pytest.ini 注册 `heavy` marker
- [x] 2.3 新增会话级 `large_log_lines` fixture（1.3GB `wc -l` 只算一次）
- [x] 2.4 依赖 CLI 预加载的 reopen-dedup 测试改为 UI 打开开场
- [x] 2.5 split-preserve-scroll 测试改为小文件开场（脱离大文件依赖，转 light）

## 3. CLI 路径去重回归兜底

- [x] 3.1 `backend/main.py` 新增确定性 `cli_file_id()`（md5 替代内置 hash，消除 PYTHONHASHSEED 随机化）
- [x] 3.2 新增 `tests/unit/test_cli_open_dedup.py`（跨进程确定性 + resolve_file_path 归一化 + session 替换）

## 4. 编排与环境自检

- [x] 4.1 新增 `scripts/e2e.sh`（--setup/--reuse/--heavy/--all，退出码透传，无交互 CI 兼容）
- [x] 4.2 新增 `scripts/e2e-env-check.sh`（依赖/Playwright/大日志/端口/内存检测 + .wslconfig 建议）
- [x] 4.3 package.json 接入 `e2e` / `e2e:env` scripts
- [x] 4.4 AGENTS.md / tests/e2e/README.md 修正「复用已在跑实例」的过时描述

## 5. 测试稳定性与生产 bug 修复

- [x] 5.1 修复 `/api/log_level_stats` 双重编码 JSON（`json.loads` 包裹，stats 恒为 0 的根因）
- [x] 5.2 修复 6 个 e2e 测试（cache_reopen×2 改 dockview tab 关闭、bookmark 展开书签区、summary_fields 选择器+剪贴板 stub、collapse TS `!.` 语法、search_view 竞态）
- [x] 5.3 固定 sleep 事件驱动化（helpers/搜索等待/skeleton 等待/overlay 开关等），套件 188s→80s

## 6. 验收

- [x] 6.1 light 套件连跑 3 次全绿（19/19，约 80s/次，预算 5min）
- [x] 6.2 heavy 大文件专项跑通（4/4，约 62s）
- [x] 6.3 单测/集成全套通过（83 passed）
