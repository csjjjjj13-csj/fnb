// ---- state ----
const editSlug = new URLSearchParams(location.search).get('edit');
let originalSlug = editSlug || null;
const repeaters = {}; // key -> { getRows(), setRows(rows) }
let logoPath = '';

function currentSlug() {
  return document.getElementById('f-slug').value.trim();
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---- tab switching ----
document.getElementById('form-tabs').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  document.querySelectorAll('#form-tabs button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.querySelector(`.form-panel[data-panel="${btn.dataset.tab}"]`).classList.add('active');
});

// A freshly-uploaded image may 404 for a little while until GitHub Pages finishes
// rebuilding and publishing it. Retry a few times with growing delays before
// giving up, so the thumbnail preview in the form doesn't just look "broken".
function retryPreviewImg(imgEl, originalSrc, attempt) {
  attempt = attempt || 1;
  if (attempt > 5) {
    imgEl.alt = '아직 반영되지 않음 (잠시 후 새로고침)';
    return;
  }
  setTimeout(() => {
    imgEl.onerror = () => retryPreviewImg(imgEl, originalSrc, attempt + 1);
    imgEl.src = originalSrc + (originalSrc.includes('?') ? '&' : '?') + 'retry=' + Date.now();
  }, attempt * 3000);
}

// ---- mini field renderers used inside repeater rows ----
function renderTextMiniField(row, f) {
  const wrap = document.createElement('div');
  const label = document.createElement('label');
  label.textContent = f.label || f.key;
  const input = document.createElement(f.type === 'textarea' ? 'textarea' : 'input');
  if (f.type === 'number') input.type = 'number';
  else if (f.type === 'color') input.type = 'color';
  else if (input.tagName === 'INPUT') input.type = 'text';
  if (f.placeholder) input.placeholder = f.placeholder;
  input.value = row[f.key] ?? (f.type === 'color' ? '#8B3A2F' : '');
  input.addEventListener('input', () => {
    row[f.key] = f.type === 'number' ? Number(input.value) : input.value;
  });
  wrap.append(label, input);
  return wrap;
}

// NOTE: the upload button below must NEVER have its .textContent set directly —
// the hidden <input type=file> lives inside the same <label> as a DOM child, and
// setting label.textContent replaces (destroys) all of its children, including
// that input. That was the bug that made the "이미지 선택"/"파일 선택" button stop
// working after the very first upload: the button text was reset via
// `label.textContent = '...'`, which silently removed the file input from the
// DOM, so future clicks on the button no longer opened a file picker at all.
// Fix: keep a separate <span> for the button label text, and only ever mutate
// that span's textContent — the file input stays a permanent, untouched child.

function renderImageMiniField(row, f) {
  const wrap = document.createElement('div');
  wrap.className = 'image-field-mini';
  const labelEl = document.createElement('label');
  labelEl.textContent = f.label || '이미지';
  const preview = document.createElement('div');
  function refresh() {
    if (row[f.key]) {
      preview.innerHTML = `<img class="thumb" src="${row[f.key]}" alt="">`;
      const imgEl = preview.querySelector('img');
      imgEl.onerror = () => retryPreviewImg(imgEl, row[f.key]);
    } else {
      preview.innerHTML = '<span class="hint">등록된 이미지 없음</span>';
    }
  }
  refresh();

  const fileLabel = document.createElement('label');
  fileLabel.className = 'btn btn-sm file-upload-btn';
  const btnText = document.createElement('span');
  btnText.textContent = '이미지 선택';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  fileLabel.append(btnText, fileInput);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!currentSlug()) { alert('먼저 기본정보 탭에서 슬러그를 입력해주세요.'); fileInput.value = ''; return; }
    btnText.textContent = '업로드중...';
    try {
      const path = await uploadImageFile(file, currentSlug());
      row[f.key] = path;
      refresh();
    } catch (e) {
      alert('이미지 업로드 실패: ' + e.message);
    }
    btnText.textContent = '이미지 선택';
    fileInput.value = '';
  });
  wrap.append(labelEl, preview, fileLabel);
  return wrap;
}

