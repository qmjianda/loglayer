"""
test_engineering_foundation.py - 工程地基验收测试

对应 specs（engineering-foundation 变更）：
- specs/ci-pipeline/spec.md 的 WHEN-THEN 场景
- specs/code-quality-gates/spec.md 的 WHEN-THEN 场景
- specs/project-docs/spec.md 的 WHEN-THEN 场景
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CI_YML = REPO_ROOT / ".github" / "workflows" / "ci.yml"
PACKAGE_JSON = REPO_ROOT / "package.json"
ESLINT_CONFIG = REPO_ROOT / "eslint.config.js"
PRETTIERRC = REPO_ROOT / ".prettierrc.json"
RUFF_TOML = REPO_ROOT / "ruff.toml"
README = REPO_ROOT / "README.md"
BACKEND_INIT = REPO_ROOT / "backend" / "__init__.py"
CHANGELOG = REPO_ROOT / "CHANGELOG.md"


# ---------- ci-pipeline ----------

def test_ci_yml_exists():
    """WHEN 推送到 main/PR → THEN CI 自动运行验证（ci.yml 存在）"""
    assert CI_YML.is_file(), "缺少 .github/workflows/ci.yml"


def test_ci_triggers_on_push_main_and_pr():
    """Scenario: 推送到 main 分支触发验证 + 创建 PR 触发验证"""
    content = CI_YML.read_text(encoding="utf-8")
    assert "pull_request" in content, "CI 应配置 PR 触发"
    assert "push" in content, "CI 应配置 push 触发"
    assert "main" in content or "dev" in content, "CI 应监听 main/dev 分支"


def test_ci_runs_backend_pytest():
    """THEN 后端 pytest（unit + integration）"""
    content = CI_YML.read_text(encoding="utf-8")
    assert "pytest" in content, "CI 后端 job 应运行 pytest"
    assert "tests/unit" in content or "tests/integration" in content, "应覆盖 unit/integration"


def test_ci_runs_frontend_tsc_vitest_build():
    """THEN 前端 tsc && vitest && vite build"""
    content = CI_YML.read_text(encoding="utf-8")
    assert "tsc" in content, "CI 前端 job 应运行 tsc"
    assert "vitest" in content, "CI 前端 job 应运行 vitest"
    assert "build" in content, "CI 前端 job 应运行 build"


# ---------- code-quality-gates ----------

def test_lint_configs_exist():
    """系统 SHALL 提供前端 ESLint 与 Prettier 配置 + 后端 ruff 配置"""
    assert ESLINT_CONFIG.is_file(), "缺少 eslint.config.js"
    assert PRETTIERRC.is_file(), "缺少 .prettierrc.json"
    assert RUFF_TOML.is_file(), "缺少 ruff.toml"


def test_lint_scripts_exist():
    """`npm run lint` 与 `npm run format:check` 应存在"""
    pkg = PACKAGE_JSON.read_text(encoding="utf-8")
    assert '"lint"' in pkg, "package.json 缺少 lint script"
    assert "format:check" in pkg, "package.json 缺少 format:check script"


def test_lint_in_ci():
    """lint/format 步骤纳入 CI（backend ruff + frontend eslint/prettier）"""
    content = CI_YML.read_text(encoding="utf-8")
    assert "ruff" in content, "CI 应包含 ruff 检查"
    assert "eslint" in content, "CI 应包含 eslint 检查"
    assert "prettier" in content or "format" in content, "CI 应包含 prettier 检查"


# ---------- project-docs ----------

def test_readme_has_no_misleading_virtual_scrolling_claim():
    """Scenario: 虚拟化渲染描述准确 - 不出现 O(1) Virtual Scrolling 或 Canvas 渲染声称"""
    content = README.read_text(encoding="utf-8")
    assert "O(1)" not in content, "README 不应再声称 O(1) Virtual Scrolling"
    assert not re.search(r"Canvas.*虚拟|虚拟.*Canvas", content), "README 不应声称 Canvas 渲染"


def test_readme_describes_dom_virtual_scrolling():
    """THEN 表述为 DOM 虚拟滚动（react-virtuoso）"""
    content = README.read_text(encoding="utf-8")
    assert "virtual" in content.lower() or "虚拟" in content, "README 应描述虚拟滚动"


def test_version_baseline_synced():
    """版本基线：package.json 与后端常量同步为 0.1.0"""
    pkg = PACKAGE_JSON.read_text(encoding="utf-8")
    m = re.search(r'"version":\s*"([^"]+)"', pkg)
    assert m, "package.json 缺少 version"
    frontend_version = m.group(1)
    backend_init = BACKEND_INIT.read_text(encoding="utf-8")
    backend_m = re.search(r'__version__\s*=\s*"([^"]+)"', backend_init)
    assert backend_m, "backend/__init__.py 缺少 __version__"
    assert frontend_version == backend_m.group(1), (
        f"版本不同步: package.json={frontend_version} vs backend={backend_m.group(1)}"
    )


def test_changelog_generated():
    """基于 Conventional Commits 自动生成 CHANGELOG"""
    assert CHANGELOG.is_file(), "缺少 CHANGELOG.md"
    content = CHANGELOG.read_text(encoding="utf-8")
    assert content.strip(), "CHANGELOG.md 不应为空"
