"""
Query Layer - KQL-like Query Language for Log Filtering

Inspired by Elasticsearch's Kibana Query Language (KQL) and Loki's LogQL.
Provides a simple yet powerful query syntax for filtering logs.

Supported syntax:
- Field:value - Match field containing value (e.g., level:ERROR)
- "exact phrase" - Match exact phrase
- AND, OR, NOT - Boolean operators
- * - Wildcard (e.g., error*)
- exists(field) - Check if field exists
- range comparisons: field>value, field<value, field>=value, field<=value
- ~regex - Regex pattern matching (e.g., level:~ERROR|WARN)
- in (val1, val2) - Match multiple values (e.g., level:in(ERROR, WARN))
- not in (val1, val2) - Exclude multiple values
- ( ) - Grouping for complex boolean logic

Examples:
- level:ERROR AND service:api
- "connection timeout" OR "connection refused"
- NOT level:DEBUG
- status_code:>=500
- exists(user_id)
- level:in(ERROR, FATAL, CRITICAL)
- message:~error.*timeout
- (level:ERROR OR level:WARN) AND service:api
"""

import re
from typing import List, Dict, Optional, Any, Tuple
from loglayer.core import FilterLayer, LayerCategory, LayerStage
from loglayer.ui import StrInput, BoolInput


# Common field patterns
FIELD_PATTERNS = {
    # JSON-like fields: "field": "value" or field: value
    'json_field': r'(?P<field>"?\w+"?)\s*:\s*"(?P<value>[^"]*)"',
    'simple_field': r'(?P<field>\w+):\s*(?P<value>\S+)',
    # Log level patterns
    'level': r'\b(?P<level>FATAL|ERROR|WARN|WARNING|INFO|DEBUG|TRACE|NOTICE)\b',
    # Timestamp patterns (ISO8601, Unix, etc.)
    'timestamp_iso': r'(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})',
    'timestamp_unix': r'\b(\d{10,13})\b',
    # IP addresses
    'ip_address': r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b',
    # HTTP status codes
    'http_status': r'\b([1-5][0-9]{2})\b',
    # Email addresses
    'email': r'\b([\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})\b',
    # URLs
    'url': r'\b(https?://[\w./?=&_-]+)\b',
}


