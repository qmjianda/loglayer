## Why

e2e 测试在 WSL2 开发环境下「很难成功、跑得久」：基线 14/14 全挂（backend 启动时索引 1.3GB 大日志导致 OOM-kill，可用内存被耗尽）、单次耗时 7 分钟+、且大量时间浪费在搭建/验证环境上（杀进程重启、就绪等待 120s、固定 sleep 30-60s）。根因是 CLI 预加载 1.3GB 的时机（frontendReady 触发）与前端启动抢内存，以及环境缺内存预警。

## What Changes

- **删除 backend CLI 预加载 1.3GB 大日志**：servers fixture 不再以 LARGE_LOG 作为启动参数，消除 OOM 根因；依赖预加载的 2 个测试改为 UI 打开开场，CLI 路径去重回归点由 backend 单测兜底（`cli_file_id` 改用 md5，消除 PYTHONHASHSEED 随机化）
- **一键编排 `npm run e2e`**：环境自检 →（可选 `--setup` 初始化）→ 起服务 → 等就绪 → 跑测试 → 清理；flags：`--setup` / `--reuse` / `--heavy` / `--all`
- **服务生命周期可复用**：默认强制杀 12345/3000 既有进程再启动（可信优先）；`LOGLAYER_E2E_REUSE=1` / `--reuse` 显式复用已在跑的实例
- **heavy 大文件测试隔离**：`@pytest.mark.heavy` 标记 4 个大文件测试，默认只跑 light（21 个），`--heavy` 显式跑大文件专项
- **环境自检 `npm run e2e:env`**：依赖/内存/端口检测，内存 <3GB 时 crit 拦截并给出 `.wslconfig` 建议（WSL2 下 backend 索引 1.3GB 峰值 2.4GB+，<8GB 内存必然 OOM）
- **测试稳定性治理**：page fixture 由 `networkidle`（WebSocket 下脆弱）改为事件驱动（domcontentloaded + 显式就绪等待）；固定 sleep 事件驱动化（套件 188s→80s）
- **修复生产 bug**：`/api/log_level_stats` 双重编码 JSON（stats 永远显示 0）

## Capabilities

### New Capabilities

- `e2e-orchestration`: 一条命令端到端编排（环境检查、服务起停、light/heavy 选择、退出码透传），可被 CI 复用
- `e2e-service-lifecycle`: e2e 服务生命周期契约（默认杀重启保证测最新代码、显式复用模式、并行就绪探测 ≤15s）
- `e2e-heavy-isolation`: 大文件（1.3GB）测试与常规测试隔离：默认不跑 heavy、显式指定才跑，避免内存峰值与耗时拖累常规套件
- `e2e-env-check`: 运行前环境自检（依赖/Playwright/大日志/内存/端口），内存不足时给出可操作建议而非「玄学失败」

### Modified Capabilities

（无——现有 specs 无 e2e/测试相关能力，全部为新增）

## Impact

- **测试基础设施**：`tests/e2e/conftest.py`（servers/page fixtures、就绪探测）、`tests/e2e/helpers.py`、全部 8 个 e2e 测试文件、`pytest.ini`（heavy marker）
- **编排脚本**：`scripts/e2e.sh`、`scripts/e2e-env-check.sh`、`package.json`（e2e / e2e:env scripts）
- **后端**：`backend/main.py`（CLI file_id 确定性 md5、`/api/log_level_stats` json.loads 修复）
- **后端测试**：`tests/unit/test_cli_open_dedup.py`（CLI 路径去重回归单测）
- **文档**：AGENTS.md / tests/e2e/README.md（修正「复用已在跑实例」的过时描述）
