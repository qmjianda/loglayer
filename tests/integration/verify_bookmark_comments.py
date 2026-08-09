import json
import os
import sys

# Mocking the environment for testing
sys.path.append(os.path.join(os.getcwd(), 'backend'))
sys.path.append(os.path.join(os.getcwd(), 'backend', 'loglayer'))

from loglayer.builtin.bookmark import BookmarkLayer

def test_bookmark_layer_serialization():
    # 1. Test Dict Init
    config = {
        "bookmarks": {
            "10": "Test Comment 10",
            "20": ""
        },
        "color": "#ff0000"
    }
    layer = BookmarkLayer(config)
    print(f"Initialized with dict: {layer.bookmarks}")
    assert layer.bookmarks[10] == "Test Comment 10"
    assert layer.bookmarks[20] == ""
    
    # 2. Test List Init (Compatibility)
    config_old = {
        "bookmarks": [10, 20],
        "color": "#ff0000"
    }
    layer_old = BookmarkLayer(config_old)
    print(f"Initialized with old list: {layer_old.bookmarks}")
    assert 10 in layer_old.bookmarks
    assert layer_old.bookmarks[10] == ""

    # 3. Test comment set/clear (数据层语义，视觉渲染已前移到前端)
    layer.set_comment(10, "Updated Comment")
    assert layer.bookmarks[10] == "Updated Comment"
    assert layer.bookmarks[20] == ""

    layer.toggle(10)
    assert 10 not in layer.bookmarks
    layer.toggle(10)
    assert layer.bookmarks[10] == ""

    print("Success: BookmarkLayer tests passed!")

if __name__ == "__main__":
    test_bookmark_layer_serialization()
