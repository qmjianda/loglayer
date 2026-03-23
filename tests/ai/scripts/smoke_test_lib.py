#!/usr/bin/env python3
"""Smoke test using browser_use Python library"""

import asyncio
from browser_use import Browser, BrowserConfig

async def main():
    print("Starting browser-use smoke test...")
    
    config = BrowserConfig(
        headless=True,
        disable_security=True,
    )
    browser = Browser(config=config)
    
    try:
        print("Opening page...")
        page = await browser.navigate("http://localhost:3001")
        await page.wait_for_load_state("domcontentloaded")
        
        print(f"Title: {page.title}")
        print(f"URL: {page.url}")
        
        print("SUCCESS: Smoke test passed!")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    
    await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
