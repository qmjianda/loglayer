"""
Log Export Layer - 日志导出功能
支持将过滤后的日志导出为 CSV, JSON, TXT 格式

功能特性:
- 支持多种导出格式 (CSV, JSON, TXT)
- 包含元数据信息 (源文件、导出时间、过滤条件等)
- 支持行号、时间戳、高亮信息
- 批量导出优化 (限制最大导出量防止内存溢出)
"""
import os
import json
import csv
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class LogExporter:
    """日志导出器
    
    支持将日志数据导出为多种格式，包含完整的元数据信息
    """
    
    SUPPORTED_FORMATS = ['csv', 'json', 'txt']
    MAX_EXPORT_LINES = 100000  # 防止内存溢出的最大导出行数
    
    def __init__(self, file_id: str, file_path: str):
        self.file_id = file_id
        self.file_path = file_path
        self.file_name = Path(file_path).stem
    
    def export(
        self, 
        lines: List[Dict[str, Any]], 
        output_path: str, 
        format: str = 'txt',
        include_line_numbers: bool = True,
        include_timestamps: bool = False
    ) -> bool:
        """
        导出日志到文件
        
        Args:
            lines: 日志行数据列表，每项包含 {index, content, highlights, ...}
            output_path: 输出文件路径
            format: 导出格式 (csv/json/txt)
            include_line_numbers: 是否包含行号
            include_timestamps: 是否包含时间戳
        
        Returns:
            bool: 导出是否成功
        """
        try:
            format = format.lower()
            if format not in self.SUPPORTED_FORMATS:
                raise ValueError(f"Unsupported format: {format}")
            
            if format == 'csv':
                return self._export_csv(lines, output_path, include_line_numbers)
            elif format == 'json':
                return self._export_json(lines, output_path, include_timestamps)
            elif format == 'txt':
                return self._export_txt(lines, output_path, include_line_numbers)
            
            return False
        except (IOError, OSError) as e:
            logger.error(f"[LogExporter] File operation error: {e}")
            return False
        except ValueError as e:
            logger.error(f"[LogExporter] Invalid value: {e}")
            return False
    
    def _export_csv(self, lines: List[Dict], output_path: str, include_line_numbers: bool) -> bool:
        """导出为 CSV 格式"""
        try:
            with open(output_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                
                # 写入表头
                header = []
                if include_line_numbers:
                    header.append('line_number')
                header.extend(['original_index', 'content'])
                writer.writerow(header)
                
                # 写入数据
                for i, line in enumerate(lines):
                    row = []
                    if include_line_numbers:
                        row.append(i + 1)
                    row.extend([
                        line.get('index', 0),
                        line.get('content', '')
                    ])
                    writer.writerow(row)
            
            return True
        except (IOError, OSError) as e:
            logger.error(f"[LogExporter] CSV file error: {e}")
            return False
        except (csv.Error, ValueError) as e:
            logger.error(f"[LogExporter] CSV data error: {e}")
            return False
    
    def _export_json(self, lines: List[Dict], output_path: str, include_timestamps: bool) -> bool:
        """导出为 JSON 格式
        
        包含完整的元数据信息：
        - 源文件信息
        - 导出时间戳
        - 过滤统计
        - 每行的详细信息 (高亮、书签等)
        """
        try:
            export_data = {
                'metadata': {
                    'source_file': self.file_name,
                    'source_path': self.file_path,
                    'exported_at': datetime.now().isoformat(),
                    'format_version': '1.0',
                    'total_lines': len(lines),
                    'export_limit': self.MAX_EXPORT_LINES,
                    'truncated': len(lines) >= self.MAX_EXPORT_LINES
                },
                'lines': []
            }
            
            # 添加统计信息
            if lines:
                export_data['metadata']['first_line_index'] = lines[0].get('index', 0)
                export_data['metadata']['last_line_index'] = lines[-1].get('index', 0)
            
            for i, line in enumerate(lines):
                line_data = {
                    'line_number': i + 1,
                    'original_index': line.get('index', 0),
                    'content': line.get('content', '')
                }
                
                # 包含高亮信息
                if line.get('highlights'):
                    line_data['highlights'] = line['highlights']
                
                # 包含书签信息
                if line.get('isMarked'):
                    line_data['is_bookmarked'] = True
                    if line.get('bookmarkComment'):
                        line_data['bookmark_comment'] = line['bookmarkComment']
                
                # 包含视觉索引 (如果有过滤)
                if 'visual_index' in line:
                    line_data['visual_index'] = line['visual_index']
                
                export_data['lines'].append(line_data)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)
            
            return True
        except (IOError, OSError) as e:
            logger.error(f"[LogExporter] JSON file error: {e}")
            return False
        except (TypeError, ValueError) as e:
            logger.error(f"[LogExporter] JSON serialization error: {e}")
            return False
    
    def _export_txt(self, lines: List[Dict], output_path: str, include_line_numbers: bool) -> bool:
        """导出为 TXT 格式"""
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                for i, line in enumerate(lines):
                    if include_line_numbers:
                        f.write(f"[{i + 1}] ")
                    f.write(line.get('content', ''))
                    f.write('\n')
            
            return True
        except (IOError, OSError) as e:
            logger.error(f"[LogExporter] TXT file error: {e}")
            return False
    
    def export_visible_lines(
        self, 
        bridge, 
        output_path: str, 
        format: str = 'txt',
        include_line_numbers: bool = True
    ) -> bool:
        """
        导出当前可见的日志行（应用过滤后的结果）
        
        Args:
            bridge: FileBridge 实例
            output_path: 输出文件路径
            format: 导出格式
            include_line_numbers: 是否包含行号
        
        Returns:
            bool: 导出是否成功
        """
        if self.file_id not in bridge._sessions:
            return False
        
        session = bridge._sessions[self.file_id]
        visible_indices = session.visible_indices
        
        if visible_indices is None:
            # 没有过滤，导出所有行
            total_lines = len(session.line_offsets)
            lines_data = []
            for i in range(min(total_lines, 100000)):  # 限制最大导出量
                line_data = self._read_line_data(session, i)
                if line_data:
                    lines_data.append(line_data)
        else:
            # 导出过滤后的可见行
            lines_data = []
            for visual_idx in range(min(len(visible_indices), 100000)):
                physical_idx = visible_indices[visual_idx]
                line_data = self._read_line_data(session, physical_idx)
                if line_data:
                    line_data['visual_index'] = visual_idx
                    lines_data.append(line_data)
        
        return self.export(lines_data, output_path, format, include_line_numbers)
    
    def _read_line_data(self, session, physical_idx: int) -> Optional[Dict]:
        """读取单行数据"""
        try:
            if physical_idx >= len(session.line_offsets):
                return None
            
            start_off = session.line_offsets[physical_idx]
            end_off = (
                session.line_offsets[physical_idx + 1] 
                if physical_idx + 1 < len(session.line_offsets) 
                else session.size
            )
            
            content = session.mmap[start_off:end_off].decode('utf-8', errors='replace').strip()
            
            return {
                'index': physical_idx,
                'content': content
            }
        except (OSError, ValueError, IndexError, UnicodeDecodeError):
            return None


# FastAPI 端点集成
def register_export_endpoints(app):
    """注册导出相关的 API 端点"""
    from fastapi import Body
    from pydantic import BaseModel
    
    class ExportRequest(BaseModel):
        file_id: str
        output_path: str
        format: str = 'txt'
        include_line_numbers: bool = True
    
    @app.post("/api/export_logs")
    def export_logs(data: dict = Body(...)):
        """导出日志文件"""
        from bridge import bridge
        
        file_id = data.get('file_id')
        output_path = data.get('output_path')
        format = data.get('format', 'txt')
        include_line_numbers = data.get('include_line_numbers', True)
        
        if file_id not in bridge._sessions:
            return {'success': False, 'error': 'File not found'}
        
        session = bridge._sessions[file_id]
        exporter = LogExporter(file_id, session.path)
        
        success = exporter.export_visible_lines(
            bridge, 
            output_path, 
            format, 
            include_line_numbers
        )
        
        return {'success': success}
