"""
IT（e2e）回归：过滤图层大幅减少行数后，滚动位置必须归零，不得卡在越界旧位置。

背景 Bug：Overview Ruler 用 `transform: translateY(scrollTop)` 模拟 sticky，且是滚动容器的
子元素；该 transform 贡献 scrollable overflow，把 scrollHeight 虚撑住，导致内容收缩后浏览器
不 clamp scrollTop（死锁），表现为"过滤后文本缩到 1 页但滚动条仍停在旧位置、视口空白"。
修复：ruler 移出滚动容器为兄弟节点（VS Code minimap 架构），不贡献 scrollHeight。

本测试复现：打开多行日志 → 滚到中部 → 加过滤图层（大幅减少行数）→ 断言 scrollTop 归零、
scrollHeight 收敛、视口显示首行（非空白）。
"""

import pytest

from . import helpers

pytestmark = pytest.mark.e2e


def _write_log(path, total=3000, error_every=100):
    """生成 total 行日志，每 error_every 行一条 ERROR，其余 INFO。返回 (总行数, ERROR 行数)。"""
    lines = [
        f"ERROR critical failure at item {i}" if i % error_every == 0
        else f"INFO processing item {i} ok"
        for i in range(1, total + 1)
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return total, total // error_every


def _logviewer_state(page):
    """采集 logviewer 的滚动/高度/首行可见状态。

    row0Top 为首行（index 0）相对视口顶部的偏移；过滤后 scrollTop 归零时它应 >= 0（可见），
    卡在越界旧位置时它应为负（首行被滚到视口上方，表现为空白）。
    """
    return page.evaluate(
        """() => {
            const el = document.querySelector('[data-logviewer]');
            if (!el) return null;
            const status = el.querySelector('[role="status"]');
            const totalText = status ? status.textContent : '';
            const m = totalText.match(/共\\s*([\\d,]+)\\s*行/);
            const row0 = document.querySelector('.log-row[data-log-index="0"]');
            const row0Top = row0 ? row0.getBoundingClientRect().top : null;
            return {
                scrollTop: el.scrollTop,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                totalLines: m ? parseInt(m[1].replace(/,/g, ''), 10) : null,
                row0Top,
            };
        }"""
    )


def _add_filter_layer(page, query: str):
    """经右侧检视面板添加一个 FILTER 图层并填入查询词。"""
    page.locator('button[title="添加图层"]').first.click(timeout=10000)
    page.wait_for_timeout(400)
    page.locator('button:has-text("过滤图层")').first.click(timeout=10000)
    page.wait_for_timeout(600)
    inp = page.locator('input[placeholder="搜索模式"]').first
    inp.wait_for(state="visible", timeout=10000)
    inp.click()
    inp.fill(query)
    page.wait_for_timeout(300)


@pytest.mark.usefixtures("frontend_errors")
def test_filter_shrink_resets_scroll(page, frontend_errors, tmp_path):
    log = tmp_path / "filter_scroll.log"
    _total, error_count = _write_log(log)

    helpers.open_file_via_picker(page, str(log), timeout=120000)
    page.wait_for_selector('.log-row:visible', timeout=60000)
    page.wait_for_timeout(1500)

    # 滚到中部（非顶部），记录过滤前状态
    page.evaluate(
        """() => {
            const el = document.querySelector('[data-logviewer]');
            el.scrollTop = el.clientHeight * 5;
        }"""
    )
    page.wait_for_timeout(600)
    before = _logviewer_state(page)
    assert before is not None, "logviewer 未渲染"
    assert before["scrollTop"] > 0, f"滚动到中部失败：scrollTop 应为正值，实际 {before['scrollTop']}"

    # 添加过滤图层，减少到 error_count 行
    _add_filter_layer(page, "ERROR")

    # 等待管线完成：totalLines 收敛到 error_count
    page.wait_for_function(
        f"""() => {{
            const el = document.querySelector('[data-logviewer]');
            const s = el && el.querySelector('[role="status"]');
            if (!s) return false;
            const m = s.textContent.match(/共\\s*([\\d,]+)\\s*行/);
            return m && parseInt(m[1].replace(/,/g, ''), 10) === {error_count};
        }}""",
        timeout=30000,
    )
    page.wait_for_timeout(1000)

    after = _logviewer_state(page)
    assert after is not None
    assert after["totalLines"] == error_count, f"过滤后总行数异常: {after['totalLines']} != {error_count}"
    assert after["scrollTop"] <= 1, (
        f"过滤后 scrollTop 未归零（卡在越界旧位置）: {after['scrollTop']}"
    )
    assert after["scrollHeight"] < before["scrollHeight"], (
        f"scrollHeight 未收敛: {before['scrollHeight']} -> {after['scrollHeight']}"
    )
    assert after["row0Top"] is not None, "过滤后首行未渲染"
    assert after["row0Top"] >= 0, (
        f"过滤后视口未显示首行（空白）: row0Top={after['row0Top']}"
    )

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
