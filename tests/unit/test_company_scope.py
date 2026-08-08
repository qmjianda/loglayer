"""
test_company_scope.py - 变更级文件登记表（scope.md）与归属并集判定验收测试

对应 spec: specs/company-scope-registry/spec.md 的 WHEN-THEN 场景
- company-spec 生成 scope.md
- company-review 归属并集判定（本变更/他变更/无归属三类）
- 手册同步越界检查规则
"""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
COMMANDS_DIR = REPO_ROOT / ".opencode" / "commands"
MANUAL = REPO_ROOT / "docs" / "COMPANY_MODEL.md"


def test_company_spec_generates_scope_md():
    """Scenario: 规格阶段生成 scope.md"""
    content = (COMMANDS_DIR / "company-spec.md").read_text(encoding="utf-8")
    assert "scope.md" in content, "company-spec.md 应包含 scope.md 生成步骤"
    assert "新增" in content and "修改" in content, "scope.md 模板应按 新增/修改/删除 分组"


def test_company_review_has_scope_missing_check():
    """Scenario: scope.md 缺失时 review 提示"""
    content = (COMMANDS_DIR / "company-review.md").read_text(encoding="utf-8")
    assert "scope.md" in content, "company-review.md 应校验 scope.md 存在性"
    assert "缺失" in content or "回归规格" in content, "scope.md 缺失应提示回归规格阶段"


def test_company_review_has_three_way_attribution():
    """Scenario: 越界检查归属并集判定（三类结论）"""
    content = (COMMANDS_DIR / "company-review.md").read_text(encoding="utf-8")
    assert "本变更" in content, "应判定'命中本变更'并放行"
    assert "其他变更" in content, "应判定'命中其他活跃变更'并标记不升级"
    assert "无归属" in content, "应判定'无归属'并升级老板"


def test_company_review_uses_active_changes_list():
    """Scenario: 无归属判定需要活跃变更清单"""
    content = (COMMANDS_DIR / "company-review.md").read_text(encoding="utf-8")
    assert "openspec-cn list" in content, "归属判定应经 openspec-cn list 获取活跃变更"


def test_manual_describes_attribution_rules():
    """Scenario: 手册描述归属判定"""
    content = MANUAL.read_text(encoding="utf-8")
    assert "scope.md" in content, "手册应提及 scope.md 登记机制"
    assert "归属" in content, "手册应描述归属并集判定"
    assert "其他变更" in content, "手册应说明他变更文件不触发升级"