function renderFileMiniField(row, f) {
  const wrap = document.createElement('div');
  wrap.className = 'file-field-mini';
  const labelEl = document.createElement('label');
  labelEl.textContent = f.label || '파일';
  const info = document.createElement('div');
  info.className = 'file-field-info';
  function refresh() {
    if (row[f.key]) {
      const name = decodeURIComponent(String(row[f.key]).split('/').pop());
      info.innerHTML = `📄 <a href="${row[f.key]}" target="_blank" rel="noopener">${name}</a>`;
    } else {
      info.textContent = '등록된 파일 없음';
    }
  }
  refresh();

  const fileLabel = document.createElement('label');
  fileLabel.className = 'btn btn-sm file-upload-btn';
  const btnText = document.createElement('span');
  btnText.textContent = '파일 선택';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = f.accept || '';
  fileInput.style.display = 'none';
  fileLabel.append(btnText, fileInput);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!currentSlug()) { alert('먼저 기본정보 탭에서 슬러그를 입력해주세요.'); fileInput.value = ''; return; }
    btnText.textContent = '업로드중...';
    try {
      const path = await uploadPresentationFile(file, currentSlug());
      row[f.key] = path;
      refresh();
    } catch (e) {
      alert('파일 업로드 실패: ' + e.message);
    }
    btnText.textContent = '파일 선택';
    fileInput.value = '';
  });
  wrap.append(labelEl, info, fileLabel);
  return wrap;
}

function renderMiniField(row, f) {
  if (f.type === 'image') return renderImageMiniField(row, f);
  if (f.type === 'file') return renderFileMiniField(row, f);
  return renderTextMiniField(row, f);
}

// ---- generic repeater builder (object rows) ----
function makeRepeater(containerId, addBtnId, fields, initialRows) {
  const container = document.getElementById(containerId);
  let rows = (initialRows || []).map(r => ({ ...r }));

  function renderRows() {
    container.innerHTML = '';
    rows.forEach((row, idx) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'repeater-row';
      const fieldsWrap = document.createElement('div');
      fieldsWrap.className = 'row-fields';
      fields.forEach(f => fieldsWrap.appendChild(renderMiniField(row, f)));
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-row-btn';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        rows.splice(idx, 1);
        renderRows();
      });
      rowEl.append(fieldsWrap, removeBtn);
      container.appendChild(rowEl);
    });
    if (!rows.length) {
      container.innerHTML = '<p class="hint">아직 추가된 항목이 없습니다.</p>';
    }
  }

  document.getElementById(addBtnId).addEventListener('click', () => {
    rows.push({});
    renderRows();
  });

  renderRows();

  return {
    getRows: () => rows.filter(r => Object.values(r).some(v => v !== undefined && v !== '')),
    setRows: (newRows) => { rows = (newRows || []).map(r => ({ ...r })); renderRows(); },
  };
}

// ---- simple string-list repeater (e.g. sub slogans) ----
function makeStringRepeater(containerId, addBtnId, placeholder, initialValues) {
  const container = document.getElementById(containerId);
  let values = [...(initialValues || [])];

  function renderRows() {
    container.innerHTML = '';
    values.forEach((val, idx) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'repeater-row';
      const fieldsWrap = document.createElement('div');
      fieldsWrap.className = 'row-fields';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = placeholder || '';
      input.value = val;
      input.addEventListener('input', () => { values[idx] = input.value; });
      fieldsWrap.appendChild(input);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-row-btn';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => { values.splice(idx, 1); renderRows(); });
      rowEl.append(fieldsWrap, removeBtn);
      container.appendChild(rowEl);
    });
    if (!values.length) {
      container.innerHTML = '<p class="hint">아직 추가된 항목이 없습니다.</p>';
    }
  }

  document.getElementById(addBtnId).addEventListener('click', () => {
    values.push('');
    renderRows();
  });

  renderRows();

  return {
    getRows: () => values.filter(v => v && v.trim()),
    setRows: (newValues) => { values = [...(newValues || [])]; renderRows(); },
  };
}

// ---- logo mini field (single, not a repeater) ----
function setupLogoField(initialPath) {
  const wrap = document.getElementById('logo-field-wrap');
  const row = { logo: initialPath || '' };
  logoPath = row.logo;
  const el = renderImageMiniField(row, { key: 'logo', label: '' });
  wrap.appendChild(el);
  // poll row.logo -> logoPath after upload completes (upload is async inside renderImageMiniField)
  const observer = setInterval(() => { logoPath = row.logo; }, 500);
  window.addEventListener('beforeunload', () => clearInterval(observer));
}

