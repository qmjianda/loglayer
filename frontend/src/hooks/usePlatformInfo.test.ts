import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePlatformInfo } from '../hooks/usePlatformInfo';

vi.mock('../bridge_client', () => ({
  getPlatformInfo: vi.fn(),
}));

import { getPlatformInfo } from '../bridge_client';

const mockGetPlatformInfo = getPlatformInfo as ReturnType<typeof vi.fn>;

describe('hooks/usePlatformInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return default values initially', () => {
    const { result } = renderHook(() => usePlatformInfo());

    expect(result.current.platform).toBe('Unknown');
    expect(result.current.isWindows).toBe(false);
    expect(result.current.loading).toBe(true);
  });

  it('should set platform info on success', async () => {
    mockGetPlatformInfo.mockResolvedValue('Windows');

    const { result } = renderHook(() => usePlatformInfo());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.platform).toBe('Windows');
    expect(result.current.isWindows).toBe(true);
  });

  it('should detect Linux platform', async () => {
    mockGetPlatformInfo.mockResolvedValue('Linux');

    const { result } = renderHook(() => usePlatformInfo());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.platform).toBe('Linux');
    expect(result.current.isWindows).toBe(false);
  });

  it('should detect Darwin as not Windows', async () => {
    mockGetPlatformInfo.mockResolvedValue('Darwin');

    const { result } = renderHook(() => usePlatformInfo());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.platform).toBe('Darwin');
    expect(result.current.isWindows).toBe(false);
  });

  it('should handle error gracefully', async () => {
    mockGetPlatformInfo.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePlatformInfo());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.platform).toBe('Unknown');
    expect(result.current.isWindows).toBe(false);
  });

  it('should call getPlatformInfo once', async () => {
    mockGetPlatformInfo.mockResolvedValue('Linux');

    renderHook(() => usePlatformInfo());

    await waitFor(() => {
      expect(mockGetPlatformInfo).toHaveBeenCalledTimes(1);
    });
  });
});
