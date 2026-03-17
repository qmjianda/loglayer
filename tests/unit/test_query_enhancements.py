"""
Test Query Layer Enhancements

Tests for the enhanced QueryParser with:
- Regex patterns (~)
- in/not in operators
- Grouped expressions ( )
- Performance caching
"""

import pytest
from loglayer.layers.builtin.query import QueryParser, QueryLayer
from loglayer.layers.builtin.label import LabelExtractor, LabelLayer


class TestQueryParserEnhancements:
    """Test enhanced query parser features."""
    
    def test_regex_pattern_matching(self):
        """Test regex pattern matching with ~ operator."""
        parser = QueryParser()
        
        # Test basic regex
        conditions = parser.parse("level:~ERROR|WARN")
        assert len(conditions) == 1
        assert conditions[0]['type'] == 'regex'
        assert conditions[0]['field'] == 'level'
        assert conditions[0]['pattern'] == 'ERROR|WARN'
        
        # Test matching
        assert parser.match(conditions, "level=ERROR something")
        assert parser.match(conditions, "level=WARN something")
        assert not parser.match(conditions, "level=INFO something")
    
    def test_regex_with_field_extraction(self):
        """Test regex matching extracts field values correctly."""
        parser = QueryParser()
        conditions = parser.parse("status:~5[0-9]{2}")
        
        assert parser.match(conditions, "status=500 Internal Server Error")
        assert parser.match(conditions, "status:503 Service Unavailable")
        assert not parser.match(conditions, "status=200 OK")
        assert not parser.match(conditions, "status=404 Not Found")
    
    def test_in_operator(self):
        """Test 'in' operator for multiple value matching."""
        parser = QueryParser()
        
        # Test basic in
        conditions = parser.parse("level:in(ERROR, WARN, FATAL)")
        assert len(conditions) == 1
        assert conditions[0]['type'] == 'in'
        assert conditions[0]['field'] == 'level'
        assert conditions[0]['values'] == ['ERROR', 'WARN', 'FATAL']
        
        # Test matching
        assert parser.match(conditions, "level=ERROR")
        assert parser.match(conditions, "level=WARN")
        assert parser.match(conditions, "level=FATAL")
        assert not parser.match(conditions, "level=INFO")
        assert not parser.match(conditions, "level=DEBUG")
    
    def test_not_in_operator(self):
        """Test 'not in' operator for excluding values."""
        parser = QueryParser()
        
        conditions = parser.parse("level:not in(DEBUG, TRACE)")
        assert len(conditions) == 1
        assert conditions[0]['type'] == 'not_in'
        
        # Test matching
        assert parser.match(conditions, "level=ERROR")
        assert parser.match(conditions, "level=INFO")
        assert not parser.match(conditions, "level=DEBUG")
        assert not parser.match(conditions, "level=TRACE")
    
    def test_grouped_expressions(self):
        """Test grouped expressions with parentheses."""
        parser = QueryParser()
        
        # Test simple group
        conditions = parser.parse("(level:ERROR OR level:WARN) AND service:api")
        
        # Should have a group condition
        assert len(conditions) >= 1
        
        # Test matching
        assert parser.match(conditions, "level=ERROR service=api")
        assert parser.match(conditions, "level=WARN service=api")
        assert not parser.match(conditions, "level=ERROR service=web")
        assert not parser.match(conditions, "level=INFO service=api")
    
    def test_nested_groups(self):
        """Test nested grouped expressions."""
        parser = QueryParser()
        
        # Test nested groups
        query = "(level:ERROR OR (level:WARN AND service:api)) AND env:production"
        conditions = parser.parse(query)
        
        # Test matching
        assert parser.match(conditions, "level=ERROR env=production")
        assert parser.match(conditions, "level=WARN service=api env=production")
        assert not parser.match(conditions, "level=WARN env=production")  # Missing service:api
        assert not parser.match(conditions, "level=ERROR env=staging")  # Wrong env
    
    def test_complex_query(self):
        """Test complex query with multiple features."""
        parser = QueryParser()
        
        query = 'level:in(ERROR, FATAL) AND (service:~api.* OR host:~prod-\\d+) AND NOT env:dev'
        conditions = parser.parse(query)
        
        # Test matching
        assert parser.match(conditions, "level=ERROR service=api-v1 host=prod-1 env=production")
        assert parser.match(conditions, "level=FATAL service=api host=prod-5 env=staging")
        assert not parser.match(conditions, "level=ERROR service=web env=production")  # Wrong service
        assert not parser.match(conditions, "level=ERROR service=api env=dev")  # Excluded by NOT
    
    def test_regex_cache(self):
        """Test regex pattern caching for performance."""
        parser = QueryParser()
        
        # Parse and match to populate cache
        conditions = parser.parse("level:~ERROR")
        parser.match(conditions, "level=ERROR")
        
        # Parse and match again
        conditions = parser.parse("level:~ERROR")
        parser.match(conditions, "level=ERROR")
        
        # Cache should have the pattern (with ~ prefix in key)
        assert "level:~ERROR" in parser.regex_cache
    
    def test_quoted_values_in_in_operator(self):
        """Test in operator with quoted values."""
        parser = QueryParser()
        
        conditions = parser.parse('status:in("500", "502", "503")')
        assert conditions[0]['values'] == ['500', '502', '503']
        
        assert parser.match(conditions, "status=500")
        assert parser.match(conditions, "status=502")
        assert not parser.match(conditions, "status=200")


