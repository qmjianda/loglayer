#!/usr/bin/env python3
"""
LogLayer Unified Test Runner
=============================

统一测试入口，支持:
- pytest (Python 后端测试)
- Playwright E2E (前端 E2E 测试)
- browser-use AI (AI UI/UX 测试)

用法:
    python tools/run_all_tests.py                    # 运行所有测试
    python tools/run_all_tests.py --pytest           # 仅运行 pytest
    python tools/run_all_tests.py --e2e              # 仅运行 E2E
    python tools/run_all_tests.py --browser-use      # 仅运行 browser-use
    python tools/run_all_tests.py --no-browser-use   # 跳过 browser-use
    python tools/run_all_tests.py --report           # 生成 HTML 报告
"""

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from enum import Enum


class TestStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"


@dataclass
class TestResult:
    """单个测试类型的结果"""
    name: str
    status: TestStatus
    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    duration: float = 0.0
    error_message: str = ""
    details: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result["status"] = self.status.value
        return result


@dataclass
class TestReport:
    """完整测试报告"""
    timestamp: str
    duration: float = 0.0
    results: Dict[str, TestResult] = field(default_factory=dict)
    
    @property
    def total_passed(self) -> int:
        return sum(r.passed for r in self.results.values())
    
    @property
    def total_failed(self) -> int:
        return sum(r.failed for r in self.results.values())
    
    @property
    def total_skipped(self) -> int:
        return sum(r.skipped for r in self.results.values())
    
    @property
    def overall_status(self) -> TestStatus:
        if any(r.status == TestStatus.ERROR for r in self.results.values()):
            return TestStatus.ERROR
        if any(r.status == TestStatus.FAILED for r in self.results.values()):
            return TestStatus.FAILED
        if all(r.status == TestStatus.SKIPPED for r in self.results.values()):
            return TestStatus.SKIPPED
        return TestStatus.PASSED
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "duration": self.duration,
            "overall_status": self.overall_status.value,
            "summary": {
                "total_passed": self.total_passed,
                "total_failed": self.total_failed,
                "total_skipped": self.total_skipped,
            },
            "results": {k: v.to_dict() for k, v in self.results.items()}
        }


