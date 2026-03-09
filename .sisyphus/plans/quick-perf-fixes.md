# Quick Performance Fixes - 实施计划

## 修改 1: 修复进度信号 (workers.py:369-370)

### 当前代码
```python
if line_count % 10000 == 0:
    self.progress.emit(0)
```

### 问题
永远 emit(0) 没有任何意义，用户看不到实际进度。

### 修改方案
```python
if line_count % 10000 == 0:
    # Emit processed line count instead of meaningless 0
    # Frontend can display "Processing line X" or calculate relative progress
    self.progress.emit(float(line_count))
```

### 修改位置
- 文件: `backend/workers.py`
- 行号: 369-370

---

## 修改 2: 更新缓存注释 (bridge.py:235-242)

### 当前代码
```python
self.processing_cache = {}
self.rendering_cache = LRUCache(max_size=5000)
```

### 问题
注释说有两个 LRU 缓存，但实际 `processing_cache` 是普通 dict，只有一个 LRU 缓存。

### 修改方案
更新 LogSession 类的注释:
```python
# Note: processing_cache is a plain dict for potential future use
# Currently only rendering_cache uses LRU for line data
self.processing_cache = {}  # Reserved for future processing-level caching
self.rendering_cache = LRUCache(max_size=5000)  # LRU cache for rendered line data
```

### 修改位置
- 文件: `backend/bridge.py`
- 行号: 235-236

---

## 修改 3: 添加 Pipeline 日志

### 修改位置
- 文件: `backend/bridge.py` (_start_pipeline 方法)
- 文件: `backend/workers.py` (PipelineWorker.run)

### 添加日志位置

**bridge.py:614 (_start_pipeline 方法开始)**
```python
logger.info(f"[Pipeline] Starting pipeline for file: {file_id}, layers: {len(layer_instances)}")
```

**bridge.py:632 (worker 创建后)**
```python
logger.info(f"[Pipeline] PipelineWorker started for file: {file_id}")
```

**workers.py:226 (run 方法开始)**
```python
logger.info(f"[Pipeline] Processing {len(self.layers)} layers for file: {self.file_path}")
```

**workers.py:372-373 (完成时)**
```python
if self._is_running:
    logger.info(f"[Pipeline] Finished - visible lines: {len(visible_indices)}, search matches: {len(search_matches)}")
    self.finished.emit(visible_indices, search_matches)
```

**workers.py:375-377 (错误处理)**
```python
except Exception as e:
    logger.error(f"[Pipeline] Error processing file: {self.file_path}: {e}")
    if self._is_running:
        self.error.emit(str(e))
```

---

## 修改 4: 图层分类注释优化 (core.py)

### 当前代码
```python
class DataProcessingLayer(FilterLayer, TransformLayer):
    """旧的处理层基类 (合并了过滤和转换)"""
    category = "processing"
```

### 问题
注释说"旧的处理层基类"，但实际仍在使用，且继承关系混乱。

### 修改方案
添加更清晰的注释:
```python
class DataProcessingLayer(FilterLayer, TransformLayer):
    """
    Legacy processing layer base class (merged filter and transform).
    
    Note: This class exists for backward compatibility.
    - FILTERING layers: Decide visibility (filter_line returns bool)
    - TRANSFORM layers: Modify content (process_line returns ProcessedLine)
    - Actual behavior depends on which methods the subclass implements.
    """
    category = "processing"  # Legacy category, actual category comes from subclass methods
```

---

## 验证步骤

修改完成后执行:
```bash
# 运行测试
pytest tests/ -v

# 启动应用测试进度信号
python backend/main.py &
# 打开日志文件观察 Pipeline 日志输出
```

---

## 影响范围

| 文件 | 修改类型 | 影响 |
|:-----|:---------|:-----|
| backend/workers.py | 功能修复 | 用户能看到处理进度 |
| backend/bridge.py | 注释更新 | 代码可维护性提升 |
| backend/loglayer/core.py | 注释更新 | 理解图层系统更容易 |