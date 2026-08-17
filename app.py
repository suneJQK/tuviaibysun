#!/usr/bin/env python3
import base64
import json
import os
from datetime import datetime
from pathlib import Path

from github import Github, GithubException
from google import genai
from google.genai import types
from PIL import Image
import streamlit as st
import streamlit.components.v1 as components

# --- CẤU HÌNH TRANG ---
st.set_page_config(
    page_title="Tử Vi Đẩu Số Engine", page_icon="☯️", layout="wide"
)

# Ẩn hoàn toàn các UI thừa của Streamlit
st.markdown(
    """
    <style>
    header, footer, #MainMenu, [data-testid="stSidebar"] { display: none !important; }
    .block-container { padding: 0rem !important; margin: 0rem !important; max-width: 100% !important; }
    iframe { display: block; width: 100vw !important; height: 100vh !important; border: none; }
    </style>
""",
    unsafe_allow_html=True,
)

# --- SECRETS & CONFIG ---
API_KEY = st.secrets.get("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
GITHUB_TOKEN = st.secrets.get(
    "GITHUB_TOKEN", os.environ.get("GITHUB_TOKEN", "")
)
GITHUB_REPO = st.secrets.get("GITHUB_REPO", os.environ.get("GITHUB_REPO", ""))

BASE_DIR = Path(__file__).parent
ENGINE_FILE = BASE_DIR / "tu_vi_engine.json"
CACHE_FILE = BASE_DIR / "books_cache.json"
INDEX_FILE = BASE_DIR / "index.html"
GEMINI_MODEL = "gemini-2.5-flash"


# --- SỬA LỖI READ JSON SAFE (KHÔNG BỊ CRASH KHI FILE RỖNG) ---
def load_cached_books_safe():
  if not CACHE_FILE.exists():
    return [], "0 KB"
  try:
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
      content = f.read().strip()
      if not content:  # Tránh lỗi JSONDecodeError nếu file rỗng
        return [], "0 KB"
      data = json.loads(content)
      titles = []
      text_len = len(str(data))
      if isinstance(data, list):
        for idx, item in enumerate(data):
          if isinstance(item, dict) and "title" in item:
            titles.append(f"{idx+1}. {item['title']}")
          elif isinstance(item, str):
            titles.append(f"{idx+1}. {item[:60]}...")
      return titles, f"{text_len / 1024:.1f} KB"
  except Exception:
    return [], "0 KB"


# --- RENDER GIAO DIỆN INDEX.HTML ---
if INDEX_FILE.exists():
  with open(INDEX_FILE, "r", encoding="utf-8") as f:
    html_content = f.read()

  titles, total_size = load_cached_books_safe()

  # Chèn dữ liệu an toàn vào index.html
  final_html = html_content.replace(
      "/* BOOK_TITLES_DATA */", json.dumps(titles, ensure_ascii=False)
  ).replace("/* BOOK_SIZE_DATA */", json.dumps(total_size, ensure_ascii=False))

  components.html(final_html, height=1000, scrolling=False)
else:
  st.error("❌ Không tìm thấy file index.html trong cùng thư mục!")
