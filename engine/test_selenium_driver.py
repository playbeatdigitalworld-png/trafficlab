"""Quick test: can selenium drive the downloaded Chrome for Testing?"""
import sys

DRIVER = "/home/z/my-project/Website-Traffic-Generator-With-GUI-main/drivers/chromedriver-linux64/chromedriver"
CHROME = "/home/z/my-project/Website-Traffic-Generator-With-GUI-main/drivers/chrome-headless-shell-linux64/chrome-headless-shell"

import selenium
print(f"testing with selenium {selenium.__version__}")

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By

opts = webdriver.ChromeOptions()
opts.binary_location = CHROME
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")

try:
    service = Service(executable_path=DRIVER)
    driver = webdriver.Chrome(service=service, options=opts)
    driver.get("https://example.com")
    title = driver.title
    print(f"[OK] Page title: {title!r}")
    links = driver.find_elements(By.XPATH, "//a[@href]")
    print(f"[OK] Found {len(links)} links on example.com")
    driver.quit()
    print("[SUCCESS] selenium + Chrome for Testing work together")
    sys.exit(0)
except Exception as e:
    print(f"[FAIL] {type(e).__name__}: {str(e)[:400]}")
    sys.exit(1)
