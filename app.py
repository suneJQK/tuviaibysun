#!/usr/bin/env python3
import base64
import io
import json
import os
from datetime import datetime
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image
import streamlit as st
import streamlit.components.v1 as components

# --- 1. CẤU HÌNH TRANG STREAMLIT ---
st.set_page_config(
    page_title="Tử Vi Đẩu Số Engine", page_icon="☯️", layout="wide"
)

# Ẩn UI mặc định của Streamlit
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

# --- 2. CẤU HÌNH BIẾN & ĐƯỜNG DẪN ---
API_KEY = st.secrets.get("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
BASE_DIR = Path(__file__).parent
ENGINE_FILE = BASE_DIR / "tu_vi_engine.json"
CACHE_FILE = BASE_DIR / "books_cache.json"
INDEX_FILE = BASE_DIR / "index.html"
GEMINI_MODEL = "gemini-2.5-flash"

# Session State lưu kết quả
if "analysis_result" not in st.session_state:
  st.session_state.analysis_result = (
      "<p style='color: #a0aec0;'>Chưa có kết quả luận giải.</p>"
  )


# --- 3. ĐỌC CACHE TÀI LIỆU AN TOÀN ---
def load_cached_books_safe():
  if not CACHE_FILE.exists():
    return [], "0 KB"
  try:
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
      content = f.read().strip()
      if not content:
        return [], "0 KB"
      data = json.loads(content)
      titles = []
      if isinstance(data, list):
        for idx, item in enumerate(data):
          if isinstance(item, dict) and "title" in item:
            titles.append(f"{idx+1}. {item['title']}")
          elif isinstance(item, str):
            titles.append(f"{idx+1}. {item[:50]}...")
      return titles, f"{len(content)/1024:.1f} KB"
  except Exception:
    return [], "0 KB"


# --- 4. RENDER GIAO DIỆN HỢP NHẤT ---
if INDEX_FILE.exists():
  titles, total_size = load_cached_books_safe()

  with open(INDEX_FILE, "r", encoding="utf-8") as f:
    html_content = f.read()

  # Ép kiểu dữ liệu sang String để tránh dứt điểm lỗi TypeError
  safe_analysis = str(st.session_state.analysis_result)

  final_html = (
      html_content.replace(
          "/* BOOK_TITLES_DATA */", json.dumps(titles, ensure_ascii=False)
      )
      .replace(
          "/* BOOK_SIZE_DATA */", json.dumps(total_size, ensure_ascii=False)
      )
      .replace("<!-- ANALYSIS_RESULT -->", safe_analysis)
  )

  # Hiển thị HTML giao diện
  components.html(final_html, height=1000, scrolling=False)
else:
  st.error("❌ Không tìm thấy file index.html trong cùng thư mục!")
