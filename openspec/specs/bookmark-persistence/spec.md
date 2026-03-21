# bookmark-persistence Specification

## Purpose

将书签持久化到文件系统，确保关闭文件后书签不丢失，类似图层预设的持久化机制。

## Requirements

### Requirement: Automatic Bookmark Persistence

书签 SHALL 自动保存到 `.loglayer/bookmarks/` 目录。

#### Scenario: Save on toggle

- **WHEN** 用户切换书签（添加或删除）
- **THEN** 书签 SHALL 自动保存到 `{project}/.loglayer/bookmarks/{file_hash}.json`
- **AND** 保存操作 SHALL 在后台异步执行

#### Scenario: Save on comment update

- **WHEN** 用户更新书签注释
- **THEN** 书签 SHALL 自动保存

### Requirement: Automatic Bookmark Loading

打开文件时 SHALL 自动加载已保存的书签。

#### Scenario: Load on file open

- **WHEN** 文件成功打开
- **THEN** 系统 SHALL 检查 `.loglayer/bookmarks/{file_hash}.json` 是否存在
- **AND** 如果存在，SHALL 加载书签到 `session.bookmarks`

#### Scenario: No bookmarks file

- **WHEN** 书签文件不存在
- **THEN** `session.bookmarks` SHALL 初始化为空字典 `{}`

### Requirement: Bookmark File Format

书签文件 SHALL 使用 JSON 格式。

#### Scenario: File structure

- **WHEN** 保存书签
- **THEN** 文件内容 SHALL 为：`{"line_index": "comment", ...}`
- **AND** 文件 SHALL 存储在 `{project}/.loglayer/bookmarks/{file_hash}.json`

#### Scenario: File hash

- **WHEN** 计算文件标识
- **THEN** SHALL 使用文件路径的 MD5 或 SHA256 哈希
- **AND** 哈希 SHALL 为 16 字符长度

### Requirement: Directory Creation

书签目录 SHALL 自动创建。

#### Scenario: Create bookmarks directory

- **WHEN** 首次保存书签
- **THEN** 系统 SHALL 创建 `.loglayer/bookmarks/` 目录
- **AND** 创建操作 SHALL 使用 `mkdir -p` 语义

### Requirement: Error Handling

书签持久化失败 SHALL 不影响核心功能。

#### Scenario: Save failure

- **WHEN** 书签保存失败
- **THEN** 系统 SHALL 记录错误日志
- **AND** 书签 SHALL 继续在内存中工作
- **AND** 不 SHALL 抛出异常中断用户操作

#### Scenario: Load failure

- **WHEN** 书签加载失败（文件损坏等）
- **THEN** 系统 SHALL 记录警告日志
- **AND** `session.bookmarks` SHALL 初始化为空字典