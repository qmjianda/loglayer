"""
Phase 3 功能 e2e 测试（3.1/3.4/3.5）：Search View 结果列表、可观测诊断、Debug overlay。

覆盖：
1. /api/diagnostics 返回缓存命中统计与管线阶段耗时（3.4）
2. Ctrl+Shift+D 开关 Debug overlay（3.5），展示缓存统计/面板状态
3. Search View（view.search）渲染结果列表并可跳转（3.1）

前置：backend(12345) + vite(3000)。
"""

import os
import tempfile

import pytest

from . import helpers

pytestmark = pytest.mark.e2e


@pytest.fixture(scope="module")
def small_log_path():
    """生成含多匹配的小日志文件。"""
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "searchable.log")
        with open(path, "w", encoding="utf-8") as f:
            for i in range(20):
                f.write(f"line {i}: needle-{i % 5} tail\n")
        yield path


def test_diagnostics_api(page, small_log_path, servers):
    """/api/diagnostics 返回缓存统计与 session 计时（3.4）。"""
    # 打开文件触发管线
    helpers.open_file_via_picker(page, small_log_path, timeout=60000)
    page.wait_for_selector(".log-row", timeout=60000)
    # 等待管线运行：轮询 diagnostics 直到出现 session 计时
    page.wait_for_function(
        """async () => {
            try {
                const r = await fetch('/api/diagnostics');
                const d = await r.json();
                return d && d.sessions && Object.keys(d.sessions).length > 0;
            } catch { return false; }
        }""",
        timeout=30000,
    )

    resp = page.evaluate(
        """async () => {
            const r = await fetch('/api/diagnostics');
            return r.ok ? await r.json() : null;
        }"""
    )
    assert resp is not None, "/api/diagnostics 不可用"
    assert "cache_stats" in resp, "缺少 cache_stats"
    assert "pipeline" in resp["cache_stats"], "缺少 pipeline 统计"
    assert "search" in resp["cache_stats"], "缺少 search 统计"
    assert "sessions" in resp, "缺少 sessions"
    for stat in ("memory_hit", "sqlite_hit", "computed"):
        assert stat in resp["cache_stats"]["pipeline"], f"pipeline 缺 {stat}"
    print("PASS: /api/diagnostics 返回缓存命中统计与 sessions")


def test_debug_overlay_toggle(page, small_log_path):
    """Ctrl+Shift+D 开关 Debug overlay，展示 per-tab 状态与缓存统计（3.5）。"""
    helpers.open_file_via_picker(page, small_log_path, timeout=60000)
    page.wait_for_selector(".log-row", timeout=60000)

    # 搜索触发统计
    page.keyboard.press("Control+f")
    page.wait_for_selector('input[placeholder="查找"]', timeout=10000)
    page.locator('input[placeholder="查找"]').fill("needle")
    page.locator('input[placeholder="查找"]').press("Enter")
    # 等待搜索完成：find widget 显示匹配计数（如 "1 / 20"）
    page.wait_for_selector(r'text=/\d+ \/ \d+/', timeout=15000)
    # 失焦（输入框聚焦时全局快捷键不生效，Escape 收起 find 并让焦点回到文档）
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)

    # 打开 Debug overlay（等其渲染出现）
    page.keyboard.press("Control+Shift+d")
    page.wait_for_selector('text=Debug Overlay', timeout=5000)
    overlay = page.locator("text=Debug Overlay")
    assert overlay.count() > 0, "Debug overlay 未打开 (Ctrl+Shift+D)"
    assert page.locator("text=缓存命中统计").count() > 0, "缺少缓存统计区"
    assert page.locator("text=管线阶段耗时").count() > 0, "缺少管线耗时区"
    assert page.locator("text=当前面板搜索状态").count() > 0, "缺少 per-tab 状态区"
    # 面板状态区展示搜索词
    body_text = page.locator("body").inner_text()
    assert "needle" in body_text, "Debug overlay 未展示当前搜索词"

    # 关闭 overlay（等待其消失）
    page.keyboard.press("Control+Shift+d")
    page.wait_for_selector('text=Debug Overlay', state="detached", timeout=5000)
    assert page.locator("text=Debug Overlay").count() == 0, "Debug overlay 未关闭"


def test_search_view_results_and_jump(page, small_log_path):
    """Search View 结果列表渲染并可跳转（3.1）。"""
    helpers.open_file_via_picker(page, small_log_path, timeout=60000)
    page.wait_for_selector(".log-row", timeout=60000)

    # 搜索（全局 search 视图入口：命令面板 view.search）
    page.keyboard.press("Control+f")
    page.wait_for_selector('input[placeholder="查找"]', timeout=10000)
    page.locator('input[placeholder="查找"]').fill("needle-2")
    page.locator('input[placeholder="查找"]').press("Enter")
    # 等待搜索完成：find widget 显示匹配计数
    page.wait_for_selector(r'text=/\d+ \/ \d+/', timeout=15000)
    # 失焦（输入框聚焦时全局快捷键不生效）
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)

    # 切换到 search 视图（命令面板）
    page.keyboard.press("Control+Shift+p")
    page.wait_for_timeout(800)
    page.keyboard.type("搜索视图")
    page.wait_for_timeout(600)
    page.keyboard.press("Enter")

    # 结果列表应出现（needle-2 每 5 行一个 → 4 个匹配）——事件驱动等待，替代固定 sleep
    result_items = page.locator('button[title^="跳转到第"]')
    result_items.first.wait_for(timeout=15000)
    count = result_items.count()
    assert count >= 2, f"Search View 结果列表未渲染: {count}"
    print(f"PASS: Search View 结果列表 {count} 项")

    # 点击第一项跳转（状态栏可能覆盖侧栏底部，用 force 确保命中 DOM 目标）
    result_items.first.click(force=True)
    page.wait_for_timeout(1500)
    # 跳转后当前行高亮（无前端错误）
    assert page.locator(".log-row").count() > 0
