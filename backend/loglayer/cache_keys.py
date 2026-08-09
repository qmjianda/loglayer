"""缓存 key 工具：将图层配置 / 搜索配置规范化为稳定 hash。

原则：
- 只取影响计算输出的字段，排除 UI 元数据（id/name/isCollapsed 等），
  避免前端 UI 变化导致缓存无意义失效。
- 图层顺序敏感（管线按序执行），序列化保留列表顺序。
- 复用 SqliteMetadataCache.compute_file_hash 校验文件本身。
"""
import hashlib
import json
from typing import Any


def _stable_json(value: Any) -> str:
    """确定性序列化：sort_keys 保证同配置同输出。"""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def compute_layers_hash(layers_config: list) -> str:
    """图层配置列表 → sha1。

    输入为前端下发的图层列表，每项含 type/enabled/config 及 id/name/
    isCollapsed 等 UI 元数据。仅 type/enabled/config 进入 hash：
    - type 决定处理逻辑；
    - enabled 决定是否参与管线（sync_layers 跳过 disabled）；
    - config 为图层参数（含 rg args 与逻辑层参数）。
    """
    normalized = []
    for l_conf in layers_config:
        if not isinstance(l_conf, dict):
            continue
        normalized.append(
            {
                "type": l_conf.get("type", ""),
                "enabled": bool(l_conf.get("enabled", True)),
                "config": l_conf.get("config", {}),
            }
        )
    payload = _stable_json(normalized)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def compute_query_hash(query_config: dict) -> str:
    """搜索配置 → sha1：仅取影响匹配结果的字段。"""
    normalized = {
        "query": query_config.get("query", ""),
        "regex": bool(query_config.get("regex", False)),
        "caseSensitive": bool(query_config.get("caseSensitive", False)),
        "wholeWord": bool(query_config.get("wholeWord", False)),
    }
    payload = _stable_json(normalized)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()
