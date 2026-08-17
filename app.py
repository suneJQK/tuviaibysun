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

# --- 1. CẤU HÌNH TRANG STREAMLIT ---
st.set_page_config(
    page_title="Tử Vi Đẩu Số Engine",
    page_icon="☯️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- 2. CSS HIỆN NÚT TOGGLE SIDEBAR VÀ ÉP FRAME ---
st.markdown(
    """
    <style>
    footer { visibility: hidden; }
    #MainMenu { visibility: hidden; }
    
    /* Ép hiện nút mở/đóng Sidebar ở góc trên trái */
    [data-testid="stSidebarCollapseButton"],
    [data-testid="collapsedControl"] {
        display: flex !important;
        visibility: visible !important;
        z-index: 999999 !important;
        top: 10px !important;
        left: 10px !important;
    }

    .block-container { padding: 0rem !important; margin: 0rem !important; max-width: 100% !important; }
    iframe { display: block; width: 100vw !important; height: 100vh !important; border: none; }
    </style>
""",
    unsafe_allow_html=True,
)

# --- 3. SECRETS & THƯ MỤC CẤU HÌNH ---
API_KEY = st.secrets.get("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
GITHUB_TOKEN = st.secrets.get(
    "GITHUB_TOKEN", os.environ.get("GITHUB_TOKEN", "")
)
GITHUB_REPO = st.secrets.get("GITHUB_REPO", os.environ.get("GITHUB_REPO", ""))

BASE_DIR = Path(__file__).parent
ENGINE_FILE = BASE_DIR / "tu_vi_engine.json"
INDEX_FILE = BASE_DIR / "index.html"


def upload_to_github(uploaded_file):
  if not GITHUB_TOKEN or not GITHUB_REPO:
    return False
  try:
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(GITHUB_REPO)
    ext = Path(uploaded_file.name).suffix
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = f"uploaded_laso/laso_{timestamp}{ext}"
    repo.create_file(
        file_path, f"Upload lá số: {timestamp}", uploaded_file.getvalue()
    )
    return True
  except Exception:
    return False


# --- 4. SESSION STATES ---
if "chat_history" not in st.session_state:
  st.session_state.chat_history = []

if (
    "analysis_result" not in st.session_state
    or st.session_state.analysis_result is None
):
  st.session_state.analysis_result = (
      "<p style='color:#a0aec0;'>👈 Mở thanh điều khiển bên trái, tải lá số và"
      " bấm Bắt Đầu Luận Giải.</p>"
  )

# --- 5. SIDEBAR ĐIỀU KHIỂN & KHUNG CHAT ---
with st.sidebar:
  st.title("⚙️ Điều Khiển Engine")
  uploaded_file = st.file_uploader(
      "📸 Tải lá số:", type=["jpg", "jpeg", "png", "webp"]
  )
  selected_year = st.number_input("📅 Năm Tiểu Hạn:", 1950, 2050, 2026)

  if st.button("🔮 BẮT ĐẦU LUẬN GIẢI", type="primary", use_container_width=True):
    if not uploaded_file:
      st.warning("⚠️ Vui lòng tải lên ảnh lá số!")
    elif not API_KEY:
      st.error("❌ Chưa cấu hình GEMINI_API_KEY!")
    else:
      with st.spinner("⚡ AI (Gemini 3.6) đang phân tích..."):
        upload_to_github(uploaded_file)
        image = Image.open(uploaded_file).convert("RGB")

        engine_rules = ""
        if ENGINE_FILE.exists():
          with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            engine_rules = f.read()[:30000]

        try:
          client = genai.Client(api_key=API_KEY)
          response = client.models.generate_content(
              model="gemini-3.6",
              contents=[
                  image,
                  (
                      f"Hãy lập bài luận giải lá số này. Năm Tiểu Hạn:"
                      f" {selected_year}."
                  ),
              ],
              config=types.GenerateContentConfig(
                  system_instruction=f"BỘ QUY TẮC:\n{engine_rules}",
                  temperature=0.2,
              ),
          )

          if response and response.text:
            st.session_state.analysis_result = str(response.text).replace(
                "\n", "<br>"
            )
            st.session_state.chat_history = []
            st.rerun()
        except Exception as e:
          st.error(f"❌ Lỗi API Gemini 3.6: {e}")

  st.markdown("---")
  st.subheader("💬 Trò Chuyện Bổ Sung")
  chat_input = st.text_input("Nhập câu hỏi:")
  if st.button("Gửi câu hỏi", use_container_width=True):
    if chat_input and API_KEY:
      try:
        client = genai.Client(api_key=API_KEY)
        prompt = f"BÀI LUẬN:\n{st.session_state.analysis_result}\n\nCÂU HỎI: {chat_input}"
        chat_res = client.models.generate_content(
            model="gemini-3.6", contents=[prompt]
        )
        if chat_res and chat_res.text:
          st.session_state.chat_history.append(("User", chat_input))
          st.session_state.chat_history.append(("AI", chat_res.text))
          st.rerun()
      except Exception as e:
        st.error(f"❌ Lỗi gửi chat: {e}")

# --- 6. RENDER DỮ LIỆU SANG FILE INDEX.HTML ---
if INDEX_FILE.exists():
  with open(INDEX_FILE, "r", encoding="utf-8") as f:
    html_content = f.read()

  chat_html = ""
  for role, text in st.session_state.chat_history:
    css_class = "chat-user" if role == "User" else "chat-ai"
    chat_html += f'<div class="chat-bubble {css_class}"><b>{role}:</b> {str(text).replace("\n", "<br>")}</div>'

  safe_analysis = str(st.session_state.analysis_result or "")

  final_html = html_content.replace(
      "<!-- CHAT_HISTORY_PLACEHOLDER -->", chat_html
  ).replace("<!-- ANALYSIS_RESULT_PLACEHOLDER -->", safe_analysis)

  components.html(final_html, height=1000, scrolling=True)
else:
  st.error("❌ Không tìm thấy tệp index.html trong cùng thư mục!")
