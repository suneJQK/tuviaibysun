#!/usr/bin/env python3
import json
import os
from datetime import datetime
from pathlib import Path

from github import Github
from google import genai
from google.genai import types
from PIL import Image
import streamlit as st
import streamlit.components.v1 as components

# --- CẤU HÌNH TRANG & CSS ẨN HOÀN TOÀN TẤT CẢ UI CỦA STREAMLIT ---
st.set_page_config(
    page_title="Tử Vi Đẩu Số Engine", page_icon="☯️", layout="wide"
)

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

# --- SECRETS & BIẾN CẤU HÌNH ---
API_KEY = st.secrets.get("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
GITHUB_TOKEN = st.secrets.get(
    "GITHUB_TOKEN", os.environ.get("GITHUB_TOKEN", "")
)
GITHUB_REPO = st.secrets.get("GITHUB_REPO", os.environ.get("GITHUB_REPO", ""))

BASE_DIR = Path(__file__).parent
ENGINE_FILE = BASE_DIR / "tu_vi_engine.json"
INDEX_FILE = BASE_DIR / "index.html"
GEMINI_MODEL = "gemini-2.5-flash"


def upload_to_github(file_bytes, file_name):
  if not GITHUB_TOKEN or not GITHUB_REPO:
    return False
  try:
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(GITHUB_REPO)
    ext = Path(file_name).suffix
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = f"uploaded_laso/laso_{timestamp}{ext}"
    repo.create_file(file_path, f"Upload lá số: {timestamp}", file_bytes)
    return True
  except Exception:
    return False


# --- KHỞI TẠO STATE ---
if "chat_history" not in st.session_state:
  st.session_state.chat_history = []
if "analysis_result" not in st.session_state:
  st.session_state.analysis_result = ""

# --- RENDER VÀ TRUYỀN DỮ LIỆU CHÍNH XÁC VÀO INDEX.HTML ---
if INDEX_FILE.exists():
  with open(INDEX_FILE, "r", encoding="utf-8") as f:
    html_content = f.read()

  components.html(html_content, height=1000, scrolling=False)
else:
  st.error("❌ Không tìm thấy tệp index.html trong cùng thư mục!")
