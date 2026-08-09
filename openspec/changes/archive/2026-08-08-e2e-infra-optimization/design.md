## Context

e2e 测试（Playwright 驱动真实前后端）此前在 WSL2 开发环境几乎不可用：backend 启动时通过 CLI 预加载 1.3GB 大日志（`frontendReady` 信号触发索引，峰值 RSS 2.4GB+），在 7.6GB 内存的 WSL2 上触发内核 OOM-kill，导致 14/14 全挂、耗时 7 分钟。同时存在文档与实现不一致（声称"复用已在跑的实例"实则每次强杀重启）、就绪探测 120s 串行上限、测试内固定 sleep 30-60s 等稳定性/效率问题。

本次变更将 e2e 从"7 分钟全挂"改进为"一条命令 80 秒全绿"，并建立可复用的编排/隔离/自检契约。

## Goals / Non-Goals

**Goals:**
- `npm run e2e` 一条命令完成环境自检 → 起服务 → 跑测试 → 清理，冷启动 ≤5min
- 消除 1.3GB 预加载导致的 OOM 根因，测试在 WSL2（内存 ≥8GB）下稳定通过
- heavy 大文件测试与常规测试隔离，默认运行不含大文件
- 环境问题（依赖/内存/端口）在运行前显式暴露，而非运行中"玄学失败"
- 服务生命周期可信（默认测最新代码）+ 可显式复用

**Non-Goals:**
- 不改变产品功能行为（除 `/api/log_level_stats` 双重编码 bug 修复外）
- 不做 Docker/devcontainer 环境固化
- 不缩减 1.3GB 大日志规模（保持大文件测试有效性）
- 不建立 CI workflow（脚本预留 CI 接口）

## Decisions

**D1: 删除 CLI 预加载，而非缩小日志或降级测试**
后端不再以 `large_test.log` 作为 CLI 启动参数。原依赖预加载的 2 个 e2e 测试（reopen-dedup、split-scroll）改为通过 UI 打开文件；CLI bare-filename 路径去重回归点由 `tests/unit/test_cli_open_dedup.py` 兜底。
- 备选（缩小 1.3GB / 保留预加载）被否：会降低大文件测试有效性或保留 OOM 风险。

**D2: 默认杀重启 + `LOGLAYER_E2E_REUSE=1` 显式复用**
conftest 默认强制杀掉 12345/3000 既有进程再启动（保证测最新代码，可信优先）；设环境变量后跳过杀进程/重启，直接探测复用已在跑的实例（快，但需自行保证代码为最新）。
- 备选（默认复用）被否：服务代码非最新会静默产生假绿/假红。

**D3: 就绪探测并行化 + 收紧超时（120s→15s）**
后端端口、后端 API（/api/platform）、前端端口三个探针轮询并行，总超时 15s（正常启动 <5s），失败时输出服务日志定位。

**D4: page fixture 事件驱动**
`pg.goto(wait_until="networkidle")` 改为 `domcontentloaded` + 显式等待「浏览并打开」按钮（始终渲染，见 UnifiedPanel.tsx）。networkidle 在 WebSocket 连接下可能永不触发。

**D5: heavy marker 隔离大文件测试**
`@pytest.mark.heavy` 标记 4 个大文件测试（`test_large_file_rendering.py` 全部），`npm run e2e` 默认 `-m "e2e and not heavy"`，`--heavy` 显式跑大文件专项。顺带 `large_log_lines` 会话级 fixture 缓存 `wc -l`（1.3GB 行数统计只跑一次）。

**D6: CLI file_id 确定性化**
`cli_file_id()` 用 `hashlib.md5(绝对路径+mtime+size)` 替代 Python 内置 `hash()`（受 PYTHONHASHSEED 影响、跨进程不稳定），保证同一文件每次启动得到相同 id（路径去重的前提）。

**D7: 生产 bug 修复 `/api/log_level_stats`**
endpoint 直接返回 `bridge.get_log_level_stats()`（内部已 `json.dumps`）导致双重编码，前端解析得到字符串、stats 恒为 0。修复为 `json.loads(...)` 包裹，与代码库其他同型 endpoint 一致。

**D8: sleep→事件驱动**
52 处固定 `wait_for_timeout` 中可安全转换的（sleep 后跟着等待同一条件的 wait）改为 `wait_for_selector` / `wait_for_function`（如等 find widget 匹配计数、等 skeleton 消失、等 overlay detached）；保留鼠标拖拽/动画等真性 settle。套件 188s→80s。

## Risks / Trade-offs

- [大文件测试在低内存机器仍可能 OOM] → `e2e-env-check.sh` 检测可用内存 <3GB 时 crit 拦截并提示 `.wslconfig`（memory=12GB）
- [reuse 模式服务代码与工作区不一致导致假结果] → 文档/README 明示"需自行保证服务代码为最新"，默认行为仍为杀重启
- [heavy 测试默认不跑，大文件回归可能漏检] → `--heavy` / `--all` 显式选项 + README 说明；验收流程含 heavy 专项
- [删预加载后 reopen-dedup 回归点转移] → 单测兜底（跨进程确定性 + session 替换），e2e 保留 UI 打开路径的去重验证
