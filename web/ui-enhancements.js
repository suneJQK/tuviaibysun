(() => {
  const $ = (id) => document.getElementById(id);
  const PROFILE_KEY = 'tvai_profiles_v2';
  const ESCAPE = (value) => String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
  const ORDER = ['Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất'];
  const ELEMENTS = [
    { key: 'moc', label: 'Mộc', tone: 'wood' },
    { key: 'hoa', label: 'Hỏa', tone: 'fire' },
    { key: 'tho', label: 'Thổ', tone: 'earth' },
    { key: 'kim', label: 'Kim', tone: 'metal' },
    { key: 'thuy', label: 'Thủy', tone: 'water' },
  ];
  const RELATIONS = [
    { key: 'base', label: 'Cung chọn', cls: 'rel-base' },
    { key: 'tamhop', label: 'Tam Hợp', cls: 'rel-tamhop' },
    { key: 'xung', label: 'Xung Chiếu', cls: 'rel-xung' },
    { key: 'nhihop', label: 'Nhị Hợp', cls: 'rel-nhihop' },
    { key: 'giap', label: 'Giáp Cung', cls: 'rel-giap' },
  ];

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();

  function asList(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
  }

  /* app.js khai báo `chart` bằng `let` nên biến này KHÔNG nằm trên window.
     Vì vậy đọc thẳng payload engine đã render ra #jsonBox làm nguồn dự phòng —
     đây là cùng một dữ liệu authoritative, không suy luận thêm. */
  function currentChart() {
    if (window.chart && typeof window.chart === 'object') return window.chart;
    try {
      const raw = $('jsonBox')?.textContent?.trim();
      return raw && raw !== 'Chưa có dữ liệu.' ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function allPalaces() {
    return asList(currentChart()?.['12_cung']);
  }

  /* Engine phát ra ngũ hành cung dưới dạng MÃ MỘT KÝ TỰ (AmDuong.nguHanh):
       M = Mộc · H = Hỏa · O = Thổ · K = Kim · T = Thủy
     Bản cũ chỉ so khớp chuỗi đầy đủ ("mộc", "hỏa"…) nên mọi cung đều không
     khớp: chú giải luôn báo 0 cung và bàn số không bao giờ được tô ngũ hành.
     Xử lý mã một ký tự TRƯỚC, rồi mới đến tên đầy đủ. */
  const ELEMENT_CODE = { m: 'moc', h: 'hoa', o: 'tho', k: 'kim', t: 'thuy' };

  function matchElementName(raw) {
    const s = normalize(raw);
    if (!s) return '';
    if (s.length === 1) return ELEMENT_CODE[s] || '';
    if (s.includes('thuy')) return 'thuy';
    if (s.includes('moc')) return 'moc';
    if (s.includes('hoa')) return 'hoa';
    if (s.includes('tho')) return 'tho';
    if (s.includes('kim')) return 'kim';
    return '';
  }

  const ELEMENT_LABEL = { moc: 'Mộc', hoa: 'Hỏa', tho: 'Thổ', kim: 'Kim', thuy: 'Thủy' };

  /* Nhãn hiển thị: đổi mã một ký tự sang tên đọc được, giữ nguyên nếu engine
     đã trả tên đầy đủ. Không suy luận gì thêm ngoài bảng mã của engine. */
  function elementLabel(raw) {
    const key = matchElementName(raw);
    if (!key) return String(raw ?? '').trim();
    const full = String(raw ?? '').trim();
    return full.length === 1 ? ELEMENT_LABEL[key] : full;
  }
  window.elementLabel = elementLabel;

  function starName(star) {
    return star?.ten || star?.name || star?.saoTen || star?.sao || String(star ?? '');
  }

  function mainStarsOf(palace) {
    return asList(palace?.chinh_tinh).map(starName).filter(Boolean);
  }

  function supportStarsOf(palace) {
    const direct = asList(palace?.phu_tinh || palace?.phuTinh);
    if (direct.length) return direct.map(starName).filter(Boolean);
    const raw = asList(palace?.sao || palace?.stars || palace?.all_stars);
    return raw.map(starName).filter(Boolean).slice(0, 10);
  }

  function renderLegend() {
    const host = $('nguHanhLegend');
    if (!host) return;
    const palaces = allPalaces();
    if (!palaces.length) {
      host.innerHTML = '<span class="source-chip">Chưa có dữ liệu</span>';
      const relationEmpty = $('relationLegend');
      if (relationEmpty) relationEmpty.innerHTML = RELATIONS.map((item) => `<span class="legend-chip ${item.cls}">${item.label}</span>`).join('');
      return;
    }
    const counts = { moc: 0, hoa: 0, tho: 0, kim: 0, thuy: 0 };
    palaces.forEach((palace) => {
      const key = matchElementName(palace?.ngu_hanh);
      if (key) counts[key] += 1;
    });
    host.innerHTML = ELEMENTS.map((item) => `<span class="legend-chip ${item.tone}"><b>${item.label}</b><span>${counts[item.key] || 0} cung</span></span>`).join('');
    const relationHost = $('relationLegend');
    if (relationHost) {
      relationHost.innerHTML = RELATIONS.map((item) => `<span class="legend-chip ${item.cls}">${item.label}</span>`).join('');
    }
  }

  function boardButtonByBranch(branch) {
    const buttons = Array.from(document.querySelectorAll('#board .palace[data-cung]'));
    return buttons.find((btn) => {
      const palace = window.palaceByName?.(btn.dataset.cung);
      return palace && window.branchOf?.(palace) === branch;
    }) || null;
  }

  function applyRelationHighlight(palace) {
    const buttons = Array.from(document.querySelectorAll('#board .palace'));
    buttons.forEach((btn) => {
      btn.classList.remove('is-selected', 'relation-base', 'relation-tamhop', 'relation-xung', 'relation-nhihop', 'relation-giap');
    });
    if (!palace || !window.relationData) return;
    const rel = window.relationData(palace);
    const baseBranch = rel?.base?.branch;
    if (baseBranch) boardButtonByBranch(baseBranch)?.classList.add('is-selected', 'relation-base');
    rel?.tamhop?.forEach((item) => boardButtonByBranch(window.branchOf?.(item))?.classList.add('relation-tamhop'));
    rel?.xung?.forEach((item) => boardButtonByBranch(window.branchOf?.(item))?.classList.add('relation-xung'));
    rel?.nhihop?.forEach((item) => boardButtonByBranch(window.branchOf?.(item))?.classList.add('relation-nhihop'));
    rel?.giap?.forEach((item) => boardButtonByBranch(window.branchOf?.(item))?.classList.add('relation-giap'));
  }

  function renderSelectionSummary(palace) {
    const host = $('selectionSummary');
    if (!host) return;
    if (!palace) {
      host.classList.add('empty-state');
      host.innerHTML = 'Chưa chọn cung.';
      return;
    }
    host.classList.remove('empty-state');
    const rel = window.relationData?.(palace);
    const elem = elementLabel(palace?.ngu_hanh) || '—';
    const main = mainStarsOf(palace).slice(0, 3);
    const support = supportStarsOf(palace).slice(0, 4);
    const badge = (label, items, cls) => `<span class="legend-chip ${cls}">${label}: <b>${items.length}</b></span>`;
    host.innerHTML = `
      <div class="title-row">
        <div>
          <b>${ESCAPE(palace?.cung || '—')}</b>
          <div class="muted">${ESCAPE([window.branchOf?.(palace), palace?.can_chi, elem].filter(Boolean).join(' · '))}</div>
        </div>
        <div class="relation-badges">
          ${badge('Tam Hợp', rel?.tamhop || [], 'rel-tamhop')}
          ${badge('Xung', rel?.xung || [], 'rel-xung')}
          ${badge('Nhị Hợp', rel?.nhihop || [], 'rel-nhihop')}
          ${badge('Giáp', rel?.giap || [], 'rel-giap')}
        </div>
      </div>
      <div class="star-preview">${main.map((name) => `<span class="chip main">${ESCAPE(name)}</span>`).join('') || '<span class="chip">Không có chính tinh</span>'}</div>
      <div class="star-preview">${support.map((name) => `<span class="chip">${ESCAPE(name)}</span>`).join('') || '<span class="chip">Không có phụ tinh</span>'}</div>
    `;
  }

  function enrichRelationPanel(palace) {
    const host = $('relationPanel');
    if (!host || !palace || !window.relationData) return;
    const rel = window.relationData(palace);
    const groups = [
      ['Tam Hợp', rel?.tamhop || [], 'rel-tamhop'],
      ['Xung Chiếu', rel?.xung || [], 'rel-xung'],
      ['Nhị Hợp', rel?.nhihop || [], 'rel-nhihop'],
      ['Giáp Cung', rel?.giap || [], 'rel-giap'],
    ];
    host.innerHTML = groups.map(([label, items, cls]) => `
      <article class="relation-card">
        <h3>${label}</h3>
        ${items.length ? items.map((item) => `
          <div class="relation-name">${ESCAPE(item?.cung || '—')}</div>
          <div class="relation-meta">${ESCAPE([window.branchOf?.(item), item?.cung_so ? `Cung ${item.cung_so}` : '', mainStarsOf(item).join(', ')].filter(Boolean).join(' · '))}</div>
          <div class="relation-actions"><button type="button" class="ghost small relation-jump ${cls}" data-cung="${ESCAPE(item?.cung || '')}">Định vị cung</button></div>
        `).join('') : '<div class="relation-meta">Không xác định</div>'}
      </article>
    `).join('');

    host.querySelectorAll('.relation-jump').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = window.palaceByName?.(btn.dataset.cung);
        if (!target) return;
        if (typeof window.switchView === 'function') window.switchView('chart');
        applyRelationHighlight(target);
        renderSelectionSummary(target);
        window.renderDetail?.(target);
        const boardBtn = document.querySelector(`#board .palace[data-cung="${CSS.escape(btn.dataset.cung)}"]`);
        boardBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  function enrichBoardData() {
    document.querySelectorAll('#board .palace[data-cung]').forEach((btn) => {
      const palace = window.palaceByName?.(btn.dataset.cung);
      const key = matchElementName(palace?.ngu_hanh);
      if (key) btn.dataset.nguhanh = key;
      // Nhãn ngũ hành trên thẻ cung: engine trả mã 1 ký tự nên phải dịch ra chữ.
      const label = btn.querySelector('.meta');
      if (label && key) {
        label.textContent = label.textContent.replace(
          new RegExp(`(^|·\\s*)${String(palace.ngu_hanh).trim()}(\\s*·|$)`),
          (m, a, b) => `${a}${ELEMENT_LABEL[key]}${b}`,
        );
      }
      btn.title = [palace?.cung, elementLabel(palace?.ngu_hanh), window.branchOf?.(palace)].filter(Boolean).join(' · ');
    });
  }

  function filterStarCatalog(term) {
    const cards = Array.from(document.querySelectorAll('#starCatalog .star-card'));
    if (!cards.length) return;
    const normalized = normalize(term);
    let shown = 0;
    cards.forEach((card) => {
      const text = normalize(card.textContent);
      const match = !normalized || text.includes(normalized);
      card.style.display = match ? '' : 'none';
      if (match) shown += 1;
    });
    const hint = document.querySelector('#view-stars .toolbar-hint');
    if (hint) {
      hint.textContent = normalized
        ? `${shown}/${cards.length} sao khớp từ khóa.`
        : 'Tìm nhanh theo sao, cung hoặc ngũ hành. Nhấn / để vào ô tìm.';
    }
  }

  async function copyJson() {
    const raw = $('jsonBox')?.textContent?.trim();
    if (!raw || raw === 'Chưa có dữ liệu.') {
      window.tvToast?.('Chưa có dữ liệu lá số');
      return;
    }
    try {
      await navigator.clipboard.writeText(raw);
      window.tvToast?.('Đã sao chép payload engine', 'ok');
      const btn = $('copyJsonBtn') || $('copyJsonInlineBtn');
      if (btn) {
        const old = btn.textContent;
        btn.textContent = 'Đã sao chép';
        setTimeout(() => { btn.textContent = old; }, 1200);
      }
    } catch (_) {
      window.tvToast?.('Trình duyệt chặn sao chép', 'err');
    }
  }

  function exportProfiles() {
    try {
      const data = JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]');
      if (!data.length) {
        window.tvToast?.('Chưa có hồ sơ nào để xuất');
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tvai-profiles.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 800);
      window.tvToast?.(`Đã xuất ${data.length} hồ sơ`, 'ok');
    } catch (_) {
      window.tvToast?.('Không xuất được hồ sơ', 'err');
    }
  }

  function importProfiles(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(String(reader.result || '[]'));
        const current = JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]');
        const map = new Map();
        current.concat(Array.isArray(incoming) ? incoming : []).forEach((item) => {
          if (item?.id) map.set(item.id, item);
        });
        localStorage.setItem(PROFILE_KEY, JSON.stringify(Array.from(map.values())));
        window.refreshProfiles?.();
        if ($('status')) $('status').textContent = `Đã nhập ${map.size} hồ sơ.`;
        window.tvToast?.(`Đã nhập ${map.size} hồ sơ`, 'ok');
      } catch (error) {
        if ($('status')) $('status').textContent = 'Không đọc được file hồ sơ JSON.';
        window.tvToast?.('File hồ sơ không hợp lệ', 'err');
      }
    };
    reader.readAsText(file);
  }

  function toggleBoardFocus() {
    document.body.classList.toggle('full-focus');
    const on = document.body.classList.contains('full-focus');
    const btn = $('focusBoardBtn');
    if (btn) btn.textContent = on ? 'Thoát tập trung' : 'Tập trung bàn số';
    if (typeof window.switchView === 'function' && on) window.switchView('chart');
  }

  function hookButtons() {
    $('starSearch')?.addEventListener('input', (e) => filterStarCatalog(e.target.value));
    $('copyJsonBtn')?.addEventListener('click', copyJson);
    $('copyJsonInlineBtn')?.addEventListener('click', copyJson);
    $('exportProfileBtn')?.addEventListener('click', exportProfiles);
    $('importProfileBtn')?.addEventListener('click', () => $('importProfileInput')?.click());
    $('importProfileInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) importProfiles(file);
      e.target.value = '';
    });
    $('focusBoardBtn')?.addEventListener('click', toggleBoardFocus);
  }

  function patchRenderLifecycle() {
    if (typeof window.render === 'function' && !window.render.__enhanced) {
      const nativeRender = window.render;
      window.render = function patchedRender(...args) {
        // Phản chiếu chart lên window trước khi các phần phụ trợ đọc dữ liệu.
        if (args[0] && typeof args[0] === 'object') window.chart = args[0];
        const result = nativeRender.apply(this, args);
        renderLegend();
        enrichBoardData();
        filterStarCatalog($('starSearch')?.value || '');
        renderSelectionSummary(null);
        return result;
      };
      window.render.__enhanced = true;
    }
    if (typeof window.showRelations === 'function' && !window.showRelations.__enhanced) {
      const nativeShowRelations = window.showRelations;
      window.showRelations = function patchedShowRelations(palace) {
        const result = nativeShowRelations.apply(this, arguments);
        applyRelationHighlight(palace);
        renderSelectionSummary(palace);
        enrichRelationPanel(palace);
        return result;
      };
      window.showRelations.__enhanced = true;
    }
    if (typeof window.renderDetail === 'function' && !window.renderDetail.__enhanced) {
      const nativeRenderDetail = window.renderDetail;
      window.renderDetail = function patchedRenderDetail(palace) {
        const result = nativeRenderDetail.apply(this, arguments);
        // Bảng chi tiết in thẳng mã ngũ hành của engine → dịch sang chữ.
        if (palace?.ngu_hanh) {
          const label = elementLabel(palace.ngu_hanh);
          $('detail')?.querySelectorAll('.summary-row').forEach((row) => {
            if (normalize(row.querySelector('span')?.textContent).includes('ngu hanh')) {
              const b = row.querySelector('b');
              if (b) b.textContent = label || '—';
            }
          });
        }
        applyRelationHighlight(palace);
        renderSelectionSummary(palace);
        return result;
      };
      window.renderDetail.__enhanced = true;
    }
    if (typeof window.reset === 'function' && !window.reset.__enhanced) {
      const nativeReset = window.reset;
      window.reset = function patchedReset() {
        const result = nativeReset.apply(this, arguments);
        window.chart = null;
        renderLegend();
        renderSelectionSummary(null);
        filterStarCatalog('');
        document.body.classList.remove('full-focus');
        const btn = $('focusBoardBtn');
        if (btn) btn.textContent = 'Tập trung bàn số';
        return result;
      };
      window.reset.__enhanced = true;
    }
  }

  window.renderLegendPublic = renderLegend;
  window.applyRelationHighlightPublic = applyRelationHighlight;

  window.addEventListener('DOMContentLoaded', () => {
    hookButtons();
    patchRenderLifecycle();
    renderLegend();
    renderSelectionSummary(null);
    document.querySelector('#board')?.addEventListener('click', (event) => {
      const button = event.target.closest('.palace[data-cung]');
      if (!button) return;
      const palace = window.palaceByName?.(button.dataset.cung);
      if (palace) {
        setTimeout(() => {
          applyRelationHighlight(palace);
          renderSelectionSummary(palace);
        }, 0);
      }
    });
  });
})();
