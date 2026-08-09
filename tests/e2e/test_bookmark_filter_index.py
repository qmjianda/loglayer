"""
书签过滤索引回归测试（e2e）：验证过滤视图下书签锚定物理行号 + 双行号 gutter。

覆盖 fix-bookmark-filter-index 变更：
1. 过滤后 gutter 双列：物理列（原始行号，跳跃）+ 虚拟列（过滤序号，连续）
2. 书签 key 为物理行号：点击 gutter 加书签后，书签列表 #N 为物理行号
3. 点击书签跳转精确滚动到该物理行对应的可见位置
4. 无过滤时虚拟列折叠（仅物理列）
"""

import os
import tempfile

import pytest

from . import helpers

pytestmark = pytest.mark.e2e

# 0-based 物理索引，含 ERROR 的行（20 行文件中 4 行）
ERROR_LINES = [3, 8, 13, 18]
# 对应 1-based 物理行号
ERROR_LINE_NUMBERS = [n + 1 for n in ERROR_LINES]


@pytest.fixture(scope="module")
def filter_log_path():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "filter.log")
        with open(path, "w", encoding="utf-8") as f:
            for i in range(20):
                lv = "ERROR" if i in ERROR_LINES else "INFO"
                f.write(f"2026-08-07 10:00:{i:02d} [{lv}] svc-{i % 5:02d} 处理请求 #{i}\n")
        yield path


def _gutter_physical_texts(page):
    return page.evaluate(
        """() => Array.from(document.querySelectorAll('.log-row .gutter-physical'))
              .map(el => el.textContent.trim())"""
    )


def _gutter_virtual_texts(page):
    return page.evaluate(
        """() => Array.from(document.querySelectorAll('.log-row .gutter-virtual'))
              .map(el => el.textContent.trim())"""
    )


def _virtual_columns_collapsed(page):
    """无过滤时虚拟列应处于折叠态（collapsed 类 + 宽度 0）。"""
    return page.evaluate(
        """() => {
            const els = document.querySelectorAll('.log-row .gutter-virtual');
            if (els.length === 0) return false;
            return Array.from(els).every(el => el.classList.contains('collapsed'));
        }"""
    )


@pytest.mark.usefixtures("frontend_errors")
def test_filter_bookmark_physical_index_and_jump(page, filter_log_path, frontend_errors):
    """过滤下书签锚定物理行号：双列显示 + 书签跳转精确命中。"""
    helpers.open_file_via_picker(page, filter_log_path, timeout=60000)
    page.wait_for_selector('.log-row', timeout=60000)

    # --- 1. 精确定位第 4 行（0-based 3 = 第一个 ERROR 行），JS 选中 "ERROR" 词，右键 → "以此过滤" ---
    page.wait_for_function(
        """() => {
            const row = document.querySelectorAll('.log-row')[3];
            return row && row.querySelector('.log-row-content')?.textContent.includes('ERROR');
        }""",
        timeout=10000,
    )
    selected = page.evaluate(
        """() => {
            const row = document.querySelectorAll('.log-row')[3];
            const contentEl = row.querySelector('.log-row-content');
            const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
            const parts = [];
            let text = '';
            let node;
            while ((node = walker.nextNode())) {
                parts.push({ node, start: text.length, text: node.textContent });
                text += node.textContent;
            }
            const idx = text.indexOf('ERROR');
            if (idx === -1) return false;
            for (const p of parts) {
                if (idx >= p.start && idx < p.start + p.text.length) {
                    const range = document.createRange();
                    range.setStart(p.node, idx - p.start);
                    range.setEnd(p.node, idx - p.start + 5);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    return true;
                }
            }
            return false;
        }"""
    )
    assert selected, "未能在第 4 行选中 ERROR 词"
    page.wait_for_timeout(200)
    # 右键菜单键触发 contextmenu（真实右键 mousedown 会清空 JS 选区）
    page.keyboard.press('ContextMenu')
    page.wait_for_selector('button:has-text("以此过滤")', timeout=10000)
    page.locator('button:has-text("以此过滤")').click()

    # --- 2. 等待过滤生效：只剩 4 个可见行，且首行物理列重渲染为 4 ---
    page.wait_for_function(
        """() => document.querySelectorAll('.log-row').length === 4
               && document.querySelector('.log-row .gutter-physical')?.textContent.trim() === '4'""",
        timeout=60000,
    )

    # --- 3. 断言双行号：物理列（4,9,14,19）+ 虚拟列（1,2,3,4） ---
    phys = _gutter_physical_texts(page)
    assert phys == [str(n) for n in ERROR_LINE_NUMBERS], f"物理列应显示原始行号，实际 {phys}"
    virt = _gutter_virtual_texts(page)
    assert virt == ["1", "2", "3", "4"], f"虚拟列应显示连续序号，实际 {virt}"

    # --- 4. 点击第一个可见行（物理行 4）gutter 加书签 ---
    page.locator('.log-row .log-row-gutter').nth(0).click(timeout=10000)
    # 书签列表在右侧操作台「书签」折叠区内，先展开再断言
    page.locator(':text-is("书签")').first.click()
    # 书签列表出现 #4（物理行号 +1），证明书签 key 锚定物理行号
    page.wait_for_selector('span.text-amber-500:text-is("#4")', timeout=10000)

    # --- 5. 点击书签条目跳转 → 精确滚动到物理行 4 对应的可见位置 ---
    page.locator('span.text-amber-500:text-is("#4")').click(timeout=10000)
    page.wait_for_function(
        """() => {
            const el = document.querySelector('.log-row .gutter-number');
            return el && el.textContent.trim() === '4';
        }""",
        timeout=10000,
    )

    assert not frontend_errors, f"前端存在错误: {frontend_errors}"


@pytest.mark.usefixtures("frontend_errors")
def test_virtual_column_collapsed_without_filter(page, filter_log_path, frontend_errors):
    """无过滤时虚拟列折叠：仅物理列，无 .gutter-virtual。"""
    helpers.open_file_via_picker(page, filter_log_path, timeout=60000)
    page.wait_for_selector('.log-row', timeout=60000)
    page.wait_for_timeout(1500)

    assert _virtual_columns_collapsed(page), "无过滤时虚拟列应处于折叠态（collapsed）"
    phys = _gutter_physical_texts(page)
    assert len(phys) >= 20 and phys[0] == "1", f"无过滤时物理列应从 1 开始，实际 {phys[:3]}"

    assert not frontend_errors, f"前端存在错误: {frontend_errors}"
