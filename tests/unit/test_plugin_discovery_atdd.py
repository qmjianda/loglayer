from pathlib import Path


def test_discovery_sorts_sources_deterministically_and_records_duplicate_winner():
    from loglayer.plugin_discovery import PluginCandidate, PluginDiscovery

    candidates = [
        PluginCandidate(plugin_id="acme.same", source=Path("/z/plugin"), priority=2),
        PluginCandidate(plugin_id="acme.same", source=Path("/a/plugin"), priority=2),
        PluginCandidate(plugin_id="acme.other", source=Path("/b/plugin"), priority=2),
    ]
    discovery = PluginDiscovery(
        entry_point_provider=lambda: (),
        configured_directories=(),
    )

    result = discovery.resolve_candidates(candidates)

    assert [candidate.plugin_id for candidate in result.selected] == [
        "acme.other",
        "acme.same",
    ]
    assert result.selected[1].source == Path("/a/plugin").resolve()
    assert result.diagnostics[0].code == "duplicate_plugin_id"
