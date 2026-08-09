"""
e2e 测试基础设施：管理前后端进程生命周期与 Playwright 浏览器。

前置条件：
- Python 环境装有 pytest 与 playwright（`pip install pytest playwright && python -m playwright install chromium`）
- Node 依赖已安装（项目根 package.json）
- 由 pytest marker `e2e` 标记的测试，可单独运行：
    python3 -m pytest tests/e2e -m e2e -v
"""

import os
import re
import signal
import socket
import subprocess
import sys
import time
import uuid

import pytest
from playwright.sync_api import sync_playwright

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_MAIN = os.path.join(PROJECT_ROOT, "backend", "main.py")
BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 12345
VITE_PORT = 3000
APP_URL = f"http://{BACKEND_HOST}:{VITE_PORT}/"

# 测试专用大日志文件（超大文件，触发虚拟高度/scroll-scaling）
LARGE_LOG = os.path.join(PROJECT_ROOT, "tests", "logs", "large_test.log")

# 后端就绪探针端点
READY_ENDPOINT = f"http://{BACKEND_HOST}:{BACKEND_PORT}/api/platform"

# 复用已有实例的开关：LOGLAYER_E2E_REUSE=1 时跳过杀进程/重启，直接探测复用
REUSE_ENV = "LOGLAYER_E2E_REUSE"


