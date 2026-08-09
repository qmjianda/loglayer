"""缓存 key 确定性验收测试（任务 1.10）。

对应 spec: search-and-pipeline-cache
- 同输入同 key：相同图层/搜索配置多次计算得到相同 hash。
- 不同输入不同 key：配置任何影响输出的字段变化 → hash 不同。
- UI 元数据排除：id/name/isCollapsed 不影响 hash，避免前端 UI 变化导致缓存无意义失效。
- 图层顺序敏感：管线按序执行，交换图层顺序 → hash 不同。
- 配置内字段顺序无关：config dict 键顺序不影响 hash（JSON sort_keys）。
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from loglayer.cache_keys import compute_layers_hash, compute_query_hash


def _layer(lid, query, enabled=True, extra=None):
    """构造带 UI 元数据与 config 的图层项。"""
    conf = {"query": query}
    if extra:
        conf.update(extra)
    return {
        "id": lid,
        "type": "FILTER",
        "enabled": enabled,
        "config": conf,
        "name": f"层-{lid}",
        "isCollapsed": False,
    }


class TestComputeLayersHash:
    def test_same_input_same_key(self):
        """同输入多次计算 → 同 key（确定性）。"""
        layers = [_layer("l1", "ERROR"), _layer("l2", "INFO")]
        assert compute_layers_hash(layers) == compute_layers_hash(layers)

    def test_different_layers_different_key(self):
        """不同图层配置 → 不同 key。"""
        a = compute_layers_hash([_layer("l1", "ERROR")])
        b = compute_layers_hash([_layer("l1", "INFO")])
        assert a != b

    def test_ui_metadata_ignored(self):
        """UI 元数据（id/name/isCollapsed）变化 → 同 key。"""
        base = compute_layers_hash([_layer("l1", "ERROR")])
        renamed = compute_layers_hash(
            [{"id": "x", "type": "FILTER", "enabled": True,
              "config": {"query": "ERROR"}, "name": "改名", "isCollapsed": True}]
        )
        assert base == renamed

    def test_layer_order_sensitive(self):
        """交换图层顺序 → 不同 key（管线按序执行）。"""
        a = compute_layers_hash([_layer("l1", "ERROR"), _layer("l2", "INFO")])
        b = compute_layers_hash([_layer("l2", "INFO"), _layer("l1", "ERROR")])
        assert a != b

    def test_enabled_affects_key(self):
        """enabled 变化 → 不同 key（enabled 决定是否参与管线）。"""
        a = compute_layers_hash([_layer("l1", "ERROR", enabled=True)])
        b = compute_layers_hash([_layer("l1", "ERROR", enabled=False)])
        assert a != b

    def test_config_key_order_irrelevant(self):
        """config dict 键顺序不同 → 同 key（sort_keys 序列化）。"""
        a = compute_layers_hash([_layer("l1", "ERROR", extra={"a": 1, "b": 2})])
        b = compute_layers_hash([_layer("l1", "ERROR", extra={"b": 2, "a": 1})])
        assert a == b

    def test_config_change_affects_key(self):
        """config 内字段变化 → 不同 key。"""
        a = compute_layers_hash([_layer("l1", "ERROR")])
        b = compute_layers_hash([_layer("l1", "ERROR", extra={"caseSensitive": True})])
        assert a != b


class TestComputeQueryHash:
    def test_same_input_same_key(self):
        """同输入多次计算 → 同 key。"""
        q = {"query": "INFO", "regex": False, "caseSensitive": False}
        assert compute_query_hash(q) == compute_query_hash(q)

    def test_query_change_differs(self):
        """搜索词变化 → 不同 key。"""
        a = compute_query_hash({"query": "INFO"})
        b = compute_query_hash({"query": "WARN"})
        assert a != b

    def test_flag_change_differs(self):
        """regex/caseSensitive/wholeWord 变化 → 不同 key。"""
        base = {"query": "info", "regex": False, "caseSensitive": False,
                "wholeWord": False}
        assert compute_query_hash(base) != compute_query_hash(
            {**base, "regex": True}
        )
        assert compute_query_hash(base) != compute_query_hash(
            {**base, "caseSensitive": True}
        )
        assert compute_query_hash(base) != compute_query_hash(
            {**base, "wholeWord": True}
        )

    def test_ui_fields_ignored(self):
        """非匹配相关字段（UI 附加字段）不影响 key。"""
        a = compute_query_hash({"query": "INFO", "panelId": "p1"})
        b = compute_query_hash({"query": "INFO", "panelId": "p2"})
        assert a == b

    def test_defaults_normalized(self):
        """缺省字段与显式默认值 → 同 key。"""
        a = compute_query_hash({"query": "INFO"})
        b = compute_query_hash(
            {"query": "INFO", "regex": False, "caseSensitive": False,
             "wholeWord": False}
        )
        assert a == b

    def test_key_order_irrelevant(self):
        """dict 键顺序不同 → 同 key。"""
        a = compute_query_hash({"query": "INFO", "regex": False})
        b = compute_query_hash({"regex": False, "query": "INFO"})
        assert a == b
