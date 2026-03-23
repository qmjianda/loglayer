import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  basename,
  removeFromSet,
  addToSet,
  formatFileSize,
  generateId,
  debounce,
  getBackendUrl,
} from '../../../frontend/src/utils/index';

describe('utils/index', () => {
  describe('basename', () => {
    it('should extract filename from Unix path', () => {
      expect(basename('/path/to/file.txt')).toBe('file.txt');
    });

    it('should extract filename from Windows path', () => {
      expect(basename('C:\\Users\\test\\file.log')).toBe('file.log');
    });

    it('should handle path without directory', () => {
      expect(basename('file.txt')).toBe('file.txt');
    });

    it('should handle empty path', () => {
      expect(basename('')).toBe('');
    });
  });

  describe('removeFromSet', () => {
    it('should remove item from set', () => {
      const set = new Set([1, 2, 3]);
      const result = removeFromSet(set, 2);
      expect(result.has(1)).toBe(true);
      expect(result.has(2)).toBe(false);
      expect(result.has(3)).toBe(true);
    });

    it('should not mutate original set', () => {
      const set = new Set([1, 2, 3]);
      removeFromSet(set, 2);
      expect(set.has(2)).toBe(true);
    });

    it('should return same set if item not found', () => {
      const set = new Set([1, 2]);
      const result = removeFromSet(set, 3);
      expect(result.size).toBe(2);
    });
  });

  describe('addToSet', () => {
    it('should add item to set', () => {
      const set = new Set([1, 2]);
      const result = addToSet(set, 3);
      expect(result.has(1)).toBe(true);
      expect(result.has(2)).toBe(true);
      expect(result.has(3)).toBe(true);
    });

    it('should not mutate original set', () => {
      const set = new Set([1, 2]);
      addToSet(set, 3);
      expect(set.has(3)).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle fractional values', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should accept prefix', () => {
      const id = generateId('test-');
      expect(id.startsWith('test-')).toBe(true);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should delay function execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should only call once for multiple rapid calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to function', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('getBackendUrl', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        location: { port: '3000', protocol: 'http:', host: 'localhost:3000' },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return localhost URL in dev mode', () => {
      expect(getBackendUrl()).toBe('http://127.0.0.1:12345');
    });

    it('should return current host in production', () => {
      vi.stubGlobal('window', {
        location: { port: '5173', protocol: 'https:', host: 'example.com' },
      });
      expect(getBackendUrl()).toBe('https://example.com');
    });
  });
});