class QueryParser:
    """
    Parse KQL-like query strings into executable conditions.
    
    Grammar:
        query       = expression (OR expression)*
        expression  = term (AND term)*
        term        = NOT? condition
        condition   = field_condition | phrase | wildcard | exists | range | regex | in_list | grouped
        field_condition = field ":" value
        phrase      = '"' text '"'
        wildcard    = text '*' text
        exists      = 'exists' '(' field ')'
        range       = field (">=" | "<=" | ">" | "<") value
        regex       = field ":~" pattern
        in_list     = field ":in" "(" value ("," value)* ")"
        grouped     = "(" query ")"
    """
    
    MAX_REGEX_CACHE_SIZE = 100  # Limit cache size to prevent memory growth
    
    def __init__(self):
        self.field_cache: Dict[str, re.Pattern] = {}
        self.regex_cache: Dict[str, re.Pattern] = {}
        self._pattern_hits = 0
        self._pattern_misses = 0
    
    def parse(self, query: str) -> List[Dict[str, Any]]:
        """
        Parse query string into list of conditions.
        
        Returns:
            List of condition dicts with keys:
            - type: 'field', 'phrase', 'wildcard', 'exists', 'range', 'text'
            - field: (optional) field name
            - value: value to match
            - operator: (optional) 'and', 'or', 'not'
            - comparison: (optional) for range: '>=', '<=', '>', '<'
        """
        if not query or not query.strip():
            return []
        
        conditions = []
        query = query.strip()
        
        # Tokenize
        tokens = self._tokenize(query)
        
        # Parse tokens into conditions
        i = 0
        current_op = 'and'
        
        while i < len(tokens):
            token = tokens[i]
            
            # Handle boolean operators
            if token.upper() == 'AND':
                current_op = 'and'
                i += 1
                continue
            elif token.upper() == 'OR':
                current_op = 'or'
                i += 1
                continue
            elif token.upper() == 'NOT':
                current_op = 'not'
                i += 1
                continue
            
            # Parse condition
            condition = self._parse_condition(tokens, i)
            if condition:
                condition['operator'] = current_op
                conditions.append(condition)
                current_op = 'and'  # Reset to default
                i += condition.get('tokens_consumed', 1)
            else:
                i += 1
        
        return conditions
    
    def _tokenize(self, query: str) -> List[str]:
        """Tokenize query string, respecting quotes and parentheses."""
        tokens = []
        current = ''
        in_quotes = False
        paren_depth = 0
        
        i = 0
        while i < len(query):
            char = query[i]
            
            if char == '"' and (i == 0 or query[i-1] != '\\'):
                in_quotes = not in_quotes
                current += char
            elif char == '(':
                paren_depth += 1
                current += char
            elif char == ')':
                paren_depth -= 1
                current += char
            elif char in ' \t' and not in_quotes and paren_depth == 0:
                if current:
                    tokens.append(current)
                    current = ''
            else:
                current += char
            
            i += 1
        
        if current:
            tokens.append(current)
        
        return tokens
    
    def _parse_condition(self, tokens: List[str], index: int) -> Optional[Dict[str, Any]]:
        """Parse a single condition from tokens starting at index."""
        if index >= len(tokens):
            return None
        
        token = tokens[index]
        
        # Grouped expression: ( ... )
        if token.startswith('('):
            # Find matching closing paren
            depth = 0
            end_idx = index
            for i in range(index, len(tokens)):
                t = tokens[i]
                depth += t.count('(') - t.count(')')
                if depth == 0:
                    end_idx = i
                    break
            
            # Extract inner tokens and parse as sub-query
            inner_tokens = tokens[index:end_idx+1]
            # Remove outer parens
            if inner_tokens:
                inner_tokens[0] = inner_tokens[0][1:]  # Remove leading (
                if inner_tokens[-1].endswith(')'):
                    inner_tokens[-1] = inner_tokens[-1][:-1]  # Remove trailing )
            
            # Parse inner expression
            inner_conditions = self.parse(' '.join(inner_tokens))
            return {
                'type': 'group',
                'conditions': inner_conditions,
                'tokens_consumed': end_idx - index + 1
            }
        
        # exists(field) syntax
        if token.startswith('exists(') and token.endswith(')'):
            field = token[7:-1].strip('"\'')
            return {
                'type': 'exists',
                'field': field,
                'tokens_consumed': 1
            }
        
        # Field:value syntax
        if ':' in token and not token.startswith('"'):
            parts = token.split(':', 1)
            field = parts[0]
            value = parts[1] if len(parts) > 1 else ''
            
            # Check for in/not in operators (handle both "in(...)" and "not in(...)")
            if value.startswith('in(') and value.endswith(')'):
                values_str = value[3:-1]
                values = [v.strip().strip('"\'') for v in values_str.split(',')]
                return {
                    'type': 'in',
                    'field': field,
                    'values': values,
                    'tokens_consumed': 1
                }
            elif value.startswith('not in(') and value.endswith(')'):
                values_str = value[7:-1]
                values = [v.strip().strip('"\'') for v in values_str.split(',')]
                return {
                    'type': 'not_in',
                    'field': field,
                    'values': values,
                    'tokens_consumed': 1
                }
            # Handle case where "not" and "in" are separate tokens (e.g., "level:not in(...)")
            elif value == 'not' and index + 1 < len(tokens) and tokens[index + 1].startswith('in('):
                next_token = tokens[index + 1]
                if next_token.endswith(')'):
                    values_str = next_token[3:-1]
                    values = [v.strip().strip('"\'') for v in values_str.split(',')]
                    return {
                        'type': 'not_in',
                        'field': field,
                        'values': values,
                        'tokens_consumed': 2
                    }
            
            # Check for regex pattern (~)
            if value.startswith('~'):
                pattern = value[1:]
                return {
                    'type': 'regex',
                    'field': field,
                    'pattern': pattern,
                    'tokens_consumed': 1
                }
            
            # Check for range operators in value
            for op in ['>=', '<=', '>', '<']:
                if op in value:
                    val_parts = value.split(op, 1)
                    return {
                        'type': 'range',
                        'field': field,
                        'comparison': op,
                        'value': val_parts[1] if len(val_parts) > 1 else '',
                        'tokens_consumed': 1
                    }
            
            # Handle wildcards
            if '*' in value:
                return {
                    'type': 'wildcard',
                    'field': field,
                    'value': value,
                    'tokens_consumed': 1
                }
            
            return {
                'type': 'field',
                'field': field,
                'value': value,
                'tokens_consumed': 1
            }
        
        # Phrase (quoted text)
        if token.startswith('"') and token.endswith('"'):
            return {
                'type': 'phrase',
                'value': token[1:-1],
                'tokens_consumed': 1
            }
        
        # Wildcard text
        if '*' in token:
            return {
                'type': 'wildcard',
                'value': token,
                'tokens_consumed': 1
            }
        
        # Plain text search
        return {
            'type': 'text',
            'value': token,
            'tokens_consumed': 1
        }
    
    def match(self, conditions: List[Dict[str, Any]], line: str, index: int = -1) -> bool:
        """
        Check if a line matches all conditions.
        
        Args:
            conditions: Parsed conditions from parse()
            line: Log line content
            index: Line index (optional)
            
        Returns:
            True if line matches, False otherwise
        """
        if not conditions:
            return True  # No conditions = match all
        
        for i, cond in enumerate(conditions):
            matches = self._match_condition(cond, line, index)
            
            # Apply boolean logic
            if cond.get('operator') == 'not':
                matches = not matches
            
            if i == 0:
                result = matches
            elif cond.get('operator') == 'or':
                result = result or matches
            else:  # and
                result = result and matches
        
        return result if conditions else True
    
    def _match_condition(self, cond: Dict[str, Any], line: str, index: int) -> bool:
        """Match a single condition against a line."""
        cond_type = cond.get('type')
        
        if cond_type == 'text':
            return cond['value'].lower() in line.lower()
        
        elif cond_type == 'phrase':
            return cond['value'] in line
        
        elif cond_type == 'wildcard':
            pattern = cond['value'].replace('*', '.*')
            return bool(re.search(pattern, line, re.IGNORECASE))
        
        elif cond_type == 'field':
            field = cond['field']
            value = cond['value']
            # Try to find field:value pattern in line
            field_pattern = rf'{re.escape(field)}\s*[:=]\s*["\']?{re.escape(value)}["\']?'
            if re.search(field_pattern, line, re.IGNORECASE):
                return True
            # Also try simple containment for common fields
            if field.lower() in ['level', 'loglevel', 'severity']:
                return value.lower() in line.lower()
            return False
        
        elif cond_type == 'exists':
            field = cond['field']
            # Check if field name appears in line
            return bool(re.search(rf'\b{re.escape(field)}\b[:=]', line, re.IGNORECASE))
        
        elif cond_type == 'range':
            field = cond['field']
            comparison = cond['comparison']
            value = cond['value']
            
            # Try to extract numeric value for field
            field_pattern = rf'{re.escape(field)}\s*[:=]\s*(\d+(?:\.\d+)?)'
            match = re.search(field_pattern, line)
            if match:
                line_value = float(match.group(1))
                try:
                    compare_value = float(value)
                    if comparison == '>':
                        return line_value > compare_value
                    elif comparison == '>=':
                        return line_value >= compare_value
                    elif comparison == '<':
                        return line_value < compare_value
                    elif comparison == '<=':
                        return line_value <= compare_value
                except ValueError:
                    pass
            return False
        
        elif cond_type == 'regex':
            field = cond['field']
            pattern_str = cond['pattern']
            
            # Use cached regex pattern with LRU eviction
            cache_key = f"{field}:~{pattern_str}"
            if cache_key not in self.regex_cache:
                try:
                    # Evict oldest entry if cache is full
                    if len(self.regex_cache) >= self.MAX_REGEX_CACHE_SIZE:
                        # Remove first (oldest) item
                        oldest_key = next(iter(self.regex_cache))
                        del self.regex_cache[oldest_key]
                    self.regex_cache[cache_key] = re.compile(pattern_str, re.IGNORECASE)
                except re.error:
                    return False
            
            pattern = self.regex_cache[cache_key]
            
            # Try to find field:value pattern and match against value
            field_pattern = rf'{re.escape(field)}\s*[:=]\s*["\']?([^"\'\s,]+)["\']?'
            match = re.search(field_pattern, line, re.IGNORECASE)
            if match:
                field_value = match.group(1)
                return bool(pattern.search(field_value))
            
            # Also try matching against entire line for common fields
            if field.lower() in ['level', 'loglevel', 'severity', 'message', 'msg']:
                return bool(pattern.search(line))
            
            return False
        
        elif cond_type == 'in':
            field = cond['field']
            values = cond['values']
            
            # Try to find field:value pattern in line
            field_pattern = rf'{re.escape(field)}\s*[:=]\s*["\']?([^"\'\s,]+)["\']?'
            match = re.search(field_pattern, line, re.IGNORECASE)
            if match:
                field_value = match.group(1).lower()
                return any(v.lower() == field_value for v in values)
            
            # Also try simple containment for common fields
            if field.lower() in ['level', 'loglevel', 'severity']:
                line_lower = line.lower()
                return any(v.lower() in line_lower for v in values)
            
            return False
        
        elif cond_type == 'not_in':
            field = cond['field']
            values = cond['values']
            
            # Try to find field:value pattern in line
            field_pattern = rf'{re.escape(field)}\s*[:=]\s*["\']?([^"\'\s,]+)["\']?'
            match = re.search(field_pattern, line, re.IGNORECASE)
            if match:
                field_value = match.group(1).lower()
                return not any(v.lower() == field_value for v in values)
            
            # Also try simple containment for common fields
            if field.lower() in ['level', 'loglevel', 'severity']:
                line_lower = line.lower()
                return not any(v.lower() in line_lower for v in values)
            
            return True  # Field not found, so not in list
        
        elif cond_type == 'group':
            # Evaluate grouped conditions
            sub_conditions = cond.get('conditions', [])
            return self.match(sub_conditions, line, index)
        
        return False


