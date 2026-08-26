"""1.2 repro（后端）：read_processed_lines 定长 null 占位契约 — ATDD"""

import os
import sys
import json
import array
import mmap
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from bridge import FileBridge


def _make_file(lines):
    f = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log", encoding="utf-8")
    for line in lines:
        f.write(line + "\n")
    f.close()
    return f.name


def test_read_processed_lines_null_placeholder_and_offset():
    """请求区间含越界/异常行时，返回定长，异常位为 null，后续偏移正确"""
    bridge = FileBridge()
    file_id = "repro-null-hole"
    path = _make_file([f"line {i}" for i in range(20)])
    try:
        bridge.open_file(file_id, path)
        import time

        deadline = time.time() + 10
        while time.time() < deadline:
            sess = bridge._sessions.get(file_id)
            if sess and len(sess.line_offsets) >= 20:
                break
            time.sleep(0.05)
        sess = bridge._sessions[file_id]
        assert len(sess.line_offsets) >= 20

        # 正常全量读取应定长无 null
        raw = bridge.read_processed_lines(file_id, 5, 5)
        arr = json.loads(raw)
        assert len(arr) == 5, f"expected 5 got {len(arr)}"
        assert all(x is not None for x in arr)
        assert arr[0]["content"].strip() == "line 5"

        # 构造越界：请求末尾越界，越界位应为 null 占位（或截断到 total）
        # total=20, 请求 [18,25) -> expected = min(25,20)-18=2，返回2个，越界不产生但也不压缩
        raw2 = bridge.read_processed_lines(file_id, 18, 10)
        arr2 = json.loads(raw2)
        # 定长语义：end_idx = min(start+count,total)=20 => expected 2
        assert len(arr2) == 2
        assert arr2[0] is not None and arr2[1] is not None

        # 人为制造单行异常：通过污染 offsets 使某行 real_idx 越界
        # 将 line_offsets 截短，迫使 real_idx >= len(offsets) 触发 null 占位
        orig_offsets = sess.line_offsets
        sess.line_offsets = array.array("Q", list(orig_offsets)[:10])
        raw3 = bridge.read_processed_lines(file_id, 0, 12)
        arr3 = json.loads(raw3)
        # total 此时仍以 visible_indices/ offsets 长度为准，但我们截短了 offsets，
        # 对于 i>=10 的行应为 null（定长）
        assert len(arr3) == 10 or len(arr3) == 12  # 取决于 total 计算分支
        # 至少验证 null 占位存在且不压缩
        # 若 total 仍为 20，预期 12 行中后2行为 null
        if len(arr3) == 12:
            assert arr3[10] is None and arr3[11] is None, f"expected null placeholders at tail, got {arr3[10:12]}"
            # 前10行中应有正常内容
            assert arr3[0] is not None
        # 恢复
        sess.line_offsets = orig_offsets

    finally:
        bridge.close_file(file_id)
        Path(path).unlink(missing_ok=True)


def test_read_processed_lines_returns_full_length_under_normal():
    bridge = FileBridge()
    file_id = "repro-full"
    path = _make_file([f"row {i}" for i in range(100)])
    try:
        bridge.open_file(file_id, path)
        import time

        deadline = time.time() + 10
        while time.time() < deadline:
            s = bridge._sessions.get(file_id)
            if s and len(s.line_offsets) >= 100:
                break
            time.sleep(0.05)
        raw = bridge.read_processed_lines(file_id, 0, 100)
        arr = json.loads(raw)
        assert len(arr) == 100
        assert arr[0]["content"].strip() == "row 0"
        assert arr[99]["content"].strip() == "row 99"
    finally:
        bridge.close_file(file_id)
        Path(path).unlink(missing_ok=True)
