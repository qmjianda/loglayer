"""VFS 数据源抽象单元测试。"""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest

from loglayer.vfs import LocalFileProvider, MemoryLogProvider


@pytest.fixture
def temp_log_file():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False, encoding="utf-8") as f:
        for i in range(5):
            f.write(f"line {i}: hello world\n")
        path = f.name
    yield path
    if os.path.exists(path):
        os.remove(path)


def test_local_provider_open_metadata(temp_log_file):
    provider = LocalFileProvider()
    meta = provider.open(temp_log_file)

    assert meta.uri == temp_log_file
    assert meta.size_bytes > 0
    assert meta.line_count == 5  # 5 行 + 末尾偏移
    assert meta.encoding == "utf-8"

    provider.close(temp_log_file)


def test_local_provider_read_lines(temp_log_file):
    provider = LocalFileProvider()
    provider.open(temp_log_file)

    lines = provider.read_lines(temp_log_file, 0, 3)
    assert len(lines) == 3
    assert lines[0] == "line 0: hello world"
    assert lines[2] == "line 2: hello world"

    provider.close(temp_log_file)


def test_local_provider_get_line_offsets(temp_log_file):
    provider = LocalFileProvider()
    provider.open(temp_log_file)

    offsets = provider.get_line_offsets(temp_log_file)
    assert offsets[0] == 0
    # 递增且最后一个偏移 < 文件大小（尾部 \n 已清理）
    assert all(offsets[i] < offsets[i + 1] for i in range(len(offsets) - 1))

    provider.close(temp_log_file)


def test_local_provider_get_raw_bytes(temp_log_file):
    provider = LocalFileProvider()
    provider.open(temp_log_file)

    raw = provider.get_raw_bytes(temp_log_file, 0, 10)
    assert isinstance(raw, bytes)
    assert len(raw) == 10

    provider.close(temp_log_file)


def test_local_provider_reopen_same_file(temp_log_file):
    provider = LocalFileProvider()
    meta1 = provider.open(temp_log_file)
    meta2 = provider.open(temp_log_file)
    assert meta1.line_count == meta2.line_count
    provider.close(temp_log_file)


def test_local_provider_open_missing_raises():
    provider = LocalFileProvider()
    with pytest.raises(FileNotFoundError):
        provider.open("/nonexistent/path/file.log")


def test_memory_provider():
    provider = MemoryLogProvider("a\nb\nc\n")
    meta = provider.open("mem://test")
    assert meta.line_count == 3
    assert provider.read_lines("mem://test", 0, 2) == ["a", "b"]
