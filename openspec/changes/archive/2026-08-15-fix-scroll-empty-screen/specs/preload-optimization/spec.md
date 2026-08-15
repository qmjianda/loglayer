# preload-optimization Delta Specification

## MODIFIED Requirements

### Requirement: 预加载 buffer 充足

系统 SHALL 在滚动时持续拉取「可视区前后各 M 行」（M 为配置常量，静态、无方向、无速度）到前端缓存，确保真实文本尽量就绪；允许快速滚动/拖条跳转时偶发占位（尽力而为，非强保证）。

#### Scenario: 正常滚动

- **WHEN** 用户以正常速度滚动日志
- **THEN** 可视区前后 M 行已在缓存中
- **AND** 用户看到真实文本而非占位

#### Scenario: 快速滚动

- **WHEN** 用户快速滚动
- **THEN** 系统持续按「可视区 ± M」拉取（窗口 re-anchor 时立即触发）
- **AND** 允许偶发占位，滚动停止后真实文本尽快就绪

#### Scenario: 滚动停止

- **WHEN** 用户停止滚动
- **THEN** 当前可视区及周边 M 行内的真实文本已在缓存中

### Requirement: Request Debouncing

滚动过程中 SHALL 控制请求频率，且 SHALL 允许在途请求完成并按行号合并结果。

#### Scenario: Scroll request merge

- **WHEN** 滚动过程中窗口 re-anchor 多次触发拉取
- **THEN** 不做时间防抖/节流，靠 re-anchor 滞后自然限流
- **AND** 已发出的在途请求不被取消，返回后按行号幂等合并到缓存
