import os
import sys
import json
import asyncio
import threading
import uvicorn
import webview
import argparse
import time
import logging

from logging_config import logger

# Windows asyncio fix for [WinError 10054]
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except (AttributeError, OSError):
        pass

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Import refactored bridge
from bridge import FileBridge

# Global bridge instance
bridge = FileBridge()

# Event loop reference for thread-safe broadcasting
main_loop = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
    logger.info("Event loop captured for signal broadcasting")
    yield
    logger.info("Server shutting down")


# 1. Initialize FastAPI with lifespan
app = FastAPI(lifespan=lifespan)


# Enable CORS for development - restrict to localhost in production
# In production, this should be limited to the actual frontend origin
def get_cors_origins():
    import os

    env = os.environ.get("LOGLAYER_ENV", "development")
    if env == "production":
        return ["http://localhost:12345"]  # Production should be configured
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:12345",
        "http://127.0.0.1:12345",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import WebSocket manager
from websocket_manager import manager

# Setup Bridge Signals to WebSocket
def broadcast_signal(signal_name, *args):
    """
    Called from bridge threads/uvicorn threads to broadcast signals via WebSockets.
    """
    message = {"signal": signal_name, "args": args}

    if main_loop:
        try:
            asyncio.run_coroutine_threadsafe(manager.broadcast(message), main_loop)
        except Exception as e:
            logger.warning(f"Signal broadcast failed for {signal_name}: {e}")
    else:
        logger.debug(f"Global loop not ready for signal: {signal_name}")


# Connect signals
bridge.fileLoaded.connect(lambda *args: broadcast_signal("fileLoaded", *args))
bridge.pipelineFinished.connect(
    lambda *args: broadcast_signal("pipelineFinished", *args)
)
bridge.statsFinished.connect(lambda *args: broadcast_signal("statsFinished", *args))
bridge.operationStarted.connect(
    lambda *args: broadcast_signal("operationStarted", *args)
)
bridge.operationProgress.connect(
    lambda *args: broadcast_signal("operationProgress", *args)
)
bridge.operationError.connect(lambda *args: broadcast_signal("operationError", *args))
bridge.operationStatusChanged.connect(
    lambda *args: broadcast_signal("operationStatusChanged", *args)
)
bridge.pendingFilesCount.connect(
    lambda *args: broadcast_signal("pendingFilesCount", *args)
)
bridge.frontendReady.connect(lambda *args: broadcast_signal("frontendReady", *args))
bridge.workspaceOpened.connect(lambda *args: broadcast_signal("workspaceOpened", *args))


# 2. Define API Endpoints (FastAPI)
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Ping/Pong or keep-alive if needed
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/api/platform")
def get_platform():
    return bridge.get_platform_info()


@app.get("/api/has_native_dialogs")
def has_native_dialogs():
    """检查是否支持原生文件对话框（用于 --no-ui 模式检测）"""
    return hasattr(bridge, "window") and bridge.window is not None


@app.post("/api/open_file")
def open_file(data: dict = Body(...)):
    return bridge.open_file(data["file_id"], data["file_path"])


@app.post("/api/sync_all")
def sync_all(data: dict = Body(...)):
    return bridge.sync_all(
        data["file_id"],
        data["layers_json"],
        data["search_json"] if "search_json" in data else None,
    )


@app.post("/api/sync_layers")
def sync_layers(data: dict = Body(...)):
    return bridge.sync_layers(
        data["file_id"], data["layers_json"], data.get("search_json")
    )


@app.post("/api/sync_decorations")
def sync_decorations(data: dict = Body(...)):
    return bridge.sync_decorations(data["file_id"], data["layers_json"])


@app.get("/api/read_processed_lines")
def read_processed_lines(file_id: str, start_line: int, count: int):
    # Returns raw string from bridge, FastAPI will wrap it in JSON correctly
    return json.loads(bridge.read_processed_lines(file_id, start_line, count))


@app.post("/api/get_lines_by_indices")
def get_lines_by_indices(data: dict = Body(...)):
    """获取指定索引的行内容"""
    return json.loads(bridge.get_lines_by_indices(data["file_id"], data["indices"]))


