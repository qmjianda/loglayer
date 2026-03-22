#!/usr/bin/env python3
"""
LogLayer AI Assistant - 智能测试优化建议系统

功能:
- 分析测试覆盖率并识别薄弱环节
- 基于代码变更智能推荐新测试用例
- 生成测试质量报告
- 提供测试优化建议

使用场景:
- CI/CD 流水线中的测试质量检查
- 开发过程中的测试覆盖率分析
- 代码审查时的测试完整性验证

用法:
    python tools/ai_test_optimizer.py                    # 运行完整分析
    python tools/ai_test_optimizer.py --coverage         # 仅覆盖率分析
    python tools/ai_test_optimizer.py --recommend        # 生成测试建议
    python tools/ai_test_optimizer.py --report           # 生成质量报告
"""

import json
import os
import sys
import subprocess
from pathlib import Path
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import re


class Priority(Enum):
    """测试建议优先级"""
    CRITICAL = "critical"  # 关键功能缺少测试
    HIGH = "high"          # 重要功能测试不足
    MEDIUM = "medium"      # 一般功能需要补充
    LOW = "low"            # 可选优化


@dataclass
class TestGap:
    """测试缺口分析"""
    file_path: str
    function_name: str
    line_number: int
    has_test: bool
    test_coverage: float  # 0-100
    priority: Priority
    suggestion: str
    estimated_effort: str  # "low", "medium", "high"


@dataclass
class CoverageReport:
    """覆盖率报告"""
    total_files: int
    tested_files: int
    total_functions: int
    tested_functions: int
    coverage_percentage: float
    gaps: List[TestGap] = field(default_factory=list)


@dataclass
class TestRecommendation:
    """测试推荐"""
    title: str
    description: str
    priority: Priority
    affected_files: List[str]
    suggested_tests: List[str]
    code_example: Optional[str] = None


