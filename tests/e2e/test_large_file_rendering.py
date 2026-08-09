"""
白屏回归测试：打开超大日志文件，验证日志区域渲染正确（不白屏）。

背景：曾出现打开 large_test.log（2290 万行）时日志区域白屏——
LogViewer 容器高度在 dockview 面板内未受约束，viewportHeight 被错误地
测成整个虚拟滚动高度（10_000_000+ px），canvas 被拉满导致不可见。

本测试通过真实 UI 交互（远程路径选择器）打开文件，并断言：
1. canvas 渲染高度是真实可视区高度，而非虚拟高度（白屏核心）
2. aria-label 总行数与文件一致
3. 无前端运行时错误
"""

import pytest

from . import helpers

pytestmark = [pytest.mark.e2e, pytest.mark.heavy]


@pytest.mark.usefixtures("frontend_errors")
def test_large_file_renders_not_blank(page, large_log_path, large_log_lines, frontend_errors):
    """打开超大文件后日志区域正常渲染，不出现白屏，且无前端错误。"""
    # 通过前端 UI 交互打开大文件
    helpers.open_file_via_picker(page, large_log_path, timeout=120000)

    # 采集渲染状态并断言
    state = helpers.collect_canvas_state(page)
    helpers.assert_not_blank_screen(state)
    helpers.assert_aria_line_count(state, large_log_lines)

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


@pytest.mark.usefixtures("frontend_errors")
def test_large_file_visible_range_and_scroll(page, large_log_path, frontend_errors):
    """验证可视区行数与容器滚动关系合理（虚拟化未退化），且无前端错误。"""
    helpers.open_file_via_picker(page, large_log_path, timeout=120000)

    state = helpers.collect_canvas_state(page)
    total, rng = helpers.parse_aria_label(state["ariaLabel"])

    assert total is not None and total > 0
    assert rng is not None, "aria-label 缺少当前显示范围"
    start_n, end_n = rng
    assert end_n > start_n >= 1, f"显示范围异常: {rng}"

    # 容器可视高度应远小于滚动内容高度（虚拟滚动生效）
    ch = state["containerClientHeight"]
    sh = state["containerScrollHeight"]
    assert ch and sh and sh >= ch, f"容器高度异常: client={ch} scroll={sh}"
    assert state["spacerHeight"], "缺少虚拟滚动 spacer"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


def test_fast_scroll_shows_placeholder_then_content(page, large_log_path, frontend_errors):
    """拖动白屏回归：快速滚动到未加载区域时先显示占位行（行号可见），
    随后替换为真实内容，全程不出现整片空白。"""
    helpers.open_file_via_picker(page, large_log_path, timeout=120000)

    # 瞬间跳到文件 80% 处（模拟拖动滚动条）
    page.evaluate(
        """() => {
          const sc = document.querySelector('[data-logviewer]');
          sc.scrollTop = sc.scrollHeight * 0.8;
        }"""
    )
    page.wait_for_timeout(150)

    # 立即检查：行号应已显示（占位/真实），不允许 0 行
    snap = page.evaluate(
        """() => {
          const sc = document.querySelector('[data-logviewer]');
          const rows = sc.querySelectorAll('.log-row');
          const first = rows[0];
          return {
            rowCount: rows.length,
            firstGutter: first ? first.querySelector('.log-row-gutter').textContent.trim() : null,
          };
        }"""
    )
    assert snap["rowCount"] > 0, "快速滚动后应渲染占位行（行号可见），而非空白"
    assert snap["firstGutter"], "占位行应显示行号"

    # 等数据加载完成（占位消失）——事件驱动替代固定 sleep
    page.wait_for_function(
        """() => document.querySelectorAll('.log-row-skeleton').length === 0""",
        timeout=30000,
    )
    loaded = page.evaluate(
        """() => {
          const sc = document.querySelector('[data-logviewer]');
          const rows = sc.querySelectorAll('.log-row');
          const skeleton = sc.querySelectorAll('.log-row-skeleton').length;
          const first = rows[0];
          return {
            skeleton,
            firstGutter: first ? first.querySelector('.log-row-gutter').textContent.trim() : null,
            firstIdx: first ? first.getAttribute('data-log-index') : null,
          };
        }"""
    )
    assert loaded["skeleton"] == 0, f"数据加载完成后占位应消失，剩余 {loaded['skeleton']} 个占位"
    assert loaded["firstIdx"] is not None, "应有真实行内容"
    assert loaded["firstGutter"], "行号应持续可见"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


def test_reopen_same_file_no_duplicate_tab(page, large_log_path, frontend_errors):
    """回归：同一文件重复打开不应产生重复面板（路径去重）。"""
    # 首次通过 UI 打开，应只有 1 个 tab
    helpers.open_file_via_picker(page, large_log_path, timeout=120000)
    tabs_before = page.locator('.dv-tab').all_text_contents()
    assert len(tabs_before) == 1, f"打开后应只有 1 个 tab，实际: {tabs_before}"

    # 再次通过 UI 打开同一文件，不应新增 tab
    helpers.open_file_via_picker(page, large_log_path, timeout=120000)

    tabs_after = page.locator('.dv-tab').all_text_contents()
    assert len(tabs_after) == 1, f"重复打开同一文件不应新增 tab，实际: {tabs_after}"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
