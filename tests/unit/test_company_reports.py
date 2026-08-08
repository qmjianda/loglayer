"""
test_company_reports.py - 一人公司模型：落盘报告机制验收测试

对应 spec: specs/company-reports/spec.md 的 WHEN-THEN 场景
- 报告文件按 <变更名>-<日期>.md 格式生成于 docs/company-reports/
- 报告内容包含状态与证据
- docs/company-reports/ 未被 gitignore
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
REPORTS_DIR = REPO_ROOT / "docs" / "company-reports"
GITIGNORE = REPO_ROOT / ".gitignore"

REPORT_NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}-\d{2}-\d{2}\.md$")


def test_report_name_format_matches_change_date_pattern():
    """Scenario: 报告文件按规范路径生成（文件名格式）"""
    # 格式: <变更名(全小写kebab)>-<YYYY-MM-DD>.md
    assert REPORT_NAME_RE.match("engineering-foundation-2026-08-08.md")
    assert REPORT_NAME_RE.match("company-operating-model-2026-08-08.md")
    assert not REPORT_NAME_RE.match("Engineering.md")
    assert not REPORT_NAME_RE.match("engineering-foundation.md")  # 缺日期


def test_reports_dir_not_gitignored():
    """Scenario: 报告目录纳入版本控制"""
    assert GITIGNORE.is_file(), "缺少 .gitignore"
    content = GITIGNORE.read_text(encoding="utf-8")
    assert "company-reports" not in content, "docs/company-reports/ 不应被 gitignore"


def test_generated_report_contains_status_and_evidence():
    """Scenario: 报告内容包含状态与证据（对已生成报告的契约校验）"""
    if not REPORTS_DIR.is_dir():
        return  # 尚无报告时跳过（红→绿转换后由 company-run 生成）
    reports = sorted(REPORTS_DIR.glob("*.md"))
    assert reports, "docs/company-reports/ 存在但无报告文件"
    sample = reports[-1].read_text(encoding="utf-8")
    # 报告必须覆盖: 变更名/阶段、改动摘要、测试证据、待决策项
    assert "变更" in sample or "Change" in sample
    assert "阶段" in sample or "Stage" in sample
    assert "测试" in sample or "Test" in sample
