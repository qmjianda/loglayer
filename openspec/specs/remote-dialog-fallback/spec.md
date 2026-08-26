# remote-dialog-fallback Specification

## Purpose
保证在原生文件对话框不可用的远程模式（--no-ui 浏览器访问）下，用户仍能通过前端 RemotePathPicker 完成打开文件/文件夹操作，所有入口行为与桌面模式一致。
## Requirements
### Requirement: 打开文件夹入口统一回退

系统 SHALL 为所有"打开文件夹"用户入口（统一打开按钮/菜单、Ctrl+Shift+O 快捷键、命令面板命令）提供一致的对话框分流：原生对话框可用时使用原生对话框；不可用时自动回退到 RemotePathPicker。

#### Scenario: 远程模式下按快捷键打开文件夹
- **WHEN** 后端以 --no-ui 模式运行（无原生对话框），用户按下 Ctrl+Shift+O
- **THEN** 前端弹出 RemotePathPicker 供浏览并选择服务器端目录

#### Scenario: 远程模式下从命令面板打开文件夹
- **WHEN** 后端以 --no-ui 模式运行，用户在命令面板执行"打开文件夹"
- **THEN** 前端弹出 RemotePathPicker

#### Scenario: 桌面模式下打开文件夹
- **WHEN** 后端带 pywebview 窗口运行（原生对话框可用），用户触发任一"打开文件夹"入口
- **THEN** 弹出原生文件夹选择对话框，不出现 RemotePathPicker

### Requirement: 回退选择的语义一致性

打开文件夹编排 SHALL 区分"用户取消"与"原生对话框不可用"两种结果：取消时不产生任何副作用，不可用时执行回退。

#### Scenario: 桌面模式下用户取消
- **WHEN** 用户在原生文件夹对话框中点击取消
- **THEN** 工作区根目录不变，无远程选择器弹出

#### Scenario: 远程模式下用户取消
- **WHEN** 用户在 RemotePathPicker 中关闭/取消
- **THEN** 工作区根目录不变

### Requirement: 回退选择结果生效

远程模式下经 RemotePathPicker 选中的目录 SHALL 被设为工作区根目录，选中的文件 SHALL 直接作为日志文件打开，与桌面模式结果一致。

#### Scenario: 远程模式选中目录
- **WHEN** 用户在 RemotePathPicker 中确认某个目录
- **THEN** 该目录成为工作区根目录，侧栏展示其中的日志文件

#### Scenario: 远程模式选中文件
- **WHEN** 用户在 RemotePathPicker 中选中一个文件
- **THEN** 该文件被作为日志文件打开

