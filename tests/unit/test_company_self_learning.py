"""
test_company_self_learning.py - 一人公司模型：自学习闭环验收测试

对应 spec: specs/company-self-learning/spec.md 与 specs/company-operating-model/spec.md 的 WHEN-THEN 场景
- 复盘输入随闸门报告沉淀（报告含「本次循环问题」小节）
- 待提炼状态在 company-report 可见（「待提炼问题 N 条」）
- 提炼由老板触发（代理不自动执行）
- 改进落地走立项审批（/company-init 后再改流程文件）
- 评审量化约束（每产出物 ≥3 轮诘问、含挑战隐含假设）
- 第一性原理（proposal 含「根本问题」小节）
"""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MANUAL_PATH = REPO_ROOT / "docs" / "COMPANY_MODEL.md"
COMMANDS_DIR = REPO_ROOT / ".opencode" / "commands"


def _read(path: Path) -> str:
    assert path.is_file(), f"文件缺失: {path}"
    return path.read_text(encoding="utf-8")


def test_manual_describes_self_learning_loop():
    """Scenario: 手册描述自学习闭环"""
    content = _read(MANUAL_PATH)
    for kw in ["自学习", "复盘输入", "待提炼", "老板触发", "立项"]:
        assert kw in content, f"COMPANY_MODEL.md 缺少自学习闭环要素: {kw}"


def test_manual_describes_review_quantification():
    """Scenario: 手册描述评审量化约束"""
    content = _read(MANUAL_PATH)
    assert "3 轮" in content, "COMPANY_MODEL.md 缺少评审量化（≥3 轮诘问）"
    assert "挑战隐含假设" in content, "COMPANY_MODEL.md 缺少挑战隐含假设要求"


def test_manual_describes_first_principles():
    """Scenario: 手册描述第一性原理要求"""
    content = _read(MANUAL_PATH)
    assert "根本问题" in content, "COMPANY_MODEL.md 缺少第一性原理（根本问题小节）要求"


def test_manual_requires_init_approval_for_refinement():
    """Scenario: 手册规定提炼落地需立项"""
    content = _read(MANUAL_PATH)
    assert "提炼" in content, "COMPANY_MODEL.md 缺少提炼机制描述"
    # 提炼与立项在同一语境（改进落地需经 /company-init）
    assert "company-init" in content, "COMPANY_MODEL.md 缺少 /company-init 引用"


def test_report_template_has_retro_section():
    """Scenario: 报告包含本次循环问题小节"""
    # company-spec / company-review / company-run 的报告模板都应沉淀复盘输入
    for name in ["company-spec.md", "company-review.md", "company-run.md"]:
        content = _read(COMMANDS_DIR / name)
        assert "本次循环问题" in content, f"{name} 缺少「本次循环问题」小节"


def test_company_report_shows_pending_refinement():
    """Scenario: 报告显示待提炼问题数量"""
    content = _read(COMMANDS_DIR / "company-report.md")
    assert "待提炼问题" in content, "company-report.md 缺少「待提炼问题」汇总"
