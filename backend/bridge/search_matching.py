"""搜索匹配计算（与过滤管线解耦的纯函数）。"""

import array
import subprocess
from typing import Optional

from .utils import get_creationflags


def compute_search_matches(
    rg_path: str,
    file_path: str,
    search_config: Optional[dict],
    is_cancelled=None,
) -> "array.array":
    """独立计算搜索匹配的物理行号，与过滤管线完全解耦。

    返回有序的匹配物理行号数组（`array.array('I')`）。搜索词为空或
    配置缺失时返回空数组。`is_cancelled` 为可选可调用对象，用于支持
    管线取消（循环中检查，返回 True 时提前终止）。
    """
    if not search_config or not search_config.get("query"):
        return array.array("I")
    if not rg_path:
        return array.array("I")

    cmd = [
        rg_path,
        "--line-number",
        "--no-heading",
        "--no-filename",
        "--color",
        "never",
    ]
    if search_config.get("regex"):
        cmd.append("-e")
    else:
        cmd.append("-F")
    if not search_config.get("caseSensitive"):
        cmd.append("-i")
    if search_config.get("wholeWord"):
        cmd.append("-w")
    cmd.append(search_config["query"])
    cmd.append(file_path)

    matching_physicals = array.array("I")
    sp = None
    try:
        sp = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False,
            creationflags=get_creationflags(),
        )
        if sp.stdout:
            for match_line_bytes in sp.stdout:
                if is_cancelled and is_cancelled():
                    break
                match_line = match_line_bytes.decode("utf-8", errors="replace")
                parts = match_line.split(":", 1)
                if parts[0].isdigit():
                    # rg --line-number 输出天然按行号升序且每行至多一次，
                    # 直接 append 到 array('I')（4B/元素），避免 set() 的高内存开销
                    matching_physicals.append(int(parts[0]) - 1)
        if is_cancelled and is_cancelled():
            try:
                sp.terminate()
            except Exception:
                pass
        sp.wait(timeout=5)
    except Exception as e:
        print(f"[Search] compute_search_matches error: {e}")
    finally:
        # 取消/异常路径兜底：确保 rg 子进程被回收，不残留孤儿进程
        if sp is not None and sp.poll() is None:
            try:
                sp.terminate()
            except Exception:
                pass
            try:
                sp.wait(timeout=2)
            except Exception:
                try:
                    sp.kill()
                except Exception:
                    pass

    return matching_physicals
