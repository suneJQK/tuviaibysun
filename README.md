# Tử Vi Đẩu Số — Professional UI (Redesigned)

Giao diện chuyên nghiệp cho dự án [suneJQK/tuviaibysun](https://github.com/suneJQK/tuviaibysun).
Backend FastAPI giữ nguyên (api/index.py, tuvi_engine, system_prompts, …) — chỉ thay **frontend**
(`web/index.html` + `web/style.css` + `web/app.js`).

## Cấu trúc gói frontend

```
web/
  index.html        ← bố cục mới (sidebar + board 12 cung + tabs AI/Audit/…)
  style.css         ← theme cosmic (gold/indigo), responsive, dark/light
  app.js            ← controller: gọi /api/lap-so, /api/luan-giai, audit, JSON, …
api/
  index.py          ← re-export từ repo gốc (giữ nguyên contract)
vercel.json         ← rewrite all → /api/index (FastAPI on Vercel)
runtime.txt         ← python-3.11.9
requirements.txt
```

## Tính năng UI

- **Sidebar** với form nhập liệu, hồ sơ, lưu trữ
- **Lá số 12 cung** dạng grid 4×3 + medallion trung tâm hiển thị Cách cục
- **Tabs**: Lá số · Cách cục · Sao · Quan hệ · Luận giải AI · Audit · Dữ liệu
- **AI Q&A** với quick-chips, chat UI, copy/export
- **Audit** panel có badge Engine authoritative
- **Theme light/dark** · responsive mobile (drawer + tabbar dọc)
- **Phím tắt**: `Ctrl+Enter` lập lá số, `Ctrl+K` tìm, `?` trợ giúp
- **In ấn** hỗ trợ `@media print`
- **Background** starfield + aurora (CSS only, không ảnh hưởng hiệu năng)

## Chạy local

```bash
pip install -r requirements.txt
uvicorn api.index:app --reload --port 8000
# → http://localhost:8000
```

## Deploy lên Vercel

1. Push repo lên GitHub (ví dụ `yourname/tuvi-ai-ui`).
2. Vào https://vercel.com/new → **Import Project** → chọn repo.
3. Framework preset: **Other**.
4. Bấm **Deploy**.
5. (Tuỳ chọn) Vào **Settings → Environment Variables** để thêm:
   - `GEMINI_API_KEY` (hoặc `GEMINI_API_KEY_1..20`)
   - `OPENAI_API_KEY`
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app`

> Lưu ý: Vercel hỗ trợ Python runtime, `api/index.py` được serve tự động nhờ `vercel.json` rewrite.
