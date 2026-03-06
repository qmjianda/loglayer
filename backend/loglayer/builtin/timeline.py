"""
Timeline Histogram Component

Displays log distribution over time as a histogram.
Inspired by Kibana's histogram visualization.

Features:
- Auto-bucketing based on time range
- Click to filter by time range
- Color-coded by log level
- Responsive design
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from loglayer.core import UIWidget, LayerCategory


class TimelineHistogram(UIWidget):
    """
    Timeline histogram widget for statusbar/sidebar.
    
    Shows log distribution over time with optional level breakdown.
    """
    
    role = "sidebar"
    refresh_interval = 0  # Manual refresh only
    
    def __init__(self):
        super().__init__()
        self._buckets: List[Dict[str, Any]] = []
        self._time_range: Optional[tuple] = None
    
    def compute_buckets(self, timestamps: List[datetime], 
                       levels: Optional[List[str]] = None,
                       bucket_count: int = 50) -> List[Dict[str, Any]]:
        """
        Compute histogram buckets from timestamps.
        
        Args:
            timestamps: List of log timestamps
            levels: Optional list of log levels (same length as timestamps)
            bucket_count: Number of buckets to create
            
        Returns:
            List of bucket dicts with keys:
            - start: bucket start time
            - end: bucket end time
            - count: total log count
            - levels: breakdown by level
        """
        if not timestamps:
            return []
        
        min_time = min(timestamps)
        max_time = max(timestamps)
        
        # Handle edge case: all same timestamp
        if min_time == max_time:
            min_time = min_time - timedelta(seconds=1)
            max_time = max_time + timedelta(seconds=1)
        
        bucket_duration = (max_time - min_time) / bucket_count
        
        buckets = []
        for i in range(bucket_count):
            bucket_start = min_time + timedelta(seconds=bucket_duration.total_seconds() * i)
            bucket_end = bucket_start + bucket_duration
            
            buckets.append({
                'start': bucket_start,
                'end': bucket_end,
                'count': 0,
                'levels': {}
            })
        
        # Fill buckets
        for i, ts in enumerate(timestamps):
            # Find bucket index
            bucket_idx = int((ts - min_time).total_seconds() / bucket_duration.total_seconds())
            bucket_idx = min(bucket_idx, bucket_count - 1)
            bucket_idx = max(bucket_idx, 0)
            
            buckets[bucket_idx]['count'] += 1
            
            # Track level breakdown
            if levels and i < len(levels):
                level = levels[i] or 'UNKNOWN'
                buckets[bucket_idx]['levels'][level] = \
                    buckets[bucket_idx]['levels'].get(level, 0) + 1
        
        self._buckets = buckets
        self._time_range = (min_time, max_time)
        
        return buckets
    
    def get_data(self) -> dict:
        """Return histogram data for UI rendering."""
        return {
            'buckets': [
                {
                    'start': b['start'].isoformat(),
                    'end': b['end'].isoformat(),
                    'count': b['count'],
                    'levels': b['levels']
                }
                for b in self._buckets
            ],
            'time_range': {
                'start': self._time_range[0].isoformat() if self._time_range else None,
                'end': self._time_range[1].isoformat() if self._time_range else None
            } if self._time_range else None
        }
    
    def get_time_range_for_bucket(self, bucket_index: int) -> Optional[tuple]:
        """Get time range for a specific bucket (for filtering)."""
        if 0 <= bucket_index < len(self._buckets):
            bucket = self._buckets[bucket_index]
            return (bucket['start'], bucket['end'])
        return None


# Singleton instance
_histogram: Optional[TimelineHistogram] = None


def get_histogram() -> TimelineHistogram:
    """Get or create singleton histogram instance."""
    global _histogram
    if _histogram is None:
        _histogram = TimelineHistogram()
    return _histogram