class TestRunner:
    """统一测试运行器"""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.report_dir = project_root / "test-results"
        self.report_dir.mkdir(exist_ok=True)
        
    def run_all(self, 
                run_pytest: bool = True,
                run_e2e: bool = True, 
                run_browser_use: bool = False,
                generate_report: bool = True) -> TestReport:
        """运行所有测试"""
        start_time = time.time()
        report = TestReport(timestamp=datetime.now().isoformat())
        
        print("=" * 60)
        print("LogLayer Unified Test Runner")
        print("=" * 60)
        print(f"时间: {report.timestamp}")
        print(f"项目根目录: {self.project_root}")
        print("=" * 60)
        
        # 1. TypeScript 类型检查
        print("\n[1/4] TypeScript 类型检查...")
        report.results["typescript"] = self.run_typescript_check()
        self._print_result(report.results["typescript"])
        
        # 2. pytest 测试
        if run_pytest:
            print("\n[2/4] pytest 后端测试...")
            report.results["pytest"] = self.run_pytest()
            self._print_result(report.results["pytest"])
        else:
            report.results["pytest"] = TestResult(
                name="pytest", 
                status=TestStatus.SKIPPED
            )
            print("\n[2/4] pytest 后端测试... 跳过")
        
        # 3. E2E Playwright 测试
        if run_e2e:
            print("\n[3/4] E2E Playwright 测试...")
            report.results["e2e"] = self.run_e2e()
            self._print_result(report.results["e2e"])
        else:
            report.results["e2e"] = TestResult(
                name="e2e", 
                status=TestStatus.SKIPPED
            )
            print("\n[3/4] E2E Playwright 测试... 跳过")
        
        # 4. browser-use AI 测试
        if run_browser_use:
            print("\n[4/4] browser-use AI 测试...")
            report.results["browser_use"] = self.run_browser_use()
            self._print_result(report.results["browser_use"])
        else:
            report.results["browser_use"] = TestResult(
                name="browser_use", 
                status=TestStatus.SKIPPED
            )
            print("\n[4/4] browser-use AI 测试... 跳过")
        
        report.duration = time.time() - start_time
        
        # 打印总结
        self._print_summary(report)
        
        # 保存报告
        if generate_report:
            self._save_report(report)
        
        return report
    
    def run_typescript_check(self) -> TestResult:
        """运行 TypeScript 类型检查"""
        result = TestResult(name="typescript", status=TestStatus.RUNNING)
        start_time = time.time()
        
        try:
            frontend_dir = self.project_root / "frontend"
            proc = subprocess.run(
                ["npx", "tsc", "--noEmit"],
                cwd=frontend_dir,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            result.duration = time.time() - start_time
            
            if proc.returncode == 0:
                result.status = TestStatus.PASSED
                result.passed = 1
                result.total = 1
            else:
                result.status = TestStatus.FAILED
                result.failed = 1
                result.total = 1
                result.error_message = proc.stdout or proc.stderr
                
        except subprocess.TimeoutExpired:
            result.status = TestStatus.ERROR
            result.duration = time.time() - start_time
            result.error_message = "TypeScript check timed out"
        except Exception as e:
            result.status = TestStatus.ERROR
            result.duration = time.time() - start_time
            result.error_message = str(e)
        
        return result
    
    def run_pytest(self) -> TestResult:
        """运行 pytest 测试"""
        result = TestResult(name="pytest", status=TestStatus.RUNNING)
        start_time = time.time()
        
        try:
            # 运行 pytest 并生成 JSON 报告
            json_report = self.report_dir / "pytest-report.json"
            
            proc = subprocess.run(
                [
                    sys.executable, "-m", "pytest", 
                    "tests/", 
                    "-v", 
                    "--tb=short",
                    f"--json-report-file={json_report}",
                    "--json-report-indent=2"
                ],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            result.duration = time.time() - start_time
            
            # 解析 pytest 输出获取统计
            output = proc.stdout + proc.stderr
            
            # 尝试从 JSON 报告解析
            if json_report.exists():
                try:
                    with open(json_report) as f:
                        pytest_data = json.load(f)
                    summary = pytest_data.get("summary", {})
                    result.total = summary.get("total", 0)
                    result.passed = summary.get("passed", 0)
                    result.failed = summary.get("failed", 0)
                    result.skipped = summary.get("skipped", 0)
                except Exception:
                    pass
            
            # 如果 JSON 解析失败，从输出解析
            if result.total == 0:
                result = self._parse_pytest_output(output, result)
            
            result.status = TestStatus.PASSED if result.failed == 0 else TestStatus.FAILED
            
        except subprocess.TimeoutExpired:
            result.status = TestStatus.ERROR
            result.duration = time.time() - start_time
            result.error_message = "pytest timed out"
        except Exception as e:
            result.status = TestStatus.ERROR
            result.duration = time.time() - start_time
            result.error_message = str(e)
        
        return result
    
    def run_e2e(self) -> TestResult:
        """运行 E2E Playwright 测试"""
        result = TestResult(name="e2e", status=TestStatus.RUNNING)
        start_time = time.time()
        
        try:
            proc = subprocess.run(
                ["npx", "playwright", "test", "e2e/", "--reporter=json"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=600
            )
            
            result.duration = time.time() - start_time
            
            # 解析 Playwright JSON 输出
            try:
                # Playwright JSON reporter outputs to stdout
                lines = proc.stdout.strip().split('\n')
                for line in lines:
                    if line.startswith('{'):
                        try:
                            data = json.loads(line)
                            if data.get("config"):
                                continue
                            # Parse test results
                            if "suites" in data:
                                self._parse_playwright_suites(data["suites"], result)
                        except json.JSONDecodeError:
                            continue
                
                # 如果 JSON 解析失败，从输出解析
                if result.total == 0:
                    result = self._parse_playwright_output(proc.stdout + proc.stderr, result)
                    
            except Exception as e:
                result.error_message = f"Failed to parse output: {e}"
                result = self._parse_playwright_output(proc.stdout + proc.stderr, result)
            
            result.status = TestStatus.PASSED if result.failed == 0 else TestStatus.FAILED
            
        except subprocess.TimeoutExpired:
            result.status = TestStatus.ERROR
            result.duration = time.time() - start_time
            result.error_message = "E2E tests timed out"
        except FileNotFoundError:
            result.status = TestStatus.SKIPPED
            result.duration = time.time() - start_time
            result.error_message = "Playwright not installed. Run: npx playwright install"
        except Exception as e:
            result.status = TestStatus.ERROR
            result.duration = time.time() - start_time
            result.error_message = str(e)
        
        return result
    
    def run_browser_use(self) -> TestResult:
        """运行 browser-use AI 测试"""
        result = TestResult(name="browser_use", status=TestStatus.RUNNING)
        start_time = time.time()
        
        try:
            # 检查环境变量
            if not os.environ.get("QWEN_API_KEY") or not os.environ.get("QWEN_URL"):
                result.status = TestStatus.SKIPPED
                result.duration = time.time() - start_time
                result.error_message = "QWEN_API_KEY or QWEN_URL not set"
                return result
            
            # 运行冒烟测试
            smoke_script = self.project_root / "e2e" / "browser-use" / "scripts" / "smoke-test.sh"
            
            if not smoke_script.exists():
                result.status = TestStatus.SKIPPED
                result.duration = time.time() - start_time
                result.error_message = "browser-use scripts not found"
                return result
            
            proc = subprocess.run(
                ["bash", str(smoke_script)],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=300,
                env={**os.environ, "APP_URL": "http://localhost:3000"}
            )
            
            result.duration = time.time() - start_time
            
            if proc.returncode == 0:
                result.status = TestStatus.PASSED
                result.passed = 1
                result.total = 1
            else:
                result.status = TestStatus.FAILED
                result.failed = 1
                result.total = 1
                result.error_message = proc.stderr or proc.stdout
                
        except subprocess.TimeoutExpired:
            result.status = TestStatus.ERROR
            result.duration = time.time() - start_time
            result.error_message = "browser-use test timed out"
        except Exception as e:
            result.status = TestStatus.ERROR
            result.duration = time.time() - start_time
            result.error_message = str(e)
        
        return result
    
    def _parse_pytest_output(self, output: str, result: TestResult) -> TestResult:
        """从 pytest 输出解析测试结果"""
        import re
        
        # 查找 "= N passed, M failed, K skipped =" 格式
        match = re.search(
            r'(\d+) passed,?\s*(\d+) failed,?\s*(\d+) skipped',
            output
        )
        if match:
            result.passed = int(match.group(1))
            result.failed = int(match.group(2))
            result.skipped = int(match.group(3))
            result.total = result.passed + result.failed + result.skipped
            return result
        
        # 只有 passed
        match = re.search(r'(\d+) passed', output)
        if match:
            result.passed = int(match.group(1))
            result.failed = 0
            result.skipped = 0
            result.total = result.passed
        
        return result
    
    def _parse_playwright_suites(self, suites: List[Dict], result: TestResult):
        """递归解析 Playwright suites"""
        for suite in suites:
            if "specs" in suite:
                for spec in suite["specs"]:
                    result.total += 1
                    if spec.get("ok"):
                        result.passed += 1
                    else:
                        result.failed += 1
            if "suites" in suite:
                self._parse_playwright_suites(suite["suites"], result)
    
    def _parse_playwright_output(self, output: str, result: TestResult) -> TestResult:
        """从 Playwright 输出解析测试结果"""
        import re
        
        # 查找 passed 和 failed 数量
        passed_match = re.search(r'(\d+) passed', output)
        failed_match = re.search(r'(\d+) failed', output)
        skipped_match = re.search(r'(\d+) skipped', output)
        
        result.passed = int(passed_match.group(1)) if passed_match else 0
        result.failed = int(failed_match.group(1)) if failed_match else 0
        result.skipped = int(skipped_match.group(1)) if skipped_match else 0
        result.total = result.passed + result.failed + result.skipped
        
        return result
    
    def _print_result(self, result: TestResult):
        """打印单个测试结果"""
        status_icon = {
            TestStatus.PASSED: "✅",
            TestStatus.FAILED: "❌",
            TestStatus.SKIPPED: "⏭️",
            TestStatus.ERROR: "💥",
            TestStatus.RUNNING: "🔄",
            TestStatus.PENDING: "⏳",
        }.get(result.status, "❓")
        
        print(f"  状态: {status_icon} {result.status.value}")
        if result.total > 0:
            print(f"  结果: {result.passed} passed, {result.failed} failed, {result.skipped} skipped")
        print(f"  耗时: {result.duration:.2f}s")
        if result.error_message and result.status in [TestStatus.ERROR, TestStatus.FAILED]:
            print(f"  错误: {result.error_message[:200]}...")
    
    def _print_summary(self, report: TestReport):
        """打印测试总结"""
        print("\n" + "=" * 60)
        print("测试总结")
        print("=" * 60)
        print(f"总耗时: {report.duration:.2f}s")
        print(f"总体状态: {report.overall_status.value}")
        print(f"  通过: {report.total_passed}")
        print(f"  失败: {report.total_failed}")
        print(f"  跳过: {report.total_skipped}")
        print("=" * 60)
    
    def _save_report(self, report: TestReport):
        """保存测试报告"""
        # JSON 报告
        json_path = self.report_dir / "test-report.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, indent=2, ensure_ascii=False)
        print(f"\n报告已保存: {json_path}")
        
        # HTML 报告
        html_path = self.report_dir / "test-report.html"
        self._generate_html_report(report, html_path)
        print(f"HTML 报告: {html_path}")
    
    def _generate_html_report(self, report: TestReport, output_path: Path):
        """生成 HTML 报告"""
        html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LogLayer Test Report</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #1a1a1a;
            color: #e0e0e0;
        }}
        .header {{
            text-align: center;
            padding: 20px;
            border-bottom: 1px solid #333;
            margin-bottom: 30px;
        }}
        .summary {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }}
        .summary-card {{
            background: #252525;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }}
        .summary-card h3 {{
            margin: 0 0 10px;
            font-size: 14px;
            color: #888;
        }}
        .summary-card .value {{
            font-size: 32px;
            font-weight: bold;
        }}
        .passed {{ color: #22c55e; }}
        .failed {{ color: #ef4444; }}
        .skipped {{ color: #f59e0b; }}
        .total {{ color: #3b82f6; }}
        .result-card {{
            background: #252525;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
        }}
        .result-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: #333;
        }}
        .result-body {{
            padding: 20px;
        }}
        .status-badge {{
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }}
        .status-passed {{ background: #22c55e20; color: #22c55e; }}
        .status-failed {{ background: #ef444420; color: #ef4444; }}
        .status-skipped {{ background: #f59e0b20; color: #f59e0b; }}
        .status-error {{ background: #ef444420; color: #ef4444; }}
        .stats {{
            display: flex;
            gap: 20px;
            margin-top: 10px;
        }}
        .stat {{
            font-size: 14px;
        }}
        .error-message {{
            background: #2a2a2a;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            overflow-x: auto;
            margin-top: 10px;
            color: #ef4444;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>LogLayer Test Report</h1>
        <p>Generated: {report.timestamp}</p>
        <p>Duration: {report.duration:.2f}s</p>
    </div>
    
    <div class="summary">
        <div class="summary-card">
            <h3>Total</h3>
            <div class="value total">{report.total_passed + report.total_failed + report.total_skipped}</div>
        </div>
        <div class="summary-card">
            <h3>Passed</h3>
            <div class="value passed">{report.total_passed}</div>
        </div>
        <div class="summary-card">
            <h3>Failed</h3>
            <div class="value failed">{report.total_failed}</div>
        </div>
        <div class="summary-card">
            <h3>Skipped</h3>
            <div class="value skipped">{report.total_skipped}</div>
        </div>
    </div>
    
    <h2>Test Results</h2>
'''
        
        for name, result in report.results.items():
            status_class = f"status-{result.status.value}"
            status_icon = {
                TestStatus.PASSED: "✅",
                TestStatus.FAILED: "❌",
                TestStatus.SKIPPED: "⏭️",
                TestStatus.ERROR: "💥",
            }.get(result.status, "❓")
            
            html += f'''
    <div class="result-card">
        <div class="result-header">
            <h3>{name}</h3>
            <span class="status-badge {status_class}">{status_icon} {result.status.value}</span>
        </div>
        <div class="result-body">
            <div class="stats">
                <span class="stat">Duration: {result.duration:.2f}s</span>
                <span class="stat passed">Passed: {result.passed}</span>
                <span class="stat failed">Failed: {result.failed}</span>
                <span class="stat skipped">Skipped: {result.skipped}</span>
            </div>
'''
            if result.error_message and result.status in [TestStatus.ERROR, TestStatus.FAILED]:
                html += f'''
            <div class="error-message">{result.error_message[:500]}</div>
'''
            html += '''
        </div>
    </div>
'''
        
        html += '''
</body>
</html>
'''
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)


def main():
    parser = argparse.ArgumentParser(
        description="LogLayer Unified Test Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
    python tools/run_all_tests.py                    # 运行所有测试
    python tools/run_all_tests.py --pytest           # 仅运行 pytest
    python tools/run_all_tests.py --e2e              # 仅运行 E2E
    python tools/run_all_tests.py --browser-use      # 包含 browser-use
    python tools/run_all_tests.py --no-browser-use   # 跳过 browser-use (默认)
    python tools/run_all_tests.py --no-report        # 不生成报告
        """
    )
    
    parser.add_argument(
        "--pytest", 
        action="store_true", 
        help="仅运行 pytest 测试"
    )
    parser.add_argument(
        "--e2e", 
        action="store_true", 
        help="仅运行 E2E 测试"
    )
    parser.add_argument(
        "--browser-use", 
        action="store_true", 
        help="包含 browser-use AI 测试"
    )
    parser.add_argument(
        "--no-pytest", 
        action="store_true", 
        help="跳过 pytest 测试"
    )
    parser.add_argument(
        "--no-e2e", 
        action="store_true", 
        help="跳过 E2E 测试"
    )
    parser.add_argument(
        "--no-browser-use", 
        action="store_true", 
        help="跳过 browser-use 测试 (默认)"
    )
    parser.add_argument(
        "--no-report", 
        action="store_true", 
        help="不生成测试报告"
    )
    parser.add_argument(
        "--typescript", 
        action="store_true", 
        help="仅运行 TypeScript 类型检查"
    )
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent
    runner = TestRunner(project_root)
    
    # 确定运行哪些测试
    run_pytest = args.pytest and not args.no_pytest
    run_e2e = args.e2e and not args.no_e2e
    run_browser_use = args.browser_use and not args.no_browser_use
    
    # 如果没有指定任何测试，运行所有测试（除了 browser-use）
    if not (args.pytest or args.e2e or args.browser_use or args.typescript):
        run_pytest = not args.no_pytest
        run_e2e = not args.no_e2e
        # browser-use 默认不运行，需要显式指定
    
    generate_report = not args.no_report
    
    report = runner.run_all(
        run_pytest=run_pytest,
        run_e2e=run_e2e,
        run_browser_use=run_browser_use,
        generate_report=generate_report
    )
    
    # 返回退出码
    if report.overall_status == TestStatus.PASSED:
        return 0
    elif report.overall_status == TestStatus.SKIPPED:
        return 0
    else:
        return 1


if __name__ == "__main__":
    sys.exit(main())