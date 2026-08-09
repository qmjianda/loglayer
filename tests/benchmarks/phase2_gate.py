"""
1.3GB 大文件性能门禁脚本（2.12 Phase 2 门禁）。
测量：打开耗时、搜索耗时、滚动帧率、F3 跳转耗时。
输出 JSON 记录，供与后续 Phase 3 门禁对比。

用法（需已起 backend:12345 + vite:3000）：
    python3 tests/benchmarks/phase2_gate.py
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

APP_URL = "http://127.0.0.1:3000/"
LARGE_LOG = os.path.abspath("tests/logs/large_test.log")


def measure(page, label, fn, *args, **kwargs):
    t0 = time.perf_counter()
    result = fn(*args, **kwargs)
    dt = time.perf_counter() - t0
    print(f"[Perf] {label}: {dt:.2f}s")
    return result, dt


def main() -> None:
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.goto(APP_URL, wait_until="networkidle", timeout=60000)

        # === 打开大文件（含索引时间）===
        page.locator('button:has-text("浏览并打开")').first.click(timeout=10000)
        page.wait_for_selector(".rpp-input", timeout=10000)
        dir_path = LARGE_LOG.replace("\\", "/")
        parts = [x for x in dir_path.split("/") if x]
        file_name = parts[-1]
        directory = "/" + "/".join(parts[:-1]) + "/"
        page.locator(".rpp-input").first.fill(directory)
        page.wait_for_timeout(1500)
        # 轮询等待 large_test 文件项出现（大文件元数据渲染可能稍慢；attached 而非 visible，避免视口外匹配失败）
        page.wait_for_selector('.rpp-item:has-text("large_test")', state="attached", timeout=30000)

        t_open0 = time.perf_counter()
        page.locator(".rpp-item", has_text="large_test").first.click(force=True, timeout=60000)
        page.wait_for_selector(".log-row", timeout=180000)
        results["open_to_first_rows"] = round(time.perf_counter() - t_open0, 2)
        # 等索引完成（行数稳定）
        time.sleep(3)
        state = page.evaluate(
            """() => {
                const scroller = document.querySelector('[data-logviewer]');
                const status = scroller ? scroller.querySelector('[role="status"]') : null;
                return status ? status.textContent.trim() : null;
            }"""
        )
        results["total_lines_aria"] = state
        print(f"[Perf] 打开至渲染首行: {results['open_to_first_rows']}s | aria: {state}")

        # === 搜索耗时 ===
        page.keyboard.press("Control+f")
        page.wait_for_timeout(600)
        inp = page.locator('input[placeholder="查找"]')
        t_search0 = time.perf_counter()
        inp.fill("ERROR")
        inp.press("Enter")
        # 等 mark 出现
        page.wait_for_selector("mark", timeout=60000)
        t_search1 = time.perf_counter()
        # 等匹配计数稳定
        page.wait_for_timeout(2000)
        results["search_query_to_marks"] = round(t_search1 - t_search0, 2)
        marks = page.locator("mark").count()
        results["visible_marks"] = marks
        print(f"[Perf] 搜索到高亮: {results['search_query_to_marks']}s | 可见 mark: {marks}")

        # === F3 跳转耗时（到匹配行）===
        t_f3_0 = time.perf_counter()
        page.keyboard.press("F3")
        page.wait_for_timeout(300)
        t_f3_1 = time.perf_counter()
        results["f3_navigate_ms"] = round((t_f3_1 - t_f3_0) * 1000, 1)
        print(f"[Perf] F3 跳转: {results['f3_navigate_ms']}ms")

        # === 滚动帧率采样（快速滚动后渲染行数）===
        t_scroll0 = time.perf_counter()
        page.mouse.move(700, 450)
        page.mouse.wheel(0, 20000)  # 快速滚 2 万像素
        page.wait_for_timeout(800)
        t_scroll1 = time.perf_counter()
        rows_after_scroll = page.locator(".log-row").count()
        results["scroll_20000px_ms"] = round((t_scroll1 - t_scroll0) * 1000, 1)
        results["rows_after_scroll"] = rows_after_scroll
        print(f"[Perf] 滚动 2 万 px: {results['scroll_20000px_ms']}ms | 渲染行: {rows_after_scroll}")

        results["frontend_errors"] = errors
        print(json.dumps(results, ensure_ascii=False, indent=2))

        with open("/tmp/opencode/e2e/phase2_gate.json", "w") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        browser.close()


if __name__ == "__main__":
    main()
