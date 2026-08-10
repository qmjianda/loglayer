"""线程安全的信号（Signal）实现，替代 pyqtSignal。"""

import threading


class Signal:
    """A simple replacement for pyqtSignal with thread safety."""

    def __init__(self, *types):
        self._callbacks = []
        self._lock = threading.Lock()

    def connect(self, callback):
        with self._lock:
            if callback not in self._callbacks:
                self._callbacks.append(callback)

    def disconnect(self, callback=None):
        with self._lock:
            if callback is None:
                self._callbacks = []
            elif callback in self._callbacks:
                self._callbacks.remove(callback)

    def emit(self, *args):
        with self._lock:
            callbacks = list(self._callbacks)
        for callback in callbacks:
            try:
                callback(*args)
            except Exception as e:
                print(f"Error in signal callback: {e}")
