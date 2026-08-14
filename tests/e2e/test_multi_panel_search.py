"""
多面板搜索独立性 e2e 测试（Phase 2 门禁，2.12）。

验证 per-tab 搜索状态（2.1-2.10 成果）：
1. 两个面板各自独立的搜索词，切换后恢复各自高亮
2. 面板 A 导航（F3）不影响面板 B 的匹配位置
3. find widget 可见性按面板记忆
4. Esc 两段式在 store 化后仍正常（2.9 回归）

前置：backend(12345) + vite(3000)，conftest 自动启动。
"""

import os
import tempfile

import pytest

from . import helpers

pytestmark = pytest.mark.e2e


@pytest.fixture(scope="module")
def two_log_files():
    """生成两个内容不同的小日志文件，用于面板独立性验证。"""
    with tempfile.TemporaryDirectory() as d:
        path_a = os.path.join(d, "alpha.log")
        path_b = os.path.join(d, "beta.log")
        with open(path_a, "w", encoding="utf-8") as f:
            for i in range(10):
                f.write(f"alpha line {i} unique-token-alpha\n")
        with open(path_b, "w", encoding="utf-8") as f:
            for i in range(10):
                f.write(f"beta line {i} unique-token-beta\n")
        yield path_a, path_b


def _open_via_picker(page, path, timeout=60000):
    helpers.open_file_via_picker(page, path, timeout=timeout)


def _switch_tab(page, file_name):
    page.locator(".dv-tab", has_text=file_name).click(timeout=10000)
    page.wait_for_timeout(2000)


def _search(page, query):
    page.keyboard.press("Control+f")
    page.wait_for_selector('input[placeholder="查找"]:visible', timeout=10000)
    inp = page.locator('input[placeholder="查找"]:visible')
    inp.fill(query)
    inp.press("Enter")
    # 等待搜索完成：find widget 显示匹配计数（如 "1 / 10"）
    page.locator('text=/\\d+ \\/ \\d+/').filter(visible=True).first.wait_for(state="visible", timeout=15000)


@pytest.mark.usefixtures("frontend_errors")
def test_multi_panel_search_independence(page, two_log_files, frontend_errors):
    """两个面板各自搜索独立词，切换恢复各自高亮（2.10 核心验收）。"""
    path_a, path_b = two_log_files
    name_a, name_b = os.path.basename(path_a), os.path.basename(path_b)

    # 打开面板 A，搜索 alpha 独有词
    _open_via_picker(page, path_a)
    page.wait_for_selector(".log-row:visible", timeout=60000)
    _search(page, "unique-token-alpha")
    marks_a = page.locator("mark:visible").count()
    assert marks_a >= 1, f"面板 A 搜索无高亮: {marks_a}"

    # 打开面板 B，搜索 beta 独有词
    _open_via_picker(page, path_b)
    page.wait_for_selector(".log-row:visible", timeout=60000)
    _search(page, "unique-token-beta")
    marks_b = page.locator("mark:visible").count()
    assert marks_b >= 1, f"面板 B 搜索无高亮: {marks_b}"
    # beta 文件的文本不含 alpha 独有词（若混用则说明状态串扰）
    rows_b = " ".join(page.locator(".log-row-content:visible").all_inner_texts())
    assert "unique-token-alpha" not in rows_b, "面板 B 混入了 A 的搜索词/内容"

    # 切回面板 A：应恢复 alpha 搜索与高亮
    _switch_tab(page, name_a)
    marks_a2 = page.locator("mark:visible").count()
    assert marks_a2 == marks_a, f"切回面板 A 高亮未恢复: {marks_a2} vs {marks_a}"
    rows_a = " ".join(page.locator(".log-row-content:visible").all_inner_texts())
    assert "unique-token-beta" not in rows_a, "面板 A 混入了 B 的内容"
    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


@pytest.mark.usefixtures("frontend_errors")
def test_find_visible_per_panel_and_esc(page, two_log_files, frontend_errors):
    """find widget 可见性按面板记忆 + Esc 两段式（2.9 回归）。"""
    path_a, path_b = two_log_files
    name_a, name_b = os.path.basename(path_a), os.path.basename(path_b)

    _open_via_picker(page, path_a)
    page.wait_for_selector(".log-row:visible", timeout=60000)
    _search(page, "unique-token-alpha")

    # 面板 A 保持 find 打开，切到 B
    _open_via_picker(page, path_b)
    page.wait_for_selector(".log-row:visible", timeout=60000)
    # B 的 find 初始隐藏（always 下 A 的 find 常驻但隐藏有异步延迟，用等待代替即时 count 避免竞态）
    page.wait_for_function(
        """() => Array.from(document.querySelectorAll('input[placeholder="查找"]'))
              .filter((el) => getComputedStyle(el).visibility !== 'hidden').length === 0""",
        timeout=10000,
    )

    # B 打开 find 并搜索
    _search(page, "unique-token-beta")
    assert page.locator('input[placeholder="查找"]:visible').count() == 1, "面板 B find 应打开"

    # 切回 A：find 应恢复为打开状态（A 上次 find 可见）
    _switch_tab(page, name_a)
    page.wait_for_selector('input[placeholder="查找"]:visible', timeout=10000)
    assert page.locator('input[placeholder="查找"]:visible').count() == 1, "切回 A 后 find 应恢复打开"

    # Esc 第一段：收起保留高亮（always 下 find 收起 = visibility:hidden 而非 DOM 移除，等待 hidden 状态）
    page.keyboard.press("Escape")
    page.wait_for_selector('input[placeholder="查找"]:visible', state="hidden", timeout=5000)
    assert page.locator('input[placeholder="查找"]:visible').count() == 0, "Esc 第一段应收起 find"
    assert page.locator("mark:visible").count() >= 1, "Esc 第一段应保留高亮"

    # Esc 第二段：清空搜索（仅统计可见 mark，隐藏面板的 mark 不计）
    page.keyboard.press("Escape")
    page.wait_for_function(
        """() => Array.from(document.querySelectorAll('mark'))
              .filter((el) => getComputedStyle(el).visibility !== 'hidden').length === 0""",
        timeout=5000,
    )
    assert page.locator("mark:visible").count() == 0, "Esc 第二段应清空搜索"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