@app.get("/api/get_search_match_index")
def get_search_match_index(file_id: str, rank: int):
    return bridge.get_search_match_index(file_id, rank)


@app.get("/api/is_search_match")
def is_search_match(file_id: str, index: int):
    return bridge.is_search_match(file_id, index)


@app.get("/api/get_search_rank_for_index")
def get_search_rank_for_index(file_id: str, index: int):
    """Get the rank (0-based position) of a search match at the given index.
    Returns -1 if the index is not a match.
    """
    return bridge.get_search_rank_for_index(file_id, index)


@app.get("/api/get_nearest_search_rank")
def get_nearest_search_rank(file_id: str, current_index: int, direction: str):
    return bridge.get_nearest_search_rank(file_id, current_index, direction)


@app.get("/api/get_search_matches_range")
def get_search_matches_range(file_id: str, start_rank: int, count: int):
    return json.loads(bridge.get_search_matches_range(file_id, start_rank, count))


@app.get("/api/get_layer_registry")
def get_layer_registry():
    return bridge._registry.get_all_types()


@app.get("/api/get_ui_widgets")
def get_ui_widgets():
    """获取所有已加载插件定义的 UI 挂件信息"""
    return bridge._registry.get_ui_widgets()


@app.get("/api/get_widget_data")
def get_widget_data(type_id: str):
    """获取指定挂件的实时数据"""
    widget = bridge._registry.create_widget_instance(type_id)
    if widget:
        return widget.get_data()
    return {}


@app.post("/api/reload_plugins")
def reload_plugins():
    return bridge.reload_plugins()


@app.post("/api/ready")
def ready():
    bridge.ready()
    return True


@app.post("/api/search_ripgrep")
def search_ripgrep(data: dict = Body(...)):
    return bridge.search_ripgrep(
        data["file_id"],
        data["query"],
        data.get("regex", False),
        data.get("case_sensitive", False),
    )


@app.post("/api/close_file")
def close_file(data: dict = Body(...)):
    bridge.close_file(data["file_id"])
    return True


@app.get("/api/select_files")
def select_files():
    return json.loads(bridge.select_files())


@app.get("/api/select_folder")
def select_folder():
    return bridge.select_folder()


@app.get("/api/list_logs_in_folder")
def list_logs_in_folder(folder_path: str):
    return json.loads(bridge.list_logs_in_folder(folder_path))


@app.get("/api/list_directory")
def list_directory(folder_path: str):
    return json.loads(bridge.list_directory(folder_path))


@app.post("/api/list_directory")
def list_directory_post(data: dict = Body(...)):
    """POST 版本的目录列表 API，用于远程路径选择器"""
    folder_path = data.get("path", "")
    items = json.loads(bridge.list_directory(folder_path))
    return {"items": items, "path": folder_path}


@app.post("/api/save_workspace_config")
def save_workspace_config(data: dict = Body(...)):
    return bridge.save_workspace_config(data["folder_path"], data["config_json"])


@app.get("/api/load_workspace_config")
def load_workspace_config(folder_path: str):
    return bridge.load_workspace_config(folder_path)


# ============================================================
# Worker Pool Configuration APIs
# ============================================================


@app.get("/api/worker_config")
def get_worker_config():
    """Get current worker pool configuration."""
    return bridge.get_worker_config()


@app.post("/api/worker_config")
def set_worker_config(data: dict = Body(...)):
    """Set worker pool size dynamically.

    Request body:
        max_workers: int (1-32)
    """
    max_workers = data.get("max_workers", 4)
    return bridge.set_worker_count(max_workers)


# ============================================================
# Bookmark APIs
# ============================================================


@app.post("/api/toggle_bookmark")
def toggle_bookmark(data: dict = Body(...)):
    """切换指定行的书签状态"""
    return json.loads(bridge.toggle_bookmark(data["file_id"], data["line_index"]))


@app.get("/api/get_bookmarks")
def get_bookmarks(file_id: str):
    """获取当前文件的书签列表"""
    return json.loads(bridge.get_bookmarks(file_id))


