"""
test_company_commands.py - 一人公司模型：company-* 命令验收测试

对应 spec: specs/company-commands/spec.md 的 WHEN-THEN 场景
- 5 个命令文件存在
- company-init 含立项要素（kebab-case、openspec-cn new change）
- company-spec 含 grill-me 评审闸门与产出物推进
- company-review 含回归闸门（validate/测试/静态门/越界检查）与熔断
- company-run 含全流程顺序与闸门暂停
- company-report 含状态汇总与待决策项
"""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
COMMANDS_DIR = REPO_ROOT / ".opencode" / "commands"

EXPECTED_COMMANDS = [
    "company-init.md",
    "company-spec.md",
    "company-review.md",
    "company-run.md",
    "company-report.md",
]

# 每个命令必须包含的关键编排要素（对应 spec 场景）
COMMAND_KEYWORDS = {
    "company-init.md": [
        "openspec-cn new change",  # 调用 openspec-cn 创建变更骨架
        "kebab-case",  # 推导 kebab-case 变更名
    ],
    "company-spec.md": [
        "grill",  # grill-me 设计评审闸门
        "proposal",  # OpenSpec 产出物
        "spec",
        "design",
        "tasks",
    ],
    "company-review.md": [
        "validate",  # openspec validate
        "pytest",  # 相关测试
        "tsc",  # 静态门
        "ruff",
        "git diff",  # 越界检查
        "3",  # 熔断（连败 3 次升级）
    ],
    "company-run.md": [
        "company-spec",  # 完整循环引用规格阶段
        "company-review",  # 完整循环引用回归阶段
        "company-report",  # 完整循环引用汇报
        "老板",  # 闸门处等待老板决策
    ],
    "company-report.md": [
        "openspec-cn list",  # 状态数据源
        "company-reports",  # 历史报告目录
        "决策",  # 待老板决策项
    ],
}


def _read_command(name: str) -> str:
    path = COMMANDS_DIR / name
    assert path.is_file(), f"命令文件缺失: {path}"
    return path.read_text(encoding="utf-8")


def test_all_five_command_files_exist():
    """Scenario: 5 个命令文件存在"""
    for name in EXPECTED_COMMANDS:
        assert (COMMANDS_DIR / name).is_file(), f"缺少命令文件: {name}"


def test_company_init_has_project_creation_flow():
    """Scenario: 立项创建变更骨架"""
    content = _read_command("company-init.md")
    for kw in COMMAND_KEYWORDS["company-init.md"]:
        assert kw in content, f"company-init.md 缺少关键要素: {kw}"


def test_company_spec_has_review_gate_and_artifacts():
    """Scenario: 规格阶段含评审闸门 + 产出物完整"""
    content = _read_command("company-spec.md")
    for kw in COMMAND_KEYWORDS["company-spec.md"]:
        assert kw in content, f"company-spec.md 缺少关键要素: {kw}"


def test_company_review_has_regression_gate_and_fuse():
    """Scenario: 回归包含测试与静态门 + 熔断"""
    content = _read_command("company-review.md")
    for kw in COMMAND_KEYWORDS["company-review.md"]:
        assert kw in content, f"company-review.md 缺少关键要素: {kw}"


def test_company_run_has_full_pipeline_and_gate_pause():
    """Scenario: 完整循环顺序执行 + 循环可拆分 + 闸门暂停"""
    content = _read_command("company-run.md")
    for kw in COMMAND_KEYWORDS["company-run.md"]:
        assert kw in content, f"company-run.md 缺少关键要素: {kw}"


def test_company_report_has_status_summary():
    """Scenario: 报告列出变更与待决策项"""
    content = _read_command("company-report.md")
    for kw in COMMAND_KEYWORDS["company-report.md"]:
        assert kw in content, f"company-report.md 缺少关键要素: {kw}"
