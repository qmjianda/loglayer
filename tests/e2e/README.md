# e2e 测试（前端 UI 交互与显示验证）

用 pytest + Playwright 驱动真实浏览器，验证前端 UI 交互与渲染显示是否正确。
**默认不随普通 `pytest` 运行**（被 `tests/conftest.py` 的 `collect_ignore` 排除），
需显式指定目录。

## 前置条件

```bash
pip install pytest playwright
python -m playwright install chromium
npm install   # 项目根
```

## 运行

```bash
# 推荐：一键编排（默认 light，不含 1.3GB 大文件测试）
npm run e2e

# 大文件专项（4 个 heavy 测试，需 tests/logs/large_test.log，峰值内存高）
npm run e2e -- --heavy

# 首次初始化：装 playwright/浏览器/npm 依赖、生成大日志
npm run e2e -- --setup

# 复用已在跑的 backend(12345)+vite(3000)，跳过杀进程/重启
npm run e2e -- --reuse

# 直接跑全部（等价 light + heavy；conftest 自动起服务）
python3 -m pytest tests/e2e -v

# 单个文件 / 单测
python3 -m pytest tests/e2e/test_large_file_rendering.py -v
```

## 服务生命周期（重要）

conftest **默认会强制杀掉**占用 12345/3000 端口的既有 backend/vite 进程再启动，
保证测试基于最新代码（结果可信优先）。**不会**自动复用已在跑的实例。

需要复用已在运行的实例时（省去杀进程/重启，但请自行保证服务代码为最新）：

```bash
LOGLAYER_E2E_REUSE=1 python3 -m pytest tests/e2e -v
# 或
npm run e2e -- --reuse
```

## 测试用例

| 文件 | 验证内容 |
|------|---------|
| `test_large_file_rendering.py` | 打开超大日志文件（`tests/logs/large_test.log`，2290 万行）不白屏：canvas 渲染高度为真实可视区而非虚拟高度、aria 行数一致、无前端错误、虚拟滚动正常 |

## 结构

```
tests/e2e/
├── conftest.py        # 前后端进程管理 + Playwright browser/page fixture
├── helpers.py         # UI 交互（打开文件）与渲染断言工具
├── test_*.py          # 具体测试
└── README.md
```

## 扩展（供 AI 后续新增 e2e）

1. 新增 `tests/e2e/test_xxx.py`，`pytestmark = pytest.mark.e2e`
2. 复用 `page` fixture（已监听 pageerror/console error）
3. 复用 `helpers.py` 的交互/断言函数，或新增
4. 关键 fixture 返回的数据结构见 `helpers.collect_canvas_state`
