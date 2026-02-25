# Spec: 预加载优化

## ADDED Requirements

### Requirement: 预加载 buffer 充足

快速滚动时，系统 MUST 提前加载足够多的行到缓存中，确保用户看到的内容始终已加载。

#### Scenario: 正常滚动

- **WHEN** 用户以正常速度滚动日志
- **THEN** 滚动区域外的行已在缓存中
- **AND** 用户不会看到"加载中"提示

#### Scenario: 快速滚动

- **WHEN** 用户快速滚动（滚动速度 > 50px/100ms）
- **THEN** 预加载 buffer SHALL 动态增大，覆盖滚动方向前方至少 1500 行
- **AND** 滚动停止后，内容立即可见

#### Scenario: 滚动停止

- **WHEN** 用户停止滚动 100ms
- **THEN** 当前可视区域内的所有行 MUST 已完成加载
- **AND** 不显示加载提示

### Requirement: Request Debouncing

滚动过程中 SHALL 避免发送过多请求。

#### Scenario: Scroll request merge

- **WHEN** 在 50ms 内多次触发预加载请求
- **THEN** 仅执行最后一次请求
- **AND** 之前的请求 MUST 被取消
