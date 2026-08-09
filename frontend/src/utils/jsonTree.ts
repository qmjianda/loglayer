export interface JsonTreeNode {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
  children?: JsonTreeNode[];
}

export function detectJson(text: string): { valid: boolean; data?: any } {
  const trimmed = text.trim();
  if (!trimmed) return { valid: false };

  try {
    const data = JSON.parse(trimmed);
    return { valid: true, data };
  } catch {
    return { valid: false };
  }
}

export function parseJsonToTree(data: any, key: string = 'root'): JsonTreeNode {
  if (data === null) {
    return { key, value: null, type: 'null' };
  }

  if (typeof data === 'string') {
    return { key, value: data, type: 'string' };
  }

  if (typeof data === 'number') {
    return { key, value: data, type: 'number' };
  }

  if (typeof data === 'boolean') {
    return { key, value: data, type: 'boolean' };
  }

  if (Array.isArray(data)) {
    return {
      key,
      value: data.length,
      type: 'array',
      children: data.map((item, index) => parseJsonToTree(item, `[${index}]`)),
    };
  }

  if (typeof data === 'object') {
    return {
      key,
      value: Object.keys(data).length,
      type: 'object',
      children: Object.entries(data).map(([k, v]) => parseJsonToTree(v, k)),
    };
  }

  return { key, value: String(data), type: 'string' };
}
