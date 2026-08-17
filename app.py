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

# --- 1. CẤU HÌNH TRANG ---
st.set_page_config(
    page_title="Tử Vi Đẩu Số Engine",
    page_icon="☯️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- 2. CSS GIAO DIỆN CHUẨN ---
st.markdown(
    """
    <style>
    footer { visibility: hidden; }
    #MainMenu { visibility: hidden; }
    .stApp { background-color: #0e1117; }

    .main .block-container {
        padding-top: 1.5rem !important;
        padding-bottom: 0rem !important;
        max-width: 98% !important;
    }

    .main-header {
        font-size: 1.8rem;
        font-weight: 700;
        color: #f6d365;
        text-align: center;
        margin-bottom: 0.8rem;
    }

    [data-testid="column"]:nth-child(1) {
        height: calc(100vh - 120px);
        overflow-y: auto;
        padding-right: 15px;
        border-right: 1px solid #262730;
    }

    [data-testid="column"]:nth-child(2) {
        height: calc(100vh - 120px);
        overflow-y: auto;
        padding-left: 15px;
    }

    [data-testid="column"]::-webkit-scrollbar { width: 6px; }
    [data-testid="column"]::-webkit-scrollbar-thumb { background-color: #363945; border-radius: 4px; }
    [data-testid="column"]::-webkit-scrollbar-thumb:hover { background-color: #f6d365; }
    </style>
    """,
    unsafe_allow_html=True,
)

# --- 3. SECRETS & DỮ LIỆU ---
API_KEY = st.secrets.get("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
GITHUB_TOKEN = st.secrets.get(
    "GITHUB_TOKEN", os.environ.get("GITHUB_TOKEN", "")
)
GITHUB_REPO = st.secrets.get("GITHUB_REPO", os.environ.get("GITHUB_REPO", ""))

BASE_DIR = Path(__file__).parent
ENGINE_FILE = BASE_DIR / "tu_vi_engine.json"


@st.cache_data(ttl=3600)
def load_engine_rules():
  if not ENGINE_FILE.exists():
    return ""
  try:
    with open(ENGINE_FILE, "r", encoding="utf-8") as f:
      data = f.read()
      # Nén bớt dung lượng JSON để tránh tràn bộ nhớ API
      return data[:50000]
  except Exception:
    return ""


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
engine_rules = load_engine_rules()

if "chat_history" not in st.session_state:
  st.session_state.chat_history = []
if "analysis_result" not in st.session_state:
  st.session_state.analysis_result = None

# --- 5. SIDEBAR ĐIỀU KHIỂN ---
with st.sidebar:
  st.title("⚙️ Cấu Hình Luận Giải")
  selected_year = st.number_input("📅 Năm luận Tiểu Hạn:", 1950, 2050, 2026)
  user_note = st.text_area(
      "📝 Ghi chú / Yêu cầu thêm:",
      value="Áp dụng quy tắc luận giải chi tiết từng cung.",
      height=80,
  )
  btn_analyze = st.button(
      "🔮 BẮT ĐẦU LUẬN GIẢI", type="primary", use_container_width=True
  )

# --- 6. BỐ CỤC CHÍNH 2 CỘT ---
st.markdown(
    '<div class="main-header">☯️ TỬ VI ĐẨU SỐ LUẬN GIẢI TỰ ĐỘNG</div>',
    unsafe_allow_html=True,
)
col_left, col_right = st.columns([1, 1.3], gap="medium")

# --- CỘT TRÁI: UPLOAD VÀ CHATBOT ---
with col_left:
  st.subheader("📸 Tải Lá Số & Chat")
  uploaded_file = st.file_uploader(
      "Tải lên ảnh lá số:", type=["jpg", "jpeg", "png", "webp"]
  )

  if uploaded_file:
    image = Image.open(uploaded_file).convert("RGB")
    st.image(image, caption="Lá số đã tải", use_container_width=True)

  # Xử lý sự kiện bấm Bắt Đầu Luận Giải
  if btn_analyze:
    if not uploaded_file:
      st.warning("⚠️ Vui lòng tải lên ảnh lá số!")
    elif not API_KEY:
      st.error("❌ Chưa cấu hình GEMINI_API_KEY trong Secrets!")
    else:
      with st.spinner("⚡ AI đang phân tích lá số..."):
        try:
          upload_to_github(uploaded_file)
          client = genai.Client(api_key=API_KEY)

          # Đóng gói Prompt tối ưu gọn nhẹ
          system_instruction_text = (
              "Bạn là Chuyên Gia Tử Vi Đẩu Số.\nQUY TẮC LUẬN GIẢI:\n"
              f"{engine_rules}"
          )

          content_payload = [
              image,
              (
                  f"Hãy quan sát ảnh lá số Tử Vi này và lập bài luận giải chi"
                  f" tiết. Năm Tiểu Hạn: {selected_year}. Ghi chú:"
                  f" {user_note}"
              ),
          ]

          # Gọi Gemini 2.5 Flash
          response = client.models.generate_content(
              model="gemini-2.5-flash",
              contents=content_payload,
              config=types.GenerateContentConfig(
                  system_instruction=system_instruction_text,
                  temperature=0.2,
              ),
          )

          if response and response.text:
            st.session_state.analysis_result = response.text
            st.session_state.chat_history = []
            st.rerun()

        except Exception as e:
          st.error(f"❌ Lỗi Engine API: {e}")

  # KHUNG CHAT
  st.markdown("---")
  st.subheader("💬 Hỏi Đáp Chi Tiết")

  for msg in st.session_state.chat_history:
    with st.chat_message(msg["role"]):
      st.markdown(msg["content"])

  if chat_input_text := st.chat_input("Đặt câu hỏi về lá số..."):
    if not st.session_state.analysis_result:
      st.warning("⚠️ Hãy thực hiện Luận Giải Lá Số trước!")
    else:
      st.session_state.chat_history.append(
          {"role": "user", "content": chat_input_text}
      )
      try:
        client = genai.Client(api_key=API_KEY)
        chat_instruction = f"Bạn là Chuyên Gia Tử Vi. Dựa vào bài luận sau để trả lời:\n{st.session_state.analysis_result}"

        history_context = ""
        for msg in st.session_state.chat_history[:-1]:
          role_name = "User" if msg["role"] == "user" else "AI"
          history_context += f"{role_name}: {msg['content']}\n"

        full_prompt = f"{history_context}\nUser: {chat_input_text}\nAI:"

        chat_response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[full_prompt],
            config=types.GenerateContentConfig(
                system_instruction=chat_instruction, temperature=0.3
            ),
        )

        if chat_response and chat_response.text:
          st.session_state.chat_history.append(
              {"role": "assistant", "content": chat_response.text}
          )
          st.rerun()

      except Exception as e:
        st.error(f"Lỗi phản hồi: {e}")

# --- CỘT PHẢI: HIỂN THỊ BÀI LUẬN ---
with col_right:
  st.subheader("📜 Kết Quả Luận Giải Tự Động")
  if st.session_state.analysis_result:
    st.markdown(st.session_state.analysis_result)
  else:
    st.info("👈 Bấm 'BẮT ĐẦU LUẬN GIẢI' để AI lập bài luận.")
