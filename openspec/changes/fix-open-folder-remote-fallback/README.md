# fix-open-folder-remote-fallback

Ctrl+Shift+O 打开文件夹在 --no-ui 远程模式下静默失效：handleNativeFolderSelect 返回 null 后未回退远程选择器
