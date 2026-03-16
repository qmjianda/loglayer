
import re
from loglayer.core import TransformLayer
from loglayer.ui import SearchInput, StrInput

class ReplaceLayer(TransformLayer):
    """替换图层：使用正则表达式替换内容"""
    type_id = "REPLACE"
    display_name = "替换图层"
    description = "使用正则表达式替换内容"
    icon = "transform"
    
    inputs = [
        SearchInput("find", "查找内容", info="支持正则表达式"),
        StrInput("replace", "替换为", info=r"支持 \1, \2 引用"),
    ]

    def process_line(self, content: str) -> str:
        if not self.find:
            return content
        
        try:
            return re.sub(self.find, self.replace or "", content)
        except Exception:
            return content
