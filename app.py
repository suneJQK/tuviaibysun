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

# --- 1. CẤU HÌNH TRANG ---
st.set_page_config(
    page_title="Tử Vi Đẩu Số Engine",
    page_icon="☯️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# --- 2. CSS TÙY CHỈNH: BIẾN SIDEBAR THÀNH NÚT BÁNH RĂNG & FIX LỖI MẤT TƯƠNG TÁC ---
st.markdown(
    """
    <style>
    /* Ẩn footer và menu mặc định */
    footer, #MainMenu, header { visibility: hidden; }
    .stApp { background-color: #0e1117; }

    /* Nút Bánh Răng Cố Định Góc Trên Bên Trái */
    [data-testid="stSidebarCollapseButton"],
    [data-testid="collapsedControl"] {
        display: flex !important;
        visibility: visible !important;
        position: fixed !important;
        top: 12px !important;
        left: 15px !important;
        z-index: 999999 !important;
        background: linear-gradient(135deg, #d4af37, #f6d365) !important;
        color: #111 !important;
        border-radius: 50% !important;
        width: 42px !important;
        height: 42px !important;
        align-items: center !important;
        justify-content: center !important;
        box-shadow: 0px 4px 12px rgba(246, 211, 101, 0.4) !important;
        cursor: pointer !important;
        border: none !important;
    }

    /* Đổi Icon Sidebar thành Bánh Răng ⚙️ */
    [data-testid="stSidebarCollapseButton"] svg,
    [data-testid="collapsedControl"] svg {
        display: none !important;
    }
    [data-testid="stSidebarCollapseButton"]::after,
    [data-testid="collapsedControl"]::after {
        content: "⚙️" !important;
        font-size: 20px !important;
    }

    /* Menu Cấu Hình Xổ Từ Trên Xuống (Top Overlay Sidebar) */
    [data-testid="stSidebar"] {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        max-width: 100vw !important;
        height: auto !important;
        max-height: 80vh !important;
        z-index: 999998 !important;
        background-color: #161922 !important;
        border-bottom: 2px solid #f6d365 !important;
        box-shadow: 0px 10px 30px rgba(0,0,0,0.8) !important;
        overflow-y: auto !important;
    }

    /* Nut Đóng Menu Xổ */
    [data-testid="stSidebar"] [data-testid="stSidebarCollapseButton"] {
        top: 12px !important;
        right: 20px !important;
        left: auto !important;
        background: #e53e3e !important;
    }
    [data-testid="stSidebar"] [data-testid="stSidebarCollapseButton"]::after {
        content: "✖" !important;
        color: #fff !important;
    }

    /* Style Tabs Đẹp Chuẩn */
    .stTabs [data-baseweb="tab-list"] {
        gap: 20px;
        justify-content: flex-end;
        border-bottom: 1px solid #262730;
        padding-bottom: 5px;
    }
    .stTabs [data-baseweb="tab"] {
        height: 45px;
        background-color: transparent;
        border-radius: 4px;
        color: #a0aec0;
        font-weight: 600;
    }
    .stTabs [aria-selected="true"] {
        color: #f6d365 !important;
        border-bottom-color: #f6d365 !important;
    }
    </style>
""",
    unsafe_allow_html=True,
)

# --- 3. LẤY SECRETS & CẤU HÌNH ---
API_KEY = st.secrets.get("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
GITHUB_TOKEN = st.secrets.get(
    "GITHUB_TOKEN", os.environ.get("GITHUB_TOKEN", "")
)
GITHUB_REPO = st.secrets.get("GITHUB_REPO", os.environ.get("GITHUB_REPO", ""))

BASE_DIR = Path(__file__).parent
ENGINE_FILE = BASE_DIR / "tu_vi_engine.json"
CACHE_FILE = BASE_DIR / "books_cache.json"
GEMINI_MODEL = "gemini-2.5-flash"


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


def load_cached_books():
  if not CACHE_FILE.exists():
    return [], "0 ký tự"
  try:
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
      data = json.load(f)
      titles = []
      text_len = len(str(data))
      if isinstance(data, list):
        for idx, item in enumerate(data):
          if isinstance(item, dict) and "title" in item:
            titles.append(f"{idx+1}. {item['title']}")
          elif isinstance(item, str):
            titles.append(f"{idx+1}. {item[:60]}...")
      return titles, f"{text_len:,} ký tự"
  except Exception:
    return [], "0 ký tự"


# --- 4. SESSION STATES ---
if "chat_history" not in st.session_state:
  st.session_state.chat_history = []
if "analysis_result" not in st.session_state:
  st.session_state.analysis_result = None

# --- 5. MENU CẤU HÌNH CÓ THỂ ĐÓNG/MỞ NỔI (BÁNH RĂNG) ---
with st.sidebar:
  st.title("⚙️ Cấu Hình Engine & Luận Giải")
  c1, c2, c3 = st.columns(3)

  with c1:
    uploaded_file = st.file_uploader(
        "📸 Tải lá số Tử Vi:", type=["jpg", "jpeg", "png", "webp"]
    )
    selected_year = st.number_input("📅 Năm Tiểu Hạn:", 1950, 2050, 2026)

  with c2:
    st.caption("📐 Căn chỉnh lề ảnh (nếu cần):")
    top_val = st.slider("Bỏ lề Trên (%)", 0, 25, 0)
    bot_val = st.slider("Bỏ lề Dưới (%)", 0, 25, 3)

  with c3:
    user_note = st.text_area("📝 Yêu cầu / Ghi chú thêm:", "Phân tích kỹ Cách Cục và vận hạn năm.", height=100)
    btn_analyze = st.button("🔮 BẮT ĐẦU LUẬN GIẢI", type="primary", use_container_width=True)

  if btn_analyze:
    if not uploaded_file:
      st.warning("⚠️ Vui lòng chọn ảnh lá số trước!")
    elif not API_KEY:
      st.error("❌ Chưa cấu hình GEMINI_API_KEY!")
    else:
      with st.spinner("⚡ AI đang lập bài luận giải..."):
        upload_to_github(uploaded_file)
        image = Image.open(uploaded_file).convert("RGB")

        engine_rules = ""
        if ENGINE_FILE.exists():
          with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            engine_rules = f.read()[:30000]

        try:
          client = genai.Client(api_key=API_KEY)
          response = client.models.generate_content(
              model=GEMINI_MODEL,
              contents=[
                  image,
                  f"Năm luận giải: {selected_year}. Ghi chú: {user_note}",
              ],
              config=types.GenerateContentConfig(
                  system_instruction=f"BỘ QUY TẮC:\n{engine_rules}",
                  temperature=0.2,
              ),
          )
          if response and response.text:
            st.session_state.analysis_result = response.text
            st.session_state.chat_history = []
            st.rerun()
        except Exception as e:
          st.error(f"❌ Lỗi xử lý: {e}")

# --- 6. GIAO DIỆN CHÍNH (3 TABS HOẠT ĐỘNG MƯỢT MÀ) ---
tab_main, tab_books, tab_contact = st.tabs([
    "☯️ Luận Giải Lá Số",
    "📚 Kho Dữ Liệu Sách & Phú",
    "🔗 Liên Hệ & Hỗ Trợ",
])

# TAB 1: LUẬN GIẢI & CHATBOT
with tab_main:
  col_chat, col_res = st.columns([1, 1.2], gap="medium")

  with col_chat:
    st.subheader("💬 Trò Chuyện & Hỏi Đáp")
    for role, text in st.session_state.chat_history:
      with st.chat_message("user" if role == "User" else "assistant"):
        st.write(text)

    chat_input = st.chat_input("Nhập câu hỏi về lá số...")
    if chat_input:
      if not API_KEY:
        st.error("Chưa cấu hình API Key.")
      else:
        st.session_state.chat_history.append(("User", chat_input))
        try:
          client = genai.Client(api_key=API_KEY)
          prompt = f"BÀI LUẬN:\n{st.session_state.analysis_result}\n\nCÂU HỎI: {chat_input}"
          chat_res = client.models.generate_content(
              model=GEMINI_MODEL, contents=[prompt]
          )
          if chat_res and chat_res.text:
            st.session_state.chat_history.append(("AI", chat_res.text))
            st.rerun()
        except Exception as e:
          st.error(f"Lỗi gửi tin nhắn: {e}")

  with col_res:
    st.subheader("📜 Kết Quả Luận Giải Chi Tiết")
    if st.session_state.analysis_result:
      st.markdown(st.session_state.analysis_result)
    else:
      st.info(
          "👈 Hãy bấm vào **⚙️ Bánh Răng** ở góc trên trái để tải lá số và tạo"
          " bài luận."
      )

# TAB 2: KHO SÁCH
with tab_books:
  st.subheader("📚 Kho Dữ Liệu Sách & Phú Tử Vi")
  titles, total_size = load_cached_books()
  st.metric("Tổng Dung Lượng Dữ Liệu Sách", total_size)
  st.markdown("---")
  if titles:
    for t in titles:
      st.markdown(f"- **{t}**")
  else:
    st.caption("Chưa có danh sách tài liệu hoặc chưa load file JSON cache.")

# TAB 3: LIÊN HỆ
with tab_contact:
  st.subheader("🔗 Thông Tin Liên Hệ & Kênh Hỗ Trợ")
  st.write("Mọi thắc mắc hoặc báo lỗi ứng dụng xin vui lòng truy cập:")
  col_a, col_b = st.columns(2)
  with col_a:
    st.info("### 🐙 GitHub Repository\nXem mã nguồn và báo lỗi dự án.")
  with col_b:
    st.success("### 💬 Telegram Support\nTham gia kênh hỗ trợ giải đáp.")
