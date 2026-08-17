#!/usr/bin/env python3
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

# --- CẤU HÌNH STREAMLIT & MỞ RỘNG TOÀN MÀN HÌNH ---
st.set_page_config(
    page_title="Tử Vi Đẩu Số Engine", page_icon="☯️", layout="wide"
)

# Ẩn toàn bộ UI thừa của Streamlit
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

# --- KHỞI TẠO SECRETS & PATHS ---
API_KEY = st.secrets.get("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
GITHUB_TOKEN = st.secrets.get(
    "GITHUB_TOKEN", os.environ.get("GITHUB_TOKEN", "")
)
GITHUB_REPO = st.secrets.get("GITHUB_REPO", os.environ.get("GITHUB_REPO", ""))

BASE_DIR = Path(__file__).parent
ENGINE_FILE = BASE_DIR / "tu_vi_engine.json"
CACHE_FILE = BASE_DIR / "books_cache.json"
INDEX_FILE = BASE_DIR / "index.html"
GEMINI_MODEL = "gemini-3.6-flash"


# --- HÀM TẢI LÊN GITHUB ---
def upload_to_github(file_bytes, file_name):
  if not GITHUB_TOKEN or not GITHUB_REPO:
    return False, "Chưa cấu hình GITHUB_TOKEN hoặc GITHUB_REPO"
  try:
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(GITHUB_REPO)
    ext = Path(file_name).suffix
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = f"uploaded_laso/laso_{timestamp}{ext}"
    try:
      contents = repo.get_contents(file_path)
      repo.update_file(
          contents.path,
          f"Update lá số: {timestamp}",
          file_bytes,
          contents.sha,
      )
    except GithubException:
      repo.create_file(
          file_path, f"Upload lá số: {timestamp}", file_bytes
      )
    return True, f"https://github.com/{GITHUB_REPO}/blob/main/{file_path}"
  except Exception as e:
    return False, str(e)


# --- HÀM ĐỌC CACHE DỮ LIỆU SÁCH ---
def load_cached_data():
  if not CACHE_FILE.exists():
    return "", []
  try:
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
      data = json.load(f)
      titles = []
      if isinstance(data, list):
        for idx, item in enumerate(data):
          if isinstance(item, dict) and "title" in item:
            titles.append(
                f"{idx+1}. {item['title']} (Tác giả: {item.get('author', 'N/A')})"
            )
          elif isinstance(item, str):
            first_line = item.strip().split("\n")[0][:80]
            titles.append(f"{idx+1}. {first_line}...")
        return "\n\n".join([str(i) for i in data]), titles
      elif isinstance(data, dict):
        return json.dumps(data, ensure_ascii=False, indent=2), [
            "1. Dữ liệu sách dạng JSON Object"
        ]
      return str(data), ["1. Dữ liệu chuỗi thuần"]
  except Exception:
    return "", []


# --- RENDER FILE INDEX.HTML CHÍNH ---
if INDEX_FILE.exists():
  with open(INDEX_FILE, "r", encoding="utf-8") as f:
    html_content = f.read()

  # Đọc danh sách sách để truyền sang giao diện index.html
  books_text, books_titles = load_cached_data()

  # Chèn dữ liệu sách và thông tin hệ thống trực tiếp vào HTML
  final_html = html_content.replace(
      "/* BOOK_TITLES_DATA */", json.dumps(books_titles, ensure_ascii=False)
  ).replace(
      "/* BOOK_SIZE_DATA */",
      json.dumps(f"{len(books_text):,} ký tự", ensure_ascii=False),
  )

  components.html(final_html, height=1000, scrolling=False)
else:
  st.error("❌ Không tìm thấy tệp index.html trong cùng thư mục!")
