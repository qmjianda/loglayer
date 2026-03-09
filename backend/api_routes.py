"""
API Routes - All REST API endpoints for LogLayer.
"""

import json
from fastapi import APIRouter
from typing import Dict, Any

from logging_config import logger
from schemas import (
    OpenFileRequest,
    SyncLayersRequest,
    SyncDecorationsRequest,
    ReadProcessedLinesRequest,
    GetLinesByIndicesRequest,
    SearchRequest,
    GetSearchMatchIndexRequest,
    GetNearestSearchRankRequest,
    GetSearchMatchesRangeRequest,
    ToggleBookmarkRequest,
    GetNearestBookmarkRequest,
    UpdateBookmarkCommentRequest,
    ExportVisibleLinesRequest,
    PhysicalToVisualIndexRequest,
    CloseFileRequest,
    ListDirectoryRequest,
    SaveWorkspaceConfigRequest,
    LoadWorkspaceConfigRequest,
    GetWidgetDataRequest,
)


def create_api_router(bridge) -> APIRouter:
    """Factory function to create API router with bridge instance."""
    router = APIRouter()

    @router.get("/api/platform")
    def get_platform():
        return bridge.get_platform_info()

    @router.get("/api/has_native_dialogs")
    def has_native_dialogs():
        return hasattr(bridge, "window") and bridge.window is not None

    @router.post("/api/open_file")
    def open_file(data: OpenFileRequest):
        return bridge.open_file(data.file_id, data.file_path)

    @router.post("/api/sync_all")
    def sync_all(data: SyncLayersRequest):
        return bridge.sync_all(
            data.file_id,
            data.layers_json,
            data.search_json,
        )

    @router.post("/api/sync_layers")
    def sync_layers(data: SyncLayersRequest):
        return bridge.sync_layers(
            data.file_id, data.layers_json, data.search_json
        )

    @router.post("/api/sync_decorations")
    def sync_decorations(data: SyncDecorationsRequest):
        return bridge.sync_decorations(data.file_id, data.layers_json)

    @router.get("/api/read_processed_lines")
    def read_processed_lines(file_id: str, start_line: int, count: int):
        return json.loads(bridge.read_processed_lines(file_id, start_line, count))

    @router.post("/api/get_lines_by_indices")
    def get_lines_by_indices(data: GetLinesByIndicesRequest):
        return json.loads(bridge.get_lines_by_indices(data.file_id, data.indices))

    @router.get("/api/get_search_match_index")
    def get_search_match_index(file_id: str, rank: int):
        return bridge.get_search_match_index(file_id, rank)

    @router.get("/api/get_nearest_search_rank")
    def get_nearest_search_rank(file_id: str, current_index: int, direction: str):
        return bridge.get_nearest_search_rank(file_id, current_index, direction)

    @router.get("/api/get_search_matches_range")
    def get_search_matches_range(file_id: str, start_rank: int, count: int):
        return json.loads(bridge.get_search_matches_range(file_id, start_rank, count))

    @router.get("/api/get_layer_registry")
    def get_layer_registry():
        return bridge._registry.get_all_types()

    @router.get("/api/get_ui_widgets")
    def get_ui_widgets():
        return bridge._registry.get_ui_widgets()

    @router.get("/api/get_widget_data")
    def get_widget_data(type_id: str):
        widget = bridge._registry.create_widget_instance(type_id)
        if widget:
            return widget.get_data()
        return {}

    @router.post("/api/reload_plugins")
    def reload_plugins():
        return bridge.reload_plugins()

    @router.post("/api/ready")
    def ready():
        bridge.ready()
        return True

    @router.post("/api/search_ripgrep")
    def search_ripgrep(data: Dict[str, Any] = Body(...)):
        return bridge.search_ripgrep(
            data["file_id"],
            data["query"],
            data.get("regex", False),
            data.get("case_sensitive", False),
        )

    @router.post("/api/close_file")
    def close_file(data: Dict[str, Any] = Body(...)):
        bridge.close_file(data["file_id"])
        return True

    @router.get("/api/select_files")
    def select_files():
        return json.loads(bridge.select_files())

    @router.get("/api/select_folder")
    def select_folder():
        return bridge.select_folder()

    @router.get("/api/list_logs_in_folder")
    def list_logs_in_folder(folder_path: str):
        return json.loads(bridge.list_logs_in_folder(folder_path))

    @router.get("/api/list_directory")
    def list_directory(folder_path: str):
        return json.loads(bridge.list_directory(folder_path))

    @router.post("/api/list_directory")
    def list_directory_post(data: Dict[str, Any] = Body(...)):
        folder_path = data.get("path", "")
        items = json.loads(bridge.list_directory(folder_path))
        return {"items": items, "path": folder_path}

    @router.post("/api/save_workspace_config")
    def save_workspace_config(data: Dict[str, Any] = Body(...)):
        return bridge.save_workspace_config(data["folder_path"], data["config_json"])

    @router.get("/api/load_workspace_config")
    def load_workspace_config(folder_path: str):
        return bridge.load_workspace_config(folder_path)

    @router.get("/api/worker_config")
    def get_worker_config():
        return bridge.get_worker_config()

    @router.post("/api/worker_config")
    def set_worker_config(data: Dict[str, Any] = Body(...)):
        max_workers = data.get("max_workers", 4)
        return bridge.set_worker_count(max_workers)

    @router.post("/api/toggle_bookmark")
    def toggle_bookmark(data: Dict[str, Any] = Body(...)):
        return json.loads(bridge.toggle_bookmark(data["file_id"], data["line_index"]))

    @router.get("/api/get_bookmarks")
    def get_bookmarks(file_id: str):
        return json.loads(bridge.get_bookmarks(file_id))

    @router.get("/api/get_nearest_bookmark_index")
    def get_nearest_bookmark_index(file_id: str, current_index: int, direction: str):
        return bridge.get_nearest_bookmark_index(file_id, current_index, direction)

    @router.post("/api/clear_bookmarks")
    def clear_bookmarks(data: Dict[str, Any] = Body(...)):
        return json.loads(bridge.clear_bookmarks(data["file_id"]))

    @router.post("/api/update_bookmark_comment")
    def update_bookmark_comment(data: Dict[str, Any] = Body(...)):
        return json.loads(
            bridge.update_bookmark_comment(
                data["file_id"], data["line_index"], data["comment"]
            )
        )

    @router.get("/api/physical_to_visual_index")
    def physical_to_visual_index(file_id: str, physical_index: int):
        return bridge.physical_to_visual_index(file_id, physical_index)

    @router.get("/api/get_log_level_stats")
    def get_log_level_stats(file_id: str):
        return bridge.get_log_level_stats(file_id)

    @router.get("/api/analyze_log_pattern")
    def analyze_log_pattern(file_id: str, sample_size: int = 1000):
        return bridge.analyze_log_pattern(file_id, sample_size)

    @router.get("/api/suggest_layers")
    def suggest_layers(file_id: str):
        return bridge.suggest_layers(file_id)

    @router.post("/api/export_visible_lines")
    def export_visible_lines(data: Dict[str, Any] = Body(...)):
        return bridge.export_visible_lines(
            data["file_id"], data.get("output_path", ""), data.get("format", "txt")
        )

    @router.get("/api/patterns/detect")
    def detect_patterns():
        return bridge._registry.get_pattern_detectors()

    # ============================================================
    # Saved Views API
    # ============================================================

    @router.get("/api/views/list")
    def list_views():
        """List all saved views."""
        from loglayer.views import get_view_manager
        manager = get_view_manager(bridge._workspace_path if hasattr(bridge, '_workspace_path') else None)
        return manager.list_views(include_workspace=True)

    @router.post("/api/views/save")
    def save_view(data: Dict[str, Any] = Body(...)):
        """Save a view."""
        from loglayer.views import get_view_manager
        manager = get_view_manager(bridge._workspace_path if hasattr(bridge, '_workspace_path') else None)
        view = manager.save_view(
            name=data['name'],
            layers=data['layers'],
            workspace_only=data.get('workspace_only', False)
        )
        return view.to_dict()

    @router.post("/api/views/load")
    def load_view(data: Dict[str, Any] = Body(...)):
        """Load a saved view."""
        from loglayer.views import get_view_manager
        manager = get_view_manager(bridge._workspace_path if hasattr(bridge, '_workspace_path') else None)
        view = manager.load_view(
            name=data['name'],
            prefer_workspace=data.get('prefer_workspace', True)
        )
        return view.to_dict() if view else None

    @router.post("/api/views/delete")
    def delete_view(data: Dict[str, Any] = Body(...)):
        """Delete a saved view."""
        from loglayer.views import get_view_manager
        manager = get_view_manager(bridge._workspace_path if hasattr(bridge, '_workspace_path') else None)
        success = manager.delete_view(
            name=data['name'],
            from_workspace=data.get('from_workspace', False)
        )
        return {'success': success}

    @router.post("/api/views/export")
    def export_views(data: Dict[str, Any] = Body(...)):
        """Export views to JSON file."""
        from loglayer.views import get_view_manager
        manager = get_view_manager(bridge._workspace_path if hasattr(bridge, '_workspace_path') else None)
        success = manager.export_views(
            output_path=data['output_path'],
            view_names=data.get('view_names')
        )
        return {'success': success}

    @router.post("/api/views/import")
    def import_views(data: Dict[str, Any] = Body(...)):
        """Import views from JSON file."""
        from loglayer.views import get_view_manager
        manager = get_view_manager(bridge._workspace_path if hasattr(bridge, '_workspace_path') else None)
        results = manager.import_views(
            input_path=data['input_path'],
            overwrite=data.get('overwrite', False)
        )
        return results

    return router
