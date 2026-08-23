/* ============================================================
   TV AI — shell.js
   Tầng vỏ giao diện: nạp SAU app.js / van10.js / audit-ui.js / ui-enhancements.js.
   Nguyên tắc: KHÔNG tự suy luận dữ liệu Tử Vi. Mọi số liệu hiển thị ở đây
   đều đọc lại từ payload engine (#jsonBox) hoặc từ endpoint chính thức.
   ============================================================ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
  const asList = (v) => (Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []));
  const fold = (v) => String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .trim().toLowerCase();

  const THEME_KEY = 'tvai_theme';
  const VIEW_KEY = 'tvai_last_view';
  const PROFILE_KEY = 'tvai_profiles_v2';

  /* ---------------- Toast ---------------- */
  function toast(message, kind = '') {
    const host = $('toastHost');
    if (!host) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('gone');
      setTimeout(() => el.remove(), 260);
    }, 2600);
  }
  window.tvToast = toast;

  /* ---------------- Đọc chart hiện tại ---------------- */
  function readChart() {
    try {
      const raw = $('jsonBox')?.textContent?.trim();
      return raw && raw !== 'Chưa có dữ liệu.' ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /* ---------------- Giao diện sáng / tối ---------------- */
  function applyTheme(name) {
    const theme = name === 'paper' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'paper' ? '#f6f1e8' : '#14110e');
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  }
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'paper' ? 'ink' : 'paper';
    applyTheme(next);
    toast(next === 'paper' ? 'Giao diện sáng' : 'Giao diện tối');
  }

  /* ---------------- Drawer ---------------- */
  const isMobile = () => window.matchMedia('(max-width: 1060px)').matches;
  function setDrawer(open) {
    document.body.classList.toggle('drawer-open', open);
    const scrim = $('drawerScrim');
    if (scrim) scrim.hidden = !open;
    $('menuBtn')?.setAttribute('aria-expanded', String(open));
  }

  /* ---------------- Điều hướng ---------------- */
  function syncNav(view) {
    document.querySelectorAll('.nav[data-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
  }
  function goView(view) {
    if (typeof window.switchView === 'function') window.switchView(view);
    syncNav(view);
    try { localStorage.setItem(VIEW_KEY, view); } catch (_) {}
    if (isMobile()) setDrawer(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function patchSwitchView() {
    if (typeof window.switchView !== 'function' || window.switchView.__shell) return;
    const native = window.switchView;
    window.switchView = function patched(name) {
      const out = native.apply(this, arguments);
      syncNav(name);
      try { localStorage.setItem(VIEW_KEY, name); } catch (_) {}
      return out;
    };
    window.switchView.__shell = true;
  }

  /* ---------------- Trung tâm bàn số ---------------- */
  function renderBoardCenter(chart) {
    const host = $('boardCenter');
    if (!host) return;
    if (!chart) {
      host.innerHTML = '<div class="bc-empty">Chưa lập lá số</div>';
      return;
    }
    const tb = chart.thien_ban || {};
    const canChi = [tb.can_nam, tb.chi_nam].filter(Boolean).join(' ');
    const year = chart?.viewing?.year || '';
    host.innerHTML = `
      <div class="bc-title">${esc(tb.ten || 'Thiên Bàn')}</div>
      <div class="bc-sub">
        ${esc(canChi || '—')}<br>
        ${esc(tb.ban_menh || '—')}<br>
        ${esc(tb.ten_cuc || '—')}
      </div>
      ${year ? `<div class="bc-year">Năm xem ${esc(year)}</div>` : ''}`;
  }

  /* ---------------- Thông tin lưu hồ sơ ---------------- */
  function renderStorageInfo(chart) {
    const host = $('storageInfo');
    if (!host) return;
    const saved = chart?.storage?.user_profile;
    if (!saved) { host.innerHTML = ''; return; }
    const ok = saved.saved === true;
    host.innerHTML = `<span class="source-chip">${ok ? '✓' : '○'} Lưu hồ sơ máy chủ: ${esc(ok ? 'thành công' : (saved.error ? 'không khả dụng' : 'bỏ qua'))}</span>`;
  }

  /* ---------------- Kích thước payload ---------------- */
  function renderJsonSize() {
    const badge = $('jsonSizeBadge');
    const raw = $('jsonBox')?.textContent || '';
    if (!badge) return;
    const bytes = new TextEncoder().encode(raw === 'Chưa có dữ liệu.' ? '' : raw).length;
    badge.textContent = bytes > 1024 * 1024
      ? `${(bytes / 1048576).toFixed(2)} MB`
      : `${Math.round(bytes / 1024)} KB`;
  }

  /* ---------------- Đồng bộ khi engine trả dữ liệu ---------------- */
  function onChartChanged() {
    const chart = readChart();
    // app.js khai báo `chart` bằng let → không nằm trên window.
    // ui-enhancements.js lại đọc window.chart, nên phải phản chiếu ở đây.
    window.chart = chart;
    renderBoardCenter(chart);
    renderStorageInfo(chart);
    renderJsonSize();
    if (typeof window.renderLegendPublic === 'function') window.renderLegendPublic();
  }

  /* ---------------- Sức khỏe engine ---------------- */
  async function checkHealth() {
    const dot = $('engineDot');
    const text = $('engineStatusText');
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error('health');
      dot?.classList.add('live');
      if (text) text.textContent = `Engine online · ${d.service || 'tv-ai'} v${d.version || '—'}`;
    } catch (_) {
      dot?.classList.add('down');
      if (text) text.textContent = 'Không kết nối được engine';
    }
  }

  /* ---------------- Thư viện rule Cách Cục ---------------- */
  let cachLibrary = [];

  function renderCachLibrary(term = '') {
    const host = $('cachLibrary');
    if (!host) return;
    if (!cachLibrary.length) {
      host.innerHTML = '<div class="empty">Không tải được thư viện rule Cách Cục.</div>';
      return;
    }
    const q = fold(term);
    const items = cachLibrary.filter((x) => !q || fold(
      [x.name, x.id, x.category, x.description].filter(Boolean).join(' ')
    ).includes(q));
    if (!items.length) {
      host.innerHTML = '<div class="empty">Không có rule khớp từ khóa.</div>';
      return;
    }
    host.innerHTML = items.map((x) => {
      const extra = [x.reason, x.uu_khuyet_diem].filter(Boolean).join('\n\n');
      return `<article class="lib-item">
        <h4>${esc(x.name || 'Cách Cục')}</h4>
        <div class="lib-meta">
          <span class="tag">${esc(x.category || 'Engine')}</span>
          <span class="tag">Rule ID: <span class="rule-id">${esc(x.id ?? '—')}</span></span>
        </div>
        <p>${esc(x.description || '—')}</p>
        ${extra ? `<details><summary>Cơ sở luận / ưu khuyết</summary><p>${esc(extra)}</p></details>` : ''}
      </article>`;
    }).join('');
  }

  async function loadCachLibrary() {
    const host = $('cachLibrary');
    if (host) host.innerHTML = '<div class="empty">Đang tải thư viện rule…</div>';
    try {
      const r = await fetch('/api/cach-cuc', { cache: 'no-store' });
      const d = await r.json();
      cachLibrary = asList(d.items);
      const badge = $('cachLibraryCount');
      if (badge) badge.textContent = String(d.count ?? cachLibrary.length);
      renderCachLibrary($('cachLibrarySearch')?.value || '');
    } catch (_) {
      cachLibrary = [];
      renderCachLibrary();
    }
  }

  /* ---------------- Thiết lập AI (provider / mode) ---------------- */
  const cookie = {
    get(name) {
      const hit = document.cookie.split('; ').find((x) => x.startsWith(`${name}=`));
      return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : '';
    },
    set(name, value) {
      document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    },
  };

  let aiModes = [];

  function renderAiModeDesc() {
    const host = $('aiModeDesc');
    if (!host) return;
    const hit = aiModes.find((m) => m.id === $('aiModeSelect')?.value);
    host.textContent = hit
      ? `${hit.name || hit.id} · nguồn cấu hình: ${hit.file || '—'}`
      : 'Chưa có chế độ luận giải nào được nạp.';
  }

  function renderAiBadge() {
    const badge = $('aiProviderBadge');
    if (!badge) return;
    const sel = $('aiProviderSelect');
    const label = sel?.options?.[sel.selectedIndex]?.textContent
      || cookie.get('tv_ai_provider') || '—';
    badge.textContent = label;
  }

  async function loadAiPrefs() {
    try {
      const [mr, pr] = await Promise.all([
        fetch('/api/ai-modes', { cache: 'no-store' }),
        fetch('/api/ai-providers', { cache: 'no-store' }),
      ]);
      const md = await mr.json();
      const pd = await pr.json();

      aiModes = asList(md.modes);
      const modeSel = $('aiModeSelect');
      if (modeSel) {
        modeSel.innerHTML = aiModes.length
          ? aiModes.map((m) => `<option value="${esc(m.id)}">${esc(m.name || m.id)}</option>`).join('')
          : '<option value="standard">standard</option>';
        const current = cookie.get('tv_ai_mode') || 'standard';
        if (aiModes.some((m) => m.id === current)) modeSel.value = current;
      }

      const providers = asList(pd.providers);
      const provSel = $('aiProviderSelect');
      if (provSel) {
        provSel.innerHTML = providers.length
          ? providers.map((p) => `<option value="${esc(p.id)}">${esc(p.name || p.id)}</option>`).join('')
          : '<option value="gemini">Gemini</option>';
        const current = cookie.get('tv_ai_provider') || 'gemini';
        if (providers.some((p) => p.id === current)) provSel.value = current;
      }
      renderAiModeDesc();
      renderAiBadge();
    } catch (_) {
      const host = $('aiModeDesc');
      if (host) host.textContent = 'Không tải được danh sách chế độ AI.';
    }
  }

  function saveAiPrefs() {
    const mode = $('aiModeSelect')?.value;
    const provider = $('aiProviderSelect')?.value;
    if (mode) cookie.set('tv_ai_mode', mode);
    if (provider) cookie.set('tv_ai_provider', provider);
    renderAiBadge();
    toast('Đã lưu thiết lập AI', 'ok');
  }

  /* ---------------- Tách audit tên Cách Cục sang panel riêng ---------------- */
  let nameAuditWarn = false;

  /* Cả app.js (kiểm tra tên Cách Cục trong bài luận) và audit-ui.js (kiểm tra
     cấu trúc engine) đều ghi vào cùng một ô #auditResult và cùng badge
     #auditStatus — nghĩa là kết quả sau đè mất kết quả trước.
     Ở đây tách chúng ra hai panel và hợp nhất badge theo mức xấu nhất. */
  function reconcileAuditBadge() {
    const badge = $('auditStatus');
    if (!badge) return;
    if (nameAuditWarn) {
      badge.textContent = 'Audit warning';
      badge.className = 'warn';
    }
  }

  function patchNameAudit() {
    if (typeof window.auditAnswer !== 'function' || window.auditAnswer.__shell) return;
    const native = window.auditAnswer;
    window.auditAnswer = function patched(text) {
      const out = native.apply(this, arguments);
      nameAuditWarn = (out?.unverified || []).length > 0;
      const src = $('auditResult');
      const dst = $('auditNameResult');
      if (src && dst) {
        dst.innerHTML = src.innerHTML;
        src.innerHTML = '<div class="empty">Bấm “Chạy Audit” để kiểm tra cấu trúc engine.</div>';
      }
      const badge = $('nameAuditBadge');
      if (badge) {
        badge.textContent = nameAuditWarn
          ? `⚠ ${out.unverified.length} tên cần kiểm tra`
          : '✓ Không phát hiện tên tự sinh';
      }
      return out;
    };
    window.auditAnswer.__shell = true;
  }

  function patchStructureAudit() {
    const btn = $('runAuditBtn');
    if (!btn || btn.__shell) return;
    btn.addEventListener('click', () => setTimeout(reconcileAuditBadge, 0));
    btn.__shell = true;
  }

  function patchReset() {
    if (typeof window.reset !== 'function' || window.reset.__shell) return;
    const native = window.reset;
    window.reset = function patched() {
      const out = native.apply(this, arguments);
      const dst = $('auditNameResult');
      if (dst) dst.innerHTML = '<div class="empty">Chưa có bài luận để kiểm tra.</div>';
      const src = $('auditResult');
      if (src) src.innerHTML = '<div class="empty">Lập lá số rồi bấm “Chạy Audit”.</div>';
      const badge = $('nameAuditBadge');
      if (badge) badge.textContent = 'Chưa chạy';
      nameAuditWarn = false;
      const status = $('auditStatus');
      if (status) { status.textContent = 'Audit ready'; status.className = 'ok'; }
      const storage = $('storageInfo');
      if (storage) storage.innerHTML = '';
      renderBoardCenter(null);
      renderJsonSize();
      syncQCount();
      toast('Đã xóa dữ liệu lá số');
      return out;
    };
    window.reset.__shell = true;
  }

  /* ---------------- Bài luận AI: sao chép / tải ---------------- */
  function currentAnswerText() {
    const nodes = document.querySelectorAll('#chat .msg-bubble.assistant .answer-text');
    const last = nodes[nodes.length - 1];
    return last ? last.innerText.trim() : '';
  }

  async function copyAnswer() {
    const text = currentAnswerText();
    if (!text) { toast('Chưa có bài luận để sao chép'); return; }
    try {
      await navigator.clipboard.writeText(text);
      toast('Đã sao chép bài luận', 'ok');
    } catch (_) {
      toast('Trình duyệt chặn sao chép', 'err');
    }
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  function exportAnswer() {
    const text = currentAnswerText();
    if (!text) { toast('Chưa có bài luận để tải'); return; }
    const chart = readChart();
    const name = chart?.thien_ban?.ten || 'la-so';
    const head = [
      `# Luận giải Tử Vi — ${name}`,
      `Năm xem: ${chart?.viewing?.year ?? '—'}`,
      `Bản Mệnh: ${chart?.thien_ban?.ban_menh ?? '—'} · Mệnh Cục: ${chart?.thien_ban?.ten_cuc ?? '—'}`,
      '', '---', '',
    ].join('\n');
    download(`luan-giai-${fold(name).replace(/[^a-z0-9]+/g, '-') || 'la-so'}.md`, head + text, 'text/markdown;charset=utf-8');
    toast('Đã tải bài luận (.md)', 'ok');
  }

  function downloadChartJson() {
    const raw = $('jsonBox')?.textContent?.trim();
    if (!raw || raw === 'Chưa có dữ liệu.') { toast('Chưa có dữ liệu lá số'); return; }
    const chart = readChart();
    const stamp = [chart?.thien_ban?.ten, chart?.viewing?.year].filter(Boolean).join('-') || 'chart';
    download(`la-so-${fold(stamp).replace(/[^a-z0-9]+/g, '-')}.json`, raw, 'application/json;charset=utf-8');
    toast('Đã tải payload engine', 'ok');
  }

  /* ---------------- Xóa hồ sơ ---------------- */
  function deleteProfile() {
    const sel = $('profileSelect');
    const id = sel?.value;
    if (!id) { toast('Chưa chọn hồ sơ nào để xóa'); return; }
    let list = [];
    try { list = JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]'); } catch (_) {}
    const hit = list.find((x) => x.id === id);
    if (!hit) { toast('Không tìm thấy hồ sơ'); return; }
    if (!window.confirm(`Xóa hồ sơ “${hit.name || 'Không tên'} · ${hit.birth || ''}”?`)) return;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(list.filter((x) => x.id !== id)));
    if (typeof window.refreshProfiles === 'function') window.refreshProfiles();
    toast('Đã xóa hồ sơ', 'ok');
  }

  /* ---------------- Đếm ký tự câu hỏi ---------------- */
  function syncQCount() {
    const el = $('question');
    const out = $('qCount');
    if (el && out) out.textContent = String(el.value.length);
  }

  /* ---------------- Phím tắt ---------------- */
  const VIEW_ORDER = ['chart', 'cach', 'stars', 'relations', 'ai', 'audit', 'data'];

  function isTyping(el) {
    return el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      if (document.body.classList.contains('drawer-open')) { setDrawer(false); return; }
      const dlg = $('helpDialog');
      if (dlg?.open) dlg.close();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      $('calcBtn')?.click();
      return;
    }
    if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === '/') {
      e.preventDefault();
      goView('stars');
      setTimeout(() => $('starSearch')?.focus(), 90);
      return;
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= VIEW_ORDER.length) {
      goView(VIEW_ORDER[n - 1]);
      return;
    }
    if (e.key.toLowerCase() === 'f') { $('focusBoardBtn')?.click(); return; }
    if (e.key.toLowerCase() === 't') { toggleTheme(); }
  }

  /* ---------------- Trạng thái nút lập lá số ---------------- */
  function watchStatus() {
    const status = $('status');
    if (!status) return;
    new MutationObserver(() => {
      const text = status.textContent.trim();
      status.classList.remove('err', 'done');
      if (!text) return;
      if (/^Đã lập lá số/.test(text)) status.classList.add('done');
      else if (!/đang/i.test(text)) status.classList.add('err');
    }).observe(status, { childList: true, characterData: true, subtree: true });
  }

  /* ---------------- Khởi tạo ---------------- */
  function init() {
    try { applyTheme(localStorage.getItem(THEME_KEY) || 'ink'); } catch (_) { applyTheme('ink'); }

    patchSwitchView();
    patchNameAudit();
    patchStructureAudit();
    patchReset();

    // điều hướng: sidebar + tabbar dùng chung
    document.querySelectorAll('.nav[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => goView(btn.dataset.view));
    });

    // drawer
    $('menuBtn')?.addEventListener('click', () => setDrawer(!document.body.classList.contains('drawer-open')));
    $('drawerCloseBtn')?.addEventListener('click', () => setDrawer(false));
    $('drawerScrim')?.addEventListener('click', () => setDrawer(false));

    /* app.js gán trực tiếp `resetBtn.onclick = reset`, tức là giữ tham chiếu
       tới hàm GỐC trước khi được bọc thêm. Gán lại để chuỗi bọc chạy đủ. */
    const resetBtn = $('resetBtn');
    if (resetBtn) resetBtn.onclick = () => window.reset?.();

    // hành động thanh trên
    $('themeBtn')?.addEventListener('click', toggleTheme);
    $('downloadJsonBtn')?.addEventListener('click', downloadChartJson);
    $('deleteProfileBtn')?.addEventListener('click', deleteProfile);
    $('copyAnswerBtn')?.addEventListener('click', copyAnswer);
    $('exportAnswerBtn')?.addEventListener('click', exportAnswer);
    $('helpBtn')?.addEventListener('click', () => $('helpDialog')?.showModal());
    $('helpCloseBtn')?.addEventListener('click', () => $('helpDialog')?.close());

    // thư viện rule
    $('reloadCachLibraryBtn')?.addEventListener('click', loadCachLibrary);
    $('cachLibrarySearch')?.addEventListener('input', (e) => renderCachLibrary(e.target.value));

    // thiết lập AI
    $('saveAiPrefBtn')?.addEventListener('click', saveAiPrefs);
    $('aiModeSelect')?.addEventListener('change', renderAiModeDesc);
    $('aiProviderSelect')?.addEventListener('change', renderAiBadge);

    // câu hỏi nhanh
    $('quickAsk')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-q]');
      if (!btn) return;
      const box = $('question');
      if (!box) return;
      box.value = btn.dataset.q;
      syncQCount();
      box.focus();
    });
    $('question')?.addEventListener('input', syncQCount);

    // theo dõi payload engine
    const jsonBox = $('jsonBox');
    if (jsonBox) {
      new MutationObserver(onChartChanged).observe(jsonBox, { childList: true, characterData: true, subtree: true });
    }
    onChartChanged();

    watchStatus();
    document.addEventListener('keydown', onKeydown);

    // khôi phục khu vực đang xem
    try {
      const last = localStorage.getItem(VIEW_KEY);
      if (last && VIEW_ORDER.includes(last)) goView(last);
    } catch (_) {}

    checkHealth();
    loadCachLibrary();
    loadAiPrefs();
    syncQCount();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
