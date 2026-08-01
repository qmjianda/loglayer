"""SQLite 元数据缓存单元测试：分块压缩、哈希校验、LRU 淘汰。"""
import os
import sys
import tempfile
import glob

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest

from loglayer.metadata_cache import SqliteMetadataCache, CachedFileIndex

@pytest.fixture
def cache(tmp_path):
    db_path = tmp_path / "cache.db"
    return SqliteMetadataCache(db_path, cache_size_bytes=None)


@pytest.fixture
def temp_log_file():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False, encoding="utf-8") as f:
        for i in range(10):
            f.write(f"line {i}: data\n")
        path = f.name
    yield path
    if os.path.exists(path):
        os.remove(path)


def test_serialize_deserialize_roundtrip(cache):
    offsets = list(range(0, 2000, 7))
    blob = SqliteMetadataCache.serialize_offsets(offsets)
    out = SqliteMetadataCache.deserialize_offsets(blob)
    assert out == offsets


def test_serialize_chunks_and_compress(cache):
    # 大量偏移（跨多个 CHUNK_ROWS 块），验证分块正确性
    offsets = list(range(0, 2_500_000, 2))
    blob = SqliteMetadataCache.serialize_offsets(offsets)
    assert len(blob) < len(offsets) * 8  # 压缩后显著更小
    out = SqliteMetadataCache.deserialize_offsets(blob)
    assert out == offsets


def test_put_get_roundtrip(cache, temp_log_file):
    offsets = [0, 10, 20, 30, 40]
    index = CachedFileIndex(
        file_hash=SqliteMetadataCache.compute_file_hash(temp_log_file),
        line_count=len(offsets),
        offsets_blob=SqliteMetadataCache.serialize_offsets(offsets),
        file_size=os.path.getsize(temp_log_file),
    )
    cache.put(temp_log_file, index)

    got = cache.get(temp_log_file)
    assert got is not None
    assert got.line_count == 5
    assert SqliteMetadataCache.deserialize_offsets(got.offsets_blob) == offsets


def test_file_change_invalidates(cache, temp_log_file):
    offsets = [0, 10, 20]
    index = CachedFileIndex(
        file_hash=SqliteMetadataCache.compute_file_hash(temp_log_file),
        line_count=3,
        offsets_blob=SqliteMetadataCache.serialize_offsets(offsets),
        file_size=os.path.getsize(temp_log_file),
    )
    cache.put(temp_log_file, index)

    # 修改文件内容 → 哈希变化 → 缓存失效
    with open(temp_log_file, "a", encoding="utf-8") as f:
        f.write("appended line\n")

    got = cache.get(temp_log_file)
    assert got is None
    assert cache.get_entries() == []


def test_invalidate(cache, temp_log_file):
    index = CachedFileIndex(
        file_hash="h", line_count=3,
        offsets_blob=SqliteMetadataCache.serialize_offsets([0, 1, 2]),
        file_size=1,
    )
    cache.put(temp_log_file, index)
    cache.invalidate(temp_log_file)
    assert cache.get(temp_log_file) is None


def test_clear_all(cache, temp_log_file):
    index = CachedFileIndex(
        file_hash="h", line_count=3,
        offsets_blob=SqliteMetadataCache.serialize_offsets([0, 1, 2]),
        file_size=1,
    )
    cache.put(temp_log_file, index)
    cache.clear_all()
    assert cache.get_entries() == []


def test_lru_hard_floor_single_file(cache, temp_log_file):
    # 单文件超上限仍缓存（硬下限）
    cache.set_cache_size(1)  # 1 byte
    offsets = list(range(0, 1000))
    index = CachedFileIndex(
        file_hash=SqliteMetadataCache.compute_file_hash(temp_log_file),
        line_count=len(offsets),
        offsets_blob=SqliteMetadataCache.serialize_offsets(offsets),
        file_size=os.path.getsize(temp_log_file),
    )
    cache.put(temp_log_file, index)
    cache.enforce_limit(protected=set())
    assert len(cache.get_entries()) == 1


def test_lru_evicts_oldest(cache):
    cache.set_cache_size(10 ** 9)  # 先允许全部存入
    files = []
    for i in range(3):
        f = tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False, encoding="utf-8")
        f.write(f"file {i}\n" * 10)
        f.close()
        files.append(f.name)
        index = CachedFileIndex(
            file_hash=SqliteMetadataCache.compute_file_hash(files[i]),
            line_count=(i + 1) * 100,
            offsets_blob=SqliteMetadataCache.serialize_offsets(list(range(0, (i + 1) * 100))),
            file_size=os.path.getsize(files[i]),
        )
        cache.put(files[i], index)

    # 模拟访问 files[2] 使其成为最近使用
    cache.get(files[2])

    # 收缩上限：应保留最近使用的，淘汰最旧的
    cache.set_cache_size(1_000_000)
    remaining = [e[0] for e in cache.get_entries()]
    assert files[2] in remaining  # 最近使用保留

    try:
        for p in files:
            os.remove(p)
    except OSError:
        pass


def test_lru_protected_exempt(cache):
    cache.set_cache_size(10 ** 9)
    files = []
    for i in range(2):
        f = tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False, encoding="utf-8")
        f.write(f"file {i}\n" * 10)
        f.close()
        files.append(f.name)
        index = CachedFileIndex(
            file_hash=SqliteMetadataCache.compute_file_hash(files[i]),
            line_count=(i + 1) * 100,
            offsets_blob=SqliteMetadataCache.serialize_offsets(list(range(0, (i + 1) * 100))),
            file_size=os.path.getsize(files[i]),
        )
        cache.put(files[i], index)

    # files[0] 为保护文件（当前编辑中），files[1] 最旧
    cache.set_cache_size(1_000_000)
    cache.enforce_limit(protected={files[0]})
    remaining = [e[0] for e in cache.get_entries()]
    assert files[0] in remaining  # 保护文件不淘汰

    try:
        for p in files:
            os.remove(p)
    except OSError:
        pass


def test_close_is_idempotent(cache):
    """close() 可多次调用且不抛异常（切换工作区时调用）。"""
    cache.close()
    cache.close()  # 二次 close 不抛异常


def test_reopen_same_db_preserves_data(tmp_path, temp_log_file):
    """关闭后重新打开同一 db 文件，数据保留（工作区切换隔离用）。"""
    db_path = tmp_path / "cache.db"
    offsets = [0, 5, 10]
    index = CachedFileIndex(
        file_hash=SqliteMetadataCache.compute_file_hash(temp_log_file),
        line_count=3,
        offsets_blob=SqliteMetadataCache.serialize_offsets(offsets),
        file_size=os.path.getsize(temp_log_file),
    )

    c1 = SqliteMetadataCache(db_path)
    c1.put(temp_log_file, index)
    c1.close()

    # 重新打开同一 db：数据保留
    c2 = SqliteMetadataCache(db_path)
    got = c2.get(temp_log_file)
    assert got is not None and got.line_count == 3