def _wait_port(host, port, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except OSError:
            time.sleep(0.3)
    return False


def _wait_all(checks: dict, timeout: int = 15) -> bool:
    """并行探测多个就绪条件：轮询所有检查项，全部通过返回 True，超时返回 False。

    checks 为 {名称: 无参返回 bool 的可调用对象}。避免多个就绪条件串行等待，
    正常启动 <5s，失败时最多等 timeout 秒即可给出明确结论。
    """
    deadline = time.time() + timeout
    pending = dict(checks)
    while time.time() < deadline:
        for name, check in list(pending.items()):
            if check():
                pending.pop(name)
        if not pending:
            return True
        time.sleep(0.3)
    return False


def _find_pids_on_port(port):
    """返回占用指定端口的进程 PID 列表（跨平台：ps/lsof/netstat）。"""
    pids = set()
    candidates = [
        ["lsof", "-t", f"-i:{port}"],
        ["netstat", "-tlnp", "2>/dev/null"],
        ["ss", "-tlnp"],
    ]
    # 方式 1：lsof（最精准）
    try:
        out = subprocess.run(
            ["lsof", "-t", f"-i:{port}"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        for line in out.stdout.split():
            line = line.strip()
            if line.isdigit():
                pids.add(int(line))
    except (subprocess.SubprocessError, FileNotFoundError):
        pass
    # 方式 2：ss / netstat 解析 pid=xxx
    for cmd in candidates[1:]:
        try:
            out = subprocess.run(
                cmd, capture_output=True, text=True, timeout=5
            )
            for line in out.stdout.splitlines():
                if f":{port}" not in line:
                    continue
                m = re.search(r"pid=(\d+)", line)
                if m:
                    pids.add(int(m.group(1)))
        except (subprocess.SubprocessError, FileNotFoundError):
            continue
    return sorted(pids)


def _kill_process_tree(pid):
    """终止进程及其进程组（尽力而为）。"""
    try:
        os.killpg(os.getpgid(pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError, OSError):
        try:
            os.kill(pid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError, OSError):
            pass
    try:
        # 等待短暂退出，未退出则 SIGKILL
        os.kill(pid, 0)
        time.sleep(0.5)
        os.kill(pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError, OSError):
        pass


def kill_existing_servers():
    """杀掉所有占用后端(12345)/前端(3000)端口的进程，避免旧实例污染测试。

    以端口占用检测（lsof/ss）为主，pgrep 兜底匹配明确的命令行模式，
    并排除当前进程自身，避免误杀测试进程。
    """
    my_pid = os.getpid()
    for port in (BACKEND_PORT, VITE_PORT):
        for pid in _find_pids_on_port(port):
            if pid == my_pid:
                continue
            try:
                os.kill(pid, 0)  # 确认存活
            except (ProcessLookupError, PermissionError, OSError):
                continue
            print(f"[e2e] Killing existing server on port {port}: pid={pid}")
            _kill_process_tree(pid)
    # 兜底：明确按命令行匹配（可能未绑定端口但进程存在）
    for name in ("backend/main.py", "vite --port", "vite/bin/vite.js"):
        try:
            out = subprocess.run(
                ["pgrep", "-f", name],
                capture_output=True,
                text=True,
                timeout=5,
            )
            for line in out.stdout.split():
                if not line.strip().isdigit():
                    continue
                pid = int(line.strip())
                if pid == my_pid or pid <= 1:
                    continue
                try:
                    os.kill(pid, 0)
                except (ProcessLookupError, OSError):
                    continue
                print(f"[e2e] Killing existing process: {name} pid={pid}")
                _kill_process_tree(pid)
        except (subprocess.SubprocessError, FileNotFoundError):
            continue
    # 等待端口释放
    for port in (BACKEND_PORT, VITE_PORT):
        deadline = time.time() + 10
        while time.time() < deadline:
            if not _find_pids_on_port(port):
                break
            time.sleep(0.3)


def _wait_http(url, timeout=15):
    import urllib.request

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status < 500:
                    return True
        except Exception:
            time.sleep(0.3)
    return False


class ServerProc:
    """封装一个后台子进程，保证测试结束被终止。"""

    def __init__(self, cmd, cwd, log_path):
        self.cmd = cmd
        self.cwd = cwd
        self.log_path = log_path
        self.proc = None

    def start(self):
        logf = open(self.log_path, "w")
        self.proc = subprocess.Popen(
            self.cmd,
            cwd=self.cwd,
            stdout=logf,
            stderr=subprocess.STDOUT,
            start_new_session=True,  # 独立进程组，便于整体 kill
        )
        return self.proc

    def stop(self):
        if self.proc and self.proc.poll() is None:
            try:
                os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
                except Exception:
                    self.proc.kill()
        self.proc = None

    def read_log(self, tail=40):
        try:
            with open(self.log_path) as f:
                lines = f.readlines()
            return "".join(lines[-tail:])
        except OSError:
            return "<log unavailable>"


@pytest.fixture(scope="session")
def servers():
    """启动 backend + vite，测试会话结束时关闭。

    默认行为：启动前强制杀掉占用 12345/3000 端口的既有前后端进程，
    确保测试基于干净、最新的代码实例（结果可信优先）。
    设置环境变量 LOGLAYER_E2E_REUSE=1 时跳过杀进程/重启，直接复用已在
    运行的实例（快，但需自行保证服务代码与当前工作区代码一致）。
    """
    proc_dir = "/tmp/opencode/e2e"
    os.makedirs(proc_dir, exist_ok=True)

    reuse = os.environ.get(REUSE_ENV) == "1"
    started_backend = False
    started_vite = False
    backend: ServerProc | None = None
    vite: ServerProc | None = None

    if not reuse:
        # 强制清理既有实例（用户手动启动的旧前后端必须终止）
        kill_existing_servers()
        # 等待端口完全释放
        time.sleep(1)

        backend = ServerProc(
            [sys.executable, BACKEND_MAIN, "--no-ui"],
            PROJECT_ROOT,
            os.path.join(proc_dir, "backend.log"),
        )
        vite = ServerProc(
            ["npx", "vite", "--port", str(VITE_PORT), "--strictPort"],
            PROJECT_ROOT,
            os.path.join(proc_dir, "vite.log"),
        )
        backend.start()
        started_backend = True
        vite.start()
        started_vite = True

    try:
        checks = {
            "backend port": lambda: _wait_port(BACKEND_HOST, BACKEND_PORT),
            "backend api": lambda: _wait_http(READY_ENDPOINT),
            "vite port": lambda: _wait_port(BACKEND_HOST, VITE_PORT),
        }
        if not _wait_all(checks, timeout=15):
            details = []
            if backend is not None:
                details.append(f"\nbackend log:\n{backend.read_log()}")
            if vite is not None:
                details.append(f"\nvite log:\n{vite.read_log()}")
            if reuse:
                details.append("\n(reuse 模式：请确认 12345/3000 端口已有服务在运行)")
            raise RuntimeError("前后端未在 15s 内就绪。" + "".join(details))

        yield {
            "backend_proc": backend,
            "vite_proc": vite,
            "started_backend": started_backend,
            "started_vite": started_vite,
            "reused": reuse,
        }
    finally:
        if backend is not None:
            backend.stop()
        if vite is not None:
            vite.stop()


@pytest.fixture(scope="session")
def app_url(servers):
    return APP_URL


@pytest.fixture(scope="session")
def large_log_path():
    if not os.path.exists(LARGE_LOG):
        pytest.skip(f"大日志文件不存在: {LARGE_LOG}")
    return LARGE_LOG


@pytest.fixture(scope="session")
def large_log_lines(large_log_path):
    """大日志行数（会话内只统计一次，与 backend 按 \\n 索引一致）。"""
    import subprocess

    result = subprocess.run(
        ["wc", "-l", large_log_path], capture_output=True, text=True, check=True
    )
    return int(result.stdout.split()[0])


@pytest.fixture()
def browser():
    """每个测试一个独立浏览器上下文。"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture()
def page(browser, app_url):
    """新页面并监听前端错误（pageerror / console error）。"""
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.grant_permissions(["clipboard-read", "clipboard-write"])
    pg = ctx.new_page()
    collected_errors: list[str] = []

    pg.on("pageerror", lambda e: collected_errors.append(f"pageerror: {e}"))
    pg.on(
        "console",
        lambda m: collected_errors.append(f"console[{m.type}]: {m.text}")
        if m.type == "error"
        else None,
    )

    pg.goto(app_url, wait_until="domcontentloaded", timeout=30000)
    # 等待应用外壳就绪（「浏览并打开」按钮始终渲染，见 UnifiedPanel.tsx）
    pg.wait_for_selector('button:has-text("浏览并打开")', timeout=30000)

    # 将错误收集器挂到 page 上，供断言读取
    pg._collected_errors = collected_errors  # type: ignore[attr-defined]
    yield pg
    ctx.close()


@pytest.fixture()
def frontend_errors(page):
    """返回前端错误列表；测试末尾用它断言无错误。"""
    return getattr(page, "_collected_errors", [])
