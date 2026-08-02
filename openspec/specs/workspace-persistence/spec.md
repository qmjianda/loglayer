# workspace-persistence Specification

## Purpose
统一的工作区持久化底座。所有工作区级状态（布局、图层、书签、文件历史、设置）经统一接口持久化到 `.loglayer/` 下的 SQLite 存储，带 schema 版本，保证跨刷新/跨会话一致恢复。旧 `.loglayer/config.json` 与 `.loglayer/cache.db` 废弃删除，无数据迁移。

## Requirements

### Requirement: 统一持久化存储

系统 SHALL 提供单一的工作区持久化存储，承载布局、图层、书签、设置与文件历史，存储位置位于工作区 `.loglayer/` 目录内。

#### Scenario: 状态跨会话恢复
- **WHEN** 用户打开一个工作区
- **THEN** 该工作区的布局、图层、书签与文件历史从统一存储恢复
- **AND** 恢复后的状态与上次关闭时一致

### Requirement: schema 版本

系统 SHALL 为持久化数据维护 schema 版本，并为未来升级预留迁移框架。

#### Scenario: 版本记录
- **WHEN** 工作区存储被创建或打开
- **THEN** 存储带当前 schema 版本号
- **AND** 未来升级时可基于版本号执行迁移

### Requirement: 原子写入

系统 SHALL 以事务方式写入持久化数据，保证写入要么全部生效要么全部不生效。

#### Scenario: 布局写入
- **WHEN** 用户改变布局（拖拽/分屏/关闭面板）
- **THEN** 布局经原子事务写入存储
- **AND** 中途失败不产生半写状态

### Requirement: 布局标识与文件解耦

系统 SHALL 使用基于文件路径（uri）的稳定标识标识面板，而非每次会话变化的 fileId。

#### Scenario: 刷新后布局一致
- **WHEN** 用户打开若干文件（叠放或分屏）后刷新页面并重新打开工作区
- **THEN** 布局（分屏结构、叠放顺序、面板位置）与刷新前一致
- **AND** 不因 fileId 变化产生错误的分屏

### Requirement: 废弃旧存储文件

系统 SHALL 废弃并删除旧 `.loglayer/config.json` 与 `.loglayer/cache.db`，不进行数据迁移。

#### Scenario: 旧存储文件清理
- **WHEN** 应用检测到工作区存在旧 `config.json` 或 `cache.db`
- **THEN** 这些旧文件被移除
- **AND** 所有状态由新统一存储接管，无旧数据保留

### Requirement: 后端状态 API

系统 SHALL 提供后端 API 读写统一存储，前端经该 API 访问持久化状态。

#### Scenario: 前端读写状态
- **WHEN** 前端需要读取或写入布局/设置/书签
- **THEN** 经后端状态 API 完成读写
- **AND** 写入为原子事务
