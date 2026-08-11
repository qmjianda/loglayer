"""通用工具：性能打点、路径解析、文件系统遍历、子进程创建参数。"""

import os
import re
import platform
import shutil
import time
from pathlib import Path
from typing import List, Optional


# ==== 性能打点（性能看护，默认关闭；LOGLAYER_TIMING=1 开启）====
# 统一格式: [Timing] <stage> wall=<epoch_ms> file=<file_id> <duration_ms>ms <extra>
# wall 与前端 Date.now() 同毫秒时间轴，可跨前后端对齐时间线。
TIMING_ENABLED = os.environ.get("LOGLAYER_TIMING") == "1"


def timing_start() -> Optional[float]:
    return time.perf_counter() if TIMING_ENABLED else None


def timing(stage: str, file_id: str = "", t0: Optional[float] = None, extra: str = "") -> None:
    if not TIMING_ENABLED:
        return
    wall = int(time.time() * 1000)
    parts = [f"[Timing] {stage}", f"wall={wall}"]
    if file_id:
        parts.append(f"file={file_id}")
    if t0 is not None:
        parts.append(f"{(time.perf_counter() - t0) * 1000:.1f}ms")
    if extra:
        parts.append(extra)
    print(" ".join(parts))


def convert_windows_path_to_linux(windows_path: str) -> str:
    """将 Windows 路径转换为 Linux 路径"""
    if platform.system() != "Windows":
        # 处理 Windows 盘符 (如 D:\Project\... -> /mnt/d/Project/...)
        path = windows_path.replace("\\", "/")

        # 检查是否是 Windows 盘符路径
        match = re.match(r"^([A-Za-z]):/(.*)", path)
        if match:
            drive_letter = match.group(1).lower()
            rest_path = match.group(2)
            # 动态映射任意盘符: X: -> /mnt/x
            return f"/mnt/{drive_letter}/{rest_path}"

        # 如果不是 Windows 盘符，可能是 WSL 路径或网络路径
        # 尝试直接返回转换后的路径
        return path
    return windows_path


def resolve_file_path(file_path: str) -> str:
    """解析文件路径，处理跨平台路径问题"""
    # 使用 Path 来规范化路径（处理正反斜杠）
    normalized_path = Path(file_path)

    # 首先检查原路径是否存在（Path会自动处理路径格式）
    if normalized_path.exists():
        return str(normalized_path)

    # 在非 Windows 平台上，尝试转换为 Linux 路径
    if platform.system() != "Windows":
        linux_path = convert_windows_path_to_linux(file_path)
        if Path(linux_path).exists():
            return linux_path

    # 返回规范化后的原始路径
    return str(normalized_path)


def get_creationflags():
    """Returns subprocess creation flags to hide windows on Windows."""
    if platform.system() == "Windows":
        return 0x08000000  # CREATE_NO_WINDOW
    return 0


def find_rg_binary(candidate_dirs: Optional[List[str]] = None) -> Optional[str]:
    """查找可用的 ripgrep 二进制，返回绝对路径；找不到返回 None。

    查找顺序：
    1. 传入的候选目录（`<dir>/<platform>/rg[.exe]`，如打包/开发目录的 bin）
    2. 系统 PATH（`shutil.which("rg")`）

    `candidate_dirs` 缺省时为空列表。返回的路径保证存在（`os.path.isfile`）。
    """
    if candidate_dirs is None:
        candidate_dirs = []
    platform_dir = "windows" if platform.system() == "Windows" else "linux"
    exe_name = "rg.exe" if platform.system() == "Windows" else "rg"
    for base in candidate_dirs:
        candidate = os.path.join(base, platform_dir, exe_name)
        if os.path.isfile(candidate):
            return candidate
    which = shutil.which("rg")
    if which and os.path.isfile(which):
        return which
    return None


def select_window_icon(icon_path: str) -> Optional[str]:
    """选择 pywebview 窗口图标路径；不适用时返回 None。

    Windows（WinForms 后端）仅接受 `.ico`，传 PNG 会触发 .NET
    `Icon.Initialize` 崩溃（GitHub issue #2）。非 Windows 平台接受 PNG。
    """
    if not icon_path or not os.path.isfile(icon_path):
        return None
    if platform.system() == "Windows" and not icon_path.lower().endswith(".ico"):
        print(f"[Main] Windows pywebview requires .ico icon, got {icon_path}; using default")
        return None
    return icon_path


def get_log_files_recursive(folder_path):
    """Utility to find log files in a directory recursively."""
    log_files = []
    try:
        for root, _, files in os.walk(folder_path):
            for file in files:
                if (
                    file.lower().endswith((".log", ".txt", ".json", ".csv", ".md"))
                    or "." not in file
                ):
                    full_path = os.path.join(root, file)
                    try:
                        stats = os.stat(full_path)
                        log_files.append(
                            {"name": file, "path": full_path, "size": stats.st_size}
                        )
                    except (OSError, PermissionError):
                        continue
    except Exception as e:
        print(f"Error walking directory {folder_path}: {e}")
    return log_files


def get_directory_contents(folder_path):
    """Utility to list all files and folders in a directory (one level)."""
    items = []
    try:
        path = Path(folder_path)
        for entry in path.iterdir():
            try:
                is_dir = entry.is_dir()
                items.append(
                    {
                        "name": entry.name,
                        "path": str(entry.absolute()),
                        "isDir": is_dir,
                        "size": entry.stat().st_size if not is_dir else 0,
                    }
                )
            except:
                continue
        items.sort(key=lambda x: (not x["isDir"], x["name"].lower()))
    except Exception as e:
        print(f"Error listing directory {folder_path}: {e}")
    return items
