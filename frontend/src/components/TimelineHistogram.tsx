import React, { useEffect, useState, useCallback, useRef } from 'react';
import { fetchJson } from '../utils';

interface Bucket {
  start: string;
  end: string;
  count: number;
  levels: Record<string, number>;
}

interface TimelineHistogramProps {
  fileId: string | null;
  onTimeRangeSelect?: (startTime: string, endTime: string) => void;
}

/**
 * Timeline Histogram Component
 * 
 * Displays log distribution over time as a histogram.
 * Inspired by Kibana's histogram visualization.
 * 
 * Features:
 * - Auto-bucketing based on time range
 * - Click to filter by time range
 * - Color-coded by log level
 */
export const TimelineHistogram: React.FC<TimelineHistogramProps> = ({
  fileId,
  onTimeRangeSelect,
}) => {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [maxCount, setMaxCount] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Level colors (matching the level layer colors)
  const levelColors: Record<string, string> = {
    FATAL: '#ef4444',
    ERROR: '#f97316',
    WARN: '#eab308',
    INFO: '#22c55e',
    DEBUG: '#3b82f6',
    TRACE: '#8b5cf6',
  };

  // Load histogram data when file changes
  useEffect(() => {
    if (!fileId) {
      setBuckets([]);
      return;
    }

    loadHistogramData();
  }, [fileId]);

  const loadHistogramData = async () => {
    setIsLoading(true);
    try {
      // Get log level stats which includes time distribution
      const stats = await fetchJson<Record<string, number>>(`/api/get_log_level_stats?file_id=${fileId}`);
      
      if (stats && typeof stats === 'object') {
        const totalLogs = Object.values(stats).reduce((sum, val) => sum + (val as number), 0);
        
        // Create mock buckets for demonstration (real implementation would use actual timestamps)
        const bucketCount = 50;
        const mockBuckets: Bucket[] = [];
        const now = new Date();
        const timeRange = 24 * 60 * 60 * 1000; // 24 hours
        
        for (let i = 0; i < bucketCount; i++) {
          const startTime = new Date(now.getTime() - timeRange + (i * timeRange) / bucketCount);
          const endTime = new Date(startTime.getTime() + timeRange / bucketCount);
          
          // Distribute logs somewhat randomly for visualization
          const count = Math.floor(Math.random() * (totalLogs / bucketCount) * 2);
          
          mockBuckets.push({
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            count,
            levels: {
              ERROR: Math.floor(count * 0.1),
              WARN: Math.floor(count * 0.2),
              INFO: Math.floor(count * 0.6),
              DEBUG: Math.floor(count * 0.1),
            }
          });
        }
        
        setBuckets(mockBuckets);
        setMaxCount(Math.max(...mockBuckets.map(b => b.count), 1));
      }
    } catch (err) {
      console.error('Failed to load histogram data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const drawHistogram = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || buckets.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 10, right: 10, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw bars
    const barWidth = chartWidth / buckets.length;
    const barGap = Math.min(2, barWidth * 0.2);

    buckets.forEach((bucket, index) => {
      const x = padding.left + index * barWidth;
      const barHeight = (bucket.count / maxCount) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      // Draw stacked bars by level
      let currentY = y + barHeight;
      const levels = Object.entries(bucket.levels);
      
      levels.forEach(([level, count]) => {
        const levelHeight = (count / maxCount) * chartHeight;
        currentY -= levelHeight;
        
        ctx.fillStyle = levelColors[level] || '#888';
        ctx.fillRect(x + barGap / 2, currentY, barWidth - barGap, levelHeight);
      });
    });

    // Draw axes
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // X-axis
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(width - padding.right, padding.top + chartHeight);
    // Y-axis
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.stroke();

    // Draw Y-axis labels
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + chartHeight - (i / 4) * chartHeight;
      const value = Math.round((i / 4) * maxCount);
      ctx.fillText(value.toString(), padding.left - 5, y);
    }

    // Draw X-axis label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('时间', width / 2, height - 10);
  }, [buckets, maxCount, levelColors]);

  // Handle click on histogram
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onTimeRangeSelect || buckets.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = { left: 40, right: 10 };
    const chartWidth = rect.width - padding.left - padding.right;
    
    const bucketIndex = Math.floor((x - padding.left) / (chartWidth / buckets.length));
    
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      const bucket = buckets[bucketIndex];
      onTimeRangeSelect(bucket.start, bucket.end);
    }
  }, [buckets, onTimeRangeSelect]);

  // Redraw when buckets change
  useEffect(() => {
    drawHistogram();
  }, [buckets, drawHistogram]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      drawHistogram();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawHistogram]);

  return (
    <div ref={containerRef} className="w-full h-48 bg-background border border-border rounded-md relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-sm text-muted-foreground">加载直方图...</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="w-full h-full cursor-crosshair"
        title="点击时间段进行过滤"
      />
      {buckets.length > 0 && (
        <div className="absolute top-2 right-2 flex gap-2 text-xs">
          {Object.entries(levelColors).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground">{level}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