class AITestOptimizer:
    """AI 测试优化器"""
    
    def __init__(self, project_root: str = None):
        self.project_root = Path(project_root) if project_root else Path(__file__).parent.parent
        self.test_dir = self.project_root / "e2e"
        self.unit_test_dir = self.project_root / "tests"
        self.frontend_dir = self.project_root / "frontend"
        self.backend_dir = self.project_root / "backend"
        
    def analyze_coverage(self) -> CoverageReport:
        """分析测试覆盖率"""
        print("🔍 分析测试覆盖率...")
        
        # 收集所有源文件
        source_files = self._collect_source_files()
        test_files = self._collect_test_files()
        
        # 映射源文件到测试文件
        file_mapping = self._map_tests_to_sources(source_files, test_files)
        
        # 计算覆盖率
        tested_files = sum(1 for f in source_files if file_mapping.get(f, []))
        coverage = (tested_files / len(source_files) * 100) if source_files else 0
        
        # 识别测试缺口
        gaps = self._identify_gaps(source_files, file_mapping)
        
        report = CoverageReport(
            total_files=len(source_files),
            tested_files=tested_files,
            total_functions=len(source_files),  # Simplified
            tested_functions=tested_files,
            coverage_percentage=coverage,
            gaps=gaps[:20]  # Top 20 gaps
        )
        
        return report
    
    def _collect_source_files(self) -> List[Path]:
        """收集所有源文件"""
        source_files = []
        
        # 前端 TypeScript/React 文件
        if self.frontend_dir.exists():
            source_files.extend(self.frontend_dir.rglob("*.ts"))
            source_files.extend(self.frontend_dir.rglob("*.tsx"))
        
        # 后端 Python 文件
        if self.backend_dir.exists():
            source_files.extend(self.backend_dir.rglob("*.py"))
        
        # 排除测试文件、配置文件等
        exclude_patterns = ['test', 'spec', '__pycache__', 'node_modules', '.git']
        source_files = [
            f for f in source_files 
            if not any(p in str(f) for p in exclude_patterns)
        ]
        
        return source_files
    
    def _collect_test_files(self) -> List[Path]:
        """收集所有测试文件"""
        test_files = []
        
        # E2E 测试
        if self.test_dir.exists():
            test_files.extend(self.test_dir.rglob("*.test.ts"))
        
        # 单元测试
        if self.unit_test_dir.exists():
            test_files.extend(self.unit_test_dir.rglob("test_*.py"))
            test_files.extend(self.unit_test_dir.rglob("*_test.py"))
        
        return test_files
    
    def _map_tests_to_sources(self, source_files: List[Path], test_files: List[Path]) -> Dict[str, List[str]]:
        """映射测试文件到源文件"""
        mapping = {}
        
        for source in source_files:
            source_name = source.stem
            related_tests = []
            
            for test in test_files:
                test_name = test.stem
                # 简单的名称匹配逻辑
                if source_name in test_name or self._semantic_match(source_name, test_name):
                    related_tests.append(str(test))
            
            mapping[str(source)] = related_tests
        
        return mapping
    
    def _semantic_match(self, source: str, test: str) -> bool:
        """语义匹配（简化版）"""
        # 移除常见后缀
        source_clean = source.lower().replace('component', '').replace('service', '')
        test_clean = test.lower().replace('test', '').replace('spec', '')
        
        return source_clean == test_clean or source_clean in test_clean
    
    def _identify_gaps(self, source_files: List[Path], mapping: Dict[str, List[str]]) -> List[TestGap]:
        """识别测试缺口"""
        gaps = []
        
        for source in source_files:
            tests = mapping.get(str(source), [])
            has_test = len(tests) > 0
            
            if not has_test:
                # 分析文件内容确定优先级
                priority = self._analyze_file_priority(source)
                
                gaps.append(TestGap(
                    file_path=str(source.relative_to(self.project_root)),
                    function_name=self._extract_main_function(source),
                    line_number=self._count_lines(source),
                    has_test=False,
                    test_coverage=0.0,
                    priority=priority,
                    suggestion=f"为 {source.name} 添加测试覆盖",
                    estimated_effort=self._estimate_effort(source)
                ))
        
        # 按优先级排序
        priority_order = {Priority.CRITICAL: 0, Priority.HIGH: 1, Priority.MEDIUM: 2, Priority.LOW: 3}
        gaps.sort(key=lambda g: priority_order[g.priority])
        
        return gaps
    
    def _analyze_file_priority(self, file_path: Path) -> Priority:
        """分析文件优先级"""
        path_str = str(file_path).lower()
        
        # 关键文件
        if any(k in path_str for k in ['bridge', 'websocket', 'main', 'auth']):
            return Priority.CRITICAL
        
        # 重要组件
        if any(k in path_str for k in ['component', 'service', 'hook', 'api']):
            return Priority.HIGH
        
        # 工具函数
        if 'util' in path_str or 'helper' in path_str:
            return Priority.MEDIUM
        
        return Priority.LOW
    
    def _extract_main_function(self, file_path: Path) -> str:
        """提取主要函数名（简化版）"""
        try:
            content = file_path.read_text(encoding='utf-8')
            
            # Python: 查找主要函数/类
            if file_path.suffix == '.py':
                match = re.search(r'(?:def|class)\s+(\w+)', content)
                if match:
                    return match.group(1)
            
            # TypeScript: 查找主要导出
            elif file_path.suffix in ['.ts', '.tsx']:
                match = re.search(r'(?:export\s+)?(?:function|class|const)\s+(\w+)', content)
                if match:
                    return match.group(1)
        except:
            pass
        
        return file_path.stem
    
    def _count_lines(self, file_path: Path) -> int:
        """计算文件行数"""
        try:
            return len(file_path.read_text(encoding='utf-8').splitlines())
        except:
            return 0
    
    def _estimate_effort(self, file_path: Path) -> str:
        """估算测试工作量"""
        try:
            lines = self._count_lines(file_path)
            
            if lines < 100:
                return "low"
            elif lines < 300:
                return "medium"
            else:
                return "high"
        except:
            return "medium"
    
    def generate_recommendations(self, coverage_report: CoverageReport) -> List[TestRecommendation]:
        """生成测试建议"""
        recommendations = []
        
        # 基于缺口生成建议
        critical_gaps = [g for g in coverage_report.gaps if g.priority == Priority.CRITICAL]
        if critical_gaps:
            recommendations.append(TestRecommendation(
                title="关键功能测试覆盖",
                description=f"发现 {len(critical_gaps)} 个关键功能缺少测试覆盖，建议优先补充",
                priority=Priority.CRITICAL,
                affected_files=[g.file_path for g in critical_gaps[:5]],
                suggested_tests=[
                    f"为 {g.function_name} 添加单元测试",
                    f"为 {g.function_name} 添加集成测试",
                    f"为 {g.function_name} 添加边界条件测试"
                ],
                code_example=self._generate_test_example(critical_gaps[0])
            ))
        
        # 覆盖率提升建议
        if coverage_report.coverage_percentage < 80:
            recommendations.append(TestRecommendation(
                title="整体覆盖率提升",
                description=f"当前测试覆盖率为 {coverage_report.coverage_percentage:.1f}%，建议提升至 80% 以上",
                priority=Priority.HIGH,
                affected_files=[g.file_path for g in coverage_report.gaps[:10]],
                suggested_tests=[
                    "为核心业务逻辑添加单元测试",
                    "为公共组件添加快照测试",
                    "为 API 接口添加集成测试"
                ]
            ))
        
        return recommendations
    
    def _generate_test_example(self, gap: TestGap) -> str:
        """生成测试示例代码"""
        if gap.file_path.endswith('.py'):
            return f'''
# 测试示例：{gap.function_name}
import pytest

def test_{gap.function_name}_basic():
    """测试基本功能"""
    # TODO: 实现测试逻辑
    pass

def test_{gap.function_name}_edge_cases():
    """测试边界条件"""
    # TODO: 实现边界测试
    pass
'''
        else:
            return f'''
// 测试示例：{gap.function_name}
import {{ test, expect }} from '@playwright/test';

test.describe('{gap.function_name}', () => {{
  test('应该正常工作', async ({{ page }}) => {{
    // TODO: 实现测试逻辑
  }});
  
  test('应该处理错误情况', async ({{ page }}) => {{
    // TODO: 实现错误处理测试
  }});
}});
'''
    
    def generate_report(self, coverage: CoverageReport, recommendations: List[TestRecommendation]) -> str:
        """生成质量报告"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        report = f"""# LogLayer 测试质量报告

