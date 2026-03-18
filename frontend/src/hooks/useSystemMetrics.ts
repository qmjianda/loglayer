import { useState, useEffect, useRef, useCallback } from 'react';
import { getSystemMetrics, SystemMetrics } from '../bridge_client';

export interface DiskIOMetrics {
    readMB: number;
    writeMB: number;
    readRateMBps: number;
    writeRateMBps: number;
    readCount: number;
    writeCount: number;
}

export interface SystemMetricsReturn {
    cpu: number;
    memory: number;
    memoryUsedMB: number;
    memoryTotalMB: number;
    diskIO: DiskIOMetrics;
    loading: boolean;
    error: string | null;
}

export function useSystemMetrics(enabled: boolean = true, intervalMs: number = 1000): SystemMetricsReturn {
    const [metrics, setMetrics] = useState<SystemMetricsReturn>({
        cpu: 0,
        memory: 0,
        memoryUsedMB: 0,
        memoryTotalMB: 0,
        diskIO: {
            readMB: 0,
            writeMB: 0,
            readRateMBps: 0,
            writeRateMBps: 0,
            readCount: 0,
            writeCount: 0,
        },
        loading: true,
        error: null,
    });

    const lastDiskIO = useRef<{ readBytes: number; writeBytes: number; timestamp: number }>({
        readBytes: 0,
        writeBytes: 0,
        timestamp: Date.now(),
    });

    const fetchMetrics = useCallback(async () => {
        try {
            const data = await getSystemMetrics();
            
            if (data.error) {
                setMetrics(prev => ({ ...prev, loading: false, error: data.error }));
                return;
            }

            const now = Date.now();
            const timeDelta = (now - lastDiskIO.current.timestamp) / 1000;
            
            let readRateMBps = 0;
            let writeRateMBps = 0;
            
            if (timeDelta > 0 && data.disk_read_bytes !== undefined && data.disk_write_bytes !== undefined) {
                const readDelta = data.disk_read_bytes - lastDiskIO.current.readBytes;
                const writeDelta = data.disk_write_bytes - lastDiskIO.current.writeBytes;
                
                readRateMBps = (readDelta / timeDelta) / (1024 * 1024);
                writeRateMBps = (writeDelta / timeDelta) / (1024 * 1024);
            }

            if (data.disk_read_bytes !== undefined && data.disk_write_bytes !== undefined) {
                lastDiskIO.current = {
                    readBytes: data.disk_read_bytes,
                    writeBytes: data.disk_write_bytes,
                    timestamp: now,
                };
            }

            setMetrics({
                cpu: data.cpu_percent || 0,
                memory: data.memory_percent || 0,
                memoryUsedMB: data.memory_used_mb || 0,
                memoryTotalMB: data.memory_total_mb || 0,
                diskIO: {
                    readMB: (data.disk_read_bytes || 0) / (1024 * 1024),
                    writeMB: (data.disk_write_bytes || 0) / (1024 * 1024),
                    readRateMBps,
                    writeRateMBps,
                    readCount: data.disk_read_count || 0,
                    writeCount: data.disk_write_count || 0,
                },
                loading: false,
                error: null,
            });
        } catch (e) {
            setMetrics(prev => ({ ...prev, loading: false, error: String(e) }));
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        fetchMetrics();
        const interval = setInterval(fetchMetrics, intervalMs);

        return () => clearInterval(interval);
    }, [enabled, intervalMs, fetchMetrics]);

    return metrics;
}