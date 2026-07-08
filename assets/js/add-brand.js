// ---- generic repeatable-row helper ----
// fields: [{key, placeholder, type}]
function makeRepeater(containerId, addBtnId, fields, initialRows = []) {
  const container = document.getElementById(containerId);
  let rows = initialRows.length ? initialRows.map(r => ({ ...r })) : [];

  function renderRow(row, idx) {
    const div = document.createElement('div');
    div.className = 'repeat-row';
    div.dataset.idx = idx;
    fields.forEach(f => {
      const input = document.createElement(f.type === 'textarea' ? 'textarea' : 'input');
      if (f.type && f.type !== 'textarea') input.type = f.type;
      input.placeholder = f.placeholder || '';
      input.value = row[f.key] ?? '';
      input.dataset.field = f.key;
      input.addEventListener('input', () => { row[f.key] = input.value; });
      div.appendChild(input);
    });
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      rows = rows.filter(r => r !== row);
      renderAll();
    });
    div.appendChild(removeBtn);
    return div;
  }

  function renderAll() {
    container.innerHTML = '';
    rows.forEach((row, idx) => container.appendChild(renderRow(row, idx)));
  }

  document.getElementById(addBtnId).addEventListener('click', () => {
    const blank = {};
    fields.forEach(f => blank[f.key] = '');
    rows.push(blank);
    renderAll();
  });

  renderAll();
  return {
    getRows: () => rows.filter(r => Object.values(r).some(v => String(v).trim() !== '')),
  };
}

// ---- set up all repeaters ----
const colorsRepeater = makeRepeater('colors-list', 'add-color', [
  { key: 'name', placeholder: '색상 이름 (예: 다크우드)' },
  { key: 'hex', placeholder: '#4A3728', type: 'color' },
  { key: 'usage', placeholder: '용도 (예: 메인 배경)' },
], [{ name: '', hex: '#8B3A2F', usage: '' }]);

const subslogansRepeater = makeRepeater('subslogans-list', 'add-subslogan', [
  { key: 'text', placeholder: '보조 카피 문구' },
]);

const lunchRepeater = makeRepeater('lunch-list', 'add-lunch', [
  { key: 'name', placeholder: '메뉴명' },
  { key: 'price', placeholder: '판매가', type: 'number' },
  { key: 'cost', placeholder: '원가', type: 'number' },
  { key: 'desc', placeholder: '설명' },
  { key: 'image', placeholder: '이미지 경로/URL' },
]);

const dinnerRepeater = makeRepeater('dinner-list', 'add-dinner', [
  { key: 'name', placeholder: '메뉴명' },
  { key: 'price', placeholder: '판매가', type: 'number' },
  { key: 'cost', placeholder: '원가', type: 'number' },
  { key: 'desc', placeholder: '설명' },
  { key: 'image', placeholder: '이미지 경로/URL' },
]);

const seasonRepeater = makeRepeater('season-list', 'add-season', [
  { key: 'season', placeholder: '지역/테마' },
  { key: 'name', placeholder: '메뉴명' },
  { key: 'period', placeholder: '운영 시기 (예: 2026-08)' },
  { key: 'desc', placeholder: '설명' },
  { key: 'image', placeholder: '이미지 경로/URL' },
]);

const eventsRepeater = makeRepeater('events-list', 'add-event', [
  { key: 'title', placeholder: '이벤트명' },
  { key: 'period', placeholder: '기간 (예: 2026-08)' },
  { key: 'desc', placeholder: '설명' },
]);

// slug auto-fill from name
document.getElementById('f-name').addEventListener('input', e => {
  const slugField = document.getElementById('f-slug');
  if (!slugField.dataset.touched) {
    slugField.value = toSlug(e.target.value);
  }
});
document.getElementById('f-slug').addEventListener('input', e => { e.target.dataset.touched = '1'; });

function toSlug(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function buildBrandData() {
  const name = document.getElementById('f-name').value.trim();
  const slug = document.getElementById('f-slug').value.trim() || toSlug(name);
  const color = document.getElementById('f-color').value;
  const tagline = document.getElementById('f-tagline').value.trim();

  return {
    slug,
    name,
    tagline,
    color,
    createdAt: new Date().toISOString().slice(0, 10),
    overview: {
      oneLiner: document.getElementById('f-oneliner').value.trim(),
      story: document.getElementById('f-story').value.trim(),
      concept: document.getElementById('f-concept').value.trim(),
      targetCustomer: document.getElementById('f-target').value.trim(),
      differentiation: document.getElementById('f-diff').value.trim(),
    },
    brandColors: colorsRepeater.getRows(),
    copywriting: {
      mainSlogan: document.getElementById('f-main-slogan').value.trim(),
      subSlogans: subslogansRepeater.getRows().map(r => r.text).filter(Boolean),
    },
    menu: {
      lunch: lunchRepeater.getRows().map(numifyMenuRow),
      dinner: dinnerRepeater.getRows().map(numifyMenuRow),
    },
    seasonMenu: seasonRepeater.getRows(),
    events: eventsRepeater.getRows(),
  };
}

function numifyMenuRow(r) {
  return { ...r, price: Number(r.price) || 0, cost: Number(r.cost) || 0 };
}

function currentJson() {
  const data = buildBrandData();
  return { data, text: JSON.stringify(data, null, 2) };
}

document.getElementById('btn-preview').addEventListener('click', () => {
  const { text } = currentJson();
  const pre = document.getElementById('json-preview');
  pre.textContent = text;
  pre.style.display = 'block';
});

document.getElementById('btn-download').addEventListener('click', () => {
  const { data, text } = currentJson();
  if (!data.slug) { alert('브랜드명 또는 슬러그를 입력해주세요.'); return; }
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${data.slug}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('btn-copy-index').addEventListener('click', () => {
  const { data } = currentJson();
  if (!data.slug) { alert('브랜드명 또는 슬러그를 입력해주세요.'); return; }
  const entry = {
    slug: data.slug,
    name: data.name,
    tagline: data.tagline,
    color: data.color,
    summary: data.overview.oneLiner || data.overview.concept || '',
  };
  const text = JSON.stringify(entry, null, 2) + ',';
  navigator.clipboard?.writeText(text).then(() => {
    alert('복사되었습니다. data/brands/index.json 배열 안에 붙여넣으세요.');
  }).catch(() => {
    const pre = document.getElementById('json-preview');
    pre.textContent = text;
    pre.style.display = 'block';
  });
});
