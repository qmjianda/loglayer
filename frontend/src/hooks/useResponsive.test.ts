import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResponsive, useMediaQuery, MEDIA_QUERIES } from '../hooks/useResponsive';

describe('hooks/useResponsive', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      matchMedia: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('useResponsive', () => {
    it('should return initial state with default values', () => {
      const { result } = renderHook(() => useResponsive());
      expect(result.current.width).toBe(1024);
      expect(result.current.height).toBe(768);
    });

    it('should detect desktop breakpoint', () => {
      vi.stubGlobal('window', {
        innerWidth: 1200,
        innerHeight: 800,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      const { result } = renderHook(() => useResponsive());
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.isMobile).toBe(false);
    });

    it('should detect mobile breakpoint', () => {
      vi.stubGlobal('window', {
        innerWidth: 400,
        innerHeight: 800,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      const { result } = renderHook(() => useResponsive());
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should detect tablet breakpoint', () => {
      vi.stubGlobal('window', {
        innerWidth: 800,
        innerHeight: 600,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      const { result } = renderHook(() => useResponsive());
      expect(result.current.isTablet).toBe(true);
    });

    it('should detect landscape orientation', () => {
      vi.stubGlobal('window', {
        innerWidth: 1024,
        innerHeight: 768,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      const { result } = renderHook(() => useResponsive());
      expect(result.current.isLandscape).toBe(true);
      expect(result.current.isPortrait).toBe(false);
    });

    it('should detect portrait orientation', () => {
      vi.stubGlobal('window', {
        innerWidth: 768,
        innerHeight: 1024,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      const { result } = renderHook(() => useResponsive());
      expect(result.current.isPortrait).toBe(true);
      expect(result.current.isLandscape).toBe(false);
    });
  });

  describe('useMediaQuery', () => {
    it('should return false initially when query does not match', () => {
      const { result } = renderHook(() => useMediaQuery('(min-width: 1000px)'));
      expect(result.current).toBe(false);
    });

    it('should return true when query matches', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      const { result } = renderHook(() => useMediaQuery('(min-width: 640px)'));
      expect(result.current).toBe(true);
    });
  });

  describe('MEDIA_QUERIES', () => {
    it('should have all expected breakpoints', () => {
      expect(MEDIA_QUERIES.sm).toBe('(min-width: 640px)');
      expect(MEDIA_QUERIES.md).toBe('(min-width: 768px)');
      expect(MEDIA_QUERIES.lg).toBe('(min-width: 1024px)');
      expect(MEDIA_QUERIES.xl).toBe('(min-width: 1280px)');
    });

    it('should have dark mode query', () => {
      expect(MEDIA_QUERIES.dark).toBe('(prefers-color-scheme: dark)');
    });

    it('should have motion query', () => {
      expect(MEDIA_QUERIES.motion).toBe('(prefers-reduced-motion: no-preference)');
    });
  });
});
