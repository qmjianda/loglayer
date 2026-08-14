# render-throttling Delta Specification

## REMOVED Requirements

### Requirement: 滚动位置保持（常驻逐帧看门狗）

**Reason**: 看门狗逐帧检测「DOM 归零但 state>0」并拉回是治标补丁——在面板失活期间（隐藏元素）拉回无效，重新激活后又被切 tab 冗余 `syncAll` 触发的污染性 scroll 事件打断，从未根治。改为 dockview `always` 渲染策略从源头保持滚动位置。

**Migration**: 见 ADDED 的「滚动位置保持」需求；前端改用 `defaultRenderer="always"`，移除看门狗 rAF 循环与 `scrollStateRef` 同步逻辑。

## ADDED Requirements

### Requirement: 滚动位置保持

系统 SHALL 在 dockview 面板切换（激活/失活）时保持日志视图的滚动位置，不因面板失活/激活导致滚动容器 scrollTop 归零；通过 dockview `always` 渲染策略使失活面板内容常驻 DOM（以 visibility:hidden 隐藏），scrollTop 原生保持，无需逐帧检测与拉回。

#### Scenario: 面板切换不跳回首行

- **WHEN** 用户在面板 A 滚动到第 5000 行后切换到面板 B 再切回面板 A
- **THEN** 面板 A 视口保持在原滚动位置
- **AND** 不出现跳回首行

#### Scenario: 分屏切 tab 不跳回首行

- **WHEN** 分屏模式下，用户在面板 A 滚动到某位置后切换到面板 B 再切回面板 A
- **THEN** 面板 A 视口保持在原滚动位置
- **AND** 不出现跳回首行

#### Scenario: 拖拽移动面板后内容仍显示

- **WHEN** 用户拖拽一个已打开日志文件的面板移动到另一个分组（或从分屏中移出）
- **THEN** 面板内容仍正常显示，不出现空白
