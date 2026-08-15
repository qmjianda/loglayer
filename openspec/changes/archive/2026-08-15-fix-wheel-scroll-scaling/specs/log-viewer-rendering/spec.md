# log-viewer-rendering Delta Specification

## ADDED Requirements

### Requirement: 滚轮滚动按行滚动

系统 SHALL 在滚动缩放启用（总行数 × 行高超过浏览器滚动上限）时，将鼠标滚轮滚动归一化为按逻辑行滚动，使每格滚动的行数恒定，与小文件原生滚动一致，不因缩放比放大而每格跳几十上百行。

#### Scenario: 滚轮滚动不随缩放放大

- **WHEN** 打开超大文件（滚动缩放启用）并滚动鼠标滚轮
- **THEN** 每格滚动的逻辑行数恒定，与文件总行数无关
- **AND** 不因物理→逻辑缩放比放大导致每格跳几十上百行

#### Scenario: deltaMode 归一化

- **WHEN** 滚轮事件的 `deltaMode` 为 LINE（1）
- **THEN** 系统按「deltaY × 行高」换算逻辑滚动量
- **AND** `deltaMode` 为 PIXEL（0）时按 deltaY 直接作为逻辑像素
- **AND** `deltaMode` 为 PAGE（2）时按「deltaY × 视口高度」换算
