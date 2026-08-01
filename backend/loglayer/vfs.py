"""数据源抽象（VFS 层）：ILogStreamProvider 接口 + LocalFileProvider 本地实现。

业务层不直接依赖具体文件系统实现（mmap/远程流），通过 provider 抽象访问日志源。
对齐 ps 项目的完整 VFS 抽象，替换旧 BaseStorageProvider 雏形。
"""
from __future__ import annotations

import mmap
import os
import struct
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

try:
    import chardet as _chardet  # type: ignore[import-not-found]
    _HAS_CHARDET = True
except ImportError:
    _chardet = None
    _HAS_CHARDET = False


@dataclass(frozen=True)
class FileMetadata:
    """已打开日志源的不可变元数据。"""

    uri: str  # 唯一标识（本地路径 / s3:// / docker://）
    size_bytes: int
    line_count: int
    encoding: str = "utf-8"


class ILogStreamProvider(ABC):
    """所有日志数据源的抽象基类。

    实现：
        - LocalFileProvider：mmap 本地文件访问
        - S3LogProvider：（未来）云端对象存储
        - DockerLogProvider：（未来）容器日志流
    """

    @abstractmethod
    def open(self, uri: str) -> FileMetadata:
        """打开日志源并返回元数据。"""
        ...

    @abstractmethod
    def close(self, uri: str) -> None:
        """释放指定日志源的资源。"""
        ...

    @abstractmethod
    def read_lines(self, uri: str, start: int, count: int) -> list:
        """从行索引 `start`（0 基）读取 `count` 行。"""
        ...

    @abstractmethod
    def get_line_offsets(self, uri: str) -> list:
        """返回每行边界的字节偏移数组，用于 O(1) 随机访问。"""
        ...

    @abstractmethod
    def get_raw_bytes(self, uri: str, offset: int, length: int) -> bytes:
        """从源读取原始字节（供 ripgrep 集成）。"""
        ...

    @abstractmethod
    def get_name(self, uri: str) -> str:
        """从 URI 提取显示名称。"""
        ...


class LocalFileProvider(ILogStreamProvider):
    """基于 mmap 的本地文件访问。

    使用操作系统级 mmap 避免将整个文件读入内存。
    行偏移索引在 open 时构建，并通过 SqliteMetadataCache 跨会话持久化。
    """

    def __init__(self) -> None:
        self._handles: dict = {}
        self._file_objects: dict = {}
        self._line_offsets: dict = {}
        self._encoding: dict = {}

    def open(self, uri: str) -> FileMetadata:
        path = Path(uri)
        if not path.exists():
            raise FileNotFoundError(uri)

        # 已打开的文件：直接返回缓存元数据，不重复构建索引
        if uri in self._line_offsets:
            size = os.path.getsize(path)
            return FileMetadata(
                uri=uri,
                size_bytes=size,
                line_count=len(self._line_offsets[uri]),
                encoding=self._encoding.get(uri, "utf-8"),
            )

        file_obj = open(path, "rb")  # noqa: SIM115
        size = os.fstat(file_obj.fileno()).st_size

        if size == 0:
            mm = None
            offsets = [0]
            encoding = "utf-8"
        else:
            mm = mmap.mmap(file_obj.fileno(), 0, access=mmap.ACCESS_READ)
            encoding = self._detect_encoding(mm, size)
            offsets = self._build_line_offsets(mm, size)

        self._file_objects[uri] = file_obj
        if mm is not None:
            self._handles[uri] = mm
        self._line_offsets[uri] = offsets
        self._encoding[uri] = encoding

        return FileMetadata(
            uri=uri,
            size_bytes=size,
            line_count=len(offsets),
            encoding=encoding,
        )

    def open_mmap(self, uri: str) -> FileMetadata:
        """仅打开文件句柄 + mmap，不构建偏移索引（缓存命中场景用）。

        返回的 FileMetadata.line_count 为 0，偏移需后续通过 set_line_offsets 注入。
        """
        path = Path(uri)
        if not path.exists():
            raise FileNotFoundError(uri)

        # 已打开但句柄已失效（如 session close 后）：重新打开
        stale = False
        existing = self._file_objects.get(uri)
        if existing is not None:
            try:
                if existing.closed:
                    stale = True
            except AttributeError:
                stale = False
        if stale:
            self.close(uri)

        if uri in self._file_objects:
            size = os.path.getsize(path)
            return FileMetadata(
                uri=uri,
                size_bytes=size,
                line_count=len(self._line_offsets.get(uri, [])),
                encoding=self._encoding.get(uri, "utf-8"),
            )

        file_obj = open(path, "rb")  # noqa: SIM115
        size = os.fstat(file_obj.fileno()).st_size
        self._file_objects[uri] = file_obj
        if size > 0:
            self._handles[uri] = mmap.mmap(file_obj.fileno(), 0, access=mmap.ACCESS_READ)
        if uri not in self._line_offsets:
            self._line_offsets[uri] = []
        encoding = self._detect_encoding(self._handles.get(uri), size)
        self._encoding[uri] = encoding
        return FileMetadata(
            uri=uri,
            size_bytes=size,
            line_count=0,
            encoding=encoding,
        )

    def set_line_offsets(self, uri: str, offsets) -> None:
        """注入偏移索引（缓存命中反序列化后调用）。"""
        self._line_offsets[uri] = offsets

    def close(self, uri: str) -> None:
        if uri in self._handles:
            self._handles.pop(uri).close()
        if uri in self._file_objects:
            getattr(self._file_objects.pop(uri), "close", lambda: None)()
        self._line_offsets.pop(uri, None)
        self._encoding.pop(uri, None)

    def read_lines(self, uri: str, start: int, count: int) -> list:
        mm = self._handles.get(uri)
        offsets = self._line_offsets.get(uri, [])
        encoding = self._encoding.get(uri, "utf-8")
        if mm is None or not offsets:
            return []

        end = min(start + count, len(offsets))
        lines: list = []
        for i in range(start, end):
            line_start = offsets[i]
            line_end = offsets[i + 1] if i + 1 < len(offsets) else mm.size()
            raw = mm[line_start:line_end]
            decoded = raw.decode(encoding, errors="replace").rstrip("\n\r")
            decoded = decoded.replace("\x00", "")
            lines.append(decoded)
        return lines

    def get_line_offsets(self, uri: str) -> list:
        return self._line_offsets.get(uri, [])

    def get_raw_bytes(self, uri: str, offset: int, length: int) -> bytes:
        mm = self._handles.get(uri)
        if mm is None:
            return b""
        return mm[offset : offset + length]

    def get_name(self, uri: str) -> str:
        return os.path.basename(uri.rstrip("/"))

    def get_mmap(self, uri: str) -> Optional[mmap.mmap]:
        """获取 mmap 对象（仅本地实现支持）。"""
        return self._handles.get(uri)

    def get_file_obj(self, uri: str):
        """获取底层文件句柄（仅本地实现支持）。"""
        return self._file_objects.get(uri)

    @staticmethod
    def _build_line_offsets(mm: mmap.mmap, size: int) -> list:
        """单次扫描构建行边界字节偏移数组。

        文件末尾换行产生的越界偏移（== size）会被清理，保证
        offsets[-1] 指向最后一个有效行的起始位置。
        """
        offsets = [0]
        pos = 0
        while pos < size:
            idx = mm.find(b"\n", pos)
            if idx == -1:
                break
            offsets.append(idx + 1)
            pos = idx + 1
        # 清理尾部：若最后一个偏移落在文件末尾（末尾换行），去掉
        if len(offsets) > 1 and offsets[-1] >= size:
            offsets.pop()
        return offsets

    @staticmethod
    def _detect_encoding(mm: Optional[mmap.mmap], size: int) -> str:
        """使用 BOM 或 chardet（前 64KB）检测文件编码。"""
        if size == 0 or mm is None:
            return "utf-8"

        # 快速路径：BOM 检测（字节 0-4）
        head = mm[: min(size, 4)]
        bom_map = {
            b"\xef\xbb\xbf": "utf-8-sig",
            b"\xff\xfe": "utf-16-le",
            b"\xfe\xff": "utf-16-be",
        }
        for bom, enc in bom_map.items():
            if head[: len(bom)] == bom:
                return enc

        # chardet 检测前 64KB
        if _HAS_CHARDET and _chardet is not None:
            sample = bytes(mm[: min(size, 65536)])
            detected = _detect_with_chardet(sample)
            if detected:
                return detected

        return "utf-8"


