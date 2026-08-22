from pathlib import Path


ROOT = Path(__file__).parents[2]


def test_backend_has_no_ai_package_or_routes():
    backend_ai = ROOT / "backend" / "ai"
    assert not backend_ai.exists()

    from backend.main import app

    assert all(not route.path.startswith("/api/ai/") for route in app.routes)


def test_frontend_and_build_config_have_no_ai_surface():
    source_roots = (ROOT / "frontend" / "src", ROOT / "vite.config.ts")
    forbidden = ("/api/ai/", "GEMINI_API_KEY", "@google/genai", "OpenAI", "Ollama")

    for source_root in source_roots:
        paths = (source_root.rglob("*") if source_root.is_dir() else (source_root,))
        for path in paths:
            if path.is_file() and path.suffix in {".ts", ".tsx"}:
                content = path.read_text(encoding="utf-8")
                assert not any(token in content for token in forbidden), path


def test_time_range_form_keeps_ordinary_fields():
    form = (ROOT / "frontend" / "src" / "components" / "DynamicUI" / "DynamicForm.tsx").read_text(encoding="utf-8")
    assert "registryEntry.type === 'TIME_RANGE'" in form
    assert "<InputMapper" in form
    assert "AI" not in form