**生成时间**: {timestamp}

## 📊 覆盖率概览

| 指标 | 数值 |
|:-----|:-----|
| 源文件总数 | {coverage.total_files} |
| 已测试文件 | {coverage.tested_files} |
| 测试覆盖率 | {coverage.coverage_percentage:.1f}% |
| 识别缺口 | {len(coverage.gaps)} |

## 🎯 优先级分布

"""
        
        # 统计各优先级的缺口数量
        priority_counts = {}
        for gap in coverage.gaps:
            priority_counts[gap.priority.value] = priority_counts.get(gap.priority.value, 0) + 1
        
        for priority, count in priority_counts.items():
            report += f"- **{priority.upper()}**: {count} 个缺口\n"
        
        report += "\n## 🔍 主要测试缺口 (Top 10)\n\n"
        report += "| 文件 | 函数 | 优先级 | 预估工作量 |\n"
        report += "|:-----|:-----|:-------|:-----------|\n"
        
        for gap in coverage.gaps[:10]:
            report += f"| `{gap.file_path}` | `{gap.function_name}` | {gap.priority.value} | {gap.estimated_effort} |\n"
        
        report += "\n## 💡 优化建议\n\n"
        
        for i, rec in enumerate(recommendations, 1):
            report += f"### {i}. {rec.title}\n\n"
            report += f"**优先级**: {rec.priority.value}\n\n"
            report += f"{rec.description}\n\n"
            
            if rec.code_example:
                report += f"**代码示例**:\n```{('python' if rec.affected_files[0].endswith('.py') else 'typescript')}\n{rec.code_example}\n```\n\n"
        
        report += "\n---\n*报告由 AI Test Optimizer 自动生成*\n"
        
        return report
    
    def run(self, output_dir: str = None) -> str:
        """运行完整分析"""
        print("🚀 启动 AI 测试优化分析...\n")
        
        # 分析覆盖率
        coverage = self.analyze_coverage()
        print(f"✅ 覆盖率分析完成：{coverage.coverage_percentage:.1f}%\n")
        
        # 生成建议
        recommendations = self.generate_recommendations(coverage)
        print(f"✅ 生成 {len(recommendations)} 条优化建议\n")
        
        # 生成报告
        report = self.generate_report(coverage, recommendations)
        
        # 保存报告
        if output_dir:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            report_file = output_path / "test-optimization-report.md"
            report_file.write_text(report, encoding='utf-8')
            print(f"📄 报告已保存：{report_file}\n")
        
        return report


def main():
    parser = argparse.ArgumentParser(description="LogLayer AI 测试优化器")
    parser.add_argument("--coverage", action="store_true", help="仅运行覆盖率分析")
    parser.add_argument("--recommend", action="store_true", help="生成测试建议")
    parser.add_argument("--report", action="store_true", help="生成完整质量报告")
    parser.add_argument("--output", "-o", default="test-results", help="输出目录")
    
    args = parser.parse_args()
    
    optimizer = AITestOptimizer()
    
    if args.coverage:
        coverage = optimizer.analyze_coverage()
        print(f"\n测试覆盖率：{coverage.coverage_percentage:.1f}%")
        print(f"测试缺口：{len(coverage.gaps)} 个")
    elif args.recommend:
        coverage = optimizer.analyze_coverage()
        recommendations = optimizer.generate_recommendations(coverage)
        print(f"\n生成 {len(recommendations)} 条优化建议:")
        for rec in recommendations:
            print(f"  - [{rec.priority.value.upper()}] {rec.title}")
    else:
        # 默认运行完整分析
        report = optimizer.run(output_dir=args.output)
        print("\n✅ 分析完成!")


if __name__ == "__main__":
    main()
