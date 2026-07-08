const params = new URLSearchParams(location.search);
const slug = params.get('brand');
const main = document.getElementById('brand-main');

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'colors', label: '브랜드컬러' },
  { id: 'copy', label: '카피문구' },
  { id: 'menu', label: '메뉴라인업' },
  { id: 'season', label: '시즌메뉴' },
  { id: 'events', label: '이벤트' },
  { id: 'cost', label: '코스트 계산기' },
];

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}
function won(n) { return (Number(n) || 0).toLocaleString('ko-KR') + '원'; }
function pct(n) { return (Number(n) || 0).toFixed(1) + '%'; }
function rateClass(rate) {
  if (rate <= 30) return 'rate-ok';
  if (rate <= 38) return 'rate-warn';
  return 'rate-bad';
}
function calcRow(price, cost) {
  const p = Number(price) || 0, c = Number(cost) || 0;
  const margin = p - c;
  const costRate = p ? (c / p) * 100 : 0;
  const marginRate = p ? (margin / p) * 100 : 0;
  return { price: p, cost: c, margin, costRate, marginRate };
}

async function init() {
  if (!slug) {
    main.innerHTML = '<p class="empty-msg">브랜드가 지정되지 않았습니다. <a href="index.html">목록으로 돌아가기</a></p>';
    return;
  }
  try {
    const res = await fetch(`data/brands/${encodeURIComponent(slug)}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error('brand json not found');
    const brand = await res.json();
    render(brand);
  } catch (e) {
    main.innerHTML = `<p class="empty-msg">브랜드 데이터를 불러오지 못했습니다. (data/brands/${escapeHtml(slug)}.json 확인) <br><a href="index.html">목록으로 돌아가기</a></p>`;
    console.error(e);
  }
}

function render(brand) {
  document.title = `${brand.name} - 브랜드 허브`;
  const color = brand.color || '#8B3A2F';

  main.innerHTML = `
    <div class="brand-hero" style="--brand-color:${escapeHtml(color)}">
      <h1>${escapeHtml(brand.name)}</h1>
      <p class="tagline">${escapeHtml(brand.tagline || '')}</p>
      <div class="swatches">
        ${(brand.brandColors || []).map(c => `<div class="swatch-dot" title="${escapeHtml(c.name)}" style="background:${escapeHtml(c.hex)}"></div>`).join('')}
      </div>
    </div>

    <div class="tabs" id="tabs">
      ${TABS.map((t, i) => `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>

    <div id="panels">
      <section class="tab-panel active" data-panel="overview">${renderOverview(brand)}</section>
      <section class="tab-panel" data-panel="colors">${renderColors(brand)}</section>
      <section class="tab-panel" data-panel="copy">${renderCopy(brand)}</section>
      <section class="tab-panel" data-panel="menu">${renderMenu(brand)}</section>
      <section class="tab-panel" data-panel="season">${renderSeason(brand)}</section>
      <section class="tab-panel" data-panel="events">${renderEvents(brand)}</section>
      <section class="tab-panel" data-panel="cost">${renderCostShell()}</section>
    </div>
  `;

  document.getElementById('tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add('active');
  });

  document.querySelectorAll('.color-card').forEach(card => {
    card.addEventListener('click', () => {
      const hex = card.dataset.hex;
      navigator.clipboard?.writeText(hex).then(() => {
        const old = card.querySelector('.hex').textContent;
        card.querySelector('.hex').textContent = '복사됨!';
        setTimeout(() => { card.querySelector('.hex').textContent = old; }, 1000);
      }).catch(() => {});
    });
  });

  setupCostCalculator(brand);
}

function renderOverview(b) {
  const o = b.overview || {};
  const rows = [
    ['한 줄 소개', o.oneLiner],
    ['브랜드 스토리', o.story],
    ['컨셉', o.concept],
    ['타깃 고객', o.targetCustomer],
    ['차별화 포인트', o.differentiation],
  ].filter(r => r[1]);
  if (!rows.length) return '<p class="empty-msg">개요 정보가 없습니다.</p>';
  return rows.map(([title, content]) => `
    <div class="section-block">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(content)}</p>
    </div>
  `).join('');
}

function renderColors(b) {
  const colors = b.brandColors || [];
  if (!colors.length) return '<p class="empty-msg">등록된 브랜드컬러가 없습니다.</p>';
  return `<div class="color-grid">
    ${colors.map(c => `
      <div class="color-card" data-hex="${escapeHtml(c.hex)}">
        <div class="color-swatch" style="background:${escapeHtml(c.hex)}"></div>
        <div class="color-info">
          <div class="name">${escapeHtml(c.name)}</div>
          <div class="hex">${escapeHtml(c.hex)}</div>
          ${c.usage ? `<div class="usage">${escapeHtml(c.usage)}</div>` : ''}
        </div>
      </div>
    `).join('')}
  </div>
  <p class="hint">색상 카드를 클릭하면 HEX 코드가 복사됩니다.</p>`;
}

function renderCopy(b) {
  const c = b.copywriting || {};
  const subs = c.subSlogans || [];
  return `
    ${c.mainSlogan ? `<p class="slogan-main">${escapeHtml(c.mainSlogan)}</p>` : ''}
    ${subs.length ? `<ul class="slogan-list">${subs.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}
    ${!c.mainSlogan && !subs.length ? '<p class="empty-msg">등록된 카피문구가 없습니다.</p>' : ''}
  `;
}

function menuCard(item) {
  return `
    <div class="menu-card">
      <div class="menu-card-img">
        ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" onerror="this.parentElement.innerHTML='이미지 없음'">` : '이미지 없음'}
      </div>
      <div class="menu-card-body">
        <h4>${escapeHtml(item.name)}</h4>
        <div class="price">${won(item.price)}</div>
        ${item.desc ? `<div class="desc">${escapeHtml(item.desc)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderMenu(b) {
  const menu = b.menu || {};
  const lunch = menu.lunch || [];
  const dinner = menu.dinner || [];
  if (!lunch.length && !dinner.length) return '<p class="empty-msg">등록된 메뉴가 없습니다.</p>';
  return `
    ${lunch.length ? `<div class="menu-section-title">점심 메뉴</div><div class="menu-grid">${lunch.map(menuCard).join('')}</div>` : ''}
    ${dinner.length ? `<div class="menu-section-title">저녁 · 술상 메뉴</div><div class="menu-grid">${dinner.map(menuCard).join('')}</div>` : ''}
  `;
}

function renderSeason(b) {
  const list = b.seasonMenu || [];
  if (!list.length) return '<p class="empty-msg">등록된 시즌메뉴가 없습니다.</p>';
  return list.map(s => `
    <div class="season-card">
      ${s.period ? `<span class="period">${escapeHtml(s.period)}</span>` : ''}
      <h4>${escapeHtml(s.name)}${s.season ? ` <span style="color:var(--text-muted);font-weight:400;font-size:.85rem;">· ${escapeHtml(s.season)}</span>` : ''}</h4>
      ${s.image ? `<img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.name)}" style="max-height:180px;object-fit:cover;border-radius:8px;margin:8px 0;" onerror="this.remove()">` : ''}
      ${s.desc ? `<p style="margin:0;color:var(--text-muted);">${escapeHtml(s.desc)}</p>` : ''}
    </div>
  `).join('');
}

function renderEvents(b) {
  const list = b.events || [];
  if (!list.length) return '<p class="empty-msg">등록된 이벤트가 없습니다.</p>';
  return list.map(ev => `
    <div class="event-card">
      ${ev.period ? `<span class="period">${escapeHtml(ev.period)}</span>` : ''}
      <h4>${escapeHtml(ev.title)}</h4>
      ${ev.desc ? `<p style="margin:0;color:var(--text-muted);">${escapeHtml(ev.desc)}</p>` : ''}
    </div>
  `).join('');
}

function renderCostShell() {
  return `
    <div class="section-block">
      <h3>메뉴 원가표</h3>
      <div id="cost-table-wrap"></div>
    </div>
    <div class="section-block">
      <h3>빠른 계산기</h3>
      <div class="calc-box">
        <div class="field">
          <label>판매금액(원)</label>
          <input type="number" id="calc-price" placeholder="예: 12900">
        </div>
        <div class="field">
          <label>원가금액(원)</label>
          <input type="number" id="calc-cost" placeholder="예: 4600">
        </div>
        <button class="btn btn-primary" id="calc-run">계산하기</button>
      </div>
      <div class="calc-result" id="calc-result"></div>
    </div>
    <div class="section-block">
      <h3>내가 추가한 항목 (이 브라우저에만 임시 저장됨)</h3>
      <div id="scratch-table-wrap"></div>
      <button class="btn add-row-btn" id="scratch-add">+ 항목 추가</button>
    </div>
  `;
}

function costTableHtml(items) {
  if (!items.length) return '<p class="empty-msg">계산할 메뉴가 없습니다.</p>';
  const rows = items.map(it => {
    const r = calcRow(it.price, it.cost);
    return { name: it.name, ...r };
  });
  const avgCostRate = rows.reduce((s, r) => s + r.costRate, 0) / rows.length;
  const totalMargin = rows.reduce((s, r) => s + r.margin, 0);
  return `
    <table>
      <thead><tr><th>메뉴명</th><th>판매가</th><th>원가</th><th>원가율</th><th>마진액</th><th>마진율</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${escapeHtml(r.name)}</td>
            <td>${won(r.price)}</td>
            <td>${won(r.cost)}</td>
            <td class="${rateClass(r.costRate)}">${pct(r.costRate)}</td>
            <td>${won(r.margin)}</td>
            <td>${pct(r.marginRate)}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr><td colspan="3">평균 원가율 / 총 마진액</td><td class="${rateClass(avgCostRate)}">${pct(avgCostRate)}</td><td>${won(totalMargin)}</td><td></td></tr>
      </tfoot>
    </table>
  `;
}

function setupCostCalculator(brand) {
  const menu = brand.menu || {};
  const allItems = [...(menu.lunch || []), ...(menu.dinner || [])];
  document.getElementById('cost-table-wrap').innerHTML = costTableHtml(allItems);

  document.getElementById('calc-run').addEventListener('click', () => {
    const price = Number(document.getElementById('calc-price').value) || 0;
    const cost = Number(document.getElementById('calc-cost').value) || 0;
    const r = calcRow(price, cost);
    let guide = '적정 범위입니다.';
    if (r.costRate > 38) guide = '원가율이 높은 편입니다. 가격 또는 구성을 재검토하세요.';
    else if (r.costRate > 0 && r.costRate < 25) guide = '원가율이 낮습니다. 구성이 부족해 보이지 않는지 확인하세요.';
    document.getElementById('calc-result').innerHTML = `
      <div class="item"><div class="label">원가율</div><div class="value ${rateClass(r.costRate)}">${pct(r.costRate)}</div></div>
      <div class="item"><div class="label">마진액</div><div class="value">${won(r.margin)}</div></div>
      <div class="item"><div class="label">마진율</div><div class="value">${pct(r.marginRate)}</div></div>
      <div class="item" style="min-width:220px;"><div class="label">진단</div><div class="value" style="font-size:.95rem;">${guide}</div></div>
    `;
  });

  const storeKey = `costcalc-${brand.slug}`;
  let scratch = [];
  try { scratch = JSON.parse(localStorage.getItem(storeKey) || '[]'); } catch (e) { scratch = []; }

  function saveScratch() { localStorage.setItem(storeKey, JSON.stringify(scratch)); }

  function renderScratch() {
    const wrap = document.getElementById('scratch-table-wrap');
    if (!scratch.length) { wrap.innerHTML = '<p class="empty-msg">추가된 항목이 없습니다.</p>'; return; }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>이름</th><th>판매가</th><th>원가</th><th>원가율</th><th>마진액</th><th></th></tr></thead>
        <tbody>
          ${scratch.map((it, i) => {
            const r = calcRow(it.price, it.cost);
            return `
              <tr>
                <td><input type="text" data-i="${i}" data-f="name" value="${escapeHtml(it.name)}" style="width:100px;"></td>
                <td><input type="number" data-i="${i}" data-f="price" value="${it.price ?? ''}" style="width:90px;text-align:right;"></td>
                <td><input type="number" data-i="${i}" data-f="cost" value="${it.cost ?? ''}" style="width:90px;text-align:right;"></td>
                <td class="${rateClass(r.costRate)}">${pct(r.costRate)}</td>
                <td>${won(r.margin)}</td>
                <td><button class="remove-btn" data-remove="${i}">✕</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    wrap.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = Number(inp.dataset.i), f = inp.dataset.f;
        scratch[i][f] = f === 'name' ? inp.value : Number(inp.value);
        saveScratch();
        renderScratch();
      });
    });
    wrap.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        scratch.splice(Number(btn.dataset.remove), 1);
        saveScratch();
        renderScratch();
      });
    });
  }

  document.getElementById('scratch-add').addEventListener('click', () => {
    scratch.push({ name: '새 항목', price: 0, cost: 0 });
    saveScratch();
    renderScratch();
  });

  renderScratch();
}

init();
