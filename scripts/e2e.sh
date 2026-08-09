#!/usr/bin/env bash
# e2e 一键编排：环境自检 →（可选 --setup 初始化）→ 运行 pytest。
#
# 用法（在仓库根目录）:
#   npm run e2e                # 默认轻量：21 个 light 测试（不含 1.3GB 大文件）
#   npm run e2e -- --heavy     # 大文件专项：4 个 heavy 测试（需大日志，峰值内存高）
#   npm run e2e -- --setup     # 首次初始化：装 playwright/浏览器/npm 依赖、生成大日志
#   npm run e2e -- --reuse     # 复用已在跑的 backend(12345)+vite(3000)，跳过杀进程/重启
#   npm run e2e -- --all       # light + heavy 全部
#
# 无交互、退出码直传 pytest，可被 CI 直接复用（换台机器跑同一脚本）。
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SETUP=0
REUSE=0
HEAVY=0
ALL=0
VERBOSE=0
for arg in "$@"; do
    case "$arg" in
        --setup)  SETUP=1 ;;
        --reuse)  REUSE=1 ;;
        --heavy)  HEAVY=1 ;;
        --all)    ALL=1 ;;
        -v|--verbose) VERBOSE=1 ;;
        *) echo "[e2e] 未知参数: $arg"; exit 2 ;;
    esac
done

# --- 1. 环境自检 ---
bash "$ROOT/scripts/e2e-env-check.sh"
check_code=$?
if [ "$check_code" -eq 2 ] && [ "$SETUP" -ne 1 ]; then
    echo "[e2e] 环境缺关键项，中止。首次运行请加 --setup（npm run e2e -- --setup）"
    exit 2
fi

# --- 2. 首次初始化（显式授权） ---
if [ "$SETUP" -eq 1 ]; then
    echo "[e2e] --setup: 安装依赖并生成大日志..."
    python3 -m pip install playwright >/dev/null 2>&1 || { echo "[e2e] pip install playwright 失败"; exit 2; }
    python3 -m playwright install chromium || exit 2
    npm install || exit 2
    if [ ! -f "$ROOT/tests/logs/large_test.log" ]; then
        echo "[e2e] 生成大日志（1.2GB，仅 heavy 需要）..."
        python3 tests/benchmarks/gen_big_file.py "$ROOT/tests/logs/large_test.log" || exit 2
    fi
fi

# --- 3. 运行模式 ---
if [ "$REUSE" -eq 1 ]; then
    echo "[e2e] --reuse: 复用已在运行的 backend/vite（请自行保证代码为最新）"
    export LOGLAYER_E2E_REUSE=1
fi

MARK_EXPR="e2e"
if [ "$ALL" -eq 1 ]; then
    echo "[e2e] 运行全部测试（light + heavy）"
elif [ "$HEAVY" -eq 1 ]; then
    echo "[e2e] 运行 heavy 大文件专项（4 个测试，峰值内存高，建议先调大 .wslconfig 内存）"
    MARK_EXPR="e2e and heavy"
else
    echo "[e2e] 运行 light 测试（21 个，不含大文件）"
    MARK_EXPR="e2e and not heavy"
fi

if [ "$VERBOSE" -eq 1 ]; then
    exec python3 -m pytest tests/e2e -m "$MARK_EXPR" -v
else
    exec python3 -m pytest tests/e2e -m "$MARK_EXPR"
fi
