"""SQLite 元数据缓存单元测试：分块压缩、哈希校验、LRU 淘汰。"""
import array
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


def test_get_offsets_memory_hit(cache, temp_log_file):
    """get_offsets 首次走磁盘、二次命中内存热缓存，且结果一致。"""
    offsets = [0, 10, 20, 30, 40]
    index = CachedFileIndex(
        file_hash=SqliteMetadataCache.compute_file_hash(temp_log_file),
        line_count=len(offsets),
        offsets_blob=SqliteMetadataCache.serialize_offsets(offsets),
        file_size=os.path.getsize(temp_log_file),
    )
    cache.put(temp_log_file, index)

    first = cache.get_offsets(temp_log_file)
    assert list(first) == offsets

    # 二次调用应命中内存层（不可观测耗时，但需保证结果一致且类型为 array）
    second = cache.get_offsets(temp_log_file)
    assert list(second) == offsets
    assert isinstance(second, type(first))

    # 文件变更后内存缓存失效，返回 None
    with open(temp_log_file, "a", encoding="utf-8") as f:
        f.write("appended line\n")
    assert cache.get_offsets(temp_log_file) is None


def test_cache_offsets_memory_pre_writes(cache, temp_log_file):
    """cache_offsets_memory：索引完成后先注入内存，SQLite 尚未落盘也能命中。"""
    offsets = [0, 1, 2, 3]
    cache.cache_offsets_memory(temp_log_file, array.array("Q", offsets))

    # 未写入 SQLite（get 应 miss），但 get_offsets 内存命中
    assert cache.get(temp_log_file) is None
    got = cache.get_offsets(temp_log_file)
    assert list(got) == offsets


def test_offsets_mem_byte_budget(cache, temp_log_file):
    """内存热缓存按字节预算 LRU 淘汰，与 cache_size_bytes 联动。"""
    fp1 = str(temp_log_file)
    fp2 = fp1 + ".2"
    open(fp2, "w").write("x")

    cache.set_cache_size(2 * 1024 * 1024)  # 2MB 预算
    big = array.array("Q", range(300_000))  # 2.4MB > 预算 → 不入内存
    cache.cache_offsets_memory(fp1, big)
    assert cache.get_offsets(fp1) is None  # 超限拒绝

    small1 = array.array("Q", range(50_000))  # 400KB
    small2 = array.array("Q", range(50_000))
    cache.cache_offsets_memory(fp1, small1)
    cache.cache_offsets_memory(fp2, small2)
    assert cache.get_offsets(fp1) is not None
    assert cache.get_offsets(fp2) is not None

    # 缩小预算到 0.5MB → 只保留最近写入的 fp2（LRU 淘汰 fp1）
    cache.set_cache_size(500 * 1024)
    assert cache.get_offsets(fp1) is None
    assert cache.get_offsets(fp2) is not None

    os.remove(fp2)


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