def _detect_with_chardet(sample: bytes) -> str:
    """使用 chardet 检测编码（返回规范化后的 Python codec 名）。"""
    if _chardet is None:
        return ""
    result = _chardet.detect(sample) or {}
    encoding = result.get("encoding")
    confidence = result.get("confidence")
    if encoding and confidence is not None and confidence > 0.5:
        detected = encoding.lower()
        alias_map = {
            "ascii": "utf-8",
            "gb2312": "gbk",
            "gb18030": "gbk",
            "windows-1252": "latin-1",
        }
        return alias_map.get(detected, detected) or "utf-8"
    return ""

    @staticmethod
    def _serialize_offsets(offsets: list) -> bytes:
        """将整数列表打包为紧凑二进制 blob（SQLite 存储用）。"""
        return struct.pack(f"<{len(offsets)}q", *offsets)

    @staticmethod
    def _deserialize_offsets(blob: bytes) -> list:
        """将二进制 blob 解包回整数列表。"""
        count = len(blob) // 8
        return list(struct.unpack(f"<{count}q", blob))


class MemoryLogProvider(ILogStreamProvider):
    """内存模拟数据源（用于测试）。"""

    def __init__(self, content: str = "line 1\nline 2\nline 3\n") -> None:
        self._content = content.encode("utf-8")
        self._offsets = [0]
        pos = 0
        while True:
            idx = self._content.find(b"\n", pos)
            if idx == -1:
                break
            self._offsets.append(idx + 1)
            pos = idx + 1
        if len(self._offsets) > 1 and self._offsets[-1] >= len(self._content):
            self._offsets.pop()

    def open(self, uri: str) -> FileMetadata:
        return FileMetadata(
            uri=uri,
            size_bytes=len(self._content),
            line_count=len(self._offsets),
            encoding="utf-8",
        )

    def close(self, uri: str) -> None:
        pass

    def read_lines(self, uri: str, start: int, count: int) -> list:
        lines: list = []
        for i in range(start, min(start + count, len(self._offsets))):
            line_start = self._offsets[i]
            line_end = self._offsets[i + 1] if i + 1 < len(self._offsets) else len(self._content)
            lines.append(self._content[line_start:line_end].decode("utf-8", errors="replace").rstrip("\n\r"))
        return lines

    def get_line_offsets(self, uri: str) -> list:
        return self._offsets

    def get_raw_bytes(self, uri: str, offset: int, length: int) -> bytes:
        return self._content[offset : offset + length]

    def get_name(self, uri: str) -> str:
        return os.path.basename(uri.rstrip("/"))
