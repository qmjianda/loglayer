# refactor-history-relative-path

历史文件路径改存相对路径（相对工作区根），删除 /mnt/d 盘符映射与工作区自动搜索；平台兼容仅依赖路径分隔符（\ vs /）由 os.path/Path 天然处理
