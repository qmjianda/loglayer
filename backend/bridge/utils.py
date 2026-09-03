"""通用工具：性能打点、路径解析、文件系统遍历、子进程创建参数。"""

import os
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


def resolve_file_path(file_path: str) -> str:
    """规范化文件路径：处理正反斜杠，裸文件名（相对路径）基于 cwd 归一化为绝对路径。"""
    normalized = Path(file_path)
    if normalized.is_absolute():
        return str(normalized)
    return str(normalized.resolve())


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
        if os.path.isfile(candidate) and _ensure_executable(candidate):
            return candidate
    which = shutil.which("rg")
    if which and os.path.isfile(which) and _ensure_executable(which):
        return which
    return None


def _ensure_executable(path: str) -> bool:
    """确保 rg 二进制可执行（POSIX）。不可执行时尝试 chmod +x 补齐。

    打包/解压后 rg 可能丢失执行位（Windows 构建、tar/zip 解压），
    此处自检补齐，替代原打包脚本的 chmod 逻辑。Windows 无执行位概念，直接可用。
    """
    if platform.system() == "Windows":
        return True
    if os.access(path, os.X_OK):
        return True
    try:
        os.chmod(path, os.stat(path).st_mode | 0o111)
    except OSError as e:
        print(f"[Bridge] Failed to set exec bit on {path}: {e}")
        return False
    return True


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
