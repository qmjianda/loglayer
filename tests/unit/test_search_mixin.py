import pytest
import array
import json
from bridge import LogSession


def test_physical_to_visual_index(bridge_instance, mock_session):
    file_id = "test-file"
    bridge_instance._sessions[file_id] = mock_session

    # CASE 1: No filtering (visible_indices is None)
    mock_session.visible_indices = None
    assert bridge_instance.physical_to_visual_index(file_id, 10) == 10

    # CASE 2: With filtering
    mock_session.visible_indices = array.array('I', [2, 5, 10, 15, 20])

    # Exact match
    assert bridge_instance.physical_to_visual_index(file_id, 5) == 1
    assert bridge_instance.physical_to_visual_index(file_id, 10) == 2

    # Nearest match (filtered out)
    # physical 6 -> should return visual 1 (physical 5)
    assert bridge_instance.physical_to_visual_index(file_id, 6) == 1
    # physical 1 -> should return 0 (nearest start)
    assert bridge_instance.physical_to_visual_index(file_id, 1) == 0
    # physical 100 -> should return visual 4 (physical 20)
    assert bridge_instance.physical_to_visual_index(file_id, 100) == 4


def test_get_nearest_search_rank(bridge_instance, mock_session):
    file_id = "test-file"
    bridge_instance._sessions[file_id] = mock_session
    mock_session.search_matches = array.array('I', [10, 20, 30, 40])  # ranks: 0, 1, 2, 3

    # Direction: next
    assert bridge_instance.get_nearest_search_rank(file_id, 5, "next") == 0
    assert bridge_instance.get_nearest_search_rank(file_id, 10, "next") == 1
    assert bridge_instance.get_nearest_search_rank(file_id, 25, "next") == 2
    assert (
        bridge_instance.get_nearest_search_rank(file_id, 40, "next") == 0
    )  # wrap around

    # Direction: prev
    assert bridge_instance.get_nearest_search_rank(file_id, 45, "prev") == 3
    assert bridge_instance.get_nearest_search_rank(file_id, 40, "prev") == 2
    assert bridge_instance.get_nearest_search_rank(file_id, 35, "prev") == 2
    assert (
        bridge_instance.get_nearest_search_rank(file_id, 10, "prev") == 3
    )  # wrap around


def test_get_search_match_index(bridge_instance, mock_session):
    file_id = "test-file"
    bridge_instance._sessions[file_id] = mock_session
    mock_session.search_matches = array.array('I', [100, 200, 300])

    assert bridge_instance.get_search_match_index(file_id, 0) == 100
    assert bridge_instance.get_search_match_index(file_id, 1) == 200
    assert bridge_instance.get_search_match_index(file_id, 5) == -1  # Out of range


def test_bookmark_logic_basic(bridge_instance, mock_session):
    # This involves Signals and Registry, which are partially mocked or instantiated in conftest
    file_id = "test-file"
    bridge_instance._sessions[file_id] = mock_session

    # We need to ensure the bridge has a pipelineFinished signal that we can monitor or mock
    # In conftest, FileBridge is instantiated, so signals are real.

    # Mock some responses from registry if necessary, but here we check toggle
    # Note: SearchMixin depends on self._registry

    # Test toggle_bookmark adds a bookmark
    res = bridge_instance.toggle_bookmark(file_id, 50)
    bookmarks = json.loads(res)
    assert "50" in bookmarks

    # Test toggle removes it
    res = bridge_instance.toggle_bookmark(file_id, 50)
    bookmarks = json.loads(res)
    assert "50" not in bookmarks


def test_toggle_bookmark_uses_physical_line_index(bridge_instance, mock_session):
    """书签 key 锚定物理行号：toggle 按传入行号原样存储，过滤存在与否不影响存储值。"""
    file_id = "test-file"
    bridge_instance._sessions[file_id] = mock_session

    # 无过滤：传入的即为物理行号，原样存储
    res = json.loads(bridge_instance.toggle_bookmark(file_id, 42))
    assert "42" in res

    # 有过滤（visible_indices 非空）：存储的仍是物理行号，不受可见行影响
    mock_session.visible_indices = array.array('I', [2, 5, 42, 99])
    res = json.loads(bridge_instance.toggle_bookmark(file_id, 7))
    assert "7" in res
    assert "42" in res  # 已有书签不受过滤状态影响

    # 语义确认：key 即物理行号（不是可见行内的序号）
    layer = bridge_instance._get_bookmark_layer(mock_session)
    assert layer is not None
    assert set(layer.bookmarks.keys()) == {42, 7}


def test_get_nearest_bookmark_index_with_filter(bridge_instance, mock_session):
    """过滤（visible_indices 非空）下，get_nearest_bookmark_index 按物理行号书签
    返回正确的可见索引，跳转目标物理行与书签一致。"""
    file_id = "test-file"
    bridge_instance._sessions[file_id] = mock_session
    # 物理可见行：2,5,10,15,20 → 视觉索引 0..4
    mock_session.visible_indices = array.array('I', [2, 5, 10, 15, 20])

    # 添加物理行号书签（10 → 视觉 2；20 → 视觉 4）
    bridge_instance.toggle_bookmark(file_id, 10)
    bridge_instance.toggle_bookmark(file_id, 20)

    # 从视觉 0（物理 2）next → 视觉 2（物理 10）
    assert bridge_instance.get_nearest_bookmark_index(file_id, 0, "next") == 2
    # 从视觉 2（物理 10）next → 视觉 4（物理 20）
    assert bridge_instance.get_nearest_bookmark_index(file_id, 2, "next") == 4
    # 末尾 next → 回绕到视觉 2
    assert bridge_instance.get_nearest_bookmark_index(file_id, 4, "next") == 2
    # 从视觉 3（物理 15）prev → 视觉 2（物理 10）
    assert bridge_instance.get_nearest_bookmark_index(file_id, 3, "prev") == 2
    # prev 回绕：从视觉 0 prev → 视觉 4（物理 20）
    assert bridge_instance.get_nearest_bookmark_index(file_id, 0, "prev") == 4
