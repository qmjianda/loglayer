import { describe, it, expect } from 'vitest';
import { isSQLLikeQuery, parseSQLQuery } from '../utils/sqlParser';

describe('utils/sqlParser', () => {
  describe('isSQLLikeQuery', () => {
    it('should return false for empty string', () => {
      expect(isSQLLikeQuery('')).toBe(false);
    });

    it('should detect AND operator', () => {
      expect(isSQLLikeQuery('error AND warning')).toBe(true);
    });

    it('should detect OR operator', () => {
      expect(isSQLLikeQuery('error OR info')).toBe(true);
    });

    it('should detect NOT operator', () => {
      expect(isSQLLikeQuery('NOT debug')).toBe(false);
    });

    it('should detect CONTAINS operator', () => {
      expect(isSQLLikeQuery('message CONTAINS "error"')).toBe(true);
    });

    it('should detect LIKE operator', () => {
      expect(isSQLLikeQuery('level LIKE "WARN%"')).toBe(true);
    });

    it('should detect IN operator', () => {
      expect(isSQLLikeQuery('level IN (ERROR, WARN)')).toBe(true);
    });

    it('should detect equality operator', () => {
      expect(isSQLLikeQuery('level = ERROR')).toBe(true);
    });

    it('should return false for simple text', () => {
      expect(isSQLLikeQuery('error message')).toBe(false);
    });

    it('should not detect NOT without space before', () => {
      expect(isSQLLikeQuery('NOTDEBUG')).toBe(false);
    });
  });

  describe('parseSQLQuery', () => {
    it('should return empty for empty input', () => {
      const result = parseSQLQuery('');
      expect(result.isSQL).toBe(false);
      expect(result.regex).toBe('');
    });

    it('should convert AND to regex', () => {
      const result = parseSQLQuery('error AND warning');
      expect(result.isSQL).toBe(true);
      expect(result.regex).toContain('.*');
    });

    it('should convert OR to regex', () => {
      const result = parseSQLQuery('error OR info');
      expect(result.isSQL).toBe(true);
      expect(result.regex).toContain('|');
    });

    it('should return input as-is for non-SQL', () => {
      const result = parseSQLQuery('error message');
      expect(result.isSQL).toBe(false);
      expect(result.regex).toBe('error message');
    });

    it('should handle NOT without space before', () => {
      const result = parseSQLQuery('NOTDEBUG');
      expect(result.isSQL).toBe(false);
    });
  });
});
