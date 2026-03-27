"""
Bookmark delegator - Composition-based alternative to BookmarkPipeline mixin.
"""

import json
import bisect
from typing import Dict, Any, Optional, Callable


class BookmarkDelegator:
    """Delegator for bookmark operations - composition over inheritance."""

    def __init__(
        self,
        get_session_fn: Callable[[str], Optional[Any]],
        refresh_signal_fn: Optional[Callable] = None,
        save_bookmarks_fn: Optional[Callable] = None,
    ):
        """
        Args:
            get_session_fn: Function to retrieve session by file_id
            refresh_signal_fn: Optional callback to emit refresh signal
            save_bookmarks_fn: Optional callback to save bookmarks to file
        """
        self._get_session = get_session_fn
        self._emit_refresh = refresh_signal_fn
        self._save_bookmarks = save_bookmarks_fn

    def toggle_bookmark(self, file_id: str, line_index: int) -> str:
        session = self._get_session(file_id)
        if not session:
            return "{}"

        if line_index in session.bookmarks:
            del session.bookmarks[line_index]
        else:
            session.bookmarks[line_index] = ""

        session.rendering_cache.clear()
        if self._emit_refresh:
            self._emit_refresh(file_id)
        if self._save_bookmarks:
            self._save_bookmarks(file_id)

        return json.dumps(session.bookmarks)

    def get_bookmarks(self, file_id: str) -> str:
        session = self._get_session(file_id)
        if not session:
            return "{}"
        return json.dumps(session.bookmarks)

    def update_bookmark_comment(self, file_id: str, line_index: int, comment: str) -> str:
        session = self._get_session(file_id)
        if not session:
            return "{}"

        if line_index in session.bookmarks:
            session.bookmarks[line_index] = comment
            session.rendering_cache.clear()
            if self._emit_refresh:
                self._emit_refresh(file_id)
            if self._save_bookmarks:
                self._save_bookmarks(file_id)

        return json.dumps(session.bookmarks)

    def get_nearest_bookmark_index(self, file_id: str, current_index: int, direction: str) -> int:
        session = self._get_session(file_id)
        if not session:
            return -1

        if not session.bookmarks:
            return -1

        sorted_bookmarks = sorted(session.bookmarks.keys())

        current_physical = current_index
        if session.visible_indices is not None:
            if session.visible_indices and 0 <= current_index < len(session.visible_indices):
                current_physical = session.visible_indices[current_index]
            elif current_index >= len(session.visible_indices):
                current_physical = session.visible_indices[-1] + 1 if session.visible_indices else 0
            else:
                current_physical = 0

        if direction == "next":
            idx = bisect.bisect_right(sorted_bookmarks, current_physical)
            if idx < len(sorted_bookmarks):
                target_physical = sorted_bookmarks[idx]
            else:
                target_physical = sorted_bookmarks[0]
        else:
            idx = bisect.bisect_left(sorted_bookmarks, current_physical) - 1
            if idx >= 0:
                target_physical = sorted_bookmarks[idx]
            else:
                target_physical = sorted_bookmarks[-1]

        if session.visible_indices is not None:
            return self._physical_to_visual(file_id, target_physical)
        return target_physical

    def _physical_to_visual(self, file_id: str, physical_index: int) -> int:
        session = self._get_session(file_id)
        if not session or session.visible_indices is None:
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

    def clear_bookmarks(self, file_id: str) -> str:
        session = self._get_session(file_id)
        if not session:
            return "{}"

        session.bookmarks.clear()
        session.rendering_cache.clear()
        if self._emit_refresh:
            self._emit_refresh(file_id)
        if self._save_bookmarks:
            self._save_bookmarks(file_id)

        return "{}"


__all__ = ["BookmarkDelegator"]
