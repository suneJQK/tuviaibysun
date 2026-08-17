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

# --- CẤU HÌNH TRANG ---
st.set_page_config(
    page_title="Tử Vi Đẩu Số Engine",
    page_icon="☯️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Ẩn header/footer mặc định của Streamlit
st.markdown(
    """
    <style>
    #MainMenu, header, footer { visibility: hidden; }
    .block-container { padding: 0rem !important; margin: 0rem !important; max-width: 100% !important; }
    iframe { display: block; width: 100vw !important; height: 100vh !important; }
    </style>
""",
    unsafe_allow_html=True,
)

# --- SECRETS & DỮ LIỆU ---
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


def crop_12_cung_overlap(img):
  width, height = img.size
  w_step, h_step = width / 4, height / 4
  grid_map = {
      "Hợi": (3, 3),
      "Tý": (2, 3),
      "Sửu": (1, 3),
      "Dần": (0, 3),
      "Mão": (0, 2),
      "Thìn": (0, 1),
      "Tị": (0, 0),
      "Ngọ": (1, 0),
      "Mùi": (2, 0),
      "Thân": (3, 0),
      "Dậu": (3, 1),
      "Tuất": (3, 2),
  }
  return {
      cung: img.crop(
          (col * w_step, row * h_step, (col + 1) * w_step, (row + 1) * h_step)
      )
      for cung, (col, row) in grid_map.items()
  }


# --- SESSION STATE ---
if "chat_history" not in st.session_state:
  st.session_state.chat_history = []
if "analysis_result" not in st.session_state:
  st.session_state.analysis_result = (
      "<p style='color:#a0aec0;'>👈 Hãy sử dụng thanh điều khiển bên trái để"
      " tải lá số và tạo bài luận giải.</p>"
  )

# --- SIDEBAR (BẢNG ĐIỀU KHIỂN CHÍNH) ---
with st.sidebar:
  st.title("⚙️ Điều Khiển Engine")
  uploaded_file = st.file_uploader(
      " Tải lên lá số:", type=["jpg", "jpeg", "png", "webp"]
  )
  selected_year = st.number_input("📅 Năm Tiểu Hạn:", 1950, 2050, 2026)

  if st.button("🔮 BẮT ĐẦU LUẬN GIẢI", type="primary", use_container_width=True):
    if not uploaded_file:
      st.warning("Vui lòng tải lên ảnh lá số!")
    elif not API_KEY:
      st.error("Chưa cấu hình GEMINI_API_KEY!")
    else:
      with st.spinner("AI đang xử lý..."):
        upload_to_github(uploaded_file)
        image = Image.open(uploaded_file).convert("RGB")
        cropped_dict = crop_12_cung_overlap(image)

        # Đọc quy tắc
        engine_rules = ""
        if ENGINE_FILE.exists():
          with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            engine_rules = f.read()

        client = genai.Client(api_key=API_KEY)
        content_payload = [image]
        for cung_name, crop_img in cropped_dict.items():
          content_payload.extend([f"Cung {cung_name}:", crop_img])
        content_payload.append(
            f"Lập luận giải chi tiết cho lá số. Năm Tiểu Hạn: {selected_year}."
        )

        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=content_payload,
            config=types.GenerateContentConfig(
                system_instruction=f"BỘ QUY TẮC BẮT BUỘC:\n{engine_rules[:150000]}",
                temperature=0.15,
            ),
        )

        if response and response.text:
          # Định dạng xuống dòng HTML
          st.session_state.analysis_result = response.text.replace(
              "\n", "<br>"
          )
          st.session_state.chat_history = []
          st.success("Hoàn tất!")
          st.rerun()

  st.markdown("---")
  st.subheader("💬 Hỏi đáp thêm")
  chat_input = st.text_input("Nhập câu hỏi:")
  if st.button("Gửi câu hỏi", use_container_width=True):
    if chat_input and API_KEY:
      client = genai.Client(api_key=API_KEY)
      prompt = f"BÀI LUẬN LÁ SỐ:\n{st.session_state.analysis_result}\n\nCÂU HỎI: {chat_input}"
      chat_res = client.models.generate_content(
          model="gemini-3.6-flash", contents=[prompt]
      )
      if chat_res and chat_res.text:
        st.session_state.chat_history.append(("User", chat_input))
        st.session_state.chat_history.append(("AI", chat_res.text))
        st.rerun()

# --- REENDER HTML ---
if INDEX_FILE.exists():
  with open(INDEX_FILE, "r", encoding="utf-8") as f:
    html_template = f.read()

  # Tạo HTML cho khung chat
  chat_html = ""
  for role, text in st.session_state.chat_history:
    css_class = "chat-user" if role == "User" else "chat-ai"
    chat_html += f'<div class="chat-bubble {css_class}"><b>{role}:</b> {text.replace("\n", "<br>")}</div>'

  # Ghép dữ liệu từ Python vào file HTML
  final_html = html_template.replace(
      "<!-- CHAT_HISTORY_PLACEHOLDER -->", chat_html
  ).replace(
      "<!-- ANALYSIS_RESULT_PLACEHOLDER -->", st.session_state.analysis_result
  )

  components.html(final_html, height=900, scrolling=False)
else:
  st.error("Không tìm thấy file index.html!")
