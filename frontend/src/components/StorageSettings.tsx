import React, { useState } from 'react';
import { Button } from './common/Button';
import { Input } from './common/Input';

interface RemoteConnection {
  id: string;
  name: string;
  type: 'sftp' | 'smb';
  host: string;
  port: number;
  username: string;
}

interface StorageSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPath: string;
  onDefaultPathChange: (path: string) => void;
}

export const StorageSettings: React.FC<StorageSettingsProps> = ({
  isOpen,
  onClose,
  defaultPath,
  onDefaultPathChange,
}) => {
  const [localPath, setLocalPath] = useState(defaultPath);
  const [connections, setConnections] = useState<RemoteConnection[]>([]);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [newConnection, setNewConnection] = useState<Partial<RemoteConnection>>({
    type: 'sftp',
    port: 22,
  });

  const handleSave = () => {
    onDefaultPathChange(localPath);
    onClose();
  };

  const handleAddConnection = () => {
    if (!newConnection.name || !newConnection.host || !newConnection.username) return;
    const conn: RemoteConnection = {
      id: Date.now().toString(),
      name: newConnection.name,
      type: newConnection.type || 'sftp',
      host: newConnection.host,
      port: newConnection.port || 22,
      username: newConnection.username,
    };
    setConnections([...connections, conn]);
    setShowAddConnection(false);
    setNewConnection({ type: 'sftp', port: 22 });
  };

  const handleDeleteConnection = (id: string) => {
    setConnections(connections.filter((c) => c.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-secondary border-default rounded-lg w-[560px] max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-default">
          <h2 className="text-lg font-medium text-white">存储设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">本地存储</h3>
            <Input
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="默认日志目录路径"
            />
            <p className="text-xs text-gray-500 mt-1">打开文件时默认显示的目录</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">远程连接</h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddConnection(true)}
              >
                添加连接
              </Button>
            </div>

            {connections.length === 0 && !showAddConnection && (
              <div className="text-sm text-muted py-4 text-center border border-dashed border-default rounded">
                暂无远程连接
              </div>
            )}

            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between p-3 bg-tertiary rounded mb-2"
              >
                <div>
                  <div className="text-white font-medium">{conn.name}</div>
                  <div className="text-xs text-gray-500">
                    {conn.type.toUpperCase()} · {conn.username}@{conn.host}:{conn.port}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteConnection(conn.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}

            {showAddConnection && (
              <div className="p-4 bg-tertiary rounded border-default space-y-3">
                <Input
                  value={newConnection.name || ''}
                  onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                  placeholder="连接名称"
                />
                <div className="flex gap-2">
                  <select
                    value={newConnection.type}
                    onChange={(e) => setNewConnection({ ...newConnection, type: e.target.value as 'sftp' | 'smb' })}
                    className="px-3 py-2 bg-secondary border-default rounded text-primary"
                  >
                    <option value="sftp">SFTP</option>
                    <option value="smb">SMB</option>
                  </select>
                  <Input
                    value={newConnection.host || ''}
                    onChange={(e) => setNewConnection({ ...newConnection, host: e.target.value })}
                    placeholder="主机地址"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={newConnection.port || ''}
                    onChange={(e) => setNewConnection({ ...newConnection, port: parseInt(e.target.value) })}
                    placeholder="端口"
                    className="w-24"
                  />
                </div>
                <Input
                  value={newConnection.username || ''}
                  onChange={(e) => setNewConnection({ ...newConnection, username: e.target.value })}
                  placeholder="用户名"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowAddConnection(false)}>
                    取消
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleAddConnection}>
                    添加
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-default">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
};