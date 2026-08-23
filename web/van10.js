(() => {
  const $ = (id) => document.getElementById(id);
  const yearInput = $('viewYear');
  const jsonBox = $('jsonBox');
  const currentYear = new Date().getFullYear();

  if (yearInput) {
    yearInput.value = String(Number(yearInput.value) || currentYear);
    yearInput.addEventListener('change', () => {
      const y = Math.min(2200, Math.max(1800, Number(yearInput.value) || currentYear));
      yearInput.value = String(Math.trunc(y));
      renderFromJson();
    });
  }

  // Giữ nguyên app.js cốt lõi, chỉ làm cho năm xem trở thành authoritative.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const isTarget = url.includes('/api/lap-so') || url.includes('/api/luan-giai');
    if (isTarget && init.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        const y = Number(yearInput?.value);
        if (Number.isInteger(y) && y >= 1800 && y <= 2200) {
          body.nam_xem = y;
          if (url.includes('/api/luan-giai')) body.year = y;
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (_) {}
    }
    return nativeFetch(input, init);
  };

  const asList = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
  };

  /* Chỉ nhận LIST thật. Trước đây hàm này gọi asList() nên một dict mô tả
     Đại vận (cung_so / cung / dia_chi / tuoi_bat_dau …) bị Object.values()
     biến thành "10 dòng" gồm các giá trị rời rạc, khiến cột Đại vận luôn ra “—”. */
  const firstArray = (van, ...keys) => {
    for (const key of keys) {
      const value = van?.[key];
      if (Array.isArray(value) && value.length) return value;
    }
    return [];
  };

  const text = (v) => (v == null || v === '' ? '—' : String(v));
  const branch = (x) => text(x?.dia_chi ?? x?.chi_ten ?? x?.cung_dia_chi_ten ?? x?.chi ?? x?.branch);
  const palace = (x) => text(x?.cung ?? (x?.cung_so != null ? `Cung ${x.cung_so}` : '—'));

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const starName = (s) => s?.ten ?? s?.name ?? s?.saoTen ?? s?.sao ?? s;
  const norm = (s) => String(s ?? '').trim().toLowerCase();

  /* Chính tinh của cung vận: TRA lại từ chính 12_cung của lá số theo tên cung.
     Đây là dữ liệu engine đã trả, chỉ nối lại — không suy luận gì thêm. */
  function mainStarsOfPalaceName(chart, name) {
    if (!name || name === '—') return '';
    const hit = asList(chart?.['12_cung']).find((p) => norm(p?.cung) === norm(name));
    const list = asList(hit?.chinh_tinh).map(starName).filter(Boolean);
    return list.length ? list.join(', ') : 'Vô chính diệu';
  }

  function cell(chart, item, { missingNote } = {}) {
    if (!item || typeof item !== 'object') {
      return `<span class="van10-missing">${escapeHtml(missingNote || 'Engine không trả dữ liệu')}</span>`;
    }
    const name = palace(item);
    // Cả tên cung và số cung đều rỗng => engine chưa giải được lớp vận này.
    if (name === '—') {
      return `<span class="van10-missing">${escapeHtml(missingNote || 'Engine không trả dữ liệu')}</span>`;
    }
    const meta = [branch(item), text(item?.can_chi)].filter((x) => x !== '—').join(' · ') || '—';
    return `<b>${escapeHtml(name)}</b>`
      + `<span class="muted">${escapeHtml(meta)}</span>`
      + `<span class="muted">${escapeHtml(mainStarsOfPalaceName(chart, name))}</span>`;
  }

  function renderVan10(chart) {
    const host = $('van10Panel');
    if (!host) return;
    const van = chart?.van || {};

    // Đại vận 10 năm là MỘT khoảng vận (dict), không phải 10 dòng.
    const daiVan = (van.dai_van_10_nam && !Array.isArray(van.dai_van_10_nam) && typeof van.dai_van_10_nam === 'object')
      ? van.dai_van_10_nam
      : null;

    const lndv = firstArray(van, 'luu_nien_dai_van_10_nam', 'luu_dai_van_10_nam');
    const tv = firstArray(van, 'tieu_van_10_nam');
    const lnn = firstArray(van, 'luu_nien_nam_10_nam', 'luu_nien_tieu_van_10_nam');

    const length = Math.max(lndv.length, tv.length, lnn.length, daiVan ? 10 : 0);
    if (!length) {
      host.innerHTML = '';
      return;
    }

    const viewing = Number(yearInput?.value);
    const rows = [];
    for (let i = 0; i < length; i += 1) {
      const b = lndv[i];
      const c = tv[i];
      const d = lnn[i];
      const year = b?.nam ?? c?.nam ?? d?.nam ?? '—';
      const age = b?.tuoi ?? c?.tuoi ?? d?.tuoi ?? '—';
      rows.push(`<tr class="${Number(year) === viewing ? 'is-viewing' : ''}">
        <td>${year === '—' ? '—' : `<button class="year-pick" type="button" data-year="${escapeHtml(year)}">${escapeHtml(year)}</button>`}</td>
        <td class="van10-age">${escapeHtml(age)}</td>
        <td>${cell(chart, daiVan, { missingNote: 'Engine không trả Đại vận' })}</td>
        <td>${cell(chart, b)}</td>
        <td>${cell(chart, c)}</td>
        <td>${cell(chart, d)}</td>
      </tr>`);
    }

    const spanNote = daiVan
      ? `Đại vận đang xét: <b>${escapeHtml(palace(daiVan))}</b> · ${escapeHtml(branch(daiVan))} · tuổi ${escapeHtml(text(daiVan.tuoi_bat_dau))}–${escapeHtml(text(daiVan.tuoi_ket_thuc))} · hướng ${escapeHtml(text(daiVan.huong))}`
      : 'Engine chưa trả Đại vận cho năm xem hiện tại.';

    host.innerHTML = `<section class="card van10-card">
      <div class="card-head">
        <div><h2>Vận hạn 10 năm</h2><span>4 lớp dữ liệu authoritative từ engine · bấm vào năm để đổi năm xem</span></div>
        <strong>${rows.length}</strong>
      </div>
      <div class="van10-note">${spanNote}</div>
      <div class="van10-note">Năm chọn được gửi trực tiếp vào <b>nam_xem</b> và <b>year</b>. Bảng chỉ hiển thị dữ liệu vận hạn do engine trả về; ô nào engine không có dữ liệu sẽ ghi rõ thay vì bỏ trống.</div>
      <div class="van10-wrap">
        <table class="van10">
          <thead><tr>
            <th>Năm</th><th>Tuổi</th><th>Đại vận</th>
            <th>Lưu niên Đại vận</th><th>Tiểu vận</th><th>Lưu niên năm</th>
          </tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
    </section>`;

    host.querySelectorAll('.year-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!yearInput) return;
        yearInput.value = btn.dataset.year;
        renderFromJson();
        // Năm xem đổi => cần engine tính lại 4 lớp vận cho năm đó.
        if (typeof window.lapSo === 'function') window.lapSo();
        else $('calcBtn')?.click();
      });
    });
  }

  function renderFromJson() {
    try {
      const host = $('van10Panel');
      if (!jsonBox) return;
      const raw = jsonBox.textContent.trim();
      if (!raw || raw === 'Chưa có dữ liệu.') {
        if (host) host.innerHTML = '';
        return;
      }
      renderVan10(JSON.parse(raw));
    } catch (_) {}
  }

  if (jsonBox) {
    new MutationObserver(renderFromJson).observe(jsonBox, { childList: true, subtree: true, characterData: true });
  }
  setTimeout(renderFromJson, 0);
  window.renderVan10 = renderVan10;
})();
