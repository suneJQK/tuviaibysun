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

# --- CẤU HÌNH TRANG ---
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

# --- CONFIGS ---
API_KEY = st.secrets.get("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
BASE_DIR = Path(__file__).parent
ENGINE_FILE = BASE_DIR / "tu_vi_engine.json"
CACHE_FILE = BASE_DIR / "books_cache.json"
INDEX_FILE = BASE_DIR / "index.html"
GEMINI_MODEL = "gemini-2.5-flash"


def load_cached_books_safe():
  if not CACHE_FILE.exists():
    return [], "0 KB"
  try:
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
      content = f.read().strip()
      if not content:
        return [], "0 KB"
      data = json.loads(content)
      titles = [
          item.get("title", f"Mục {idx+1}") if isinstance(item, dict) else str(item)[:50]
          for idx, item in enumerate(data)
      ]
      return titles, f"{len(content)/1024:.1f} KB"
  except Exception:
    return [], "0 KB"


# --- KHỞI TẠO COMPONENT LIÊN KẾT HTML ↔ PYTHON ---
if INDEX_FILE.exists():
  titles, total_size = load_cached_books_safe()

  with open(INDEX_FILE, "r", encoding="utf-8") as f:
    html_template = f.read()

  # Chèn biến vào HTML
  formatted_html = html_template.replace(
      "/* BOOK_TITLES_DATA */", json.dumps(titles, ensure_ascii=False)
  ).replace("/* BOOK_SIZE_DATA */", json.dumps(total_size, ensure_ascii=False))

  # Đọc state kết quả luận giải cũ nếu có
  analysis_text = st.session_state.get(
      "analysis_result",
      "<p style='color: #a0aec0;'>Chưa có kết quả luận giải.</p>",
  )
  formatted_html = formatted_html.replace(
      "<!-- ANALYSIS_RESULT -->", analysis_text
  )

  # Tạo Custom Component
  custom_component = components.declare_component(
      "tu_vi_interface", path=str(BASE_DIR)
  )

  # LẮNG NGHE DỮ LIỆU TỪ INDEX.HTML TRẢ VỀ
  component_data = components.html(
      formatted_html, height=1000, scrolling=False
  )

  # XỬ LÝ KHI NGƯỜI DÙNG BẤM "BẮT ĐẦU LUẬN GIẢI"
  if (
      isinstance(component_data, dict)
      and component_data.get("action") == "ANALYZE"
  ):
    img_base64 = component_data.get("image", "").split(",")[1]
    year = component_data.get("year", 2026)
    note = component_data.get("note", "")

    # Giải mã ảnh từ HTML
    image_bytes = base64.b64decode(img_base64)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Gọi Gemini API
    if API_KEY:
      try:
        client = genai.Client(api_key=API_KEY)
        engine_rules = ""
        if ENGINE_FILE.exists():
          with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            engine_rules = f.read()[:30000]

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[image, f"Năm luận giải: {year}. Ghi chú: {note}"],
            config=types.GenerateContentConfig(
                system_instruction=f"BỘ QUY TẮC:\n{engine_rules}"
            ),
        )
        st.session_state["analysis_result"] = response.text
        st.rerun()  # Cập nhật lại UI với kết quả mới
      except Exception as e:
        st.error(f"Lỗi gọi AI: {e}")
    else:
      st.error("Chưa cài đặt GEMINI_API_KEY trong Secrets!")