class QueryLayer(FilterLayer):
    """
    Query layer for KQL-like filtering.
    
    Provides a powerful query language for filtering logs based on:
    - Field matching (field:value)
    - Boolean operators (AND, OR, NOT)
    - Wildcards (*)
    - Phrase matching ("exact phrase")
    - Existence checks (exists(field))
    - Range comparisons (field>value)
    """
    
    display_name = "查询图层"
    description = "使用 KQL 类似语法进行高级查询过滤"
    icon = "search-query"
    category = LayerCategory.FILTERING
    stage = LayerStage.LOGIC
    
    inputs = [
        StrInput("query", "查询语句", 
                  info="支持: field:value, AND/OR/NOT, \"短语\", *, exists(field), field>value",
                  placeholder="level:ERROR AND service:api"),
        BoolInput("case_sensitive", "区分大小写", value=False),
    ]
    
    def __init__(self):
        super().__init__()
        self.parser = QueryParser()
        self._compiled_conditions = None
    
    def filter_line(self, content: str, index: int = -1) -> bool:
        """Filter line based on query."""
        if not hasattr(self, 'query') or not self.query:
            return True
        
        if self._compiled_conditions is None:
            self._compiled_conditions = self.parser.parse(self.query)
        
        return self.parser.match(self._compiled_conditions, content, index)
    
    def reset(self):
        """Reset compiled conditions when query changes."""
        self._compiled_conditions = None
        # Clear parser caches
        if hasattr(self, 'parser'):
            self.parser.regex_cache.clear()
            self.parser._pattern_hits = 0
            self.parser._pattern_misses = 0
    
    def get_display_summary(self) -> str:
        """Return human-readable query summary."""
        if not hasattr(self, 'query') or not self.query:
            return "无查询"
        return f"查询：{self.query[:50]}{'...' if len(self.query) > 50 else ''}"
    
    def get_query_stats(self) -> dict:
        """Return query performance statistics."""
        if hasattr(self, 'parser'):
            return {
                'regex_cache_size': len(self.parser.regex_cache),
                'pattern_hits': self.parser._pattern_hits,
                'pattern_misses': self.parser._pattern_misses,
            }
        return {}
