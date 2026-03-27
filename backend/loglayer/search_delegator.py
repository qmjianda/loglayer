"""
Search delegator - Composition-based alternative to SearchPipeline mixin.

This class receives dependencies through constructor rather than relying
on mixin host class attributes.
"""

import json
import bisect
from typing import Dict, Any, Optional, Callable


class SearchDelegator:
    """Delegator for search operations - composition over inheritance."""

    def __init__(
        self,
        get_session_fn: Callable[[str], Optional[Any]],
        pipeline_finished_emit_fn: Optional[Callable] = None,
    ):
        """
        Args:
            get_session_fn: Function to retrieve session by file_id
            pipeline_finished_emit_fn: Optional callback for pipeline finished signal
        """
        self._get_session = get_session_fn
        self._pipeline_finished = pipeline_finished_emit_fn

    def get_search_match_index(self, file_id: str, rank: int) -> int:
        session = self._get_session(file_id)
        if not session:
            return -1
        if session.search_matches is None or len(session.search_matches) == 0:
            return -1
        if rank < 0 or rank >= len(session.search_matches):
            return -1
        return session.search_matches[rank]

    def is_search_match(self, file_id: str, index: int) -> bool:
        session = self._get_session(file_id)
        if not session:
            return False
        matches = session.search_matches
        if matches is None or len(matches) == 0:
            return False
        pos = bisect.bisect_left(matches, index)
        return pos < len(matches) and matches[pos] == index

    def get_search_rank_for_index(self, file_id: str, index: int) -> int:
        session = self._get_session(file_id)
        if not session:
            return -1
        matches = session.search_matches
        if matches is None or len(matches) == 0:
            return -1
        pos = bisect.bisect_left(matches, index)
        if pos < len(matches) and matches[pos] == index:
            return pos
        return -1

    def get_nearest_search_rank(self, file_id: str, current_index: int, direction: str) -> int:
        session = self._get_session(file_id)
        if not session:
            return -1
        matches = session.search_matches
        if matches is None or len(matches) == 0:
            return -1

        if direction == "next":
            rank = bisect.bisect_right(matches, current_index)
            if rank < len(matches):
                return rank
            return 0
        else:
            rank = bisect.bisect_left(matches, current_index)
            if rank > 0:
                return rank - 1
            return len(matches) - 1

    def get_next_search_match(self, file_id: str, current_index: int, direction: str) -> str:
        session = self._get_session(file_id)
        if not session:
            return json.dumps({"rank": -1, "index": -1})
        matches = session.search_matches
        if matches is None or len(matches) == 0:
            return json.dumps({"rank": -1, "index": -1})

        if direction == "next":
            rank = bisect.bisect_right(matches, current_index)
            result_rank = rank if rank < len(matches) else 0
        else:
            rank = bisect.bisect_left(matches, current_index)
            result_rank = rank - 1 if rank > 0 else len(matches) - 1

        result_index = matches[result_rank]
        return json.dumps({"rank": int(result_rank), "index": int(result_index)})

    def get_search_matches_range(self, file_id: str, start_rank: int, count: int) -> str:
        session = self._get_session(file_id)
        if not session or session.search_matches is None:
            return "[]"
        start = max(0, start_rank)
        end = min(len(session.search_matches), start + count)
        if start >= end:
            return "[]"
        return json.dumps(session.search_matches[start:end].tolist())

    def physical_to_visual_index(self, file_id: str, physical_index: int) -> int:
        session = self._get_session(file_id)
        if not session:
            return physical_index
        if session.visible_indices is None:
            return physical_index

        visual_idx = bisect.bisect_left(session.visible_indices, physical_index)
        if (
            visual_idx < len(session.visible_indices)
            and session.visible_indices[visual_idx] == physical_index
        ):
            return visual_idx
        if visual_idx > 0:
            return visual_idx - 1
        return 0


__all__ = ["SearchDelegator"]
