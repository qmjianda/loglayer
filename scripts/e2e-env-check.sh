#!/usr/bin/env bash
# e2e 环境自检：跑 e2e 前检查依赖/内存/端口，失败原因一目了然（不再"玄学失败"）。
# 退出码：0=就绪  1=有警告（可跑，但可能不稳）  2=缺关键项（不可跑）
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WARN=0
CRIT=0

say()  { printf '[e2e] %s\n' "$*"; }
warn() { printf '[e2e] [warn] %s\n' "$*"; WARN=1; }
crit() { printf '[e2e] [crit] %s\n' "$*"; CRIT=1; }

# --- 1. 基础命令 ---
for cmd in python3 node npx; do
    command -v "$cmd" >/dev/null 2>&1 || crit "缺少命令: $cmd"
done

# --- 2. 前端依赖 ---
[ -d "$ROOT/node_modules" ] || warn "缺少 node_modules，先运行: npm install"

# --- 3. Playwright ---
if ! python3 -c "import playwright" >/dev/null 2>&1; then
    crit "缺少 playwright 包: pip install playwright"
else
    python3 -m playwright install chromium >/dev/null 2>&1 || true
    if ! ls ~/.cache/ms-playwright/chromium-* >/dev/null 2>&1; then
        warn "未找到 chromium 浏览器，运行: python3 -m playwright install chromium"
    fi
fi

# --- 4. 大日志（仅 heavy 需要，缺失只警告） ---
LARGE_LOG="$ROOT/tests/logs/large_test.log"
if [ ! -f "$LARGE_LOG" ]; then
    warn "缺少大日志 $LARGE_LOG，--heavy 前运行: python3 tests/benchmarks/gen_big_file.py $LARGE_LOG"
fi

# --- 5. 端口占用 ---
for port in 12345 3000; do
    if ss -tlnp 2>/dev/null | grep -q ":$port "; then
        say "端口 $port 已被占用（默认 e2e 会杀掉重启；--reuse 模式则复用）"
    fi
done

# --- 6. 内存（WSL2 大文件索引的 OOM 根因） ---
if [ -r /proc/meminfo ]; then
    total_kb=$(awk '/MemTotal/{print $2}' /proc/meminfo)
    avail_kb=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
    total_gb=$((total_kb / 1024 / 1024))
    avail_gb=$((avail_kb / 1024 / 1024))
    say "内存: 总 ${total_gb}GB / 可用 ${avail_gb}GB"
    if [ "$avail_kb" -lt 3145728 ]; then  # <3GB
        crit "可用内存 <3GB：backend 索引 1.3GB 大日志（峰值 2.4GB+）会被 OOM 杀死（本会话基线 14/14 全挂即此因）。"
        if [ -f /proc/version ] && grep -qi microsoft /proc/version; then
            say "  WSL2 请调大 .wslconfig（C:\\Users\\<你>\\.wslconfig）后 wsl --shutdown 重启："
            say "    [wsl2]"
            say "    memory=12GB"
            say "    swap=8GB"
        fi
    fi
    swap_free_kb=$(awk '/SwapFree/{print $2}' /proc/meminfo)
    swap_total_kb=$(awk '/SwapTotal/{print $2}' /proc/meminfo)
    if [ "$swap_total_kb" -gt 0 ] && [ $((swap_total_kb - swap_free_kb)) -gt $((swap_total_kb * 9 / 10)) ]; then
        warn "swap 已用 >90%，内存压力大，建议调大 .wslconfig 内存"
    fi
fi

say "检查完成: $([ "$CRIT" -gt 0 ] && echo '缺关键项(2)' || ([ "$WARN" -gt 0 ] && echo '有警告(1)' || echo '就绪(0)'))"
exit $((CRIT > 0 ? 2 : (WARN > 0 ? 1 : 0)))