@app.get("/api/get_nearest_bookmark_index")
def get_nearest_bookmark_index(file_id: str, current_index: int, direction: str):
    """查找最近的书签索引"""
    return bridge.get_nearest_bookmark_index(file_id, current_index, direction)


@app.post("/api/clear_bookmarks")
def clear_bookmarks(data: dict = Body(...)):
    """清除指定文件的所有书签"""
    return json.loads(bridge.clear_bookmarks(data["file_id"]))


@app.post("/api/update_bookmark_comment")
def update_bookmark_comment(data: dict = Body(...)):
    """更新书签注释"""
    return json.loads(
        bridge.update_bookmark_comment(
            data["file_id"], data["line_index"], data["comment"]
        )
    )


@app.get("/api/physical_to_visual_index")
def physical_to_visual_index(file_id: str, physical_index: int):
    """将物理行索引转换为虚拟行索引"""
    return bridge.physical_to_visual_index(file_id, physical_index)


@app.get("/api/file_info")
def get_file_info(file_id: str):
    """获取文件信息（用于文件监视）"""
    session = bridge._sessions.get(file_id)
    if not session:
        return {"error": "File not found"}

    import os

    try:
        stat = os.stat(session.path)
        return {
            "path": session.path,
            "size": stat.st_size,
            "mtime": stat.st_mtime,
            "lineCount": len(session.line_offsets),
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/log_level_stats")
def get_log_level_stats(file_id: str):
    """获取日志级别统计"""
    return bridge.get_log_level_stats(file_id)


@app.get("/api/system_metrics")
def get_system_metrics():
    """获取系统性能指标（磁盘I/O、CPU等）"""
    try:
        import psutil
        
        disk_io = psutil.disk_io_counters()
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        
        result = {
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "memory_used_mb": memory.used // (1024 * 1024),
            "memory_total_mb": memory.total // (1024 * 1024),
        }
        
        if disk_io:
            result.update({
                "disk_read_bytes": disk_io.read_bytes,
                "disk_write_bytes": disk_io.write_bytes,
                "disk_read_count": disk_io.read_count,
                "disk_write_count": disk_io.write_count,
                "disk_read_time_ms": disk_io.read_time if hasattr(disk_io, 'read_time') else 0,
                "disk_write_time_ms": disk_io.write_time if hasattr(disk_io, 'write_time') else 0,
            })
        
        return result
    except Exception as e:
        logger.error(f"[SystemMetrics] Error: {e}")
        return {"error": str(e)}


@app.get("/api/analyze_log_pattern")
def analyze_log_pattern(file_id: str, sample_size: int = 100):
    """分析日志文件的模式（时间戳格式、日志级别、格式类型等）"""
    return bridge.analyze_log_pattern(file_id, sample_size)


@app.get("/api/suggest_layers")
def suggest_layers(file_id: str):
    """基于日志分析结果推荐图层配置"""
    return bridge.suggest_layers(file_id)


# ============================================================
# Export APIs
# ============================================================


@app.post("/api/export_logs")
def export_logs(data: dict = Body(...)):
    """导出日志文件"""
    from loglayer.export import LogExporter

    file_id = data.get("file_id")
    output_path = data.get("output_path")
    format = data.get("format", "txt")
    include_line_numbers = data.get("include_line_numbers", True)

    if file_id not in bridge._sessions:
        return {"success": False, "error": "File not found"}

    session = bridge._sessions[file_id]
    exporter = LogExporter(file_id, session.path)

    success = exporter.export_visible_lines(
        bridge, output_path, format, include_line_numbers
    )

    return {"success": success, "path": output_path if success else None}


# Serve Frontend
base_dir = os.path.dirname(os.path.abspath(__file__))
www_dir = os.path.join(base_dir, "www")

if os.path.exists(www_dir):
    app.mount("/", StaticFiles(directory=www_dir, html=True), name="static")


def run_server(host, port):
    try:
        uvicorn.run(
            app,
            host=host,
            port=port,
            log_level="warning",
            reload=False,
            loop="uvloop",
            http="httptools",
        )
    except OSError as e:
        if "address already in use" in str(e).lower():
            logger.info(
                f"[Server] Port {port} is in use, trying to find and kill existing process..."
            )
            import subprocess

            try:
                result = subprocess.run(
                    ["netstat", "-ano"], capture_output=True, text=True
                )
                for line in result.stdout.split("\n"):
                    if f":{port}" in line and "LISTENING" in line:
                        parts = line.split()
                        if len(parts) >= 5:
                            pid = parts[-1]
                            logger.info(f"[Server] Found process on port {port}, PID: {pid}")
                            try:
                                subprocess.run(
                                    ["taskkill", "/PID", pid, "/F"], check=True
                                )
                                logger.info(f"[Server] Killed process {pid}, retrying...")
                                time.sleep(1)
                                uvicorn.run(
                                    app,
                                    host=host,
                                    port=port,
                                    log_level="warning",
                                    reload=False,
                                    loop="uvloop",
                                    http="httptools",
                                )
                                return
                            except Exception as kill_err:
                                logger.error(f"[Server] Failed to kill process: {kill_err}")
            except Exception as netstat_err:
                logger.error(f"[Server] Failed to check netstat: {netstat_err}")
        logger.error(f"[ServerThread] Error: {e}")


def start_app():
    parser = argparse.ArgumentParser(description="LogLayer - Log file viewer")
    parser.add_argument("paths", nargs="*", help="Files or folders to open")
    parser.add_argument("--port", type=int, default=12345, help="Backend server port")
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Backend server host (use 0.0.0.0 for external access)",
    )
    parser.add_argument(
        "--no-ui", action="store_true", help="Start server only, no UI window"
    )
    args = parser.parse_args()

    port = args.port
    host = args.host

    # Windows taskbar icon fix
    if sys.platform == "win32":
        try:
            import ctypes

            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
                "qmjianda.loglayer.v1"
            )
        except (ImportError, AttributeError, OSError):
            # Icon setting is optional, fail silently
            pass

    # Start server in thread
    t = threading.Thread(
        target=run_server,
        args=(
            host,
            port,
        ),
        daemon=True,
    )
    t.start()

    # Give server a moment to start
    time.sleep(1)

    if host == "127.0.0.1":
        url = f"http://127.0.0.1:{port}"
    else:
        url = f"http://{host}:{port}"
    if not os.path.exists(www_dir):
        # Development mode (Vite)
        url = "http://localhost:3000"
        logger.info(f"Backend running on http://127.0.0.1:{port}")
        logger.info(f"Opening dev frontend: {url}")
    else:
        logger.info(f"Starting LogLayer on {url}")

    # Handle CLI paths
    def on_ready():
        if args.paths and len(args.paths) > 0:
            path = args.paths[0]
            abs_path = os.path.abspath(path)

            if os.path.isdir(abs_path):
                # Only set workspace, don't open all files (as requested)
                bridge.workspaceOpened.emit(abs_path)
            elif os.path.isfile(abs_path):
                # Just open the single file
                try:
                    stats = os.stat(abs_path)
                    file_id = (
                        f"cli-{int(stats.st_mtime)}-{stats.st_size}-{hash(abs_path)}"
                    )
                    bridge.open_file(file_id, abs_path)
                except Exception as e:
                    logger.error(f"[Main] CLI open_file error: {e}")

    # Subscribe to frontendReady to load CLI paths
    bridge.frontendReady.connect(on_ready)

    if not args.no_ui:
        # Create webview window
        window = webview.create_window("LogLayer", url, width=1200, height=800)
        # Pass window to bridge for native dialogs
        bridge.window = window

        # Set window icon
        icon_path = os.path.join(base_dir, "assets", "icon.png")
        if not os.path.exists(icon_path):
            # Try fallback path for some environments
            icon_path = os.path.join(os.getcwd(), "backend", "assets", "icon.png")

        # Start webview
        webview.start(icon=icon_path if os.path.exists(icon_path) else None)
    else:
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            # User interrupted
            pass
        except BaseException as e:
            if not isinstance(e, KeyboardInterrupt):
                logger.error(f"[Main] Error: {e}")
                import traceback

                traceback.print_exc()


if __name__ == "__main__":
    try:
        start_app()
    except BaseException as e:
        logger.critical(f"[Main] Fatal error: {e}")
