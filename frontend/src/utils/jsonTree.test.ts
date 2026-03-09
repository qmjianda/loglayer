import { describe, it, expect } from 'vitest';
import { detectJson, parseJsonToTree, type JsonTreeNode } from '../utils/jsonTree';

describe('utils/jsonTree', () => {
  describe('detectJson', () => {
    it('should detect valid JSON object', () => {
      const result = detectJson('{"key": "value"}');
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });

    it('should detect valid JSON array', () => {
      const result = detectJson('[1, 2, 3]');
      expect(result.valid).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('should detect invalid JSON', () => {
      const result = detectJson('not json');
      expect(result.valid).toBe(false);
    });

    it('should handle empty string', () => {
      const result = detectJson('');
      expect(result.valid).toBe(false);
    });

    it('should handle whitespace-only string', () => {
      const result = detectJson('   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('parseJsonToTree', () => {
    it('should parse null value', () => {
      const result = parseJsonToTree(null, 'test');
      expect(result).toEqual({ key: 'test', value: null, type: 'null' });
    });

    it('should parse string value', () => {
      const result = parseJsonToTree('hello', 'greeting');
      expect(result).toEqual({ key: 'greeting', value: 'hello', type: 'string' });
    });

    it('should parse number value', () => {
      const result = parseJsonToTree(42, 'answer');
      expect(result).toEqual({ key: 'answer', value: 42, type: 'number' });
    });

    it('should parse boolean value', () => {
      const result = parseJsonToTree(true, 'flag');
      expect(result).toEqual({ key: 'flag', value: true, type: 'boolean' });
    });

    it('should parse object with children', () => {
      const result = parseJsonToTree({ a: 1, b: 2 }, 'root');
      expect(result.type).toBe('object');
      expect(result.value).toBe(2);
      expect(result.children).toHaveLength(2);
    });

    it('should parse array with children', () => {
      const result = parseJsonToTree([1, 2, 3], 'list');
      expect(result.type).toBe('array');
      expect(result.value).toBe(3);
      expect(result.children).toHaveLength(3);
    });

    it('should use default root key', () => {
      const result = parseJsonToTree({});
      expect(result.key).toBe('root');
    });

    it('should handle nested objects', () => {
      const result = parseJsonToTree({ nested: { depth: 1 } }, 'root');
      const nested = result.children?.find((c) => c.key === 'nested');
      expect(nested?.type).toBe('object');
      expect(nested?.children?.[0]?.key).toBe('depth');
    });
  });
});
