import json
import bisect


class SearchPipeline:
    """
    Pipeline for search operations.
    Expected to be mixed into a class with:
    - self._sessions
    - self.pipelineFinished (Signal)
    """

    def get_search_match_index(self, file_id: str, rank: int) -> int:
        if file_id not in self._sessions:
            return -1
        session = self._sessions[file_id]
        if session.search_matches is None or len(session.search_matches) == 0:
            return -1
        if rank < 0 or rank >= len(session.search_matches):
            return -1
        return session.search_matches[rank]

    def is_search_match(self, file_id: str, index: int) -> bool:
        """Check if the given index is a search match."""
        if file_id not in self._sessions:
            return False
        session = self._sessions[file_id]
        matches = session.search_matches
        if matches is None or len(matches) == 0:
            return False
        # Use bisect_left to find exact match
        pos = bisect.bisect_left(matches, index)
        return pos < len(matches) and matches[pos] == index

    def get_nearest_search_rank(
        self, file_id: str, current_index: int, direction: str
    ) -> int:
        """Find the rank of the nearest search match based on the current visible index."""
        if file_id not in self._sessions:
            return -1
        session = self._sessions[file_id]
        matches = session.search_matches
        if matches is None or len(matches) == 0:
            return -1

        # search_matches contains indices in the visible list
        rank = bisect.bisect_right(matches, current_index)

        if direction == "next":
            if rank < len(matches):
                return rank
            else:
                return 0  # Loop to start
        else:  # prev
            target_rank = rank - 1
            if target_rank >= 0:
                if matches[target_rank] == current_index:
                    target_rank -= 1

                if target_rank >= 0:
                    return target_rank
                else:
                    return len(matches) - 1
            else:
                return len(matches) - 1

    def get_search_matches_range(
        self, file_id: str, start_rank: int, count: int
    ) -> str:
        if file_id not in self._sessions:
            return "[]"
        session = self._sessions[file_id]
        if session.search_matches is None:
            return "[]"
        start = max(0, start_rank)
        end = min(len(session.search_matches), start + count)
        if start >= end:
            return "[]"
        return json.dumps(session.search_matches[start:end].tolist())

    def physical_to_visual_index(self, file_id: str, physical_index: int) -> int:
        """Convert physical line index to virtual index (considering filtered visible lines)"""
        if file_id not in self._sessions:
            return physical_index

        session = self._sessions[file_id]

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


class BookmarkPipeline:
    """
    Pipeline for bookmark operations.
    Bookmarks are now stored directly in session.bookmarks (independent of layer system).
    """

    def toggle_bookmark(self, file_id: str, line_index: int) -> str:
        """Toggle bookmark for a specific line."""
        if file_id not in self._sessions:
            return "{}"
        session = self._sessions[file_id]
        
        # 直接操作 session.bookmarks
        if line_index in session.bookmarks:
            del session.bookmarks[line_index]
        else:
            session.bookmarks[line_index] = ""
        
        # 轻量刷新：清除渲染缓存并发送信号
        session.rendering_cache.clear()
        self._emit_refresh_signal(file_id)
        
        return json.dumps(session.bookmarks)

    def get_bookmarks(self, file_id: str) -> str:
        """Get all bookmarks for a file."""
        if file_id not in self._sessions:
            return "{}"
        session = self._sessions[file_id]
        return json.dumps(session.bookmarks)

    def update_bookmark_comment(self, file_id: str, line_index: int, comment: str) -> str:
        """Update bookmark comment."""
        if file_id not in self._sessions:
            return "{}"
        session = self._sessions[file_id]
        
        if line_index in session.bookmarks:
            session.bookmarks[line_index] = comment
            session.rendering_cache.clear()
            self._emit_refresh_signal(file_id)
        
        return json.dumps(session.bookmarks)

    def get_nearest_bookmark_index(self, file_id: str, current_index: int, direction: str) -> int:
        """Find the nearest bookmark index."""
        if file_id not in self._sessions:
            return -1
        session = self._sessions[file_id]
        
        if not session.bookmarks:
            return -1
        
        sorted_bookmarks = sorted(session.bookmarks.keys())
        
        # 确定当前物理索引
        current_physical = current_index
        if session.visible_indices is not None:
            if session.visible_indices and 0 <= current_index < len(session.visible_indices):
                current_physical = session.visible_indices[current_index]
            elif current_index >= len(session.visible_indices):
                current_physical = session.visible_indices[-1] + 1 if session.visible_indices else 0
            else:
                current_physical = 0
        
        # 查找最近的物理索引
        if direction == 'next':
            idx = bisect.bisect_right(sorted_bookmarks, current_physical)
            if idx < len(sorted_bookmarks):
                target_physical = sorted_bookmarks[idx]
            else:
                target_physical = sorted_bookmarks[0]  # Loop to start
        else:  # prev
            idx = bisect.bisect_left(sorted_bookmarks, current_physical) - 1
            if idx >= 0:
                target_physical = sorted_bookmarks[idx]
            else:
                target_physical = sorted_bookmarks[-1]  # Loop to end
        
        # 转换回虚拟索引
        if session.visible_indices is not None:
            return self.physical_to_visual_index(file_id, target_physical)
        return target_physical

    def clear_bookmarks(self, file_id: str) -> str:
        """Clear all bookmarks for a file."""
        if file_id not in self._sessions:
            return "{}"
        session = self._sessions[file_id]
        
        session.bookmarks.clear()
        session.rendering_cache.clear()
        self._emit_refresh_signal(file_id)
        
        return "{}"


# Backward compatibility alias
SearchMixin = SearchPipeline
