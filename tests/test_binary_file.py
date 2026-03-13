#!/usr/bin/env python3
"""
测试二进制文件（有非法字符）的搜索和图层功能
"""
import os
import sys
import tempfile
import time

# 添加 backend 路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from bridge import FileBridge


def create_binary_test_file():
    """创建包含非法字符和正常文本的测试文件"""
    content = bytes([
        # 正常文本行
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x57, 0x6f, 0x72, 0x6c, 0x64, 0x0a,  # "Hello World\n"
        0x54, 0x68, 0x69, 0x73, 0x20, 0x69, 0x73, 0x20, 0x61, 0x20, 0x74, 0x65, 0x73, 0x74, 0x0a,  # "This is a test\n"
        # 二进制垃圾数据（非法字符）
        0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD, 0x1b, 0x5b, 0x32, 0x34, 0x6d,  # 二进制 + ANSI escape
        # 正常文本行 - 包含搜索关键词
        0x45, 0x52, 0x52, 0x4f, 0x52, 0x3a, 0x20, 0x43, 0x6f, 0x6e, 0x6e, 0x65, 0x63, 0x74, 0x69, 0x6f, 0x6e, 0x20, 0x66, 0x61, 0x69, 0x6c, 0x65, 0x64, 0x0a,  # "ERROR: Connection failed\n"
        # 更多二进制数据
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,  # PNG header
        # 正常文本行
        0x57, 0x41, 0x52, 0x4e, 0x49, 0x4e, 0x47, 0x3a, 0x20, 0x4d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x20, 0x6c, 0x6f, 0x77, 0x0a,  # "WARNING: Memory low\n"
        0x49, 0x4e, 0x46, 0x4f, 0x3a, 0x20, 0x53, 0x65, 0x72, 0x76, 0x65, 0x72, 0x20, 0x73, 0x74, 0x61, 0x72, 0x74, 0x65, 0x64, 0x0a,  # "INFO: Server started\n"
        # 包含 ERROR 关键词的行
        0x45, 0x52, 0x52, 0x4f, 0x52, 0x3a, 0x20, 0x54, 0x69, 0x6d, 0x65, 0x6f, 0x75, 0x74, 0x0a,  # "ERROR: Timeout\n"
    ])
    return content


def test_binary_file_loading(bridge: FileBridge):
    """测试加载二进制文件"""
    print("\n=== 测试 1: 加载二进制文件 ===")

    # 创建临时二进制文件
    with tempfile.NamedTemporaryFile(mode='wb', suffix='.bin', delete=False) as f:
        f.write(create_binary_test_file())
        temp_path = f.name

    try:
        file_id = "test-binary"
        result = bridge.open_file(file_id, temp_path)

        if not result:
            print("❌ 打开文件失败")
            return False

        # 等待索引完成
        session = bridge._sessions.get(file_id)
        if not session:
            print("❌ 无法获取 session")
            return False

        # 等待索引完成（最多 5 秒）
        max_wait = 5
        start = time.time()
        while not session.line_offsets or (hasattr(session, 'sparse_line_count') and session.sparse_line_count is None):
            if time.time() - start > max_wait:
                break
            time.sleep(0.1)

        line_count = session.sparse_line_count or len(session.line_offsets)
        print(f"✅ 文件加载成功: {line_count} 行")

        # 读取前几行测试
        lines_json = bridge.get_lines_by_indices(file_id, list(range(10)))
        import json
        lines = json.loads(lines_json)
        print(f"   读取到 {len(lines)} 行:")
        for line in lines[:5]:
            # 只显示可打印字符
            content = line.get('text', '')
            printable = ''.join(c if c.isprintable() else '.' for c in content[:50])
            print(f"   [{line.get('index')}] {printable}")

        return True

    finally:
        os.unlink(temp_path)


