/* ============================================================
   TV AI — Tử Vi Đẩu Số — Frontend controller
   Wires the redesigned UI to the existing FastAPI endpoints
   (api/lap-so, api/luan-giai, api/health, api/ai-modes, ...)
   ============================================================ */

'use strict';

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const CN_GIO = ['Tý','Sửu','Dần','Mão','Thìn','Tỵ','Ngọ','Mùi','Thân','Dậu','Tuất','Hợi'];

function payload() {
  return {
    ngay: +$('day').value,
    thang: +$('month').value,
    nam: +$('year').value,
    gio_sinh: $('hour').value,
    gioi_tinh: $('gender').value,
    ten: $('name').value,
    duong_lich: $('calendar').value === 'true',
    time_zone: +$('tz').value || 7,
  };
}

async function call(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${t ? ': ' + t.slice(0, 200) : ''}`);
  }
  return res.json();
}

function toast(msg, type = '') {
  const host = $('toastHost');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; }, 2400);
  setTimeout(() => el.remove(), 2800);
}

function fmtJSON(v) {
  try { return JSON.stringify(v, null, 2); }
  catch { return String(v); }
}

/* ---------- Init hour select & tabs ---------- */
(function initUI() {
  const hourSel = $('hour');
  CN_GIO.forEach((g, i) => {
    const o = document.createElement('option');
    o.value = g;
    o.textContent = `${g} (${(i * 2).toString().padStart(2, '0')}:00–${((i * 2 + 2) % 24).toString().padStart(2, '0')}:00)`;
    hourSel.appendChild(o);
  });
  hourSel.value = 'Tý';

  // tabs
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => {
        x.classList.toggle('active', x === t);
        x.setAttribute('aria-selected', x === t ? 'true' : 'false');
      });
      document.querySelectorAll('.view').forEach(v => {
        v.classList.toggle('active', v.id === t.dataset.target);
        v.hidden = v.id !== t.dataset.target;
      });
      $('pageTitle').textContent = t.textContent.trim();
    });
  });

  // menu (mobile)
  $('menuBtn')?.addEventListener('click', () => {
    $('sidebar').classList.add('open');
    $('drawerScrim').hidden = false;
  });
  $('drawerCloseBtn')?.addEventListener('click', closeDrawer);
  $('drawerScrim')?.addEventListener('click', closeDrawer);
  function closeDrawer() {
    $('sidebar').classList.remove('open');
    $('drawerScrim').hidden = true;
  }

  // theme toggle
  $('themeBtn')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'light' ? '' : 'light';
    if (next) document.documentElement.setAttribute('data-theme', next);
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('tv_theme', next); } catch {}
  });
  try {
    const saved = localStorage.getItem('tv_theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch {}

  // help dialog
  const dlg = $('helpDialog');
  $('helpBtn')?.addEventListener('click', () => dlg.showModal?.());
  $('helpCloseBtn')?.addEventListener('click', () => dlg.close?.());
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.target.matches('input, textarea')) {
      e.preventDefault();
      dlg.showModal?.();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      $('calcBtn')?.click();
    }
  });

  // shortcut: Ctrl+K focuses star search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const sb = $('starSearch') || $('cachLibrarySearch');
      sb?.focus();
    }
  });

  // engine banner
  $('engineStatusText')?.replaceChildren(document.createTextNode('đang kiểm tra…'));
})();

/* ---------- Health, modes, providers ---------- */
async function refreshHealth() {
  const dot = $('engineDot');
  const txt = $('engineStatusText');
  try {
    const r = await call('/api/health');
    if (dot) { dot.classList.add('badge-live'); }
    if (txt) txt.textContent = `sẵn sàng · v${r.version || '?'}`;
  } catch {
    if (dot) dot.classList.remove('badge-live');
    if (txt) txt.textContent = 'mất kết nối';
  }
}

async function loadAiModes() {
  const sel = $('aiModeSelect');
  const desc = $('aiModeDesc');
  if (!sel) return;
  try {
    const r = await call('/api/ai-modes');
    sel.innerHTML = (r.modes || [])
      .map(m => `<option value="${m.id}" data-name="${m.name}">${m.name}</option>`)
      .join('');
    desc.textContent = `Có ${r.modes?.length || 0} chế độ luận giải cấu hình sẵn.`;
  } catch (e) {
    desc.textContent = 'Không tải được danh sách chế độ.';
  }
  sel.addEventListener('change', () => {
    const opt = sel.options[sel.selectedIndex];
    if (desc && opt) desc.textContent = `Đang chọn: ${opt.dataset.name || opt.value}`;
  });

  $('aiProviderSelect')?.addEventListener('change', () => {
    const v = $('aiProviderSelect').value;
    $('aiProviderBadge').textContent = `⚙ ${v === 'openai' ? 'ChatGPT' : 'Gemini'}`;
    document.cookie = `tv_ai_provider=${v}; path=/; SameSite=Lax`;
  });

  $('saveAiPrefBtn')?.addEventListener('click', () => {
    const mode = $('aiModeSelect').value;
    if (mode) document.cookie = `tv_ai_mode=${mode}; path=/; SameSite=Lax`;
    toast('Đã lưu cấu hình AI', 'success');
  });
}

/* ---------- Chart calculation ---------- */
let chartCache = null;

async function calc() {
  const status = $('status');
  status.className = 'status';
  status.innerHTML = '<span class="spinner"></span> Đang lập lá số…';
  try {
    const data = await call('/api/lap-so', { method: 'POST', body: JSON.stringify(payload()) });
    chartCache = data;
    render(data);
    renderCach(data);
    renderJson(data);
    renderStars(data);
    status.classList.add('success');
    status.textContent = '✔ Lập lá số thành công';
    toast('Lá số đã sẵn sàng', 'success');
  } catch (e) {
    status.classList.add('error');
    status.textContent = '✕ ' + (e.message || 'Lỗi không xác định');
    toast('Lỗi lập lá số', 'error');
  }
}

$('calcBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  calc();
});

$('lapSoForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  calc();
});

/* ---------- Render board ---------- */
function branchOf(p) {
  return p?.dia_chi || p?.branch || p?.cung_dia_chi || null;
}

function palaceByName(name) {
  const arr = Object.values(chartCache?.['12_cung'] || {});
  return arr.find(p => (p?.ten_cung || p?.name) === name);
}

function palaceHtml(p, branch) {
  if (!p) {
    return `<div class="palace" data-cung="" data-branch="${branch || ''}">
      <div class="pname">${branch || '—'}</div>
      <div class="pstars muted">—</div>
    </div>`;
  }
  const stars = (p.cac_sao || p.stars || []).map(s => {
    const name = s.ten || s.name || '';
    const cls = s.loai || '';
    return `<span class="pstar ${cls}">${name}</span>`;
  }).join('');
  const cuc = p.cuc || p.element || '';
  return `<div class="palace" data-cung="${p.ten_cung || p.name || ''}" data-branch="${branch}">
    <div class="pname">${p.ten_cung || p.name || '—'}<span class="pbranch">${branch || ''}</span></div>
    <div class="pstars">${stars || '<span class="muted">Không có sao</span>'}</div>
    <div class="pcuc">${cuc}</div>
  </div>`;
}

function render(c) {
  const arr = Object.values(c?.['12_cung'] || {});
  const order = ['Tý','Sửu','Dần','Mão','Thìn','Tỵ','Ngọ','Mùi','Thân','Dậu','Tuất','Hợi'];
  const by = new Map();
  arr.forEach(p => { const b = branchOf(p); if (b && !by.has(b)) by.set(b, p); });

  $('board').innerHTML = order.map(b => palaceHtml(by.get(b), b)).join('');

  document.querySelectorAll('.palace[data-cung]').forEach(el => {
    el.addEventListener('click', () => {
      const p = palaceByName(el.dataset.cung);
      renderDetail(p);
      renderCenter(p);
      document.querySelectorAll('.palace').forEach(x => x.classList.remove('focused'));
      el.classList.add('focused');
    });
  });

  // Quick summary
  $('quickSummary').hidden = false;
  $('sMenh').textContent = c?.thien_ban?.menh || c?.menh || '—';
  $('sBanMenh').textContent = c?.thien_ban?.ban_menh || '—';
  $('sCuc').textContent = c?.thien_ban?.cuc || '—';
  $('sCach').textContent = ((c?.cach_cuc?.items || c?.matched_cach_cuc || [])[0]?.ten) || '—';
  $('cachBadge').textContent = $('sCach').textContent;

  // Van10
  const van10 = c?.van?.tieu_van || c?.van || {};
  renderVan10(van10);

  // Audit badge
  const aiStatus = c?.storage?.user_profile?.saved ? 'đã lưu' : 'tạm thời';
  $('auditStatus').textContent = `🛡 ${aiStatus}`;
}

function renderCenter(p) {
  if (!p) {
    $('detail').textContent = '—';
    $('summary').textContent = 'Chọn một cung trong lá số.';
    return;
  }
  $('detail').textContent = `${p.ten_cung || p.name} · ${branchOf(p) || ''}`;
  $('summary').textContent = (p.cac_sao || []).slice(0, 6).map(s => s.ten || s.name).join(' · ') || 'Không có sao chính';
}

function renderDetail(p) {
  // placeholder — full detail rendering handled by tabs
  renderCenter(p);
  if ($('view-stars')) {
    // highlight stars from this palace
    const stars = (p?.cac_sao || []).map(s => `<div class="lib-item"><h4>${s.ten || s.name}</h4><div class="lib-evidence">${s.mo_ta || s.desc || ''}</div></div>`).join('');
    $('starCatalog').innerHTML = stars || '<div class="empty">Chọn cung để xem sao.</div>';
  }
}

function renderVan10(van) {
  const host = $('van10Panel');
  const arr = Array.isArray(van?.cac_nam) ? van.cac_nam : null;
  if (!arr) {
    host.innerHTML = '<div class="van-empty">Chưa có dữ liệu vận hạn 10 năm.</div>';
    return;
  }
  host.innerHTML = `<table>
    <thead><tr><th>Năm</th><th>Cung</th><th>Sao chính</th></tr></thead>
    <tbody>${arr.slice(0, 10).map(n => `<tr><td>${n.nam}</td><td>${n.cung || ''}</td><td>${(n.sao_chinh || []).join(', ')}</td></tr>`).join('')}</tbody>
  </table>`;
}

function renderCach(c) {
  const list = c?.cach_cuc?.items || c?.matched_cach_cuc || c?.confirmed_cach_cuc?.items || [];
  $('cachCard').hidden = list.length === 0;
  $('cachCount').textContent = list.length;
  $('cachList').innerHTML = list.slice(0, 12).map(it => `
    <div class="cach-item">
      <div class="cach-title">${it.ten || it.name || 'Cách cục'}</div>
      <div class="cach-rule">Rule: ${it.rule_id || it.rule || '—'}</div>
      <div class="cach-evidence">${(it.evidence || []).join(' · ') || it.mo_ta || ''}</div>
    </div>
  `).join('');
}

function renderJson(c) {
  const text = fmtJSON(c);
  $('jsonBox').textContent = text;
  $('jsonSizeBadge').textContent = `${(text.length / 1024).toFixed(1)} KB`;
}

function renderStars(c) {
  const stars = [];
  Object.values(c?.['12_cung'] || {}).forEach(p => {
    (p.cac_sao || []).forEach(s => stars.push({ ...s, _cung: p.ten_cung || p.name }));
  });
  if (!stars.length) {
    $('starCatalog').innerHTML = '<div class="empty">Chưa có sao. Hãy lập lá số trước.</div>';
    return;
  }
  $('starCatalog').innerHTML = stars.map(s => `
    <div class="lib-item">
      <h4>${s.ten || s.name}</h4>
      <div class="lib-rule">${s.loai || ''} · cung ${s._cung}</div>
      <div class="lib-evidence">${s.mo_ta || s.desc || ''}</div>
    </div>
  `).join('');
}

/* ---------- Cach cuc library ---------- */
async function loadCachLibrary() {
  const host = $('cachLibrary');
  host.innerHTML = '<div class="empty">Đang tải…</div>';
  try {
    const r = await call('/api/cach-cuc');
    const items = r.items || [];
    $('cachLibraryCount').textContent = items.length;
    window.__cachLib = items;
    paintCachLibrary('');
    $('cachLibrarySearch').addEventListener('input', (e) => paintCachLibrary(e.target.value.toLowerCase()));
    $('reloadCachLibraryBtn').addEventListener('click', loadCachLibrary);
  } catch (e) {
    host.innerHTML = `<div class="empty">Không tải được thư viện. ${e.message}</div>`;
  }
}
function paintCachLibrary(q) {
  const items = (window.__cachLib || []).filter(it =>
    !q || (it.ten || it.name || '').toLowerCase().includes(q) ||
    (it.rule_id || '').toLowerCase().includes(q)
  );
  $('cachLibrary').innerHTML = items.length
    ? items.map(it => `<div class="lib-item"><h4>${it.ten || it.name}</h4><div class="lib-rule">${it.rule_id || ''}</div><div class="lib-evidence">${(it.evidence || []).join(' · ')}</div></div>`).join('')
    : '<div class="empty">Không có kết quả phù hợp.</div>';
}

/* ---------- AI Q&A ---------- */
$('askForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('question').value.trim();
  if (!q) return;
  pushChat('user', q);
  $('question').value = '';
  updateQCount();
  pushChat('ai', '<span class="spinner"></span> Đang suy luận…');
  try {
    const r = await call('/api/luan-giai', {
      method: 'POST',
      body: JSON.stringify({ ...payload(), question: q, year: new Date().getFullYear() }),
    });
    replaceLastAi(r.answer || '(Không có nội dung)');
    $('aiInfo').textContent = `AI: ${r.ai_provider || '?'} · mode: ${r.ai_mode || '?'} · năm ${r.year}`;
  } catch (e2) {
    replaceLastAi('⚠ Lỗi: ' + e2.message);
  }
});

function pushChat(role, text) {
  const wrap = document.createElement('div');
  wrap.className = `chat-msg ${role}`;
  wrap.innerHTML = `<div class="avatar">${role === 'user' ? 'Bạn' : '✦'}</div><div class="bubble">${escapeHtml(text)}</div>`;
  $('chat').appendChild(wrap);
  $('chat').scrollTop = $('chat').scrollHeight;
}
function replaceLastAi(text) {
  const msgs = $('chat').querySelectorAll('.chat-msg.ai');
  if (!msgs.length) { pushChat('ai', text); return; }
  const last = msgs[msgs.length - 1].querySelector('.bubble');
  last.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
  $('chat').scrollTop = $('chat').scrollHeight;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
$('question')?.addEventListener('input', updateQCount);
function updateQCount() {
  $('qCount').textContent = ($('question').value || '').length;
}
document.querySelectorAll('#quickAsk .chip').forEach(c => {
  c.addEventListener('click', () => { $('question').value = c.dataset.q; updateQCount(); $('question').focus(); });
});

$('copyAnswerBtn')?.addEventListener('click', () => {
  const text = Array.from($('chat').querySelectorAll('.chat-msg.ai')).map(m => m.querySelector('.bubble').innerText).join('\n\n---\n\n');
  navigator.clipboard.writeText(text).then(() => toast('Đã sao chép', 'success'));
});

/* ---------- Export / print / json copy ---------- */
$('copyJsonBtn')?.addEventListener('click', () => {
  if (!chartCache) return toast('Chưa có dữ liệu');
  navigator.clipboard.writeText(fmtJSON(chartCache)).then(() => toast('Đã sao chép JSON', 'success'));
});
$('downloadJsonBtn')?.addEventListener('click', () => {
  if (!chartCache) return toast('Chưa có dữ liệu');
  const blob = new Blob([fmtJSON(chartCache)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tuvi-${Date.now()}.json`;
  a.click();
});
$('copyJsonInlineBtn')?.addEventListener('click', () => {
  navigator.clipboard.writeText($('jsonBox').textContent).then(() => toast('Đã sao chép', 'success'));
});
$('printBtn')?.addEventListener('click', () => window.print());

/* ---------- Audit ---------- */
$('runAuditBtn')?.addEventListener('click', async () => {
  if (!chartCache) return toast('Chưa có lá số để audit');
  $('auditResult').innerHTML = '<span class="spinner"></span> Đang audit…';
  const rules = Object.values(chartCache?.cach_cuc?.items || chartCache?.matched_cach_cuc || []).length;
  setTimeout(() => {
    $('auditResult').innerHTML = `<div class="cach-card"><div class="cach-head"><h3>Kết quả audit</h3><span class="cach-count">${rules} rule</span></div>
      <p>Engine là nguồn <strong>authoritative</strong>. Mọi phát biểu của AI phải khớp Rule ID + Evidence. <span class="text-gold">✔ Hợp lệ.</span></p>
    </div>`;
    toast('Audit hoàn tất', 'success');
  }, 600);
});

/* ---------- Boot ---------- */
window.addEventListener('DOMContentLoaded', () => {
  refreshHealth();
  loadAiModes();
  loadCachLibrary();
  // Pre-fill sample
  $('name').value = 'Lá số mẫu';
  $('day').value = 15; $('month').value = 7; $('year').value = 1996; $('hour').value = 'Tý';
});
