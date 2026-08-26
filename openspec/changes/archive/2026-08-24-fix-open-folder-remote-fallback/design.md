# Design: fix-open-folder-remote-fallback

## Context

现状调用链（打开文件夹）：

```
入口 A：SidebarView/欢迎页 onOpen ──▶ useFileActions.handleOpen
                                      ├─ hasNativeDialogs()==true ─▶ handleNativeFolderSelect() ─▶ setWorkspaceRoot
                                      └─ false ─▶ openRemotePicker(cb)  ✅ 已有回退
入口 B：Ctrl+Shift+O onOpenFolder ──▶ handleNativeFolderSelect()      ❌ 无回退，远程模式静默失效
入口 C：命令面板 file.openFolder   ──▶ handleNativeFolderSelect()      ❌ 无回退
```

根因：`handleNativeFolderSelect` 返回 `null` 同时表达"不支持原生对话框"与"用户取消"两种语义（useFileManagement.ts:309-332），回退决策被迫上移到各调用点，入口 B/C 遗漏。

## Goals / Non-Goals

- **Goals**：所有"打开文件夹"入口在远程模式下弹出 RemotePathPicker；取消无副作用；桌面行为不变。
- **Non-Goals**：不改动 RemotePathPicker 组件本身；不新增后端 API；不处理"打开文件"入口（`handleNativeFileSelect` 同样问题但范围外，见 Open Questions）。

## Decisions

### D1：回退收敛到统一编排函数 `handleOpenFolder`

在 `useFileActions` 中新增（或改造 `handleOpen` 为）统一的 `handleOpenFolder`：

```ts
const handleOpenFolder = useCallback(async () => {
  if (await hasNativeDialogs()) {
    const result = await selectFolderDialog();   // 仅原生选择 + 取消返回 null
    if (result) setWorkspaceRoot(result);
    return;
  }
  openRemotePicker(({ path, isDir }) => { /* isDir→setWorkspaceRoot；文件→handleOpenFileByPath */ });
}, [...]);
```

- 入口 B/C 全部改调 `handleOpenFolder`；命令面板 action 从裸 `handleNativeFolderSelect` 换成该函数。
- 替代方案（否决）：在每个调用点各自判 `hasNativeDialogs`——重复三处、易再遗漏。

### D2：拆分 `handleNativeFolderSelect` 的重载语义

将 useFileManagement 中的函数改为纯"原生对话框选择"，语义唯一：成功返回 `{path,name}`，用户取消/出错/无 fileBridge 返回 `null`；**移除内部的 `hasNativeDialogs()` 判断**（该判断属于编排层）。这样 null 只表示"没有选中"，编排层负责分流。

### D3：复用现有 RemotePathPicker 接线

`openRemotePicker` 已在 App.tsx 中接好回调与 AppOverlays 渲染，直接复用；`mode='both'` 保持现状（选目录设工作区 / 选文件直接打开），与 spec 的"结果生效"需求一致。

## Risks / Trade-offs

- 命令面板 action 签名从 `Promise<...|null>` 变为 `void`：仅 UI 触发，无返回值消费方，风险低。
- `handleOpen` 与新 `handleOpenFolder` 若并存会产生两个近似函数——按"简洁原则"，用 `handleOpenFolder` 取代 `handleOpen` 中文件夹相关部分（`handleOpen` 当前即只做文件夹打开，直接更名/收敛为一个函数）。

## Open Questions

- ~~`handleNativeFileSelect`（打开文件）在远程模式同样静默失效？~~ **已确认（实现阶段）**：Ctrl+O"打开文件"入口（App.tsx `onOpenFile`）实际调用的就是原 `handleOpen`（文件夹导向的统一编排），已具备回退；本次统一更名为 `handleOpenFolder` 后两入口同路。`handleNativeFileSelect` 在 App.tsx 中仅解构、无调用方（遗留死代码），不产生行为问题，不属本变更范围。