class TestLabelExtractor:
    """Test label extraction functionality."""
    
    def test_extract_key_value_equals(self):
        """Test extracting key=value format."""
        extractor = LabelExtractor()
        
        labels = extractor.extract("level=ERROR service=api user_id=123")
        
        assert labels['level'] == 'ERROR'
        assert labels['service'] == 'api'
        assert labels['user_id'] == '123'
    
    def test_extract_json_format(self):
        """Test extracting JSON format labels."""
        extractor = LabelExtractor()
        
        line = '{"level": "ERROR", "service": "api", "status_code": 500}'
        labels = extractor.extract(line)
        
        assert labels['level'] == 'ERROR'
        assert labels['service'] == 'api'
        assert labels['status_code'] == '500'
    
    def test_extract_colon_format(self):
        """Test extracting key:value format."""
        extractor = LabelExtractor()
        
        labels = extractor.extract("level:ERROR service:api host:prod-1")
        
        assert labels['level'] == 'ERROR'
        assert labels['service'] == 'api'
        assert labels['host'] == 'prod-1'
    
    def test_extract_mixed_formats(self):
        """Test extracting mixed format labels."""
        extractor = LabelExtractor()
        
        line = "level=ERROR {\"service\": \"api\", \"user_id\": 123} host:prod-1"
        labels = extractor.extract(line)
        
        assert labels['level'] == 'ERROR'
        assert labels['service'] == 'api'
        assert labels['user_id'] == '123'
        assert labels['host'] == 'prod-1'
    
    def test_extract_for_field(self):
        """Test extracting specific field."""
        extractor = LabelExtractor()
        
        line = "level=ERROR service=api user_id=123"
        
        assert extractor.extract_for_field(line, 'level') == 'ERROR'
        assert extractor.extract_for_field(line, 'service') == 'api'
        assert extractor.extract_for_field(line, 'user_id') == '123'
        assert extractor.extract_for_field(line, 'nonexistent') is None
    
    def test_case_insensitive_keys(self):
        """Test that keys are normalized to lowercase."""
        extractor = LabelExtractor()
        
        labels = extractor.extract("LEVEL=ERROR Service=api USER_ID=123")
        
        assert 'level' in labels
        assert 'service' in labels
        assert 'user_id' in labels
        assert 'LEVEL' not in labels


class TestLabelLayer:
    """Test label filtering layer."""
    
    def test_exact_match_filter(self):
        """Test exact match label filtering."""
        layer = LabelLayer()
        layer.labels = "level=ERROR"
        layer._parse_filters()
        
        assert layer.filter_line("level=ERROR service=api")
        assert not layer.filter_line("level=INFO service=api")
    
    def test_regex_filter(self):
        """Test regex label filtering."""
        layer = LabelLayer()
        layer.labels = "service=~api.*"
        layer._parse_filters()
        
        assert layer.filter_line("level=INFO service=api-v1")
        assert layer.filter_line("level=INFO service=api-gateway")
        assert not layer.filter_line("level=INFO service=web")
    
    def test_multiple_filters_and(self):
        """Test multiple filters with AND."""
        layer = LabelLayer()
        layer.labels = "level=ERROR AND service=api"
        layer._parse_filters()
        
        assert layer.filter_line("level=ERROR service=api")
        assert not layer.filter_line("level=ERROR service=web")
        assert not layer.filter_line("level=INFO service=api")
    
    def test_multiple_filters_or(self):
        """Test multiple filters with OR."""
        layer = LabelLayer()
        layer.labels = "level=ERROR OR level=FATAL"
        layer._parse_filters()
        
        assert layer.filter_line("level=ERROR")
        assert layer.filter_line("level=FATAL")
        assert not layer.filter_line("level=INFO")
    
    def test_get_extracted_labels(self):
        """Test getting extracted labels."""
        layer = LabelLayer()
        
        labels = layer.get_extracted_labels("level=ERROR service=api user_id=123")
        
        assert labels['level'] == 'ERROR'
        assert labels['service'] == 'api'
        assert labels['user_id'] == '123'


class TestQueryLayerIntegration:
    """Test QueryLayer integration."""
    
    def test_query_layer_regex(self):
        """Test QueryLayer with regex patterns."""
        layer = QueryLayer()
        layer.query = "level:~ERROR|WARN|FATAL"
        
        assert layer.filter_line("level=ERROR something")
        assert layer.filter_line("level=WARN something")
        assert layer.filter_line("level=FATAL something")
        assert not layer.filter_line("level=INFO something")
    
    def test_query_layer_in_operator(self):
        """Test QueryLayer with in operator."""
        layer = QueryLayer()
        layer.query = "level:in(ERROR, WARN, FATAL)"
        
        assert layer.filter_line("level=ERROR")
        assert layer.filter_line("level=WARN")
        assert layer.filter_line("level=FATAL")
        assert not layer.filter_line("level=INFO")
    
    def test_query_layer_reset_clears_cache(self):
        """Test that reset clears regex cache."""
        layer = QueryLayer()
        layer.query = "level:~ERROR"
        layer.filter_line("level=ERROR")
        
        # Check cache has entries
        assert len(layer.parser.regex_cache) > 0
        
        # Reset should clear cache
        layer.reset()
        assert len(layer.parser.regex_cache) == 0
    
    def test_query_layer_get_stats(self):
        """Test getting query statistics."""
        layer = QueryLayer()
        layer.query = "level:~ERROR"
        
        stats = layer.get_query_stats()
        
        assert 'regex_cache_size' in stats
        assert 'pattern_hits' in stats
        assert 'pattern_misses' in stats
