#!/usr/bin/env python3
"""验证阿里云灵积 Qwen 模型配置"""

import os
import asyncio
import sys

API_KEY = os.environ.get("QWEN_API_KEY")
BASE_URL = os.environ.get("QWEN_URL")
MODEL = os.environ.get("MODEL_NAME", "qwen3.5-plus")

if not API_KEY or not BASE_URL:
    print("ERROR: 请设置环境变量 QWEN_API_KEY 和 QWEN_URL")
    print("示例: export QWEN_URL='https://your-api-endpoint'")
    print("      export QWEN_API_KEY='sk-your-key'")
    sys.exit(1)


async def test_qwen():
    from openai import AsyncOpenAI

    print(f"Testing Qwen model: {MODEL}")
    print(f"API Base URL: {BASE_URL}")
    print("-" * 40)

    client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL)

    try:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": "Say 'Hello, LogLayer!' in exactly those words."}],
            max_tokens=50,
        )
        print(f"Response: {response.choices[0].message.content}")
        print("-" * 40)
        print("SUCCESS: Qwen model is working!")
        return True
    except Exception as e:
        print(f"ERROR: {e}")
        return False


if __name__ == "__main__":
    success = asyncio.run(test_qwen())
    sys.exit(0 if success else 1)