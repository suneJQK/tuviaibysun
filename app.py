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

# Cấu hình giao diện Streamlit
st.set_page_config(
    page_title="Tử Vi Đẩu Số Engine", page_icon="☯️", layout="wide"
)

# Secrets & Configs
API_KEY = st.secrets.get("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
GITHUB_TOKEN = st.secrets.get(
    "GITHUB_TOKEN", os.environ.get("GITHUB_TOKEN", "")
)
GITHUB_REPO = st.secrets.get("GITHUB_REPO", os.environ.get("GITHUB_REPO", ""))

BASE_DIR = Path(__file__).parent
ENGINE_FILE = BASE_DIR / "tu_vi_engine.json"
CACHE_FILE = BASE_DIR / "books_cache.json"
GEMINI_MODEL = "gemini-3.6-flash"

# Session States
if "analysis_result" not in st.session_state:
  st.session_state.analysis_result = ""
if "chat_history" not in st.session_state:
  st.session_state.chat_history = []


# Hàm xử lý gọi Gemini API
def process_gemini(image_bytes, year, note):
  if not API_KEY:
    return "❌ Lỗi: Chưa cấu hình GEMINI_API_KEY trong Secrets!"
  try:
    image = Image.open(image_bytes).convert("RGB")
    engine_rules = ""
    if ENGINE_FILE.exists():
      with open(ENGINE_FILE, "r", encoding="utf-8") as f:
        engine_rules = f.read()[:30000]

    client = genai.Client(api_key=API_KEY)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[image, f"Năm luận giải: {year}. Ghi chú: {note}"],
        config=types.GenerateContentConfig(
            system_instruction=f"BỘ QUY TẮC:\n{engine_rules}",
        ),
    )
    return (
        response.text
        if response and response.text
        else "Không nhận được phản hồi từ AI."
    )
  except Exception as e:
    return f"❌ Lỗi xử lý API: {str(e)}"


# --- TẠO GIAO DIỆN TƯƠNG TÁC QUA STREAMLIT FORM CHE MỜ (SỬA LỖI ĐƠ WEBPAGE) ---
st.markdown(
    """
    <style>
    header, footer, #MainMenu { visibility: hidden; }
    .stApp { background-color: #0e1117; }
    </style>
""",
    unsafe_allow_html=True,
)

# Hiển thị giao diện Streamlit Native (Đảm bảo tương tác 100% không đơ)
st.title("☯️ Tử Vi Đẩu Số Engine")

tabs = st.tabs([
    "⚙️ Cấu Hình & Luận Giải",
    "💬 Trò Chuyện",
    "📚 Kho Dữ Liệu Sách",
])

with tabs[0]:
  col1, col2 = st.columns([1, 1])
  with col1:
    uploaded_file = st.file_uploader(
        "📸 Chọn ảnh lá số Tử Vi", type=["jpg", "png", "jpeg", "webp"]
    )
    selected_year = st.number_input("📅 Năm Tiểu Hạn", 1950, 2050, 2026)
    user_note = st.text_area("📝 Ghi chú thêm", "Phân tích kỹ Cách Cục.")
    btn_submit = st.button("🔮 BẮT ĐẦU LUẬN GIẢI", type="primary")

  with col2:
    st.subheader("📜 Kết Quả Luận Giải")
    if btn_submit:
      if uploaded_file is not None:
        with st.spinner("⚡ AI đang phân tích lá số..."):
          res = process_gemini(uploaded_file, selected_year, user_note)
          st.session_state.analysis_result = res
      else:
        st.warning("Vui lòng chọn file ảnh lá số!")

    if st.session_state.analysis_result:
      st.markdown(st.session_state.analysis_result)

with tabs[1]:
  st.subheader("💬 Trò Chuyện Cùng AI")
  for user_msg, ai_msg in st.session_state.chat_history:
    with st.chat_message("user"):
      st.write(user_msg)
    with st.chat_message("assistant"):
      st.write(ai_msg)

  chat_input = st.chat_input("Nhập câu hỏi về lá số...")
  if chat_input:
    if st.session_state.analysis_result:
      client = genai.Client(api_key=API_KEY)
      chat_prompt = f"BÀI LUẬN:\n{st.session_state.analysis_result}\n\nCÂU HỎI: {chat_input}"
      res = client.models.generate_content(
          model=GEMINI_MODEL, contents=[chat_prompt]
      )
      st.session_state.chat_history.append((chat_input, res.text))
      st.rerun()
    else:
      st.warning("Hãy luận giải lá số ở tab 1 trước!")

with tabs[2]:
  st.subheader("📚 Danh Sách Phú & Sách")
  if CACHE_FILE.exists():
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
      st.json(json.load(f))
  else:
    st.info("Chưa có file cache dữ liệu sách.")
