/* Live feature bridge: preserves the new Lá Số Ngũ Hành UI and adds live chart + AI. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>\"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#92;','"':'&quot;'}[m] || m));
  const PROFILE_KEY = 'tvai_live_profiles_v1';
  let liveChart = null;
  let aiProvider = localStorage.getItem('tvai_provider') || 'gemini';

  async function postJSON(url, payload) {
    const r = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    let data = {};
    try { data = await r.json(); } catch (_) {}
    if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
    return data;
  }

  function formData() {
    return {
      ngay: Number($('tvDay').value),
      thang: Number($('tvMonth').value),
      nam: Number($('tvYear').value),
      gio_sinh: $('tvHour').value,
      gioi_tinh: $('tvGender').value,
      ten: $('tvName').value.trim(),
      duong_lich: $('tvCalendar').value === 'true',
      time_zone: Number($('tvTz').value) || 7,
      nam_xem: Number($('viewYear').value) || new Date().getFullYear()
    };
  }

  function profiles() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveProfiles(items) { localStorage.setItem(PROFILE_KEY, JSON.stringify(items)); }
  function profileKey(p) {
    return [p.ten || '—',p.ngay,p.thang,p.nam,p.gio_sinh,p.gioi_tinh,p.duong_lich,p.time_zone].join('|').toLowerCase();
  }
  function saveCurrentProfile() {
    const p = formData();
    const id = profileKey(p);
    const list = profiles();
    const item = {...p,id,birth:`${String(p.ngay).padStart(2,'0')}/${String(p.thang).padStart(2,'0')}/${p.nam}`};
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) list[idx] = {...list[idx], ...item}; else list.unshift(item);
    saveProfiles(list);
    syncProfileOptions();
    $('profileSelect').value = id;
    $('profileId').textContent = 'ID: ' + id;
  }
  function fillProfile(p) {
    if (!p) return;
    $('tvName').value = p.ten || '';
    $('tvDay').value = p.ngay;
    $('tvMonth').value = p.thang;
    $('tvYear').value = p.nam;
    $('tvHour').value = p.gio_sinh;
    $('tvGender').value = p.gioi_tinh;
    $('tvCalendar').value = String(p.duong_lich);
    $('tvTz').value = p.time_zone ?? 7;
    if (p.nam_xem) $('viewYear').value = p.nam_xem;
    $('profileId').textContent = 'ID: ' + (p.id || '—');
  }
  function syncProfileOptions() {
    const sel = $('profileSelect');
    if (!sel) return;
    const existing = new Set([...sel.options].map(o => o.value));
    profiles().forEach(p => {
      if (existing.has(p.id)) return;
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = `${p.ten || 'Không tên'} · ${p.birth}`;
      sel.appendChild(o);
    });
  }

  function setProvider(provider) {
    aiProvider = provider;
    localStorage.setItem('tvai_provider', provider);
    document.cookie = `tv_ai_provider=${encodeURIComponent(provider)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.querySelectorAll('#tvAiProvider button').forEach(b => b.classList.toggle('active', b.dataset.provider === provider));
  }

  function renderLiveChart(data) {
    liveChart = data;
    window.tvaiLiveChart = data;
    if (typeof window.render === 'function') {
      window.render(data);
    }
    const year = data.viewing?.year || formData().nam_xem;
    if ($('viewYear')) $('viewYear').value = year;
    if ($('profileId')) $('profileId').textContent = 'ID: LIVE · ' + (data.thien_ban?.ten || formData().ten || 'Không tên');
    if ($('tvStatus')) $('tvStatus').textContent = 'Đã lập lá số';
    saveCurrentProfile();
  }

  function installBirthForm() {
    const box = document.querySelector('.profile-box');
    if (!box || $('tvBirthForm')) return;
    const wrap = document.createElement('div');
    wrap.id = 'tvBirthForm';
    wrap.innerHTML = `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid #273852">
        <label>Họ tên</label><input id="tvName" placeholder="Không bắt buộc">
        <div class="two">
          <div><label>Ngày</label><input id="tvDay" type="number" min="1" max="31" value="1"></div>
          <div><label>Tháng</label><input id="tvMonth" type="number" min="1" max="12" value="1"></div>
        </div>
        <label>Năm sinh</label><input id="tvYear" type="number" min="1800" max="2200" value="1996">
        <div class="two">
          <div><label>Giờ sinh</label><select id="tvHour"><option>Tý</option><option>Sửu</option><option>Dần</option><option>Mão</option><option>Thìn</option><option>Tỵ</option><option>Ngọ</option><option>Mùi</option><option>Thân</option><option>Dậu</option><option>Tuất</option><option>Hợi</option></select></div>
          <div><label>Giới tính</label><select id="tvGender"><option>Nam</option><option>Nữ</option></select></div>
        </div>
        <div class="two">
          <div><label>Lịch</label><select id="tvCalendar"><option value="true">Dương lịch</option><option value="false">Âm lịch</option></select></div>
          <div><label>Múi giờ</label><input id="tvTz" type="number" value="7"></div>
        </div>
        <button class="primary" id="tvCalc">LẬP LÁ SỐ</button>
        <div id="tvStatus" class="meta" style="margin-top:7px"></div>
      </div>`;
    box.appendChild(wrap);
    $('tvCalc').onclick = async () => {
      $('tvCalc').disabled = true;
      $('tvStatus').textContent = 'Đang lập lá số...';
      try {
        const data = await postJSON('/api/lap-so', formData());
        renderLiveChart(data);
      } catch (e) {
        $('tvStatus').textContent = e.message;
      } finally {
        $('tvCalc').disabled = false;
      }
    };
  }

  function installAI() {
    if ($('tvAiNav')) return;
    const relationsNav = [...document.querySelectorAll('.nav')].find(x => x.dataset.view === 'relations');
    if (!relationsNav) return;

    const nav = document.createElement('button');
    nav.className = 'nav';
    nav.id = 'tvAiNav';
    nav.textContent = '✎ Chat AI';
    relationsNav.insertAdjacentElement('afterend', nav);

    const view = document.createElement('section');
    view.id = 'tvAiView';
    view.className = 'view';
    view.innerHTML = `
      <div class="workspace">
        <section class="card" style="min-height:540px;display:flex;flex-direction:column">
          <div class="card-head">
            <div><h2>Chat AI</h2><span>Luận giải trực tiếp trên dữ liệu Engine authoritative</span></div>
            <div id="tvAiProvider" style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="ghost small" data-provider="gemini">Gemini</button>
              <button class="ghost small" data-provider="openai">ChatGPT / OpenAI</button>
            </div>
          </div>
          <div id="tvChat" style="flex:1;min-height:360px;max-height:62vh;overflow:auto;padding-top:10px">
            <div class="empty">Hãy lập lá số rồi đặt câu hỏi.</div>
          </div>
          <textarea id="tvQuestion" rows="4" placeholder="Nhập câu hỏi... Enter để gửi, Shift + Enter để xuống dòng" style="width:100%;margin-top:10px;padding:11px;background:#080f1b;border:1px solid #2b3e5e;color:#f4f7ff;border-radius:9px;resize:vertical"></textarea>
          <button class="primary" id="tvAsk">Gửi</button>
        </section>
        <aside class="card" style="max-height:540px;overflow:auto"><h2>Trạng thái AI</h2><div id="tvAiStatus" class="empty" style="margin-top:10px">Chưa có câu hỏi.</div></aside>
      </div>`;
    document.querySelector('main.main')?.appendChild(view);

    document.querySelectorAll('.nav').forEach(b => {
      if (b.dataset.tvaiBound) return;
      b.dataset.tvaiBound = '1';
      b.addEventListener('click', () => {
        if (b === nav) return;
        if (typeof window.switchView === 'function' && b.dataset.view) window.switchView(b.dataset.view);
      });
    });
    nav.onclick = () => {
      document.querySelectorAll('.nav').forEach(x => x.classList.remove('active'));
      nav.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      view.classList.add('active');
      if ($('pageTitle')) $('pageTitle').textContent = 'Chat AI';
    };

    document.querySelectorAll('#tvAiProvider button').forEach(b => b.onclick = () => setProvider(b.dataset.provider));
    setProvider(aiProvider);

    const ask = async () => {
      const question = $('tvQuestion').value.trim();
      if (!question) return;
      if (!liveChart) {
        $('tvAiStatus').textContent = 'Hãy lập lá số trước khi chat với AI.';
        return;
      }
      const user = document.createElement('div');
      user.className = 'detail';
      user.innerHTML = `<b>Bạn</b><div style="margin-top:5px">${esc(question)}</div>`;
      const waiting = document.createElement('div');
      waiting.className = 'detail';
      waiting.textContent = 'AI đang luận giải...';
      $('tvChat').append(user, waiting);
      $('tvQuestion').value = '';
      $('tvChat').scrollTop = $('tvChat').scrollHeight;
      $('tvAsk').disabled = true;
      try {
        const d = await postJSON('/api/luan-giai', {...formData(), question, year:Number($('viewYear').value) || new Date().getFullYear(), provider:aiProvider});
        waiting.remove();
        const answer = document.createElement('div');
        answer.className = 'detail';
        answer.innerHTML = `<div style="font-weight:900;color:#e7c66e;margin-bottom:7px">AI · ${esc(d.ai_provider || aiProvider)}${d.ai_mode ? ` · ${esc(d.ai_mode)}` : ''}</div><div style="white-space:pre-wrap">${esc(d.answer || 'Không có phản hồi')}</div>`;
        $('tvChat').appendChild(answer);
        $('tvAiStatus').textContent = `Đã nhận phản hồi từ ${d.ai_provider || aiProvider}.`;
        $('tvChat').scrollTop = $('tvChat').scrollHeight;
      } catch (e) {
        waiting.textContent = 'Lỗi: ' + e.message;
        $('tvAiStatus').textContent = e.message;
      } finally {
        $('tvAsk').disabled = false;
      }
    };
    $('tvAsk').onclick = ask;
    $('tvQuestion').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
    });
  }

  function wireProfiles() {
    const sel = $('profileSelect');
    if (!sel || sel.dataset.tvaiProfileBound) return;
    sel.dataset.tvaiProfileBound = '1';
    const original = sel.onchange;
    sel.onchange = e => {
      const p = profiles().find(x => x.id === e.target.value);
      if (p) fillProfile(p);
      else if (typeof original === 'function') original.call(sel, e);
    };
  }

  function start() {
    installBirthForm();
    installAI();
    syncProfileOptions();
    wireProfiles();
    if ($('printBtn')) $('printBtn').addEventListener('click', () => window.print());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
