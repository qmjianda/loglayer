"""
1.4 e2e：快速滚动往返后首屏无残留空白（骨架/真空）回归

覆盖 Requirement: 拉取失败不产生永久空洞 / 小幅滚动触发缺口补拉 / 拖动后空洞消除
"""

import pytest

from . import helpers

pytestmark = [pytest.mark.e2e]


@pytest.mark.usefixtures("frontend_errors")
def test_prefetch_holes_scroll_roundtrip(page, tmp_path, frontend_errors):
    # 生成 5k 行小文件避免 heavy
    log_path = tmp_path / "prefetch_holes.log"
    log_path.write_text("\n".join(f"line {i} content for prefetch test" for i in range(5000)), encoding="utf-8")

    helpers.open_file_via_picker(page, str(log_path), timeout=60000)
    helpers.wait_for_log_canvas(page, timeout=60000)

    # 记录首屏首行文本
    first_text = page.locator(".log-row:visible").first.text_content(timeout=5000)

    # 滚动到中部
    page.evaluate(
        """() => {
          const sc = document.querySelector('[data-logviewer]');
          sc.scrollTop = sc.scrollHeight * 0.5;
          sc.dispatchEvent(new Event('scroll'));
        }"""
    )
    page.wait_for_timeout(800)
    helpers.wait_for_log_canvas(page, timeout=10000)

    # 快速回顶部
    page.evaluate(
        """() => {
          const sc = document.querySelector('[data-logviewer]');
          sc.scrollTop = 0;
          sc.dispatchEvent(new Event('scroll'));
        }"""
    )
    page.wait_for_timeout(800)

    # 断言首屏无残留空白（无 skeleton 且行数正常）
    state = helpers.collect_canvas_state(page)
    helpers.assert_not_blank_screen(state)
    assert state["rowCount"] > 0, "回顶部后未渲染行"
    # 首行文本应仍可读且非空
    after_first = page.locator(".log-row:visible").first.text_content(timeout=5000)
    assert after_first and len(after_first.strip()) > 0, f"首行空白残留: {after_first!r}"
    # 无真空：可视行应含行号
    gutter_text = page.locator(".log-row-gutter:visible").first.text_content(timeout=5000)
    assert gutter_text and gutter_text.strip() != "", "行号真空"

    assert not frontend_errors, f"前端错误: {frontend_errors}"