// ---- init repeaters ----
function initRepeaters(brand) {
  brand = brand || {};
  repeaters.brandImages = makeRepeater('brandImages-list', 'add-brandImage',
    [{ key: 'image', label: '이미지', type: 'image' }, { key: 'caption', label: '설명' }],
    brand.brandImages);

  repeaters.presentations = makeRepeater('presentations-list', 'add-presentation',
    [{ key: 'title', label: '자료명', placeholder: '예: 쟁반집 사업계획서' },
     { key: 'path', label: 'PPT 파일', type: 'file', accept: '.ppt,.pptx' }],
    brand.presentations);

  repeaters.brandColors = makeRepeater('brandColors-list', 'add-brandColor',
    [{ key: 'name', label: '색상명', placeholder: '예: 메인 브라운' },
     { key: 'hex', label: 'HEX 코드', type: 'color' },
     { key: 'usage', label: '활용처', placeholder: '예: 로고, 간판' }],
    (brand.brandColors));

  repeaters.subSlogans = makeStringRepeater('subSlogans-list', 'add-subSlogan',
    '예: 매일 아침 손질하는 제철 안주', (brand.copywriting || {}).subSlogans);

  const menuFields = [
    { key: 'name', label: '메뉴명' },
    { key: 'price', label: '판매가', type: 'number', placeholder: '숫자만 입력 (원)' },
    { key: 'cost', label: '원가', type: 'number', placeholder: '숫자만 입력 (원)' },
    { key: 'desc', label: '설명', type: 'textarea' },
    { key: 'image', label: '사진', type: 'image' },
  ];
  repeaters.lunch = makeRepeater('lunch-list', 'add-lunch', menuFields, (brand.menu || {}).lunch);
  repeaters.dinner = makeRepeater('dinner-list', 'add-dinner', menuFields, (brand.menu || {}).dinner);

  repeaters.season = makeRepeater('season-list', 'add-season',
    [{ key: 'season', label: '시즌', placeholder: '예: 여름' },
     { key: 'name', label: '메뉴명' },
     { key: 'period', label: '기간', placeholder: '예: 6월~8월' },
     { key: 'desc', label: '설명', type: 'textarea' },
     { key: 'image', label: '사진', type: 'image' }],
    brand.seasonMenu);

  repeaters.events = makeRepeater('events-list', 'add-event',
    [{ key: 'title', label: '이벤트명' },
     { key: 'period', label: '기간' },
     { key: 'desc', label: '설명', type: 'textarea' }],
    brand.events);
}

// ---- fill basic fields ----
function fillBasicFields(brand) {
  document.getElementById('f-name').value = brand.name || '';
  document.getElementById('f-slug').value = brand.slug || '';
  document.getElementById('f-tagline').value = brand.tagline || '';
  document.getElementById('f-color').value = brand.color || '#8B3A2F';
  document.getElementById('f-oneliner').value = (brand.overview || {}).oneLiner || '';
  document.getElementById('f-story').value = (brand.overview || {}).story || '';
  document.getElementById('f-concept').value = (brand.overview || {}).concept || '';
  document.getElementById('f-target').value = (brand.overview || {}).targetCustomer || '';
  document.getElementById('f-diff').value = (brand.overview || {}).differentiation || '';
  document.getElementById('f-mainslogan').value = (brand.copywriting || {}).mainSlogan || '';
}

// ---- build brand data object from form ----
function buildBrandData() {
  const slug = currentSlug();
  return {
    slug,
    name: document.getElementById('f-name').value.trim(),
    tagline: document.getElementById('f-tagline').value.trim(),
    color: document.getElementById('f-color').value,
    createdAt: window.__existingBrand?.createdAt || new Date().toISOString(),
    logo: logoPath || '',
    brandImages: repeaters.brandImages ? repeaters.brandImages.getRows() : [],
    presentations: repeaters.presentations ? repeaters.presentations.getRows() : [],
    overview: {
      oneLiner: document.getElementById('f-oneliner').value.trim(),
      story: document.getElementById('f-story').value.trim(),
      concept: document.getElementById('f-concept').value.trim(),
      targetCustomer: document.getElementById('f-target').value.trim(),
      differentiation: document.getElementById('f-diff').value.trim(),
    },
    brandColors: repeaters.brandColors ? repeaters.brandColors.getRows() : [],
    copywriting: {
      mainSlogan: document.getElementById('f-mainslogan').value.trim(),
      subSlogans: repeaters.subSlogans ? repeaters.subSlogans.getRows() : [],
    },
    menu: {
      lunch: repeaters.lunch ? repeaters.lunch.getRows() : [],
      dinner: repeaters.dinner ? repeaters.dinner.getRows() : [],
    },
    seasonMenu: repeaters.season ? repeaters.season.getRows() : [],
    events: repeaters.events ? repeaters.events.getRows() : [],
  };
}

