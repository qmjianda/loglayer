"""
WebSocket Manager - Handles real-time communication with frontend.
"""

import asyncio
from typing import List
from fastapi import WebSocket, WebSocketDisconnect

from logging_config import logger


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"WebSocket broadcast error: {e}")
                self.disconnect(connection)


manager = ConnectionManager()
