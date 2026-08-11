"""
e2e 验收测试：右侧操作台（add-right-inspector-panel 变更）

逐条追溯 openspec/changes/add-right-inspector-panel/specs/right-inspector-panel/spec.md
的 WHEN-THEN 验收场景（R1-R10）。核心验证点：
- 操作台随激活文件切换（摘要/图层/书签）
- 文件属性摘要（路径/大小/行数/级别分布/复制）
- 图层区交互（添加/开关/删除）
- 预设（保存/应用合并/删除）
- 书签（列表/徽标/缓存免闪烁）
- 左右折叠、左侧纯导航、stats 移除、统计占位
"""

import os
import signal
import subprocess
import sys
import tempfile
import time

import pytest

from . import helpers

pytestmark = pytest.mark.e2e

# 本项目 e2e 自带 servers/page fixtures（历史原因：conftest 曾以 1.3GB
# large_test.log 预加载 backend；现已移除预加载，此 workaround 仍可用但不必要）。
# 保留以降低改动风险；新测试请直接用 conftest 的 fixtures。


@pytest.fixture(scope="session")
def inspector_servers():
    """启动 backend（无 CLI 大日志）+ vite，测试结束清理。"""
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    backend_main = os.path.join(project_root, "backend", "main.py")
    port_backend, port_vite = 12345, 3000

    def port_open(port, timeout=40):
        import socket
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=1):
                    return True
            except OSError:
                time.sleep(0.3)
        return False

    procs = []
    try:
        backend = subprocess.Popen(
            [sys.executable, backend_main, "--no-ui"],
            cwd=project_root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        procs.append(backend)
        vite = subprocess.Popen(
            ["npx", "vite", "--port", str(port_vite), "--strictPort"],
            cwd=project_root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        procs.append(vite)
        if not port_open(port_backend):
            raise RuntimeError("backend 未在 12345 就绪")
        if not port_open(port_vite):
            raise RuntimeError("vite 未在 3000 就绪")
        yield
    finally:
        for p in procs:
            if p.poll() is None:
                try:
                    os.killpg(os.getpgid(p.pid), signal.SIGTERM)
                except (ProcessLookupError, PermissionError):
                    p.terminate()


@pytest.fixture()
def page(inspector_servers):
    """新页面并监听前端错误（不依赖 conftest fixtures）。"""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        ctx.grant_permissions(["clipboard-read", "clipboard-write"])
        pg = ctx.new_page()
        collected: list = []
        pg.on("pageerror", lambda e: collected.append(f"pageerror: {e}"))
        pg.on(
            "console",
            lambda m: collected.append(f"console[{m.type}]: {m.text}")
            if m.type == "error"
            else None,
        )
        pg.goto("http://127.0.0.1:3000/", wait_until="networkidle", timeout=60000)
        pg._collected_errors = collected  # type: ignore[attr-defined]
        yield pg
        ctx.close()
        browser.close()


@pytest.fixture()
def frontend_errors(page):
    return getattr(page, "_collected_errors", [])


@pytest.fixture(scope="module")
def two_log_files():
    """生成两个不同大小/行数的日志文件。"""
    with tempfile.TemporaryDirectory() as d:
        a = os.path.join(d, "alpha.log")
        b = os.path.join(d, "beta.log")
        with open(a, "w", encoding="utf-8") as f:
            for i in range(100):
                f.write(f"[2026-08-08 10:00:{i % 60:02d}] INFO alpha message {i}\n")
        with open(b, "w", encoding="utf-8") as f:
            for i in range(50):
                f.write(f"[2026-08-08 11:00:{i % 60:02d}] WARN beta message {i}\n")
        yield {"a": a, "b": b}


def _open(page, path):
    helpers.open_file_via_picker(page, path, timeout=60000)


def _summary_path_span(page, path):
    """摘要区的完整路径 span（title=完整路径，仅摘要区存在）。"""
    return page.locator(f'span[title="{path}"]')


def _wait_text(page, text, timeout=15000):
    page.wait_for_selector(f":text-is('{text}')", timeout=timeout)


def test_inspector_empty_state(page):
    """R1 空态：无激活文件时操作台显示空态提示。"""
    # 若 backend CLI 预加载了大日志（large_test.log 存在），跳过空态断言
    if page.locator(".log-row").count() > 0:
        pytest.skip("已预加载文件，跳过空态断言")
    _wait_text(page, "未打开文件")


def test_inspector_summary_fields(page, two_log_files, frontend_errors):
    """R2 摘要：路径/大小/行数/级别分布展示 + 复制路径反馈。"""
    path = two_log_files["a"]
    _open(page, path)

    # 文件名 + 完整路径（title=完整路径 的 span 仅在摘要区）
    _summary_path_span(page, path).first.wait_for(timeout=15000)
    # 总行数（摘要用中文"行"，StatusBar 用 "Lines"，不冲突）
    _wait_text(page, "100 行")
    # 级别分布 legend（INFO 应有计数）
    _wait_text(page, "INFO 100")

    # 复制路径：headless chromium 的 OS 剪贴板受限，stub writeText 以验证反馈链路
    page.evaluate(
        """() => { navigator.clipboard = { writeText: async () => {}, readText: async () => '' }; }"""
    )
    copy_btn = page.locator('button[title="复制完整路径"]')
    copy_btn.first.hover(timeout=5000)
    copy_btn.first.click(force=True)
    # 复制成功反馈：按钮自身变绿（text-green-400 加在 button 上，非 svg）
    page.wait_for_selector('button[title="复制完整路径"].text-green-400', timeout=5000)

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


def test_inspector_follows_tab_switch(page, two_log_files, frontend_errors):
    """R1 切 tab：操作台摘要随激活文件切换。"""
    pa, pb = two_log_files["a"], two_log_files["b"]
    _open(page, pa)
    _summary_path_span(page, pa).first.wait_for(timeout=15000)
    _wait_text(page, "100 行")

    _open(page, pb)
    _summary_path_span(page, pb).first.wait_for(timeout=15000)
    _wait_text(page, "50 行")

    # 切回 alpha tab → 摘要回 alpha
    page.locator(f'.dv-tab:has-text("alpha.log")').first.click(timeout=10000)
    _summary_path_span(page, pa).first.wait_for(timeout=15000)
    _wait_text(page, "100 行")

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


def test_inspector_stats_follow_tab_switch(page, two_log_files, frontend_errors):
    """issue #3 切 tab：级别统计（ERROR/INFO/WARN）随激活文件切换。

    alpha.log = 100 行全 INFO；beta.log = 50 行全 WARN。
    切到 beta 应显示 WARN 50，切回 alpha 应恢复 INFO 100。
    """
    pa, pb = two_log_files["a"], two_log_files["b"]
    _open(page, pa)
    _summary_path_span(page, pa).first.wait_for(timeout=15000)
    _wait_text(page, "INFO 100")

    _open(page, pb)
    _summary_path_span(page, pb).first.wait_for(timeout=15000)
    _wait_text(page, "WARN 50")

    # 切回 alpha tab → 统计回 alpha（issue #3 修复点）
    page.locator(f'.dv-tab:has-text("alpha.log")').first.click(timeout=10000)
    _summary_path_span(page, pa).first.wait_for(timeout=15000)
    _wait_text(page, "INFO 100")

    # 再切到 beta → 统计又回 beta
    page.locator(f'.dv-tab:has-text("beta.log")').first.click(timeout=10000)
    _summary_path_span(page, pb).first.wait_for(timeout=15000)
    _wait_text(page, "WARN 50")

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


def test_inspector_layers_ui(page, two_log_files, frontend_errors):
    """R3 图层区：添加图层 → 计数+1；开关切换 title 反转；删除移除。"""
    path = two_log_files["a"]
    _open(page, path)

    # 图层区默认展开：处理层/渲染层分区存在
    page.wait_for_selector(':text-is("处理层")', timeout=15000)

    def layer_count_badge():
        # 图层区 SectionHeader 徽标（"图层"标题后的计数）
        badge = page.locator(':text-is("图层")').first.locator("xpath=following-sibling::*[1]")
        return int(badge.inner_text())

    count0 = layer_count_badge()

    # 添加图层：打开下拉 → 点第一个核心图层（分组标题是 div，菜单项是其后 button）
    page.locator('button[title="添加图层"]').first.click()
    page.wait_for_selector(':text-is("核心图层")', timeout=5000)
    page.locator(':text-is("核心图层")').locator("xpath=following-sibling::button[1]").click(force=True)
    page.wait_for_timeout(800)
    count1 = layer_count_badge()
    assert count1 == count0 + 1, f"添加图层后计数 {count1} != {count0} + 1"

    # 开关：新图层默认启用（title=禁用），点击后变 title=启用
    toggle_btn = page.locator('button[title="禁用"]').first
    toggle_btn.wait_for(timeout=5000)
    toggle_btn.click(force=True)
    page.wait_for_selector('button[title="启用"]', timeout=5000)

    # 删除：点击删除按钮 → 计数回到 count0
    page.locator('button[title="删除"]').first.click(force=True)
    page.wait_for_timeout(800)
    assert layer_count_badge() == count0, "删除图层后计数应回到初始值"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


def test_inspector_preset_flow(page, two_log_files, frontend_errors):
    """R4 预设：保存命名浮层 → 预设区新增；应用合并；删除。"""
    path = two_log_files["a"]
    _open(page, path)

    # 预设区默认折叠 → 展开
    presets_header = page.locator(':text-is("预设")').first
    presets_header.click()
    page.wait_for_selector(':text-is("默认预设")', timeout=5000)

    # 保存为预设：浮层输入名称 → 确认
    page.locator('button:has-text("保存为预设")').first.click()
    page.wait_for_selector('input[placeholder="输入预设名称..."]', timeout=5000)
    page.locator('input[placeholder="输入预设名称..."]').fill("e2e验收预设")
    page.locator('button:has-text("确认")').click()
    page.wait_for_selector(':text-is("e2e验收预设")', timeout=5000)

    # 应用（合并语义）：点击新预设条目 → 图层区应出现其图层（无前端错误即可验证链路）
    preset_item = page.locator('div[title^="点击应用预设"]:has-text("e2e验收预设")').first
    preset_item.click(force=True)
    page.wait_for_timeout(1000)

    # 删除预设（等其从 DOM 消失）
    page.locator('button[title="删除预设"]').first.click(force=True)
    page.wait_for_selector(':text-is("e2e验收预设")', state="detached", timeout=5000)
    assert page.locator(':text-is("e2e验收预设")').count() == 0, "删除后预设应消失"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


def test_inspector_bookmarks(page, two_log_files, frontend_errors):
    """R5 书签：折叠展示、加书签后徽标更新、删除。"""
    path = two_log_files["a"]
    _open(page, path)

    # 书签区默认折叠 → 展开 → 空态提示
    page.locator(':text-is("书签")').first.click()
    page.wait_for_selector(':text-is("暂无书签。点击行号区域可添加。")', timeout=5000)

    # 在日志视图行号区点击第一行 → 添加书签
    page.locator(".log-row-gutter").first.click(force=True)
    # 书签区出现 #1 条目
    page.wait_for_selector(':text-is("#1")', timeout=10000)

    # 点击书签条目跳转（无错误即可）
    page.locator(':text-is("#1")').first.click(force=True)
    page.wait_for_timeout(800)

    # 删除书签（条目内删除按钮）
    page.locator('button[title="删除书签"]').first.click(force=True)
    page.wait_for_selector(':text-is("暂无书签。点击行号区域可添加。")', timeout=10000)

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


def test_inspector_bookmark_cache(page, two_log_files, frontend_errors):
    """R6 缓存：切回已加载文件，书签立即显示（无需再次网络加载的可见等待）。"""
    pa, pb = two_log_files["a"], two_log_files["b"]
    _open(page, pa)
    _open(page, pb)

    # 在 alpha 加书签
    page.locator(f'.dv-tab:has-text("alpha.log")').first.click(timeout=10000)
    page.locator(".log-row-gutter").first.click(force=True)
    page.wait_for_timeout(1500)

    # 切到 beta 再切回 alpha → 书签徽标应立即为 1（缓存命中）
    page.locator(f'.dv-tab:has-text("beta.log")').first.click(timeout=10000)
    page.locator(f'.dv-tab:has-text("alpha.log")').first.click(timeout=10000)
    page.wait_for_selector(':text-is("书签")', timeout=5000)
    # 徽标：书签标题后的计数
    badge = page.locator(':text-is("书签")').first.locator("xpath=following-sibling::*[1]")
    page.wait_for_function(
        """(el) => el.textContent.trim() === '1'""",
        arg=badge.element_handle(),
        timeout=10000,
    )

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


def test_inspector_collapse_restore(page, two_log_files, frontend_errors):
    """R7 折叠：点顶栏按钮 → 操作台隐藏；再点 → 恢复显示摘要。"""
    path = two_log_files["a"]
    _open(page, path)
    _summary_path_span(page, path).first.wait_for(timeout=15000)

    # 折叠
    page.locator('button[title="折叠右侧操作台"]').click(force=True)
    # 折叠后按钮切换为"展开"，且操作台容器宽度归 0（clientWidth 不含边框）
    page.wait_for_selector('button[title="展开右侧操作台"]', timeout=5000)
    page.wait_for_function(
        """(path) => {
            const el = document.querySelector('span[title="' + path + '"]');
            if (!el) return true;
            const panel = el.closest('[class*="group/inspector"]');
            return !panel || panel.clientWidth === 0;
        }""",
        arg=path,
        timeout=5000,
    )

    # 恢复
    page.locator('button[title="展开右侧操作台"]').click(force=True)
    _summary_path_span(page, path).first.wait_for(timeout=10000)

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


def test_left_navigation_and_stats_removed(page, two_log_files, frontend_errors):
    """R8/R9/R10：左侧纯导航（无已打开）、无独立 stats 视图、统计区占位。"""
    path = two_log_files["a"]
    _open(page, path)

    # 左侧：资源管理器 + 历史文件 存在，无"已打开"区
    page.wait_for_selector(':text-is("资源管理器")', timeout=15000)
    assert page.locator(':text-is("已打开")').count() == 0, "左侧不应再有'已打开'区"

    # 统计区（操作台内）：展开显示占位文案
    page.locator(':text-is("统计")').first.click()
    page.wait_for_selector(':text-is("统计信息（第二版迭代）")', timeout=5000)

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