// ---- submit ----
async function submitBrand() {
  const statusEl = document.getElementById('submit-status');
  const cfg = getGithubConfig();
  if (!cfg) {
    statusEl.textContent = '먼저 설정 페이지에서 GitHub 연결 정보를 저장해주세요.';
    return;
  }
  const brand = buildBrandData();
  if (!brand.name) { statusEl.textContent = '브랜드명을 입력해주세요.'; return; }
  const slug = slugify(brand.slug || brand.name);
  if (!slug) { statusEl.textContent = '슬러그(영문 URL)를 입력해주세요.'; return; }
  brand.slug = slug;

  const isEdit = !!originalSlug;
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  statusEl.textContent = 'GitHub에 저장하는 중...';

  try {
    const brandPath = `data/brands/${slug}.json`;

    if (!isEdit) {
      const existing = await ghGetFileRaw(cfg, brandPath);
      if (existing) throw new Error('이미 같은 슬러그의 브랜드가 존재합니다. 다른 슬러그를 입력해주세요.');
    } else if (slug !== originalSlug) {
      throw new Error('슬러그는 등록 후 변경할 수 없습니다.');
    }

    await ghPutTextSmart(cfg, brandPath, JSON.stringify(brand, null, 2), `${isEdit ? '브랜드 수정' : '브랜드 등록'}: ${brand.name}`);

    // update index.json
    const idxPath = 'data/brands/index.json';
    let indexArr = [];
    const idxExisting = await ghGetFile(cfg, idxPath);
    if (idxExisting) {
      try { indexArr = JSON.parse(idxExisting.text); } catch (e) { indexArr = []; }
    }
    const summary = { slug: brand.slug, name: brand.name, tagline: brand.tagline, color: brand.color };
    const pos = indexArr.findIndex(b => b.slug === slug);
    if (pos >= 0) indexArr[pos] = summary; else indexArr.push(summary);
    await ghPutTextSmart(cfg, idxPath, JSON.stringify(indexArr, null, 2), `브랜드 목록 갱신: ${brand.name}`);

    // instant-view cache so the next page shows fresh data without waiting for Pages rebuild
    sessionStorage.setItem(`brand-cache-${slug}`, JSON.stringify(brand));
    sessionStorage.setItem('index-cache', JSON.stringify(indexArr));

    statusEl.textContent = '저장 완료! 이동합니다...';
    location.href = `brand.html?brand=${encodeURIComponent(slug)}`;
  } catch (e) {
    statusEl.textContent = '❌ ' + e.message;
    btn.disabled = false;
    console.error(e);
  }
}

document.getElementById('submit-btn').addEventListener('click', submitBrand);

document.getElementById('btn-preview').addEventListener('click', () => {
  document.getElementById('json-preview').value = JSON.stringify(buildBrandData(), null, 2);
});
document.getElementById('btn-download').addEventListener('click', () => {
  const brand = buildBrandData();
  const blob = new Blob([JSON.stringify(brand, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${brand.slug || 'brand'}.json`;
  a.click();
});

// auto-suggest slug from name while creating a new brand
document.getElementById('f-name').addEventListener('input', () => {
  if (originalSlug) return; // don't touch slug once editing an existing brand
  const slugEl = document.getElementById('f-slug');
  if (!slugEl.dataset.touched) {
    slugEl.value = slugify(document.getElementById('f-name').value);
  }
});
document.getElementById('f-slug').addEventListener('input', e => { e.target.dataset.touched = '1'; });

// ---- init ----
async function init() {
  if (editSlug) {
    document.getElementById('page-title').textContent = '브랜드 수정';
    document.getElementById('f-slug').disabled = true;
    try {
      const res = await fetch(`data/brands/${encodeURIComponent(editSlug)}.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error('brand not found');
      const brand = await res.json();
      window.__existingBrand = brand;
      fillBasicFields(brand);
      setupLogoField(brand.logo);
      initRepeaters(brand);
      return;
    } catch (e) {
      document.getElementById('submit-status').textContent = '기존 브랜드 데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.';
      console.error(e);
    }
  }
  setupLogoField('');
  initRepeaters({});
}

init();
