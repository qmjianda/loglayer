import os
import json
import time
import threading
from pathlib import Path
from backend.bridge import FileBridge, StatsWorker


def test_empty_file():
    print("--- Testing Empty File Line Count ---")
    bridge = FileBridge()

    test_file = Path("tests/empty_test.log")
    test_file.write_text("")

    results = {}
    loaded_event = threading.Event()

    def on_loaded(file_id, info_json):
        info = json.loads(info_json)
        results["lineCount"] = info["lineCount"]
        loaded_event.set()

    bridge.fileLoaded.connect(on_loaded)
    print("Calling open_file...")
    bridge.open_file("empty-id", str(test_file))
    loaded_event.wait(timeout=10)

    print(f"Empty file line count: {results.get('lineCount')}")
    assert results.get("lineCount") == 0, "Empty file should have 0 lines"

    if test_file.exists():
        test_file.unlink()


def test_stats_worker_termination():
    print("--- Testing StatsWorker Termination ---")

    test_file = Path("tests/stats_term_test.log")
    with open(test_file, "w") as f:
        for i in range(100000):
            f.write(f"Line {i} some content with ERROR\n")

    rg_path = "bin/windows/rg.exe"
    layers = [
        {"id": "l1", "type": "FILTER", "enabled": True, "config": {"query": "ERROR"}},
        {
            "id": "l2",
            "type": "HIGHLIGHT",
            "enabled": True,
            "config": {"query": "Line 100"},
        },
    ]

    worker = StatsWorker(rg_path, layers, str(test_file), 100000)
    worker.start()
    time.sleep(0.1)

    print("Stopping worker...")
    worker.stop()
    worker.wait(2000)

    is_running = worker.isRunning()
    print(f"Worker is running: {is_running}")

    if test_file.exists():
        test_file.unlink()

    assert not is_running, "Worker should have stopped"


if __name__ == "__main__":
    test_empty_file()
    test_stats_worker_termination()

    print("\n--- Bug Fix Summary ---")
    print("All tests passed!")

    import sys

    sys.exit(0)