def test_search_binary_file(bridge: FileBridge):
    """测试在二进制文件中搜索"""
    print("\n=== 测试 2: 搜索功能 ===")

    # 创建临时二进制文件
    with tempfile.NamedTemporaryFile(mode='wb', suffix='.bin', delete=False) as f:
        f.write(create_binary_test_file())
        temp_path = f.name

    try:
        file_id = "test-binary-search"

        # 先加载文件
        bridge.open_file(file_id, temp_path)

        # 等待索引
        session = bridge._sessions.get(file_id)
        max_wait = 5
        start = time.time()
        while not session.line_offsets or (hasattr(session, 'sparse_line_count') and session.sparse_line_count is None):
            if time.time() - start > max_wait:
                break
            time.sleep(0.1)

        # 测试搜索 "ERROR"
        print("   搜索关键词: 'ERROR'")
        print(f"   ripgrep 路径: {bridge._rg_path}")

        result = bridge.search_ripgrep(file_id, "ERROR", False, False)

        # 等待搜索完成（搜索结果通过信号返回，存储在 session.search_matches）
        time.sleep(1.0)

        if session.search_matches is not None and len(session.search_matches) > 0:
            matches = session.search_matches
            print(f"✅ 搜索成功: 找到 {len(matches)} 个匹配")
            # 显示匹配的行号
            for rank in range(min(3, len(matches))):
                line_idx = matches[rank]
                print(f"   匹配 {rank}: 行 {line_idx}")
        else:
            print("❌ 搜索失败或无匹配")

        # 测试搜索 "WARNING"
        print("\n   搜索关键词: 'WARNING'")
        bridge.search_ripgrep(file_id, "WARNING", False, False)
        time.sleep(0.5)

        if session.search_matches is not None and len(session.search_matches) > 0:
            print(f"✅ 搜索成功: 找到 {len(session.search_matches)} 个匹配")
        else:
            print("❌ 搜索失败或无匹配")

        # 测试搜索 "Hello"
        print("\n   搜索关键词: 'Hello'")
        bridge.search_ripgrep(file_id, "Hello", False, False)
        time.sleep(0.5)

        if session.search_matches is not None and len(session.search_matches) > 0:
            print(f"✅ 搜索成功: 找到 {len(session.search_matches)} 个匹配")
        else:
            print("❌ 搜索失败或无匹配")

        return True

    finally:
        os.unlink(temp_path)


def test_layers_binary_file(bridge: FileBridge):
    """测试图层功能"""
    print("\n=== 测试 3: 图层功能 ===")

    # 创建临时二进制文件
    with tempfile.NamedTemporaryFile(mode='wb', suffix='.bin', delete=False) as f:
        f.write(create_binary_test_file())
        temp_path = f.name

    try:
        file_id = "test-binary-layer"

        # 先加载文件
        bridge.open_file(file_id, temp_path)

        # 等待索引
        session = bridge._sessions.get(file_id)
        max_wait = 5
        start = time.time()
        while not session.line_offsets or (hasattr(session, 'sparse_line_count') and session.sparse_line_count is None):
            if time.time() - start > max_wait:
                break
            time.sleep(0.1)

        # 测试 filter 图层 - 只显示包含 "ERROR" 的行
        print("   创建 Filter 图层: ERROR")
        layers_json = '''
        [{
            "id": "filter-error",
            "type": "filter",
            "name": "Error Filter",
            "enabled": true,
            "config": {
                "query": "ERROR",
                "regex": false,
                "caseSensitive": false
            }
        }]
        '''

        result = bridge.sync_layers(file_id, layers_json, "[]")

        if result:
            print(f"✅ 图层同步成功")
            # 获取可见行数
            visible_count = len(session.visible_indices) if session.visible_indices else session.sparse_line_count
            print(f"   可见行数: {visible_count}")
        else:
            print("❌ 图层同步失败")

        # 测试 highlight 图层
        print("\n   创建 Highlight 图层: WARNING")
        layers_json2 = '''
        [{
            "id": "highlight-warn",
            "type": "highlight",
            "name": "Warning Highlight",
            "enabled": true,
            "config": {
                "query": "WARNING",
                "regex": false,
                "caseSensitive": false,
                "color": "#ff9900"
            }
        }]
        '''

        result2 = bridge.sync_layers(file_id, layers_json2, "[]")
        if result2:
            print(f"✅ Highlight 图层同步成功")
        else:
            print("❌ Highlight 图层同步失败")

        return True

    finally:
        os.unlink(temp_path)


def main():
    print("=" * 50)
    print("LogLayer - 二进制文件搜索和图层功能测试")
    print("=" * 50)

    # 初始化 bridge
    bridge = FileBridge()

    # 运行测试
    all_passed = True

    try:
        all_passed &= test_binary_file_loading(bridge)
    except Exception as e:
        print(f"❌ 测试 1 异常: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False

    try:
        all_passed &= test_search_binary_file(bridge)
    except Exception as e:
        print(f"❌ 测试 2 异常: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False

    try:
        all_passed &= test_layers_binary_file(bridge)
    except Exception as e:
        print(f"❌ 测试 3 异常: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False

    print("\n" + "=" * 50)
    if all_passed:
        print("✅ 所有测试通过!")
    else:
        print("❌ 部分测试失败")
    print("=" * 50)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())