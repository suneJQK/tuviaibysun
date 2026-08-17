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

# --- 1. CẤU HÌNH TRANG STREAMLIT ---
st.set_page_config(
    page_title="Tử Vi Đẩu Số - Luận Giải Tự Động Engine",
    page_icon="☯️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- 2. CSS TỐI ƯU GIAO DIỆN & GIỮ NÚT SIDEBAR ---
st.markdown(
    """
    <style>
    /* Chỉ ẩn Footer và Header mặc định, GIỮ LẠI Sidebar Toggle Button */
    footer { visibility: hidden; }
    .stApp { background-color: #0e1117; }

    /* Hiển thị cưỡng chế nút đóng/mở Sidebar */
    button[data-testid="stSidebarCollapseButton"],
    button[data-testid="baseButton-header"],
    div[data-testid="stSidebarNav"] button,
    [data-testid="collapsedControl"] {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 999999 !important;
    }

    /* Khóa cuộn trang chính để chia 2 cột cuộn độc lập */
    .main .block-container {
        padding-top: 2rem !important;
        padding-bottom: 0rem !important;
        max-width: 98% !important;
    }

    /* Tiêu đề chính */
    .main-header {
        font-size: 2rem;
        font-weight: 700;
        color: #f6d365;
        text-align: center;
        margin-bottom: 0.8rem;
        text-shadow: 0px 0px 10px rgba(246, 211, 101, 0.2);
    }

    /* CỘT TRÁI: CỐ ĐỊNH HOÀN TOÀN (Gồm Upload + Khung Chat) */
    [data-testid="column"]:nth-child(1) {
        height: calc(100vh - 130px);
        overflow-y: auto;
        padding-right: 15px;
        border-right: 1px solid #262730;
    }

    /* CỘT PHẢI: TRƯỢT/CUỘN ĐỘC LẬP (Bài luận giải dài) */
    [data-testid="column"]:nth-child(2) {
        height: calc(100vh - 130px);
        overflow-y: auto;
        padding-left: 15px;
    }

    /* Tùy chỉnh thanh cuộn đẹp mắt cho cả 2 cột */
    [data-testid="column"]::-webkit-scrollbar {
        width: 6px;
    }
    [data-testid="column"]::-webkit-scrollbar-thumb {
        background-color: #363945;
        border-radius: 4px;
    }
    [data-testid="column"]::-webkit-scrollbar-thumb:hover {
        background-color: #f6d365;
    }

    /* Style nút bấm */
    div.stButton > button[kind="primary"] {
        background: linear-gradient(90deg, #d4af37 0%, #f6d365 100%);
        color: #1a202c;
        font-weight: bold;
        border: none;
        border-radius: 8px;
        transition: all 0.3s ease;
    }
    div.stButton > button[kind="primary"]:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(246, 211, 101, 0.4);
    }
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
BOOKS_FILE = BASE_DIR / "books_cache.json"


@st.cache_data(ttl=3600)
def load_engine_rules():
  if not ENGINE_FILE.exists():
    return None, f"Không tìm thấy file: {ENGINE_FILE.name}"
  try:
    with open(ENGINE_FILE, "r", encoding="utf-8") as f:
      return json.load(f), None
  except Exception as e:
    return None, str(e)


@st.cache_data(ttl=3600)
def load_books_reference():
  if not BOOKS_FILE.exists():
    return None, f"Không tìm thấy file: {BOOKS_FILE.name}"
  try:
    with open(BOOKS_FILE, "r", encoding="utf-8") as f:
      data = json.load(f)
      return (
          json.dumps(data, ensure_ascii=False, indent=2)
          if isinstance(data, (dict, list))
          else str(data)
      ), None
  except Exception as e:
    return None, str(e)


def upload_to_github(uploaded_file):
  if not GITHUB_TOKEN or not GITHUB_REPO:
    return False, "Thiếu GITHUB_TOKEN hoặc GITHUB_REPO"
  try:
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(GITHUB_REPO)
    ext = Path(uploaded_file.name).suffix
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = f"uploaded_laso/laso_{timestamp}{ext}"
    repo.create_file(
        file_path,
        f"Upload lá số: {timestamp}",
        uploaded_file.getvalue(),
    )
    return True, f"https://github.com/{GITHUB_REPO}/blob/main/{file_path}"
  except Exception as e:
    return False, str(e)


def crop_12_cung_overlap(
    img, top_cut=0, bottom_cut=3, side_cut=0, overlap_px=15
):
  width, height = img.size
  left_start, right_end = width * (side_cut / 100), width * (
      1 - side_cut / 100
  )
  top_start, bottom_end = height * (top_cut / 100), height * (
      1 - bottom_cut / 100
  )

  w_step = (right_end - left_start) / 4
  h_step = (bottom_end - top_start) / 4

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
      cung: img.crop((
          max(0, left_start + col * w_step - overlap_px),
          max(0, top_start + row * h_step - overlap_px),
          min(width, left_start + (col + 1) * w_step + overlap_px),
          min(height, top_start + (row + 1) * h_step + overlap_px),
      ))
      for cung, (col, row) in grid_map.items()
  }


# --- 4. NẠP DỮ LIỆU & SESSION STATES ---
st.markdown(
    '<div class="main-header">☯️ TỬ VI ĐẨU SỐ LUẬN GIẢI TỰ ĐỘNG</div>',
    unsafe_allow_html=True,
)
engine_data, engine_err = load_engine_rules()
books_text, books_err = load_books_reference()

if "chat_history" not in st.session_state:
  st.session_state.chat_history = []
if "analysis_result" not in st.session_state:
  st.session_state.analysis_result = None

# --- 5. SIDEBAR (CÀI ĐẶT BÊN TRÁI) ---
with st.sidebar:
  st.image("https://img.icons8.com/color/96/yin-yang.png", width=64)
  st.title("⚙️ Cấu Hình Luận Giải")
  selected_year = st.number_input("📅 Năm luận Tiểu Hạn:", 1950, 2050, 2026, 1)
  user_note = st.text_area(
      "📝 Ghi chú / Yêu cầu thêm:",
      value="Yêu cầu AI áp dụng nghiêm ngặt quy tắc trong tu_vi_engine.json.",
      height=100,
  )
  btn_sidebar_analyze = st.button(
      "🔮 BẮT ĐẦU LUẬN GIẢI",
      type="primary",
      key="btn_sidebar",
      use_container_width=True,
  )

# --- 6. TABS HỆ THỐNG ---
tab_main, tab_rules, tab_books, tab_contact = st.tabs([
    "🔮 Luận Giải Lá Số",
    "📜 Bộ Quy Tắc Chính",
    "📚 Kho Tham Khảo",
    "🔗 Liên Hệ",
])

# ==========================================
# TAB 1: LUẬN GIẢI LÁ SỐ
# ==========================================
with tab_main:
  col_input, col_output = st.columns([1, 1.3], gap="medium")

  # CỘT TRÁI: CỐ ĐỊNH, CHỨA UPLOAD & CHAT
  with col_input:
    st.subheader("📸 Upload & Căn Chỉnh Lá Số")
    uploaded_file = st.file_uploader(
        "Tải lên ảnh lá số:", type=["jpg", "jpeg", "png", "webp"]
    )
    cropped_dict = {}

    if uploaded_file:
      if st.session_state.get("last_uploaded") != uploaded_file.name:
        with st.spinner("🐙 Đang lưu bản sao lá số..."):
          upload_to_github(uploaded_file)
          st.session_state.last_uploaded = uploaded_file.name

      image = Image.open(uploaded_file).convert("RGB")

      with st.expander("🛠️ Căn chỉnh lề & Tuần/Triệt", expanded=False):
        top_val = st.slider("⬆️ Bỏ lề TRÊN (%):", 0, 25, 0, 1)
        bottom_val = st.slider("⬇️ Bỏ lề DƯỚI (%):", 0, 25, 3, 1)
        side_val = st.slider("↔️ Bỏ lề TRÁI/PHẢI (%):", 0, 15, 0, 1)
        overlap_val = st.slider("🔍 Vùng phủ (Px):", 5, 40, 15, 1)

      st.image(image, caption="Lá số đã tải", use_container_width=True)
      cropped_dict = crop_12_cung_overlap(
          image, top_val, bottom_val, side_val, overlap_val
      )

      with st.expander("🔍 Xem mảnh cắt 12 Cung"):
        cols = st.columns(3)
        for idx, (name, crop_img) in enumerate(cropped_dict.items()):
          cols[idx % 3].image(
              crop_img, caption=f"Cung {name}", use_container_width=True
          )

    btn_main_analyze = st.button(
        "🔮 BẮT ĐẦU LUẬN GIẢI",
        type="primary",
        key="btn_main",
        use_container_width=True,
    )

    # KHUNG CHAT TRONG CỘT TRÁI
    st.markdown("---")
    st.subheader("💬 Trò Chuyện & Hỏi Thêm AI Về Lá Số")

    # Render Lịch Sử Chat
    for message in st.session_state.chat_history:
      with st.chat_message(message["role"]):
        st.markdown(message["content"])

    # Ô nhập liệu chat
    if chat_input_text := st.chat_input(
        "Đặt câu hỏi cho AI (Ví dụ: Hạn năm nay ra sao?, Cung Tử Tức thế"
        " nào?...)"
    ):
      if not st.session_state.analysis_result:
        st.warning("⚠️ Hãy thực hiện Luận Giải Lá Số trước khi bắt đầu chat!")
      else:
        st.session_state.chat_history.append(
            {"role": "user", "content": chat_input_text}
        )

        try:
          client = genai.Client(api_key=API_KEY)

          chat_system_instruction = (
              "Bạn là Chuyên Gia Tử Vi Đẩu Số đang trực tiếp tư vấn cho gia"
              " chủ.\n"
              "Dựa vào BÀI LUẬN ĐÃ LẬP dưới đây để trả lời câu hỏi chi"
              " tiết:\n\n"
              f"BÀI LUẬN LÁ SỐ:\n{st.session_state.analysis_result}"
          )

          history_context = ""
          for msg in st.session_state.chat_history[:-1]:
            role_name = "User" if msg["role"] == "user" else "AI"
            history_context += f"{role_name}: {msg['content']}\n"

          full_prompt = f"{history_context}\nUser: {chat_input_text}\nAI:"

          # CẬP NHẬT TÊN MODEL SANG GEMINI-3.6-FLASH
          chat_response = client.models.generate_content(
              model="gemini-3.6-flash",
              contents=[full_prompt],
              config=types.GenerateContentConfig(
                  system_instruction=chat_system_instruction,
                  temperature=0.3,
              ),
          )

          if chat_response and chat_response.text:
            st.session_state.chat_history.append(
                {"role": "assistant", "content": chat_response.text}
            )
            st.rerun()
        except Exception as e:
          st.error(f"Lỗi phản hồi: {e}")

  # CỘT PHẢI: KẾT QUẢ VĂN BẢN (CUỘN ĐỘC LẬP)
  with col_output:
    st.subheader("📜 Kết Quả Luận Giải Tự Động")

    if btn_sidebar_analyze or btn_main_analyze:
      if not uploaded_file:
        st.warning("⚠️ Vui lòng tải lên ảnh lá số trước!")
      elif not API_KEY:
        st.error("❌ Chưa cấu hình GEMINI_API_KEY trong Secrets!")
      elif not engine_data:
        st.error("❌ Thiếu file quy tắc `tu_vi_engine.json`!")
      else:
        with st.spinner("⚡ AI đang nạp quy tắc & thực thi luận giải..."):
          try:
            client = genai.Client(api_key=API_KEY)

            system_instruction_text = (
                "Bạn là Engine Suy Luận Tử Vi Đẩu Số Chuyên Sâu.\n"
                "BỘ QUY TẮC BẮT BUỘC:\n```json\n"
                f"{json.dumps(engine_data, ensure_ascii=False, indent=2)[:250000]}\n```"
            )

            user_prompt = (
                f"Lập luận giải cho lá số này. Năm Tiểu Hạn: {selected_year}."
                f" Ghi chú: {user_note}"
            )

            content_payload = [image]
            for cung_name, crop_img in cropped_dict.items():
              content_payload.extend([f"Cung {cung_name}:", crop_img])
            content_payload.append(user_prompt)

            # CẬP NHẬT TÊN MODEL SANG GEMINI-3.6-FLASH
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=content_payload,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction_text,
                    temperature=0.15,
                ),
            )

            if response and response.text:
              st.session_state.analysis_result = response.text
              st.session_state.chat_history = []
              st.success("✅ Hoàn tất luận giải!")
              st.rerun()

          except Exception as e:
            st.error(f"❌ Lỗi AI Engine: {e}")

    if st.session_state.analysis_result:
      st.markdown(st.session_state.analysis_result)
    else:
      st.info("👈 Bấm 'BẮT ĐẦU LUẬN GIẢI' ở cột bên trái để AI lập bài luận.")

# ==========================================
# TAB 2, 3, 4: GIỮ NGUYÊN TÍNH NĂNG
# ==========================================
with tab_rules:
  st.subheader("📜 Bộ Quy Tắc Cốt Lõi (`tu_vi_engine.json`)")
  if engine_data:
    st.json(engine_data)
  else:
    st.error(engine_err)

with tab_books:
  st.subheader("📚 Kho Tham Khảo Phú / Ví Dụ (`books_cache.json`)")
  if books_text:
    st.text_area("Dữ liệu sách:", value=books_text, height=600)
  else:
    st.warning(books_err)

with tab_contact:
  st.subheader("🔗 Liên Hệ & Hỗ Trợ Engine")
  st.markdown("- **Engine Tử Vi Đẩu Số Luận Giải Tự Động & Chatbot AI.**")
