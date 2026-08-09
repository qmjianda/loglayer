export interface SQLQueryResult {
  isSQL: boolean;
  regex: string;
  error?: string;
}

export function isSQLLikeQuery(input: string): boolean {
  if (!input) return false;
  const sqlPatterns = [
    /\s+=\s+/,
    /\s+AND\s+/i,
    /\s+OR\s+/i,
    /\s+NOT\s+/i,
    /\s+CONTAINS\s+/i,
    /\s+LIKE\s+/i,
    /\s+IN\s+\(/i,
  ];
  return sqlPatterns.some((pattern) => pattern.test(input));
}

export function parseSQLQuery(input: string): SQLQueryResult {
  if (!input) {
    return { isSQL: false, regex: '' };
  }

  if (!isSQLLikeQuery(input)) {
    return { isSQL: false, regex: input };
  }

  try {
    let regex = input;

    regex = regex.replace(/\s+AND\s+/gi, '.*');
    regex = regex.replace(/\s+OR\s+/gi, '|');

    regex = regex.replace(/\s+NOT\s+(\S+)/gi, '(?!.*$1)');

    regex = regex.replace(/(\w+)\s*=\s*(\S+)/g, '($1[:\\s]+$2|$2)');
    regex = regex.replace(/(\w+)\s+CONTAINS\s+(\S+)/gi, '($1.*$2|$2)');
    regex = regex.replace(/(\w+)\s+LIKE\s+(\S+)/gi, '($1.*$2|$2)');

    regex = regex.replace(/\s+/g, '');

    new RegExp(regex);

    return { isSQL: true, regex };
  } catch (e) {
    return {
      isSQL: true,
      regex: '',
      error: e instanceof Error ? e.message : 'Invalid SQL-like query',
    };
  }
}
