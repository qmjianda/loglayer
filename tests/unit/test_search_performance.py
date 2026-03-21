"""
Tests for the combined search API (get_next_search_match).

This tests the performance optimization that combines get_nearest_search_rank
and get_search_match_index into a single API call.
"""
import pytest
import json
import array
from unittest.mock import MagicMock, patch


class TestGetNextSearchMatch:
    """Tests for the get_next_search_match API."""

    @pytest.fixture
    def mock_bridge(self):
        """Create a mock FileBridge with search matches."""
        from bridge import FileBridge
        
        bridge = FileBridge.__new__(FileBridge)
        bridge._sessions = {}
        
        # Create a mock session with search matches
        session = MagicMock()
        session.search_matches = array.array('Q', [10, 25, 50, 75, 100, 150, 200])
        session.visible_indices = None
        bridge._sessions['test_file'] = session
        
        return bridge

    def test_get_next_search_match_returns_both_rank_and_index(self, mock_bridge):
        """Test that get_next_search_match returns both rank and index."""
        result = mock_bridge.get_next_search_match('test_file', 30, 'next')
        data = json.loads(result)
        
        assert 'rank' in data
        assert 'index' in data
        assert data['rank'] == 2  # 50 is at rank 2
        assert data['index'] == 50

    def test_get_next_search_match_next_direction(self, mock_bridge):
        """Test finding next match from current position."""
        # From position 30, next match should be 50 (rank 2)
        result = mock_bridge.get_next_search_match('test_file', 30, 'next')
        data = json.loads(result)
        assert data['index'] == 50
        
        # From position 100, next match should be 150 (wrapping behavior checked by rank)
        result = mock_bridge.get_next_search_match('test_file', 100, 'next')
        data = json.loads(result)
        assert data['index'] == 150

    def test_get_next_search_match_prev_direction(self, mock_bridge):
        """Test finding previous match from current position."""
        # From position 60, prev match should be 50
        result = mock_bridge.get_next_search_match('test_file', 60, 'prev')
        data = json.loads(result)
        assert data['index'] == 50
        
        # From position 25, prev match should be 10
        result = mock_bridge.get_next_search_match('test_file', 25, 'prev')
        data = json.loads(result)
        assert data['index'] == 10

    def test_get_next_search_match_wraps_to_first(self, mock_bridge):
        """Test that next wraps to first match when at end."""
        # From position 250, next should wrap to 10 (first match)
        result = mock_bridge.get_next_search_match('test_file', 250, 'next')
        data = json.loads(result)
        assert data['rank'] == 0
        assert data['index'] == 10

    def test_get_next_search_match_wraps_to_last(self, mock_bridge):
        """Test that prev wraps to last match when at start."""
        # From position 5, prev should wrap to 200 (last match)
        result = mock_bridge.get_next_search_match('test_file', 5, 'prev')
        data = json.loads(result)
        assert data['rank'] == 6
        assert data['index'] == 200

    def test_get_next_search_match_no_matches(self, mock_bridge):
        """Test behavior when there are no search matches."""
        session = mock_bridge._sessions['test_file']
        session.search_matches = array.array('Q', [])
        
        result = mock_bridge.get_next_search_match('test_file', 30, 'next')
        data = json.loads(result)
        assert data['rank'] == -1
        assert data['index'] == -1

    def test_get_next_search_match_invalid_file(self, mock_bridge):
        """Test behavior with invalid file ID."""
        result = mock_bridge.get_next_search_match('invalid_file', 30, 'next')
        data = json.loads(result)
        assert data['rank'] == -1
        assert data['index'] == -1

    def test_get_next_search_match_on_match_jumps_to_next(self, mock_bridge):
        """Test that when cursor is ON a match, next jumps to the NEXT match (VSCode behavior)."""
        # When cursor is at position 50 (which is a match), 
        # next should go to 75, not stay at 50
        result = mock_bridge.get_next_search_match('test_file', 50, 'next')
        data = json.loads(result)
        assert data['index'] == 75

    def test_get_next_search_match_single_api_call(self, mock_bridge):
        """Verify that this is a single API call vs two separate calls.
        
        This test documents the performance improvement:
        - Before: get_nearest_search_rank + get_search_match_index = 2 API calls
        - After: get_next_search_match = 1 API call
        """
        # The combined API should return both values in one call
        result = mock_bridge.get_next_search_match('test_file', 30, 'next')
        data = json.loads(result)
        
        # Both values should be present
        assert data['rank'] >= 0
        assert data['index'] >= 0
        
        # Verify they're consistent
        expected_index = mock_bridge._sessions['test_file'].search_matches[data['rank']]
        assert data['index'] == expected_index


class TestSearchPerformance:
    """Performance-related tests for search operations."""

    @pytest.fixture
    def large_search_matches(self):
        """Create a large array of search matches for performance testing."""
        return array.array('Q', range(0, 1000000, 100))  # 10000 matches

    def test_bisect_performance_is_logarithmic(self, large_search_matches):
        """Test that bisect operations are O(log n)."""
        import bisect
        import time
        
        # Time operations on different sizes
        times = []
        sizes = [100, 1000, 10000]
        
        for size in sizes:
            matches = large_search_matches[:size]
            start = time.perf_counter()
            for _ in range(1000):
                bisect.bisect_right(matches, 50000)
            end = time.perf_counter()
            times.append(end - start)
        
        # Logarithmic growth: doubling size shouldn't double time
        # Time ratio should be much less than 10x for 10x size increase
        ratio_1 = times[1] / times[0] if times[0] > 0 else 1
        ratio_2 = times[2] / times[1] if times[1] > 0 else 1
        
        # For O(log n), ratios should be small (not linear)
        assert ratio_1 < 5, f"Expected logarithmic growth, got ratio {ratio_1}"
        assert ratio_2 < 5, f"Expected logarithmic growth, got ratio {ratio_2}"