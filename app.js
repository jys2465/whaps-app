/* 화프스(WHAPS) 화면 v3.0 — 데이터는 모두 서버(Apps Script)를 거칩니다. 화면에는 비밀을 두지 않습니다. */
'use strict';

const S = { token: null, user: null, settings: {}, data: null, detail: {}, wide: false, flash: null };
const STAFF = ['관리자', '운영기획'];
const CONTRACT_STATES = ['작성중', '서명대기', '증빙수집', '완료', '종료'];
const PRODUCT_STATES = ['검토중', '판매중', '판매중지'];
const SHIP_METHODS = ['자사배송', '업체배송'];
const VENDOR_KINDS = ['공급사', 'PB제조사', '물류사', '개발사', '기타'];
// TRADE_TYPES, CONTRACT_DOCS, CONTRACT_KINDS, KEY_META, kindParts, partsKeys, adCalc, termsTable, fmtComma 는 templates.js에 있습니다.

/* ───────── 작은 도구 ───────── */
const $ = (sel, root) => (root || document).querySelector(sel);
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  let value;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'value') value = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (typeof v === 'boolean') e[k] = v;
      else e.setAttribute(k, v);
    }
  }
  kids.flat(Infinity).forEach(k => {
    if (k === null || k === undefined || k === false) return;
    e.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  });
  if (value !== undefined) e.value = value;
  return e;
}
const num = s => Number(String(s === undefined || s === null ? '' : s).replace(/,/g, ''));
const won = n => (n === null || n === undefined || isNaN(n) ? '—' : Math.round(n).toLocaleString('ko-KR') + '원');
const pct = n => (n === null || n === undefined || isNaN(n) ? '—' : (n * 100).toFixed(1) + '%');
const isStaff = () => S.user && STAFF.includes(S.user.role);
const isAdmin = () => S.user && S.user.role === '관리자';
const canEdit = () => S.user && !['조회', '업체'].includes(S.user.role);
const isVendor = () => !!(S.user && S.user.role === '업체');
function bizNoOk(s) {
  const d = String(s).replace(/[^0-9]/g, '');
  if (d.length !== 10) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * w[i];
  sum += Math.floor(Number(d[8]) * 5 / 10);
  return (10 - (sum % 10)) % 10 === Number(d[9]);
}
function toast(msg, kind) {
  const box = $('#toast');
  while (box.children.length >= 2) box.firstChild.remove();
  const t = el('div', { class: kind === 'err' ? 'err' : '' }, msg);
  box.appendChild(t);
  setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3000);
}
// 화면 조각을 붙입니다. 목록은 펼치고, 빈 값(null)은 건너뜁니다(브라우저 기본 append는 목록·null을 글자로 찍음).
function appendKids(parent, ...kids) {
  kids.flat(Infinity).forEach(k => {
    if (k === null || k === undefined || k === false) return;
    parent.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  });
  return parent;
}
function field(label, input, hint, cls) {
  return el('label', { class: 'field' + (cls ? ' ' + cls : '') }, el('span', null, label), input, hint ? el('small', null, hint) : null);
}
function select(options, value, attrs) {
  const s = el('select', attrs || null, options.map(o => (Array.isArray(o) ? el('option', { value: o[0] }, o[1]) : el('option', { value: o }, o))));
  if (value !== undefined) s.value = value;
  return s;
}
async function act(btn, fn) {
  if (btn) btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message, 'err'); } finally { if (btn) btn.disabled = false; }
}
const SHORT = { 작성중: '작성', 서명대기: '서명', 증빙수집: '증빙', 완료: '완료', 종료: '종료' };
function stamp(state, small) { return el('div', { class: 'stamp ' + state + (small ? ' sm' : ''), role: 'img', 'aria-label': '상태: ' + state }, small ? (SHORT[state] || state) : state); }
function tagFor(state) {
  const cls = { 확인: 'ok', 미확인: 'wait', 없음: 'no', 반려: 'no' }[state] || '';
  return el('span', { class: 'tag ' + cls }, state);
}

/* ───────── 대기 표시(모래시계) ───────── */
const BUSY_MSG = { login: '로그인 중입니다', bootstrap: '자료를 불러오는 중입니다', 'contract.confirm': '계약서 PDF를 만드는 중입니다 (10초 안팎)',
  'attach.upload': '파일을 올리는 중입니다', 'file.get': '파일을 여는 중입니다', 'auth.changePassword': '비밀번호를 바꾸는 중입니다' };
let busyN = 0, busyTimer = null;
function busyEl() {
  let b = document.getElementById('busy');
  if (!b) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'hourglass'); svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M6 2h12M6 22h12M7 2v4a5 5 0 0 0 2.5 4.3L12 12l2.5 1.7A5 5 0 0 1 17 18v4M17 2v4a5 5 0 0 1-2.5 4.3L12 12l-2.5 1.7A5 5 0 0 0 7 18v4M9.5 19h5');
    svg.appendChild(p);
    b = el('div', { id: 'busy', role: 'status', 'aria-live': 'polite' }, el('div', { class: 'busy-card' }, svg, el('div', { id: 'busy-msg' })));
    document.body.appendChild(b);
  }
  return b;
}
function busyStart(msg) {
  busyN++;
  busyEl();
  $('#busy-msg').textContent = msg;
  clearTimeout(busyTimer);
  busyTimer = setTimeout(() => { if (busyN > 0) $('#busy').classList.add('on'); }, 250);
}
function busyEnd() {
  busyN = Math.max(0, busyN - 1);
  if (!busyN) { clearTimeout(busyTimer); const b = $('#busy'); if (b) b.classList.remove('on'); }
}

/* ───────── 서버 호출 ───────── */
class ApiError extends Error { constructor(msg, code) { super(msg); this.code = code; } }
async function api(action, payload, opts) {
  const silent = opts && opts.silent;
  const body = JSON.stringify({ action: action, payload: payload || {}, token: S.token });
  const bar = $('#progress');
  if (bar && !silent) bar.classList.add('on');
  if (!silent) busyStart(BUSY_MSG[action] || (/\.(list|get)$/.test(action) || action === 'auth.me' ? '불러오는 중입니다' : '저장하는 중입니다'));
  let j;
  try {
    if (window.__WHAPS_TEST_HANDLER__) {
      j = JSON.parse(await Promise.resolve(window.__WHAPS_TEST_HANDLER__(body)));
    } else {
      const url = (window.WHAPS_CONFIG || {}).API_URL || '';
      if (!/^https:\/\/script\.google\.com\//.test(url)) throw new ApiError('config.js에 Apps Script 웹앱 주소를 넣어 주세요.', 'config');
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body });
      j = await res.json();
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('서버에 연결하지 못했습니다. 인터넷 연결과 웹앱 주소를 확인하세요.', 'network');
  } finally {
    if (bar && !silent) bar.classList.remove('on');
    if (!silent) busyEnd();
  }
  if (!j.ok) {
    if (j.code === 'auth') { clearSession(); setTimeout(() => viewLogin(j.msg), 0); }
    if (j.code === 'must_change') setTimeout(() => { location.hash = '#/password'; }, 0);
    throw new ApiError(j.msg || '요청을 처리하지 못했습니다.', j.code);
  }
  return j.data;
}
// 앱을 열 때 목록을 한 번에 받아 두고(bootstrap), 화면 전환은 기억해 둔 데이터로 즉시 그립니다.
const LISTS = { vendors: 'vendors', categories: 'categories', warehouses: 'warehouses', products: 'products', contracts: 'contracts', notices: 'notices' };
function persistData() { try { sessionStorage.setItem('whaps_data', JSON.stringify(S.data)); } catch (e) { /* 용량 초과 시 무시 */ } }
function applyData(d) {
  if (d.user) S.user = d.user;
  S.settings = d.settings;
  S.data = { vendors: d.vendors, categories: d.categories, warehouses: d.warehouses, products: d.products, contracts: d.contracts, notices: d.notices,
    dashboard: d.dashboard, choices: d.choices || [], details: d.details || {}, vendor: d.vendor || null, at: d.at, _t: Date.now() };
  saveUser(); persistData();
  autoLogo();
  return S.data;
}
async function loadAll(silent) {
  return applyData(await api('bootstrap', {}, { silent: !!silent }));
}
let refreshTimer = null;
function refreshSoon(rerender) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    try {
      await loadAll(true);
      if (rerender && /^#\/(home|contracts|products|masters|notices|contract\/[^/]+$)/.test(location.hash || '#/home')) route(true);
    } catch (e) { /* 다음 기회에 */ }
  }, 1200);
}
function upsert(list, row, key) {
  if (!S.data || !row) return;
  const k = key || 'id';
  const arr = S.data[list] || (S.data[list] = []);
  const i = arr.findIndex(x => x[k] === row[k]);
  if (i >= 0) arr[i] = row; else arr.unshift(row);
  persistData();
}
function rememberDetail(d) {
  if (!d || !d.contract) return d;
  if (S.data) { S.data.details = S.data.details || {}; S.data.details[d.contract.id] = d; }
  const lite = Object.assign({}, d.contract); delete lite.키값JSON;
  upsert('contracts', lite);
  return d;
}
function setSession(d) {
  S.token = d.token; S.user = d.user; S.settings = d.settings || {};
  saveUser();
}
function clearSession() { S.token = null; S.user = null; S.data = null; S.detail = {}; sessionStorage.removeItem('whaps'); sessionStorage.removeItem('whaps_data'); }
function saveUser() { sessionStorage.setItem('whaps', JSON.stringify({ token: S.token, user: S.user, settings: S.settings })); }
// 계약서 바닥글 로고가 없으면 화프스 로고(gcw1.png)를 자동으로 등록합니다(운영기획·관리자).
let logoTried = false;
async function registerLogo(blob, name, silent) {
  const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  S.settings = await api('settings.logo', { data: dataUrl.split(',')[1], mime: blob.type || 'image/png', ratio: img.naturalHeight / img.naturalWidth, name: name }, { silent: !!silent });
  saveUser();
}
async function autoLogo() {
  if (logoTried || !isStaff() || S.settings.로고파일ID) return;
  logoTried = true;
  try { const b = await (await fetch('gcw1.png')).blob(); await registerLogo(b, 'gcw1.png', true); } catch (e) { /* 설정 화면에서 다시 등록 */ }
}

/* ───────── 계약서 템플릿 ───────── */
function fillNodes(text, values, settings) {
  const out = [];
  const re = /\{\{([^}]+)\}\}/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = m[1];
    const v = k[0] === '@' ? (settings[k.slice(1)] || '') : (values[k] || '');
    out.push(v ? el('span', { class: 'fv' }, v) : el('span', { class: 'miss' }, '«' + keyLabel(k) + '»'));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
// 계약서 블록을 화면 요소로 만듭니다(화면 미리보기와 인쇄가 함께 씀).
// 계약서 블록을 화면 요소로 만듭니다(화면 미리보기와 인쇄가 함께 씀).
function docNodes(tpl, values, settings) {
  return tpl.blocks.map(b => {
    if (b.t === 'title') return { t: b.t, node: el('h2', { class: 'doc-title' }, fillNodes(b.x, values, settings)) };
    if (b.t === 'party') {                       // 좌우 같은 항목을 같은 줄에(대표자·도장 자리가 나란히)
      const L = b.left.lines, R = b.right.lines;
      const cells = [el('div', { class: 'ttl' }, b.left.title), el('div', { class: 'ttl' }, b.right.title)];
      for (let i = 0; i < Math.max(L.length, R.length); i++) {
        [L[i], R[i]].forEach(ln => cells.push(ln ? el('div', { class: 'ln' }, el('span', { class: 'lb' }, ln[0]), el('span', { class: 'vl' }, fillNodes(ln[1], values, settings))) : el('div')));
      }
      return { t: b.t, node: el('div', { class: 'party' }, cells) };
    }
    if (b.t === 'sp') {
      const v = String(values['특약사항'] || '').trim();
      return { t: b.t, node: el('div', { class: 'sp' }, (v ? v.split(/\r?\n/).filter(x => x.trim()) : ['없음']).map(line => el('p', null, el('span', { class: 'fv' }, line)))) };
    }
    if (b.t === 'table') {
      const tb = el('table');
      b.rows.forEach(r => tb.appendChild(el('tr', null, r.map(c => el('td', { class: c.h ? 'h' : null }, fillNodes(c.x, values, settings))))));
      return { t: b.t, node: tb };
    }
    if (b.t === 'terms') {                       // 별지 1: 상품 데이터로 만든 거래조건표
      const tt = values._terms || { title: '상품', head: ['상품코드', '상품명'], rows: [] };
      const rows = tt.rows.length ? tt.rows : [['등록된 상품이 없습니다'].concat(tt.head.slice(1).map(() => ''))];
      const tb = el('table', { class: 'terms' }, el('tr', null, tt.head.map(h => el('td', { class: 'h' }, h))),
        rows.map(r => el('tr', null, r.map(x => el('td', null, el('span', { class: 'fv' }, String(x || '')))))));
      return { t: 'table', node: el('div', null, el('p', { class: 'h' }, tt.title), tb) };
    }
    return { t: b.t, node: el('p', { class: b.t === 'p' ? null : b.t }, fillNodes(b.x, values, settings)) };
  });
}
// 여러 문서(기본계약 + 부속서 + 별지)를 문서마다 새 쪽에서 시작하게 나누고, 전체 쪽 번호를 붙입니다.
function paginateParts(parts, values, settings) {
  const pages = [];
  parts.forEach(code => { const t = CONTRACT_DOCS[code]; if (t) paginate(t, values, settings).forEach(p => pages.push(p)); });
  pages.forEach((p, i) => { const n = p.querySelector('.pg-num'); if (n) n.textContent = (i + 1) + ' / ' + pages.length; });
  return pages;
}
function renderPaged(parts, values, settings) {
  const wrap = el('div', { class: 'pages', 'aria-label': '계약서 미리보기' }, paginateParts(parts, values, settings));
  requestAnimationFrame(() => fitPages(wrap));
  return wrap;
}
// 인쇄: 같은 쪽 나누기 결과를 여백 0으로 인쇄(브라우저가 날짜·제목·주소를 붙이지 않음)
async function printDoc(parts, values, settings) {
  const prev = document.getElementById('print-root');
  if (prev) prev.remove();
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const root = el('div', { id: 'print-root', 'aria-hidden': 'true' }, paginateParts(parts, values, settings));
  document.body.appendChild(root);
  await Promise.all(Array.from(root.querySelectorAll('img')).map(img => (img.complete ? null : new Promise(r => { img.onload = r; img.onerror = r; }))));
  const cleanup = () => { root.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
// 이 계약 종류·거래형태에서 키별로 고를 수 있는 값 (운영기획이 설정)
function choicesFor(kind, trade) {
  const m = {};
  ((S.data && S.data.choices) || []).forEach(c => {
    if (c.계약종류 && c.계약종류 !== kind && c.계약종류 !== trade) return;
    (m[c.키] = m[c.키] || []).push(c.값);
  });
  return m;
}
const vendorTrade = v => (v ? (v.구분 === 'PB제조사' ? '직매입' : (v.거래형태 || '')) : '');
// 상대방 정보(벤더 마스터)로 자동 채우는 값
function partyValues(vendor) {
  const masked = s => /\*/.test(String(s || ''));
  const m = { 상대_상호: vendor.상호, 상대_사업자등록번호: vendor.사업자등록번호, 상대_주소: vendor.사업장주소, 상대_대표자: vendor.대표자,
    상대_담당자: vendor.담당자, 상대_연락처: vendor.연락처, 상대_이메일: vendor.이메일 };
  const out = {};
  Object.keys(m).forEach(k => { out[k] = m[k] && !masked(m[k]) ? m[k] : ''; });
  return out;
}
const keyLabel = k => (KEY_META[k] && KEY_META[k].label) || k.replace(/^@/, '').replace(/_/g, ' ');
// 미리보기용 값: 입력값 + 상대방 정보 + 광고료 계산 + 거래조건표
function previewValues(kind, vendor, parts, values) {
  const v = Object.assign({}, values);
  if (vendor) Object.assign(v, partyValues(vendor));
  const keys = partsKeys(parts);
  keys.forEach(k => { if (KEY_META[k] && KEY_META[k].t === 'won' && v[k]) v[k] = fmtComma(v[k]); });
  if (keys.includes('광고료_총액')) {
    const r = adCalc(v.광고_시작일, v.광고_종료일, v.광고_일단가);
    v.광고_게재일수 = r ? String(r.days) : '';
    v.광고료_총액 = r && v.광고_일단가 ? fmtComma(r.total) : '';
  }
  if (parts.includes('S1') && vendor) v._terms = termsTable(vendorTrade(vendor), ((S.data && S.data.products) || []).filter(p => p.공급사코드 === vendor.id), v);
  if (keys.includes('거래조건표_번호') && !v.거래조건표_번호) v.거래조건표_번호 = '확정 때 자동';
  return v;
}

/* ───────── 터치 서명 패드 ───────── */
function signaturePad() {
  const c = el('canvas', { width: '600', height: '200', class: 'sigpad', 'aria-label': '여기에 손가락이나 펜으로 서명하세요' });
  const ctx = c.getContext('2d');
  ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
  let drawing = false, dirty = false, last = null;
  const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.addEventListener('pointerdown', e => { drawing = true; last = pos(e); try { c.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } e.preventDefault(); });
  c.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
    last = p; dirty = true; e.preventDefault();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => c.addEventListener(t, () => { drawing = false; }));
  const clear = () => { ctx.clearRect(0, 0, c.width, c.height); dirty = false; };
  const bClear = el('button', { type: 'button', class: 'btn small ghost' }, '지우고 다시 쓰기');
  bClear.onclick = clear;
  return { node: el('div', { class: 'sigwrap' }, c, el('div', { class: 'inline' }, el('small', null, '칸 안에 서명하세요'), bClear)), isEmpty: () => !dirty, dataUrl: () => c.toDataURL('image/png'), clear };
}
let measureHost = null;
function paginate(tpl, values, settings) {
  if (!measureHost || !measureHost.isConnected) { measureHost = el('div', { class: 'measure-host', 'aria-hidden': 'true' }); document.body.appendChild(measureHost); }
  const probe = el('section', { class: 'pg' }, el('div', { class: 'pg-body' }));
  measureHost.appendChild(probe);
  const box = probe.firstChild;
  const avail = box.getBoundingClientRect().height;
  const nodes = docNodes(tpl, values, settings);
  const items = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.t === 'center') {                        // 계약일 + 당사자 + 안내문은 한 덩어리로(쪽이 갈리지 않게)
      const grp = el('div', { class: 'sig' }, n.node);
      while (nodes[i + 1] && (nodes[i + 1].t === 'party' || nodes[i + 1].t === 'note')) grp.appendChild(nodes[++i].node);
      items.push({ node: grp });
    } else items.push({ node: n.node, keepNext: n.t === 'h' || n.t === 'title' });
  }
  items.forEach(it => { box.appendChild(it.node); it.h = it.node.getBoundingClientRect().height; });
  const pages = [[]];
  let used = 0;
  items.forEach((it, i) => {
    const need = it.h + (it.keepNext && items[i + 1] ? items[i + 1].h : 0);
    if (used + need > avail + 0.5 && pages[pages.length - 1].length) { pages.push([]); used = 0; }
    pages[pages.length - 1].push(it);
    used += it.h;
  });
  probe.remove();
  return pages.map((list, idx) => el('section', { class: 'pg' },
    el('div', { class: 'pg-body' }, list.map(it => it.node)),
    el('img', { class: 'pg-logo', src: 'gcw1.png', alt: '' }),
    el('div', { class: 'pg-num' }, (idx + 1) + ' / ' + pages.length)));
}
// 화면용: 쪽마다 A4 종이처럼 보이고, 화면 폭에 맞춰 축소합니다.
function fitPages(wrap) {
  const w = wrap.clientWidth;
  if (!w) return;
  wrap.style.setProperty('--z', String(Math.min(1, (w - 4) / 793.7)));
}
window.addEventListener('resize', () => document.querySelectorAll('.pages').forEach(fitPages));
// 인쇄: 같은 쪽 나누기 결과를 여백 0으로 인쇄(브라우저가 날짜·제목·주소를 붙이지 않음)
/* ───────── 뼈대와 라우터 ───────── */
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  contract: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5',
  product: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9',
  master: 'M12 3 2.5 8 12 13l9.5-5zM2.5 12.5 12 17.5l9.5-5M2.5 16.5 12 21.5l9.5-5',
  more: 'M5 12h.01M12 12h.01M19 12h.01'
};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICONS[name]);
  if (name === 'more') p.setAttribute('stroke-width', '3.2');
  svg.appendChild(p);
  return svg;
}
function logoutButton() {
  const b = el('button', { class: 'logout', type: 'button' }, '로그아웃');
  b.onclick = async () => {
    try { await api('auth.logout', {}, { silent: true }); } catch (e) { /* 이미 만료 */ }
    clearSession(); history.replaceState(null, '', location.pathname); viewLogin('로그아웃했습니다.');
  };
  return b;
}
function renderShell() {
  const tabs = isVendor()
    ? [['#/home', 'contract', '내 계약'], ['#/more', 'more', '더보기']]
    : [['#/home', 'home', '홈'], ['#/contracts', 'contract', '계약'], ['#/products', 'product', '상품'], ['#/masters/vendors', 'master', '마스터'], ['#/more', 'more', '더보기']];
  const nav = el('nav', { class: 'tabs' + (isVendor() ? ' two' : ''), 'aria-label': '주 메뉴' }, tabs.map(([h, ic, t]) => el('a', { href: h, 'data-base': h.split('/')[1] }, icon(ic), t)));
  $('#root').replaceChildren(
    el('div', { class: 'progress', id: 'progress' }),
    el('header', { class: 'bar' }, el('img', { src: 'wp1.png', alt: 'WP' }), el('span', { class: 'name' }, isVendor() ? '계약 서명' : '화프스'),
      el('span', { class: 'who' }, S.user.name, isVendor() ? null : [el('br'), S.user.role]), logoutButton()),
    el('main', { id: 'main' }), nav);
  route();
}
async function viewHome() {
  if (isVendor()) return viewVendorHome();
  const data = await ensureData();
  const d = data.dashboard;
  const todo = [];
  d.waitingSign.forEach(c => {
    const how = c.서명방식 === '전자' ? (c.업체서명일시 ? '업체 서명 완료 · 회사 서명이 필요합니다' : (c.회사서명일시 ? '회사 서명 완료 · 업체 서명을 기다리는 중' : '전자서명을 기다리는 중')) : '전자서명을 요청하거나 서명본을 올리세요';
    todo.push(el('a', { class: 'row', href: '#/contract/' + c.id }, stamp('서명대기', true),
      el('div', { class: 'main' }, el('div', { class: 't' }, c.상호), el('div', { class: 's' }, how + ' · ' + c.종류명))));
  });
  if (d.docsToCheck) todo.push(el('a', { class: 'row', href: '#/contracts/' + encodeURIComponent('증빙수집') }, stamp('증빙수집', true),
    el('div', { class: 'main' }, el('div', { class: 't' }, '확인할 서류 ' + d.docsToCheck + '건'), el('div', { class: 's' }, '올라온 서명본·증빙을 확인하세요'))));
  d.expiring.forEach(c => todo.push(el('a', { class: 'row', href: '#/contract/' + c.id }, stamp('완료', true),
    el('div', { class: 'main' }, el('div', { class: 't' }, c.상호 + ' 만료 ' + c.남은일 + '일 전'), el('div', { class: 's' }, c.종류명 + ' · ' + c.계약종료일)))));
  return el('div', null,
    el('h1', null, S.user.name + '님, 오늘 처리할 일'),
    el('div', { class: 'list' }, todo.length ? todo : el('div', { class: 'empty' }, '지금 처리할 계약 업무가 없습니다.')),
    el('h2', null, '계약 현황'),
    el('div', { class: 'stamps' }, CONTRACT_STATES.map(st => el('a', { href: '#/contracts/' + encodeURIComponent(st) }, stamp(st, true), el('b', null, d.contracts[st] || 0), el('span', { class: 'cap' }, st)))),
    el('h2', null, '상품 현황'),
    el('div', { class: 'list' }, el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, '등록된 벤더 ' + d.vendors + '곳'),
      el('div', { class: 's' }, PRODUCT_STATES.map(k => k + ' ' + (d.products[k] || 0)).join('  |  '))))),
    el('h2', null, '공지'),
    el('div', { class: 'list' }, d.notices.length ? d.notices.map(n => el('a', { class: 'row', href: '#/notice/' + encodeURIComponent(n.id) },
      el('div', { class: 'main' }, el('div', { class: 't' }, n.제목), el('div', { class: 's' }, (n.작성자명 || '') + ' · ' + String(n.수정일시).slice(0, 10)))))
      : el('div', { class: 'empty' }, '공지가 없습니다.')),
    el('div', { class: 'actions' }, el('a', { class: 'btn ghost', href: '#/notices' }, '공지 전체 보기'), isStaff() ? el('a', { class: 'btn', href: '#/notice/new/edit' }, '공지 쓰기') : null),
    el('p', { class: 'lead' }, '자료 기준 ' + (data.at || '')));
}
function viewMore() {
  const item = (href, t, sub) => el('a', { class: 'row', href: href }, el('div', { class: 'main' }, el('div', { class: 't' }, t), sub ? el('div', { class: 's' }, sub) : null));
  if (isVendor()) {
    return el('div', null, el('h1', null, '더보기'),
      el('div', { class: 'list' }, item('#/password', '비밀번호 바꾸기')),
      el('p', { class: 'lead', style: 'margin-top:16px' }, '문의는 WHITE PRICE 담당자에게 연락해 주세요. · ' + S.user.id));
  }
  const bReload = el('button', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, '최신 자료 다시 받기'), el('div', { class: 's' }, '다른 사람이 바꾼 내용을 바로 보고 싶을 때')));
  bReload.onclick = () => act(bReload, async () => { await loadAll(false); toast('최신 자료를 받았습니다.'); });
  return el('div', null, el('h1', null, '더보기'),
    el('div', { class: 'list' }, item('#/notices', '공지사항', isStaff() ? '등록·수정·삭제' : '읽기'), item('#/password', '비밀번호 바꾸기'), bReload,
      isAdmin() ? [item('#/users', '사용자 관리', '계정 추가, 역할, 업체 계정, 비밀번호 초기화'), item('#/audit', '감사로그', '누가 언제 무엇을 바꿨는지')] : null,
      isStaff() ? item('#/settings', '회사 정보·선택 목록·로고·직인', '계약서에 들어가는 우리 회사 정보와 키값 목록') : null),
    el('h2', null, '2단계에서 열리는 메뉴'),
    el('div', { class: 'list' }, ['주문관리', '매입관리', '비용관리', '매출관리', '정산관리', '손익관리'].map(t => el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't', style: 'color:var(--muted)' }, t)), el('span', { class: 'tag' }, '12월 이후')))),
    el('p', { class: 'lead', style: 'margin-top:16px' }, '화프스 v3.0 · ' + S.user.id + ' (' + S.user.role + ')'));
}
async function viewUsers() {
  if (!isAdmin()) throw new Error('관리자만 볼 수 있습니다.');
  const list = await api('user.list');
  const vendors = (await ensureData()).vendors;
  const vName = id => { const v = vendors.find(x => x.id === id); return v ? v.상호 : id; };
  const result = el('div');
  const flash = S.flash && S.flash.pw ? S.flash : null;
  if (flash) S.flash = null;
  const showTemp = (who, pw) => result.replaceChildren(el('div', { class: 'note' }, who + '의 임시 비밀번호입니다. 지금 한 번만 보입니다. 본인에게 직접 전달하세요.'), el('p', { class: 'secret' }, pw));
  const nid = el('input', { autocapitalize: 'off', placeholder: '영문·숫자 3자 이상' }), nname = el('input'), nrole = select(['MD', '운영기획', '관리자', '조회', '업체'], 'MD');
  const nven = select([['', '연결할 벤더']].concat(vendors.map(v => [v.id, v.상호 + ' (' + v.id + ')'])), '');
  const venField = field('연결할 벤더 (업체 계정)', nven, '업체 계정은 그 벤더의 계약만 봅니다');
  const syncRole = () => { venField.style.display = nrole.value === '업체' ? '' : 'none'; };
  nrole.addEventListener('change', syncRole);
  const bAdd = el('button', { class: 'btn primary' }, '계정 만들기');
  bAdd.onclick = () => act(bAdd, async () => {
    const d = await api('user.save', { isNew: true, id: nid.value.trim(), 이름: nname.value, 역할: nrole.value, 벤더코드: nven.value });
    S.flash = { who: nid.value.trim(), pw: d.tempPassword };
    route();
  });
  const rows = list.map(u => {
    const role = select(['관리자', '운영기획', 'MD', '조회', '업체'], u.역할), st = select(['사용', '중지'], u.상태);
    const bSave = el('button', { class: 'btn small' }, '저장');
    bSave.onclick = () => act(bSave, async () => { await api('user.save', { id: u.id, 이름: u.이름, 역할: role.value, 상태: st.value, 벤더코드: u.벤더코드 }); toast(u.id + ' 저장 (다음 로그인부터 적용)'); });
    const bReset = el('button', { class: 'btn small ghost' }, '비밀번호 초기화');
    bReset.onclick = () => act(bReset, async () => { if (!confirm(u.id + '의 비밀번호를 초기화할까요?')) return; const d = await api('user.resetPassword', { id: u.id }); showTemp(u.id, d.tempPassword); window.scrollTo(0, 0); });
    return el('div', { class: 'row', style: 'flex-wrap:wrap' }, el('div', { class: 'main' }, el('div', { class: 't' }, u.이름 + ' (' + u.id + ')'),
      el('div', { class: 's' }, (u.벤더코드 ? '업체: ' + vName(u.벤더코드) + ' · ' : '') + '마지막 수정 ' + u.수정일시)), role, st, bSave, bReset);
  });
  if (flash) showTemp(flash.who, flash.pw);
  syncRole();
  return el('div', null, el('h1', null, '사용자 관리'), result,
    el('div', { class: 'form' }, el('div', { class: 'two' }, field('아이디', nid), field('이름', nname)), field('역할', nrole, 'MD: 작성 · 운영기획: 확정·서류 확인 · 조회: 읽기만 · 업체: 자기 계약 서명'), venField, bAdd),
    el('p', { class: 'lead' }, '업체 계정은 계약 화면의 "업체에 전자서명 요청"을 누르면 자동으로 만들어집니다.'),
    el('h2', null, '계정 ' + list.length + '개'), el('div', { class: 'list' }, rows));
}
async function registerImage(action, blob, name, silent) {
  const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  S.settings = await api(action, { data: dataUrl.split(',')[1], mime: blob.type || 'image/png', ratio: img.naturalHeight / img.naturalWidth, name: name }, { silent: !!silent });
  saveUser();
}
async function viewSettings() {
  if (!isStaff()) throw new Error('운영기획·관리자만 볼 수 있습니다.');
  await ensureData();
  const keys = Object.keys(S.settings).filter(k => !k.startsWith('로고') && !k.startsWith('직인'));
  const selKeys = Object.keys(KEY_META).filter(k => KEY_META[k].t === 'select');
  const scopes = [['', '모든 계약']].concat(TRADE_TYPES.map(t => [t, '거래형태: ' + t])).concat(Object.keys(CONTRACT_KINDS).map(k => [k, '계약: ' + CONTRACT_KINDS[k].name]));
  const scopeName = c => (scopes.find(s => s[0] === (c || '')) || [c, c])[1];
  const nk = select(selKeys.map(k => [k, keyLabel(k)]), '대금지급주기'), nv = el('input', { placeholder: '예) 주간 마감(월~일)·차주 목요일 지급' }), nt = select(scopes, ''), no = el('input', { type: 'number', value: '1', min: '1', style: 'max-width:90px' });
  const bAddCh = el('button', { class: 'btn primary' }, '목록에 추가');
  bAddCh.onclick = () => act(bAddCh, async () => {
    S.data.choices = await api('choice.save', { 키: nk.value, 값: nv.value, 계약종류: nt.value, 순서: no.value });
    persistData(); toast('선택 목록에 추가했습니다.'); route(true);
  });
  const groups = {};
  (S.data.choices || []).forEach(c => { (groups[c.키] = groups[c.키] || []).push(c); });
  const choiceBox = el('div', null,
    el('p', { class: 'lead' }, '선택지가 하나뿐이면 그 값이 자동으로 들어가고, 여럿이면 그중에서만 고릅니다(직접 입력 불가). 문장에 넣었을 때 조사가 자연스러운지 확인하고 추가하세요. 확정된 계약서에는 영향이 없습니다.'),
    Object.keys(groups).length ? Object.keys(groups).map(k => el('details', null, el('summary', null, keyLabel(k) + ' (' + groups[k].length + ')'), el('div', { class: 'list' }, groups[k].map(c => {
      const bDel = el('button', { class: 'btn small ghost' }, '지우기');
      bDel.onclick = () => act(bDel, async () => {
        if (!confirm('"' + c.값 + '"(' + scopeName(c.계약종류) + ')을 목록에서 지울까요?')) return;
        S.data.choices = await api('choice.save', Object.assign({}, c, { 삭제: true })); persistData(); route(true);
      });
      return el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, c.값), el('div', { class: 's' }, scopeName(c.계약종류) + ' · 순서 ' + c.순서)), bDel);
    })))) : el('div', { class: 'list' }, el('div', { class: 'empty' }, '등록된 선택 목록이 없습니다.')),
    el('div', { class: 'form', style: 'margin-top:12px' }, el('div', { class: 'two' }, field('입력값', nk), field('적용 대상', nt)), field('값', nv), field('순서', no), bAddCh));
  const imgBlock = (title, key, action, hint, file, label) => {
    const inp = el('input', { type: 'file', accept: 'image/png,image/jpeg', class: 'sr' });
    const b = el('button', { class: 'btn' }, label);
    b.onclick = () => inp.click();
    inp.onchange = () => act(b, async () => { const f = inp.files[0]; if (!f) return; await registerImage(action, f, f.name); toast(title + '을(를) 등록했습니다.'); route(true); });
    return el('div', { class: 'form' }, el('p', { class: 'note' }, S.settings[key] ? '등록되어 있습니다. ' + hint : '아직 없습니다. ' + hint), file ? el('img', { src: file, alt: '', style: 'max-width:180px' }) : null, el('div', { class: 'actions', style: 'margin:0' }, b, inp));
  };
  const bDefault = el('button', { class: 'btn' }, '화프스 로고(gcw1.png)로 등록');
  bDefault.onclick = () => act(bDefault, async () => { const b = await (await fetch('gcw1.png')).blob(); await registerImage('settings.logo', b, 'gcw1.png'); toast('계약서 로고를 등록했습니다.'); route(true); });
  return el('div', null, el('h1', null, '회사 정보·선택 목록·로고·직인'),
    el('h2', null, '키값 선택 목록'), choiceBox,
    el('h2', null, '회사 직인 (전자서명용)'),
    imgBlock('회사 직인', '직인파일ID', 'settings.seal', '전자서명할 때 "회사 직인으로 서명"을 누르면 계약서 대표자 칸에 이 이미지가 들어갑니다. 배경이 투명한 PNG를 권합니다.', null, '직인 이미지 올리기'),
    el('h2', null, '계약서 바닥글 로고'),
    el('div', null, imgBlock('계약서 로고', '로고파일ID', 'settings.logo', '계약서 PDF 각 페이지 아래 가운데에 들어갑니다(폭 26mm).', 'gcw1.png', '다른 이미지로 바꾸기'), el('div', { class: 'actions' }, bDefault)),
    el('h2', null, '회사 정보와 기준값'),
    el('p', { class: 'lead' }, '회사 정보는 모든 계약서의 "공급받는 자" 칸에 들어갑니다. 이미 확정된 계약서 PDF는 바뀌지 않습니다.'),
    el('div', { class: 'form' }, keys.map(k => {
      const i = el('input', { value: S.settings[k], disabled: !isAdmin() });
      const b = el('button', { class: 'btn small' }, '저장');
      b.onclick = () => act(b, async () => { S.settings = await api('settings.save', { 키: k, 값: i.value }); saveUser(); toast(k + ' 저장'); });
      return el('label', { class: 'field' }, el('span', null, k.replace(/_/g, ' ')), el('div', { class: 'inline' }, i, isAdmin() ? b : null));
    })));
}
const ROUTES = [
  [/^#\/home$/, () => viewHome()],
  [/^#\/contracts(?:\/([^/]+))?$/, m => viewContracts(m[1] ? decodeURIComponent(m[1]) : '')],
  [/^#\/contract\/new$/, () => viewContractEdit(null)],
  [/^#\/contract\/([^/]+)\/edit$/, m => viewContractEdit(decodeURIComponent(m[1]))],
  [/^#\/contract\/([^/]+)$/, m => viewContract(decodeURIComponent(m[1]))],
  [/^#\/products$/, () => viewProducts()],
  [/^#\/product\/([^/]+)$/, m => viewProductEdit(m[1] === 'new' ? null : decodeURIComponent(m[1]))],
  [/^#\/masters\/(vendors|categories|warehouses)$/, m => viewMasters(m[1])],
  [/^#\/vendor\/([^/]+)$/, m => viewVendorEdit(m[1] === 'new' ? null : decodeURIComponent(m[1]))],
  [/^#\/warehouse\/([^/]+)$/, m => viewWarehouseEdit(m[1] === 'new' ? null : decodeURIComponent(m[1]))],
  [/^#\/more$/, () => viewMore()],
  [/^#\/notices$/, () => viewNotices()],
  [/^#\/notice\/([^/]+)\/edit$/, m => viewNoticeEdit(m[1] === 'new' ? null : decodeURIComponent(m[1]))],
  [/^#\/notice\/([^/]+)$/, m => viewNotice(decodeURIComponent(m[1]))],
  [/^#\/users$/, () => viewUsers()],
  [/^#\/audit$/, () => viewAudit()],
  [/^#\/settings$/, () => viewSettings()],
  [/^#\/password$/, () => viewPassword()]
];
async function route(silent) {
  if (!S.token) return viewLogin();
  const main = $('#main');
  if (!main) return renderShell();
  let h = location.hash || '#/home';
  if (S.user.mustChange && h !== '#/password') { location.hash = '#/password'; return; }
  if (isVendor() && !/^#\/(home|contract\/[^/]+|more|password)$/.test(h)) { location.hash = '#/home'; return; }
  const base = h.split('/')[1];
  const alias = { contract: 'contracts', product: 'products', vendor: 'masters', warehouse: 'masters', notices: 'more', notice: 'more', users: 'more', audit: 'more', settings: 'more', password: 'more' };
  document.querySelectorAll('nav.tabs a').forEach(a => a.classList.toggle('on', a.dataset.base === (alias[base] || base)));
  for (const [re, fn] of ROUTES) {
    const m = h.match(re);
    if (!m) continue;
    S.wide = false;
    const slow = silent === true ? null : setTimeout(() => main.replaceChildren(el('div', { class: 'empty' }, '불러오는 중…')), 200);
    try {
      const node = await fn(m);
      clearTimeout(slow);
      if (location.hash !== h && location.hash) return;
      main.className = S.wide ? 'wide' : '';
      if (node) {
        const y = window.scrollY;
        main.replaceChildren(node);
        window.scrollTo(0, silent === true ? y : 0);
      }
    } catch (e) {
      clearTimeout(slow);
      if (e.code === 'auth' || e.code === 'must_change') return;
      main.replaceChildren(el('div', { class: 'note warn' }, e.message), el('div', { class: 'actions' }, el('button', { class: 'btn', onclick: route }, '다시 시도')));
    }
    return;
  }
  location.hash = '#/home';
}
window.addEventListener('hashchange', () => route());

/* ───────── 로그인 · 비밀번호 ───────── */
function viewLogin(msg) {
  const cfgMissing = !window.__WHAPS_TEST_HANDLER__ && !/^https:\/\/script\.google\.com\//.test((window.WHAPS_CONFIG || {}).API_URL || '');
  const err = el('div', { class: 'err', role: 'alert' }, msg || (cfgMissing ? 'config.js에 Apps Script 웹앱 주소를 먼저 넣어 주세요.' : ''));
  const id = el('input', { autocomplete: 'username', required: true, autocapitalize: 'off' });
  const pw = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const btn = el('button', { class: 'btn primary', type: 'submit' }, '로그인');
  const form = el('form', {
    onsubmit: e => {
      e.preventDefault();
      err.textContent = '';
      act(btn, async () => {
        try {
          const d = await api('login', { id: id.value.trim(), password: pw.value });
          setSession(d);
          if (!d.user.mustChange) { if (d.data) applyData(d.data); else await loadAll(); }
          location.hash = d.user.mustChange ? '#/password' : '#/home';
          renderShell();
        } catch (x) { err.textContent = x.message; }
      });
    }
  }, el('img', { src: 'gcw1.png', alt: '주식회사 지씨더블유' }), el('h1', null, 'WHITE PRICE 운영 시스템, 화프스'),
  field('아이디', id), field('비밀번호', pw), err, btn);
  $('#root').replaceChildren(el('div', { class: 'login' }, form));
  id.focus();
}
function viewPassword() {
  const old = el('input', { type: 'password', autocomplete: 'current-password' });
  const n1 = el('input', { type: 'password', autocomplete: 'new-password' });
  const n2 = el('input', { type: 'password', autocomplete: 'new-password' });
  const btn = el('button', { class: 'btn primary' }, '비밀번호 바꾸기');
  btn.onclick = () => act(btn, async () => {
    if (n1.value !== n2.value) throw new Error('새 비밀번호 두 칸이 서로 다릅니다.');
    const d = await api('auth.changePassword', { oldPassword: old.value, newPassword: n1.value });
    S.user = d.user; saveUser();
    toast('비밀번호를 바꿨습니다.');
    if (!S.data) await loadAll();
    location.hash = '#/home';
  });
  return el('div', null, el('h1', null, '비밀번호 바꾸기'),
    S.user.mustChange ? el('p', { class: 'note warn' }, '임시 비밀번호로 로그인했습니다. 계속하려면 새 비밀번호를 정하세요.') : null,
    el('div', { class: 'form' }, field('지금 비밀번호', old, S.user.mustChange ? '관리자에게 받은 임시 비밀번호' : null),
      field('새 비밀번호', n1, '영문과 숫자를 섞어 8자 이상'), field('새 비밀번호 확인', n2), btn));
}

/* ───────── 데이터 준비 ───────── */
async function ensureData() {
  if (!S.data) return loadAll();
  if (!S.data._t || Date.now() - S.data._t > 60000) { S.data._t = Date.now(); refreshSoon(true); }
  return S.data;
}

/* ───────── 엑셀 올리기·내려받기 ───────── */
const XL = {
  vendors: { title: '벤더', action: 'vendor.import', need: '상호', cols: ['id', '구분', '거래형태', '상태', '상호', '사업자등록번호', '대표자', '사업장주소', '업태', '종목', '담당자', '연락처', '이메일', '거래경로', '은행', '계좌번호', '예금주', '메모'],
    guide: { id: '비우면 새로 등록, 기존 코드(V0001)를 넣으면 수정', 구분: VENDOR_KINDS.join(' / '), 거래형태: '구분이 공급사일 때: ' + TRADE_TYPES.join(' / '), 상태: '후보 / 계약중 / 중단', 상호: '필수', 사업자등록번호: '10자리, 검증번호 확인', 담당자: '계약서 통지 담당자(필수)', 연락처: '계약서 통지 연락처(필수)', 이메일: '계약서 통지 전자우편(필수)' } },
  categories: { title: '분류', action: 'category.import', need: '대분류', cols: ['id', '단계', '대분류', '중분류', '소분류', '노출', '순서', '체계버전'],
    guide: { id: '비우면 대·중·소 경로를 따라 없는 분류를 만듦. 코드(K001)를 넣으면 그 분류의 이름·노출·순서를 고침', 단계: '내려받을 때 참고용(올릴 때는 무시)', 대분류: '필수', 중분류: '중분류를 만들 때', 소분류: '소분류를 만들 때', 노출: 'Y / N', 순서: '같은 단계 안의 순서(숫자)', 체계버전: '9+1 / v3 등' } },
  warehouses: { title: '창고', action: 'warehouse.import', need: '이름', cols: ['id', '이름', '유형', '보관조건', '주소', '담당자', '상태'],
    guide: { id: '비우면 새로 등록, W01 같은 코드를 넣으면 수정', 이름: '필수', 유형: '3PL센터 / 샘플실 / 사무실 보관 / 기타', 상태: '사용 / 중지' } },
  products: { title: '상품', action: 'product.import', need: '상품명', cols: ['id', '상태', '상품명', '공급사코드', '브랜드구분', '분류ID', '대분류', '중분류', '소분류', '배송방식', '규격', '납품단위', '판매단위', '바코드', '박스코드', '박스입수', '소비기한', '보관', '과세구분', '공급가', '수수료율', '일반회원가', '구독회원가', '제조원', '거래조건', '배송비부담', '연결주소', '회원혜택', '메모'],
    guide: { id: '비우면 새로 등록, P0001 같은 코드를 넣으면 수정', 상태: PRODUCT_STATES.join(' / '), 상품명: '필수', 공급사코드: '벤더 코드(V0001). 거래형태는 공급사에서 자동', 브랜드구분: 'NB / PB', 분류ID: '분류 코드(K001). 비우면 대·중·소 이름으로 찾음', 배송방식: SHIP_METHODS.join(' / ') + ' (직매입·위탁판매만)', 보관: '상온 / 냉장 / 냉동', 과세구분: '과세 / 면세', 공급가: '숫자, VAT 별도 (직매입)', 수수료율: '% 숫자 (위탁판매)', 바코드: '숫자 그대로(앞자리 0 유지)', 연결주소: '제휴입점 상품의 판매 페이지', 회원혜택: '제휴입점 회원 전용 혜택' } }
};
function catTree() {
  const nodes = (S.data.categories || []).slice().sort((a, b) => (num(a.순서) - num(b.순서)) || String(a.이름).localeCompare(String(b.이름)));
  const kids = pid => nodes.filter(n => (n.상위ID || '') === (pid || ''));
  const path = id => { const out = []; let n = nodes.find(x => x.id === id), g = 0; while (n && g++ < 5) { out.unshift(n.이름); n = nodes.find(x => x.id === n.상위ID); } return out; };
  return { nodes, kids, path };
}
function exportRows(kind) {
  if (kind !== 'categories') return S.data[kind] || [];
  const t = catTree();
  const out = [];
  const walk = pid => t.kids(pid).forEach(n => { const p = t.path(n.id); out.push({ id: n.id, 단계: n.단계, 대분류: p[0] || '', 중분류: p[1] || '', 소분류: p[2] || '', 노출: n.노출, 순서: n.순서, 체계버전: n.체계버전 }); walk(n.id); });
  walk('');
  return out;
}

/* ───────── 상품 ───────── */
async function viewProducts() {
  const data = await ensureData();
  const list = data.products;
  const vname = id => { const v = data.vendors.find(x => x.id === id); return v ? v.상호 : '공급사 미정'; };
  const q = el('input', { type: 'search', placeholder: '상품명·코드·바코드 검색', 'aria-label': '상품 검색' });
  const box = el('div', { class: 'list' });
  const draw = () => {
    const sq = q.value.trim();
    const rows = list.filter(p => !sq || (p.상품명 + p.id + (p.바코드 || '')).includes(sq));
    box.replaceChildren(...(rows.length ? rows.map(p => el('a', { class: 'row', href: '#/product/' + encodeURIComponent(p.id) },
      el('div', { class: 'main' }, el('div', { class: 't' }, p.상품명), el('div', { class: 's' }, p.id + ' · ' + vname(p.공급사코드) + ' · ' + (p.거래형태 || '거래형태 미정') + (p.배송방식 ? ' · ' + p.배송방식 : '') + ' · 일반가 ' + won(num(p.일반회원가)))),
      el('span', { class: 'tag' + (p.상태 === '판매중' ? ' ok' : '') }, p.상태)))
      : [el('div', { class: 'empty' }, list.length ? '검색 결과가 없습니다.' : '아직 등록된 상품이 없습니다.')]));
  };
  q.addEventListener('input', draw);
  draw();
  return el('div', null, el('h1', null, '상품'), el('p', { class: 'lead' }, '판매중·판매중지 상태는 운영기획·관리자가 정합니다. 거래형태는 공급사에서 정해지고, 상품마다 배송방식을 고릅니다.'),
    el('div', { class: 'form', style: 'padding:10px' }, q), excelBar('products'),
    canEdit() ? el('div', { class: 'actions' }, el('a', { class: 'btn primary', href: '#/product/new' }, '상품 등록')) : null, box);
}
// 자동 계산: 일반가·구독가 각각 세제외, 마진율, PG수수료, 순수익, 순수익율
function calcProduct(p, trade) {
  const vat = Number(S.settings.VAT || 0.1), pg = Number(S.settings.PG율 || 0.033);
  const net = x => (p.과세구분 === '면세' ? x : x / (1 + vat));
  const cost = num(p.공급가), fee = num(p.수수료율) / 100;
  const one = price => {
    if (!price) return null;
    const ex = net(price);
    const pgFee = price * pg * (1 + vat);
    if (trade === '위탁판매') {
      if (!fee) return { ex, margin: null, pg: pgFee, profit: null, rate: null };
      const profit = price * fee - pgFee;
      return { ex, margin: fee, pg: pgFee, profit, rate: profit / ex };
    }
    if (!cost) return { ex, margin: null, pg: pgFee, profit: null, rate: null };
    const profit = ex - cost - pgFee;
    return { ex, margin: (ex - cost) / ex, pg: pgFee, profit, rate: profit / ex };
  };
  return { 일반: one(num(p.일반회원가)), 구독: one(num(p.구독회원가)) };
}
async function viewProductEdit(id) {
  const data = await ensureData();
  const p = id ? data.products.find(x => x.id === id) : { 상태: '검토중', 과세구분: '과세', 보관: '상온', 브랜드구분: 'NB', 배송방식: '자사배송' };
  if (!p) throw new Error('상품을 찾을 수 없습니다: ' + id);
  const ro = !canEdit() || (id && p.상태 !== '검토중' && !isStaff());
  const f = {};
  const inp = (k, attrs) => (f[k] = el('input', Object.assign({ value: p[k] || '' }, attrs || {})));
  const sel = (k, opts) => (f[k] = select(opts, p[k] || (Array.isArray(opts[0]) ? opts[0][0] : opts[0])));
  const suppliers = data.vendors.filter(v => v.구분 === '공급사' || v.구분 === 'PB제조사');
  sel('공급사코드', [['', '선택 안 함']].concat(suppliers.map(v => [v.id, v.상호 + ' (' + v.id + ' · ' + (vendorTrade(v) || '거래형태 미정') + ')'])));
  const tradeOf = () => vendorTrade(data.vendors.find(v => v.id === f.공급사코드.value));
  // 분류: 대 → 중 → 소 (상위를 고르면 하위 목록이 바뀜)
  const t = catTree();
  const chain = [];
  let cur = p.분류ID ? t.nodes.find(n => n.id === p.분류ID) : null;
  while (cur) { chain.unshift(cur.id); cur = t.nodes.find(n => n.id === cur.상위ID); }
  const cs = [0, 1, 2].map(i => el('select', { 'aria-label': ['대분류', '중분류', '소분류'][i] }));
  const fillCat = (level, parent, value) => {
    const opts = level === 0 || parent ? t.kids(parent || '') : [];
    cs[level].replaceChildren(el('option', { value: '' }, opts.length ? '선택' : '없음'), ...opts.map(n => el('option', { value: n.id }, n.이름 + (n.노출 === 'N' ? ' (숨김)' : ''))));
    cs[level].value = value || '';
    cs[level].disabled = !opts.length || ro;
  };
  fillCat(0, '', chain[0]); fillCat(1, chain[0], chain[1]); fillCat(2, chain[1], chain[2]);
  cs[0].onchange = () => { fillCat(1, cs[0].value, ''); fillCat(2, '', ''); };
  cs[1].onchange = () => fillCat(2, cs[1].value, '');
  const catId = () => cs[2].value || cs[1].value || cs[0].value;
  const calcBox = el('div', { class: 'calc calc5' });
  const tradeLine = el('p', { class: 'lead', style: 'margin:0' });
  const shipField = field('배송방식', sel('배송방식', SHIP_METHODS), '자사배송: 우리 창고에서 출고 · 업체배송: 공급사가 고객에게 직배송');
  const costField = field('공급가 (VAT 별도)', inp('공급가', { inputmode: 'numeric' }), '직매입');
  const feeField = field('수수료율 (%)', inp('수수료율', { inputmode: 'decimal' }), '위탁판매 · 결제금액 기준');
  const adFields = el('div', { class: 'two' }, field('연결 주소 (판매 페이지)', inp('연결주소', { type: 'url', placeholder: 'https://' })), field('회원 전용 혜택', inp('회원혜택', { placeholder: '예) 회원 쿠폰 10%' })));
  const drawCalc = () => {
    const tr = tradeOf();
    tradeLine.textContent = '거래형태: ' + (tr || (f.공급사코드.value ? '공급사의 거래형태가 정해지지 않았습니다' : '공급사를 고르면 정해집니다'));
    shipField.style.display = tr === '제휴입점' ? 'none' : '';
    costField.style.display = tr === '위탁판매' || tr === '제휴입점' ? 'none' : '';
    feeField.style.display = tr === '위탁판매' ? '' : 'none';
    adFields.style.display = tr === '제휴입점' ? '' : 'none';
    if (tr === '제휴입점') { calcBox.replaceChildren(el('p', { class: 'note', style: 'margin:0' }, '제휴입점 광고 상품은 판매 수익을 계산하지 않습니다(광고료는 계약에서 정함).')); return; }
    const cur = {}; Object.keys(f).forEach(k => { cur[k] = f[k].value; });
    const r = calcProduct(cur, tr);
    const floor = tr === '위탁판매' ? Number(S.settings.원가보전선_위탁판매 || 0.05) : Number(S.settings.원가보전선_직매입 || 0.1);
    const cell = (label, val, bad) => el('div', null, el('small', null, label), el('b', { class: bad ? 'bad' : null }, val));
    const rowOf = (name, x) => [
      cell(name + '가 세제외', won(x && x.ex)),
      cell(tr === '위탁판매' ? name + '가 수수료율' : name + '가 마진율', pct(x && x.margin), x && x.margin !== null && x.margin < floor),
      cell('PG수수료(' + name + '가)', won(x && x.pg)),
      cell(name + '가 순수익', won(x && x.profit), x && x.profit !== null && x.profit < 0),
      cell(name + '가 순수익율', pct(x && x.rate), x && x.rate !== null && x.rate < 0)];
    calcBox.replaceChildren(...rowOf('일반', r.일반), ...rowOf('구독', r.구독));
  };
  const form = el('div', { class: 'form' },
    field('상품명', inp('상품명', { required: true }), '아임웹 노출명 기준'),
    el('div', { class: 'two' }, field('공급사', f.공급사코드), field('상태', sel('상태', isStaff() ? PRODUCT_STATES : [p.상태 || '검토중']), '검토중 → 판매중 → 판매중지')),
    tradeLine,
    el('div', { class: 'two' }, shipField, field('브랜드 구분', sel('브랜드구분', ['NB', 'PB']))),
    el('label', { class: 'field' }, el('span', null, '분류 (대 → 중 → 소)'), el('div', { class: 'inline cats' }, cs[0], cs[1], cs[2])),
    el('div', { class: 'two' }, field('규격', inp('규격', { placeholder: '3kg 박스(10개 내외)' })), field('판매단위', inp('판매단위', { placeholder: '1박스' }))),
    el('div', { class: 'two' }, field('납품단위', inp('납품단위', { placeholder: '10박스' })), field('박스당 입수', inp('박스입수', { inputmode: 'numeric' }))),
    el('div', { class: 'two' }, field('상품 바코드', inp('바코드', { inputmode: 'numeric' })), field('박스 코드', inp('박스코드', { inputmode: 'numeric' }))),
    el('div', { class: 'two' }, field('소비기한', inp('소비기한', { placeholder: '제조일로부터 6개월' })), field('보관', sel('보관', ['상온', '냉장', '냉동']))),
    el('div', { class: 'two' }, field('제조원 (표시사항)', inp('제조원', { placeholder: '예) ○○식품(주)' })), field('과세 구분', sel('과세구분', ['과세', '면세']))),
    el('div', { class: 'two' }, costField, feeField),
    el('div', { class: 'two' }, field('일반회원가', inp('일반회원가', { inputmode: 'numeric' })), field('구독회원가', inp('구독회원가', { inputmode: 'numeric' }))),
    el('div', { class: 'two' }, field('발주·출고 조건', inp('거래조건', { placeholder: '예) 최소 20박스, 발주 후 2일 내 납품' }), '별지 1 거래조건표에 들어감'), field('배송비', inp('배송비부담', { placeholder: '비우면 기본값' }), '업체배송은 비우면 공급가에 포함')),
    adFields,
    el('h2', { style: 'margin:6px 0 0' }, '자동 계산'), calcBox,
    field('메모', (f.메모 = el('textarea', { value: p.메모 || '' }))));
  Object.values(f).forEach(x => { x.addEventListener('input', drawCalc); x.addEventListener('change', drawCalc); if (ro) x.disabled = true; });
  drawCalc();
  const bSave = el('button', { class: 'btn primary' }, id ? '변경 저장' : '상품 등록');
  bSave.onclick = () => act(bSave, async () => {
    const payload = { id: id || undefined, 분류ID: catId() };
    Object.keys(f).forEach(k => { payload[k] = f[k].value; });
    const d = await api('product.save', payload);
    upsert('products', d); refreshSoon(false);
    toast((id ? '저장했습니다 ' : '등록했습니다 ') + '(' + d.id + ')');
    location.hash = '#/products';
  });
  return el('div', null, el('h1', null, id ? p.상품명 : '상품 등록'), id ? el('p', { class: 'lead' }, p.id + ' · 마지막 수정 ' + p.수정일시) : null,
    ro && canEdit() ? el('p', { class: 'note' }, p.상태 + ' 상태의 상품은 운영기획·관리자만 고칠 수 있습니다.') : null,
    form, ro ? null : el('div', { class: 'actions' }, bSave, el('a', { class: 'btn ghost', href: '#/products' }, '목록으로')));
}

/* ───────── 마스터: 벤더 · 분류 · 창고 ───────── */
async function viewMasters(tab) {
  const data = await ensureData();
  const head = el('div', null, el('h1', null, '마스터'),
    el('div', { class: 'chips' }, [['vendors', '벤더'], ['categories', '분류'], ['warehouses', '창고']].map(([k, t]) => el('a', { class: 'chip' + (k === tab ? ' on' : ''), href: '#/masters/' + k }, t))));
  if (tab === 'vendors') {
    const list = data.vendors;
    const q = el('input', { type: 'search', placeholder: '상호·코드·사업자번호 검색', 'aria-label': '벤더 검색' });
    const box = el('div', { class: 'list' });
    const draw = () => {
      const sq = q.value.trim();
      const rows = list.filter(v => !sq || (v.상호 + v.id + (v.사업자등록번호 || '')).includes(sq));
      box.replaceChildren(...(rows.length ? rows.map(v => el('a', { class: 'row', href: '#/vendor/' + encodeURIComponent(v.id) },
        el('div', { class: 'main' }, el('div', { class: 't' }, v.상호), el('div', { class: 's' }, v.id + ' · ' + v.구분 + (v.거래형태 ? ' · ' + v.거래형태 : '') + ' · ' + (v.사업자등록번호 || '사업자번호 없음'))),
        el('span', { class: 'tag' + (v.상태 === '계약중' ? ' ok' : '') }, v.상태)))
        : [el('div', { class: 'empty' }, list.length ? '검색 결과가 없습니다.' : '등록된 벤더가 없습니다. 계약 전에 벤더부터 등록하세요.')]));
    };
    q.addEventListener('input', draw);
    draw();
    appendKids(head, el('div', { class: 'form', style: 'padding:10px' }, q), excelBar('vendors'),
      canEdit() ? el('div', { class: 'actions' }, el('a', { class: 'btn primary', href: '#/vendor/new' }, '벤더 등록')) : null, box);
    return head;
  }
  if (tab === 'categories') {
    const t = catTree();
    const save = async (payload, msg) => { S.data.categories = await api('category.save', payload); persistData(); toast(msg); route(true); };
    const nodeRow = n => {
      const lv = Number(n.단계);
      const btns = [];
      if (isStaff()) {
        if (lv < 3) { const b = el('button', { class: 'btn small ghost' }, (lv === 1 ? '중' : '소') + '분류 추가'); b.onclick = () => act(b, async () => { const nm = prompt(n.이름 + ' 아래에 만들 ' + (lv === 1 ? '중' : '소') + '분류 이름'); if (nm) await save({ 이름: nm, 상위ID: n.id }, '추가했습니다.'); }); btns.push(b); }
        const r = el('button', { class: 'btn small ghost' }, '이름'); r.onclick = () => act(r, async () => { const nm = prompt('새 이름', n.이름); if (nm && nm !== n.이름) await save({ id: n.id, 이름: nm }, '이름을 바꿨습니다.'); }); btns.push(r);
        const h = el('button', { class: 'btn small ghost' }, n.노출 === 'Y' ? '숨기기' : '보이기'); h.onclick = () => act(h, () => save({ id: n.id, 이름: n.이름, 노출: n.노출 === 'Y' ? 'N' : 'Y' }, '바꿨습니다.')); btns.push(h);
        const d = el('button', { class: 'btn small ghost' }, '지우기'); d.onclick = () => act(d, async () => { if (confirm(n.이름 + ' 분류를 지울까요?')) await save({ id: n.id, 삭제: true }, '지웠습니다.'); }); btns.push(d);
      }
      return el('div', { class: 'row tree l' + lv }, el('div', { class: 'main' }, el('div', { class: 't' }, n.이름), el('div', { class: 's' }, n.id + ' · ' + ['대', '중', '소'][lv - 1] + '분류 · ' + (n.체계버전 || ''))),
        el('span', { class: 'tag' }, n.노출 === 'Y' ? '노출' : '숨김'), btns);
    };
    const rows = [];
    const walk = pid => t.kids(pid).forEach(n => { rows.push(nodeRow(n)); walk(n.id); });
    walk('');
    const nm = el('input', { placeholder: '예) 신선식품' }), ver = el('input', { placeholder: '9+1', style: 'max-width:100px' });
    const bAdd = el('button', { class: 'btn primary' }, '대분류 추가');
    bAdd.onclick = () => act(bAdd, () => save({ 이름: nm.value, 체계버전: ver.value }, '대분류를 추가했습니다.'));
    appendKids(head, excelBar('categories'),
      isStaff() ? el('div', { class: 'form' }, el('div', { class: 'inline' }, field('새 대분류', nm), field('체계 버전', ver)), bAdd, el('small', null, '중분류·소분류는 아래 목록의 "추가" 버튼으로 만듭니다.')) : null,
      el('div', { class: 'list' }, rows.length ? rows : el('div', { class: 'empty' }, '등록된 분류가 없습니다.')));
    return head;
  }
  const list = data.warehouses;
  appendKids(head, excelBar('warehouses'), isStaff() ? el('div', { class: 'actions' }, el('a', { class: 'btn primary', href: '#/warehouse/new' }, '창고 등록')) : null,
    el('div', { class: 'list' }, list.length ? list.map(w => el('a', { class: 'row', href: '#/warehouse/' + encodeURIComponent(w.id) },
      el('div', { class: 'main' }, el('div', { class: 't' }, w.이름), el('div', { class: 's' }, w.id + ' · ' + w.유형 + ' · ' + (w.보관조건 || '보관조건 미정'))), el('span', { class: 'tag' }, w.상태)))
      : el('div', { class: 'empty' }, '등록된 창고가 없습니다. 3PL 센터와 샘플실을 등록하세요.')));
  return head;
}
async function viewVendorEdit(id) {
  const list = (await ensureData()).vendors;
  const v = id ? list.find(x => x.id === id) : { 구분: '공급사', 상태: '후보', 거래경로: '직거래', 거래형태: '' };
  if (!v) throw new Error('벤더를 찾을 수 없습니다: ' + id);
  const locked = !canEdit() || (id && !isStaff());
  const f = {};
  const inp = (k, attrs) => (f[k] = el('input', Object.assign({ value: v[k] || '' }, attrs || {})));
  const sel = (k, opts) => (f[k] = select(opts, v[k] || (Array.isArray(opts[0]) ? opts[0][0] : opts[0])));
  const bizMsg = el('small');
  const biz = inp('사업자등록번호', { inputmode: 'numeric', placeholder: '000-00-00000' });
  biz.addEventListener('input', () => {
    const d = biz.value.replace(/[^0-9]/g, '');
    bizMsg.textContent = !d ? '' : d.length < 10 ? '10자리를 입력하세요' : bizNoOk(d) ? '올바른 번호입니다' : '검증번호가 맞지 않습니다';
    bizMsg.className = d.length === 10 && !bizNoOk(d) ? 'err' : '';
  });
  sel('구분', VENDOR_KINDS);
  sel('거래형태', [['', '아직 정하지 않음']].concat(TRADE_TYPES.map(t => [t, t])));
  const tradeField = field('거래형태', f.거래형태, '직매입: 우리가 사서 판매 · 위탁판매: 업체 가격으로 대신 판매(수수료) · 제휴입점: 광고 게재(업체 사이트에서 판매)');
  const syncKind = () => { tradeField.style.display = f.구분.value === '공급사' ? '' : 'none'; };
  f.구분.addEventListener('change', syncKind);
  const form = el('div', { class: 'form' },
    el('div', { class: 'two' }, field('구분', f.구분, '공급사 · PB제조사 · 물류사 · 개발사'), field('상태', sel('상태', isStaff() ? ['후보', '계약중', '중단'] : [v.상태 || '후보']))),
    tradeField,
    field('상호', inp('상호', { required: true })),
    el('label', { class: 'field' }, el('span', null, '사업자등록번호'), biz, bizMsg),
    el('div', { class: 'two' }, field('대표자', inp('대표자')), field('거래경로', sel('거래경로', ['직거래', '벤더 경유', '수입사 경유']))),
    field('사업장 주소', inp('사업장주소')),
    el('div', { class: 'two' }, field('업태', inp('업태')), field('종목', inp('종목'))),
    el('div', { class: 'two' }, field('담당자', inp('담당자'), '계약서 통지 담당자'), field('연락처', inp('연락처', { type: 'tel' }))),
    field('이메일', inp('이메일', { type: 'email' }), '계약서 통지·전자서명 안내에 씁니다'),
    isStaff() || !id ? el('div', { class: 'two' }, field('은행', inp('은행')), field('예금주', inp('예금주'))) : null,
    isStaff() || !id ? field('계좌번호', inp('계좌번호', { inputmode: 'numeric' }), '관리자·운영기획만 전체 번호를 볼 수 있습니다') : null,
    field('메모', (f.메모 = el('textarea', { value: v.메모 || '' }))));
  syncKind();
  if (locked) Object.values(f).forEach(x => { x.disabled = true; });
  const bSave = el('button', { class: 'btn primary' }, id ? '변경 저장' : '벤더 등록');
  bSave.onclick = () => act(bSave, async () => {
    const payload = { id: id || undefined };
    Object.keys(f).forEach(k => { payload[k] = f[k].value; });
    const d = await api('vendor.save', payload);
    upsert('vendors', d); refreshSoon(false);
    toast((id ? '저장했습니다 ' : '등록했습니다 ') + '(' + d.id + ')');
    location.hash = '#/masters/vendors';
  });
  const bContract = el('button', { class: 'btn' }, '이 벤더와 계약 만들기');
  bContract.onclick = () => { S.flash = { vendor: id }; location.hash = '#/contract/new'; };
  return el('div', null, el('h1', null, id ? v.상호 : '벤더 등록'), id ? el('p', { class: 'lead' }, v.id + ' · 마지막 수정 ' + v.수정일시) : null,
    locked && id ? el('p', { class: 'note' }, '등록된 벤더는 운영기획·관리자만 고칠 수 있습니다.') : null,
    form, locked ? null : el('div', { class: 'actions' }, bSave, el('a', { class: 'btn ghost', href: '#/masters/vendors' }, '목록으로')),
    id && canEdit() ? el('div', { class: 'actions' }, bContract) : null);
}
let xlsxReady = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  if (!xlsxReady) xlsxReady = new Promise((res, rej) => {
    const sc = el('script', { src: 'vendor/xlsx.full.min.js' });
    sc.onload = res; sc.onerror = () => { xlsxReady = null; rej(new Error('엑셀 기능을 불러오지 못했습니다. vendor 폴더가 올라갔는지 확인하세요.')); };
    document.head.appendChild(sc);
  });
  return xlsxReady;
}
async function exportExcel(kind) {
  await loadXlsx();
  const cfg = XL[kind];
  const rows = exportRows(kind).map(r => cfg.cols.map(c => String(r[c] === undefined || r[c] === null ? '' : r[c])));
  const ws = XLSX.utils.aoa_to_sheet([cfg.cols].concat(rows));
  Object.keys(ws).forEach(k => { if (k[0] !== '!' && ws[k].t !== 's') { ws[k].t = 's'; ws[k].v = String(ws[k].v); } });
  ws['!cols'] = cfg.cols.map(c => ({ wch: Math.max(8, Math.min(40, c.length * 2 + 4)) }));
  const guide = XLSX.utils.aoa_to_sheet([['칸', '쓰는 법']].concat(cfg.cols.map(c => [c, cfg.guide[c] || ''])).concat([[], ['올리는 법', '첫 번째 시트의 1행(칸 이름)은 바꾸지 마세요. 한 행이라도 오류가 있으면 아무것도 저장되지 않고, 오류 행 번호를 알려 줍니다.']]));
  guide['!cols'] = [{ wch: 16 }, { wch: 70 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, cfg.title);
  XLSX.utils.book_append_sheet(wb, guide, '작성 안내');
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  XLSX.writeFile(wb, '화프스_' + cfg.title + '_' + today + '.xlsx');
}
async function importExcel(kind, file, out) {
  await loadXlsx();
  const cfg = XL[kind];
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[cfg.title] || wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
  if (!raw.length) throw new Error('엑셀에 데이터 행이 없습니다.');
  const unknown = Object.keys(raw[0]).filter(k => !cfg.cols.includes(k));
  const need = cfg.need;
  if (!Object.keys(raw[0]).includes(need)) throw new Error('"' + need + '" 칸이 없습니다. 내려받은 양식의 1행을 그대로 쓰세요.');
  const rows = raw.map(r => {
    const o = {};
    cfg.cols.forEach(c => {
      if (!(c in r)) return;
      const v = r[c];
      o[c] = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(v)) : String(v).trim();
    });
    return o;
  }).filter(o => Object.values(o).some(v => v !== ''));
  const upd = rows.filter(r => r.id).length;
  if (!confirm(cfg.title + ' ' + rows.length + '행을 올립니다 (신규 ' + (rows.length - upd) + ', 수정 ' + upd + ').' + (unknown.length ? '\n모르는 칸은 무시합니다: ' + unknown.join(', ') : '') + '\n계속할까요?')) return;
  const res = await api(cfg.action, { rows: rows });
  if (!res.saved) {
    out.replaceChildren(el('div', { class: 'note warn' }, el('b', null, '저장하지 않았습니다. 오류 ' + res.오류수 + '건을 고쳐 다시 올리세요.'),
      el('ul', null, res.errors.slice(0, 30).map(e => el('li', null, e.행 + '행: ' + e.오류))), res.오류수 > 30 ? el('div', null, '…외 ' + (res.오류수 - 30) + '건') : null));
    return;
  }
  S.data[kind] = res.list; persistData();
  toast(cfg.title + ' 엑셀 반영: 신규 ' + res.신규 + '건, 수정 ' + res.수정 + '건');
  refreshSoon(false);
  route(true);
}
function excelBar(kind) {
  const out = el('div');
  const bDown = el('button', { class: 'btn small ghost' }, '엑셀 내려받기');
  bDown.onclick = () => act(bDown, () => exportExcel(kind));
  const inp = el('input', { type: 'file', accept: '.xlsx,.xls', class: 'sr' });
  const bUp = el('button', { class: 'btn small ghost' }, '엑셀 올리기');
  bUp.onclick = () => inp.click();
  inp.onchange = () => act(bUp, async () => { out.replaceChildren(); const f = inp.files[0]; inp.value = ''; if (f) await importExcel(kind, f, out); });
  return el('div', null, el('div', { class: 'actions', style: 'margin:8px 0' }, bDown, isStaff() ? [bUp, inp] : null), out);
}

/* ───────── 홈 ───────── */
/* ───────── 계약 ───────── */
async function viewContracts(state) {
  const data = await ensureData();
  const list = data.contracts.filter(c => !state || c.상태 === state).sort((a, b) => String(b.수정일시).localeCompare(String(a.수정일시)));
  return el('div', null,
    el('h1', null, '계약'),
    el('div', { class: 'chips' }, el('a', { class: 'chip' + (state ? '' : ' on'), href: '#/contracts' }, '전체'),
      CONTRACT_STATES.map(st => el('a', { class: 'chip' + (state === st ? ' on' : ''), href: '#/contracts/' + encodeURIComponent(st) }, st))),
    canEdit() ? el('div', { class: 'actions' }, el('a', { class: 'btn primary', href: '#/contract/new' }, '새 계약 만들기')) : null,
    el('div', { class: 'list' }, list.length ? list.map(c => el('a', { class: 'row', href: '#/contract/' + encodeURIComponent(c.id) }, stamp(c.상태, true),
      el('div', { class: 'main' }, el('div', { class: 't' }, c.상호), el('div', { class: 's' }, c.id + ' · ' + c.종류명 + (c.버전 !== '1' ? ' · v' + c.버전 : '') + ' · ' + String(c.수정일시).slice(0, 10)))))
      : el('div', { class: 'empty' }, state ? state + ' 상태의 계약이 없습니다.' : '아직 계약이 없습니다. 새 계약을 만들어 보세요.')));
}

async function getDetail(id, fresh) {
  const cached = S.data && S.data.details && S.data.details[id];
  if (!fresh && cached) return cached;
  return rememberDetail(await api('contract.get', { id: id }));
}

async function viewContractEdit(id) {
  if (!canEdit()) throw new Error('조회 권한으로는 계약을 작성할 수 없습니다.');
  const data = await ensureData();
  const vendors = data.vendors;
  const got = id ? await getDetail(id, false) : null;
  if (got && got.contract.상태 !== '작성중') { location.hash = '#/contract/' + encodeURIComponent(id); return null; }
  S.wide = true;
  let curId = got ? got.contract.id : null;
  let kind = got && CONTRACT_KINDS[got.contract.종류] ? got.contract.종류 : 'K1';
  let vendorId = got ? got.contract.벤더코드 : (S.flash && S.flash.vendor) || '';
  if (S.flash && S.flash.vendor) S.flash = null;
  const values = Object.assign({}, got ? got.values : {});
  const opt = Object.assign({ A: false, B: false, S3: false }, values._opt || {});
  const vendor = () => vendors.find(v => v.id === vendorId);
  const trade = () => vendorTrade(vendor());
  const parts = () => kindParts(kind, trade(), opt).filter(p => CONTRACT_DOCS[p]);
  const fieldsBox = el('div', { class: 'form' });
  const optBox = el('div');
  const partyBox = el('div');
  const preview = el('div', { class: 'preview-wrap' });
  const status = el('p', { class: 'note' });
  const kindSel = select(Object.keys(CONTRACT_KINDS).map(k => [k, CONTRACT_KINDS[k].name]), kind, { onchange: () => { kind = kindSel.value; buildVendorSel(); rebuild(); } });
  let venSel;
  function buildVendorSel() {
    const allowed = CONTRACT_KINDS[kind].party;
    const list = vendors.filter(v => allowed.includes(v.구분));
    if (!list.some(v => v.id === vendorId)) vendorId = '';
    venSel = select([['', list.length ? '상대방을 고르세요' : allowed.join('·') + ' 벤더를 먼저 등록하세요']].concat(list.map(v => [v.id, v.상호 + ' (' + v.id + (v.거래형태 ? ', ' + v.거래형태 : '') + ')'])), vendorId,
      { onchange: () => { vendorId = venSel.value; defaultOpt(); rebuild(); } });
    venWrap.replaceChildren(field('상대방 (' + allowed.join('·') + ')', venSel, '상대방 정보는 벤더 마스터에서 가져옵니다'));
  }
  const venWrap = el('div');
  function defaultOpt() {                         // 직매입: 공급사 상품의 배송방식으로 부속서 A·B 기본 선택
    if (kind !== 'K1' || trade() !== '직매입' || opt.A || opt.B) return;
    const ps = data.products.filter(p => p.공급사코드 === vendorId && p.상태 !== '판매중지');
    opt.A = !ps.length || ps.some(p => p.배송방식 === '자사배송');
    opt.B = ps.some(p => p.배송방식 === '업체배송');
  }
  function buildOpt() {
    const v = vendor();
    const tr = trade();
    const items = [];
    if (v && ['K1', 'S1', 'S2', 'S3', 'AD'].includes(kind) && !tr) {
      items.push(el('p', { class: 'note warn' }, '이 벤더의 거래형태가 정해지지 않았습니다. ', el('a', { href: '#/vendor/' + encodeURIComponent(v.id) }, '벤더 정보에서 거래형태를 정하세요.')));
    }
    if (kind === 'K1' && tr === '직매입') {
      const ck = (k, label) => { const c = el('input', { type: 'checkbox', checked: !!opt[k] }); c.onchange = () => { opt[k] = c.checked; rebuild(); }; return el('label', { class: 'check' }, c, label); };
      items.push(el('div', { class: 'checks' }, ck('A', '부속서 A · 자사배송'), ck('B', '부속서 B · 업체배송'), ck('S3', '별지 3 · 독점판매 특약')));
    }
    const ps = parts();
    items.push(el('p', { class: 'lead' }, '구성: ' + (ps.length ? ps.map(p => CONTRACT_DOCS[p].title).join(' + ') : '상대방을 고르면 정해집니다')));
    optBox.replaceChildren(...items);
  }
  function inputFor(k) {
    const m = KEY_META[k] || { t: 'text' };
    const ch = choicesFor(kind, trade())[k] || [];
    if (m.t === 'select') {
      if (ch.length === 1 && !values[k]) values[k] = ch[0];
      if (values[k] && !ch.includes(values[k])) values[k] = '';
      const s = select((ch.length === 1 ? [] : [['', '선택하세요']]).concat(ch.map(v => [v, v])), values[k] || '');
      s.addEventListener('change', () => { values[k] = s.value; refresh(); });
      return field(m.label, s, ch.length ? (ch.length === 1 ? '지금은 선택지가 하나입니다' : '목록에서 고릅니다') : '설정에서 선택 목록을 먼저 만드세요');
    }
    if (m.t === 'textarea') {
      const ta = el('textarea', { value: values[k] || '', rows: 4, placeholder: '예) ' + (m.ex || '') });
      ta.addEventListener('input', () => { values[k] = ta.value; refresh(); });
      return field(m.label + ' (마지막 조항)', ta, '줄마다 적습니다. 비워 두면 계약서에 "없음"으로 들어갑니다.');
    }
    if (m.t === 'calc' || m.t === 'auto') return null;
    const inp = el('input', { type: m.t === 'date' ? 'date' : 'text', value: values[k] || '', placeholder: m.ex ? '예) ' + m.ex : '', inputmode: m.t === 'won' ? 'numeric' : null, 'aria-label': m.label });
    inp.addEventListener('input', () => { values[k] = m.t === 'won' ? fmtComma(inp.value) : inp.value.trim(); if (m.t === 'won' && inp.value !== values[k]) inp.value = values[k]; refresh(); });
    return field(m.label, inp, m.t === 'won' ? '숫자만 넣으면 쉼표가 붙습니다' : null);
  }
  function buildFields() {
    const keys = partsKeys(parts());
    const pv = vendor() ? partyValues(vendor()) : {};
    const autos = keys.filter(k => (KEY_META[k] || {}).t === 'auto' && k.startsWith('상대_'));
    const missing = autos.filter(k => !pv[k]);
    partyBox.replaceChildren(vendor() ? el('div', { class: 'form' },
      el('div', { class: 's' }, '상대방 정보 (벤더 마스터에서 자동)'),
      el('div', { class: 'kv' }, autos.map(k => el('div', null, el('small', null, keyLabel(k).replace('상대방 ', '')), el('b', { class: pv[k] ? null : 'bad' }, pv[k] || '비어 있음')))),
      missing.length ? el('p', { class: 'note warn' }, '비어 있는 정보가 있어 확정할 수 없습니다. ', el('a', { href: '#/vendor/' + encodeURIComponent(vendorId) }, '벤더 정보 채우기')) : null) : null);
    const calc = keys.filter(k => (KEY_META[k] || {}).t === 'calc');
    fieldsBox.replaceChildren(...keys.map(inputFor).filter(Boolean),
      calc.length ? el('p', { class: 'note', id: 'calcline' }) : null,
      keys.includes('거래조건표_번호') ? el('p', { class: 'lead' }, '별지 1 거래조건표는 이 공급사의 상품 정보로 자동으로 만들어지고, 번호는 확정할 때 계약번호로 붙습니다.') : null);
  }
  let pageTimer = null;
  function refresh() {
    const ps = parts();
    const pv = previewValues(kind, vendor(), ps, values);
    const cl = document.getElementById('calcline');
    if (cl) cl.textContent = pv.광고_게재일수 ? '게재 ' + pv.광고_게재일수 + '일 · 할인율 ' + Math.round(adCalc(pv.광고_시작일, pv.광고_종료일, pv.광고_일단가).rate * 100) + '% · 광고료 총액 ' + (pv.광고료_총액 || '—') + '원(VAT 별도)' : '게재 시작일·종료일과 일 단가를 넣으면 광고료가 자동 계산됩니다.';
    clearTimeout(pageTimer);
    pageTimer = setTimeout(() => preview.replaceChildren(ps.length ? renderPaged(ps, pv, S.settings) : el('div', { class: 'empty' }, '계약 종류와 상대방을 고르면 미리보기가 나옵니다.')), 150);
    const keys = partsKeys(ps);
    const empty = keys.filter(k => { const m = KEY_META[k] || {}; return !m.opt && m.t !== 'auto' && m.t !== 'calc' && !values[k]; }).length;
    status.textContent = !ps.length ? '상대방을 고르세요.' : (empty ? '빈 칸 ' + empty + '개 — 미리보기에 노란색으로 표시됩니다.' : '모든 칸이 채워졌습니다. 계약일은 서명할 때 정해집니다.');
    status.className = 'note' + (empty || !ps.length ? ' warn' : '');
  }
  function rebuild() { buildOpt(); buildFields(); refresh(); }
  const pick = () => { const o = {}; partsKeys(parts()).forEach(k => { const m = KEY_META[k] || {}; if (m.t !== 'auto' && m.t !== 'calc') o[k] = values[k] || ''; }); return o; };
  async function save() {
    if (!vendorId) throw new Error('상대방(벤더)을 먼저 고르세요.');
    const d = await api('contract.saveDraft', { id: curId, 종류: kind, 벤더코드: vendorId, opt: opt, values: pick() });
    curId = d.id;
    upsert('contracts', d);
    rememberDetail({ contract: d, values: Object.assign(pick(), { _opt: opt, _parts: parts() }), attachments: [], checklist: [] });
    history.replaceState(null, '', '#/contract/' + encodeURIComponent(d.id) + '/edit');
    return d;
  }
  const bSave = el('button', { class: 'btn' }, '임시저장');
  bSave.onclick = () => act(bSave, async () => { const d = await save(); toast('임시저장했습니다 (' + d.id + ')'); });
  const bConfirm = el('button', { class: 'btn seal' }, '확정하고 PDF 만들기');
  bConfirm.onclick = () => act(bConfirm, async () => {
    if (!confirm('확정하면 계약번호와 PDF가 만들어지고, 그 뒤에는 고칠 수 없습니다(바꿀 때는 새 버전). 확정할까요?')) return;
    const draftId = (await save()).id;
    const d = rememberDetail(await api('contract.confirm', { id: curId }));
    S.data.contracts = S.data.contracts.filter(c => c.id !== draftId); persistData();
    toast(d.contract.id + ' 계약을 확정했습니다. 전자서명을 요청하거나 출력해 서명받으세요.');
    refreshSoon(false);
    location.hash = '#/contract/' + encodeURIComponent(d.contract.id);
  });
  const bPrint = el('button', { class: 'btn ghost' }, '미리보기 인쇄');
  bPrint.onclick = () => act(bPrint, () => printDoc(parts(), previewValues(kind, vendor(), parts(), values), S.settings));
  const bDel = el('button', { class: 'btn ghost' }, '초안 지우기');
  bDel.onclick = () => act(bDel, async () => {
    if (!curId) { location.hash = '#/contracts'; return; }
    if (!confirm('이 초안을 지울까요?')) return;
    await api('contract.deleteDraft', { id: curId });
    S.data.contracts = S.data.contracts.filter(c => c.id !== curId); persistData();
    toast('초안을 지웠습니다.');
    location.hash = '#/contracts';
  });
  buildVendorSel();
  defaultOpt();
  rebuild();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  return el('div', null,
    el('h1', null, curId ? '계약 작성 · ' + curId : '새 계약'),
    el('div', { class: 'split' },
      el('div', null,
        el('div', { class: 'form' }, field('계약 종류', kindSel, CONTRACT_KINDS[kind].desc || null), venWrap, optBox),
        partyBox,
        el('h2', null, '입력값'), status, fieldsBox,
        el('div', { class: 'actions' }, bSave, isStaff() ? bConfirm : null, bPrint, bDel),
        isStaff() ? null : el('p', { class: 'note' }, '확정은 운영기획·관리자가 합니다. 임시저장한 뒤 알려 주세요.')),
      preview));
}

/* ───────── 계약 상세 (직원) ───────── */
const signInfo = (who, at, name) => el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, who), el('div', { class: 's' }, at ? name + ' · ' + at : '서명 전')), tagFor(at ? '확인' : '없음'));
function credentialBox(r, c) {
  const url = location.origin + location.pathname;
  const msg = '[WHITE PRICE] ' + c.상호 + ' 계약서 전자서명 안내\n주소: ' + url + '\n아이디: ' + r.account + (r.tempPassword ? '\n임시 비밀번호: ' + r.tempPassword : '') +
    '\n로그인한 뒤 ' + (r.tempPassword ? '새 비밀번호를 정하고, ' : '') + '"서명할 계약"에서 내용을 확인하고 서명해 주세요.';
  const bCopy = el('button', { class: 'btn small' }, '안내 문구 복사');
  bCopy.onclick = async () => { try { await navigator.clipboard.writeText(msg); toast('복사했습니다. 문자나 메신저로 보내 주세요.'); } catch (e) { toast('복사하지 못했습니다. 아래 글을 길게 눌러 복사하세요.', 'err'); } };
  return el('div', { class: 'note' }, el('b', null, r.created ? '업체 계정을 만들었습니다.' : (r.tempPassword ? '임시 비밀번호를 다시 발급했습니다.' : '이미 있는 업체 계정을 씁니다.')),
    el('pre', { class: 'secret', style: 'white-space:pre-wrap;font-size:14px' }, msg), bCopy,
    r.tempPassword ? el('small', null, '임시 비밀번호는 지금 한 번만 보입니다.') : null);
}
function esignPanel(d, done) {
  const c = d.contract;
  const box = el('div');
  const out = el('div');
  const bReq = el('button', { class: 'btn primary' }, c.서명방식 === '전자' ? '업체 서명 안내 다시 보기' : '업체에 전자서명 요청');
  bReq.onclick = () => act(bReq, async () => {
    const r = await api('esign.request', { id: c.id });
    rememberDetail(r.detail);
    out.replaceChildren(credentialBox(r, c));
  });
  const bReset = el('button', { class: 'btn small ghost' }, '업체 비밀번호 다시 발급');
  bReset.onclick = () => act(bReset, async () => {
    if (!confirm('업체 계정의 비밀번호를 새로 발급할까요? 예전 비밀번호는 쓸 수 없게 됩니다.')) return;
    const r = await api('esign.request', { id: c.id, reset: true });
    out.replaceChildren(credentialBox(r, c));
  });
  const hasSeal = !!S.settings.직인파일ID;
  const bSeal = el('button', { class: 'btn seal', disabled: !hasSeal }, '회사 직인으로 서명');
  bSeal.onclick = () => act(bSeal, async () => {
    if (!confirm('등록된 회사 직인으로 ' + c.id + ' 계약에 서명합니다. 계속할까요?')) return;
    done(await api('esign.sign', { id: c.id, 서명자: S.settings.회사_대표자 || S.user.name, 동의: true, 직인: true }), '회사 서명을 마쳤습니다.');
  });
  const bDraw = el('button', { class: 'btn' }, '직접 서명');
  bDraw.onclick = () => {
    const pad = signaturePad();
    const nm = el('input', { value: S.settings.회사_대표자 || '', 'aria-label': '서명자 이름' });
    const go = el('button', { class: 'btn seal' }, '이 서명으로 제출');
    go.onclick = () => act(go, async () => {
      if (pad.isEmpty()) throw new Error('서명 칸에 서명하세요.');
      done(await api('esign.sign', { id: c.id, 서명자: nm.value, 동의: true, image: pad.dataUrl() }), '회사 서명을 마쳤습니다.');
    });
    out.replaceChildren(el('div', { class: 'form' }, field('서명자', nm), pad.node, go));
  };
  appendKids(box,
    el('div', { class: 'list' }, signInfo('공급받는 자 (회사)', c.회사서명일시, c.회사서명자), signInfo('상대방 (' + c.상호 + ')', c.업체서명일시, (c.업체서명자 || '') + (c.업체서명직위 ? ' ' + c.업체서명직위 : ''))),
    el('div', { class: 'actions' }, c.업체서명일시 ? null : [bReq, c.서명방식 === '전자' ? bReset : null], c.회사서명일시 ? null : [bSeal, bDraw]),
    hasSeal || c.회사서명일시 ? null : el('p', { class: 'note' }, '회사 직인을 등록하면 한 번에 서명할 수 있습니다. 더보기 → 회사 정보·선택 목록·계약서 로고에서 등록하세요.'),
    out);
  return box;
}
function fileB64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('파일을 읽지 못했습니다.')); r.readAsDataURL(file); });
}

/* ───────── 업체 화면 (모바일 서명) ───────── */
async function viewVendorHome() {
  const data = await ensureData();
  const list = data.contracts || [];
  const todo = list.filter(c => c.상태 === '서명대기' && !c.업체서명일시);
  const row = c => el('a', { class: 'row', href: '#/contract/' + encodeURIComponent(c.id) }, stamp(c.상태, true),
    el('div', { class: 'main' }, el('div', { class: 't' }, c.종류명), el('div', { class: 's' }, c.id + (c.업체서명일시 ? ' · 서명함 ' + c.업체서명일시.slice(0, 10) : ''))));
  return el('div', null,
    el('h1', null, (data.vendor ? data.vendor.상호 : S.user.name) + ' 담당자님'),
    el('p', { class: 'lead' }, '(주)지씨더블유(WHITE PRICE)와의 계약을 확인하고 서명하는 화면입니다.'),
    el('h2', null, '서명할 계약 ' + todo.length + '건'),
    el('div', { class: 'list' }, todo.length ? todo.map(row) : el('div', { class: 'empty' }, '지금 서명할 계약이 없습니다.')),
    el('h2', null, '내 계약'),
    el('div', { class: 'list' }, list.length ? list.map(row) : el('div', { class: 'empty' }, '아직 계약이 없습니다.')));
}
async function viewVendorContract(id) {
  const d = await getDetail(id, false);
  const c = d.contract;
  const parts = (d.values._parts || String(c.구성 || '').split(',')).filter(p => CONTRACT_DOCS[p]);
  const done = (detail, msg) => { rememberDetail(detail); toast(msg); refreshSoon(false); route(true); };
  const bPdf = el('button', { class: 'btn' }, '계약서 PDF 열기');
  bPdf.onclick = () => openFile(c.PDF파일ID);
  const bSigned = c.서명본파일ID ? el('button', { class: 'btn primary' }, '서명이 끝난 계약서 열기') : null;
  if (bSigned) bSigned.onclick = () => openFile(c.서명본파일ID);
  let signBox = null;
  if (c.상태 === '서명대기' && !c.업체서명일시) {
    const a1 = el('input', { type: 'checkbox' }), a2 = el('input', { type: 'checkbox' });
    const nm = el('input', { value: (S.data.vendor && S.data.vendor.대표자) || '', autocomplete: 'name', 'aria-label': '서명자 이름' });
    const title = el('input', { value: '대표', 'aria-label': '직위' });
    const pad = signaturePad();
    const go = el('button', { class: 'btn seal' }, '서명 제출');
    go.onclick = () => act(go, async () => {
      if (!a1.checked || !a2.checked) throw new Error('두 항목에 모두 체크하세요.');
      if (pad.isEmpty()) throw new Error('서명 칸에 서명하세요.');
      if (!confirm('이 서명으로 계약을 체결합니다. 제출한 뒤에는 고칠 수 없습니다.')) return;
      done(await api('esign.sign', { id: c.id, 서명자: nm.value, 직위: title.value, 동의: true, image: pad.dataUrl() }), '서명을 제출했습니다. 감사합니다.');
    });
    signBox = el('div', { class: 'form' },
      el('h2', { style: 'margin:0' }, '서명하기'),
      el('label', { class: 'check' }, a1, '위 계약서의 내용을 모두 확인했습니다.'),
      el('label', { class: 'check' }, a2, '전자서명으로 이 계약을 체결하는 데 동의합니다.'),
      el('div', { class: 'two' }, field('서명자 이름', nm), field('직위', title)),
      pad.node, go);
  }
  const maxMb = Number(S.settings.첨부최대MB || 10);
  const needDocs = d.checklist.filter(x => x.유형 !== '서명본');
  const upRow = x => {
    const inp = el('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png', capture: 'environment', class: 'sr' });
    const b = el('button', { class: 'btn small' }, x.상태 === '없음' ? '사진 찍어 올리기' : '다시 올리기');
    b.onclick = () => inp.click();
    inp.onchange = () => act(b, async () => {
      const f = inp.files[0]; inp.value = '';
      if (!f) return;
      if (f.size > maxMb * 1024 * 1024) throw new Error(maxMb + 'MB보다 작은 파일을 올리세요.');
      done(await api('attach.upload', { 계약번호: c.id, 유형: x.유형, 파일명: f.name, mime: f.type, data: await fileB64(f) }), x.유형 + '을(를) 올렸습니다.');
    });
    return el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, x.유형)), tagFor(x.상태), x.상태 === '확인' ? null : el('span', null, b, inp));
  };
  return el('div', null,
    el('div', { class: 'inline', style: 'gap:14px;align-items:center' }, stamp(c.상태), el('div', null, el('h1', { style: 'margin:0' }, c.종류명), el('div', { class: 's' }, c.id))),
    el('div', { class: 'actions' }, bSigned, bPdf),
    c.업체서명일시 ? el('p', { class: 'note' }, '서명함: ' + c.업체서명자 + ' · ' + c.업체서명일시 + (c.회사서명일시 ? '' : ' (회사 서명을 기다리는 중)')) : null,
    parts.length ? renderPaged(parts, d.values, S.settings) : null,
    signBox,
    needDocs.length ? [el('h2', null, '제출할 서류'), el('div', { class: 'list' }, needDocs.map(upRow))] : null);
}
async function viewContract(id) {
  if (isVendor()) return viewVendorContract(id);
  const d = await getDetail(id, false);
  const c = d.contract;
  if (c.상태 === '작성중') { location.hash = '#/contract/' + encodeURIComponent(c.id) + '/edit'; return null; }
  const parts = (d.values._parts || String(c.구성 || '').split(',')).filter(p => CONTRACT_DOCS[p]);
  const maxMb = Number(S.settings.첨부최대MB || 10);
  const done = (detail, msg) => { rememberDetail(detail); toast(msg); refreshSoon(false); route(true); };
  async function upload(type, file, extra) {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error('PDF·JPG·PNG 파일만 올릴 수 있습니다.');
    if (file.size > maxMb * 1024 * 1024) throw new Error(maxMb + 'MB보다 작은 파일을 올리세요.');
    const data = await fileB64(file);
    done(await api('attach.upload', Object.assign({ 계약번호: c.id, 유형: type, 파일명: file.name, mime: file.type, data: data }, extra || {})), type + '을(를) 올렸습니다.');
  }
  function uploader(type, label, before) {
    const inp = el('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png', class: 'sr' });
    const b = el('button', { class: 'btn small' }, label || '올리기');
    b.onclick = () => { try { if (before) before(); inp.click(); } catch (e) { toast(e.message, 'err'); } };
    inp.onchange = () => act(b, async () => {
      const f = inp.files[0]; inp.value = '';
      const t = typeof type === 'function' ? type() : type;
      await upload(t, f, t === '서명본' ? { 체결일: signDate.value } : null);
    });
    return el('span', null, b, inp);
  }
  const signDate = el('input', { type: 'date', 'aria-label': '계약 체결일' });
  const needDate = () => { if (!signDate.value) throw new Error('먼저 계약 체결일(두 당사자 중 늦게 서명한 날짜)을 고르세요.'); };
  const canUpload = isStaff() && ['서명대기', '증빙수집', '완료'].includes(c.상태);
  const allOk = d.checklist.every(x => x.상태 === '확인');
  const bPdf = el('button', { class: 'btn primary' }, '계약서 PDF 열기');
  bPdf.onclick = () => openFile(c.PDF파일ID);
  const bSigned = c.서명본파일ID ? el('button', { class: 'btn' }, '전자서명본 열기') : null;
  if (bSigned) bSigned.onclick = () => openFile(c.서명본파일ID);
  const bVer = el('button', { class: 'btn' }, '새 버전 만들기');
  bVer.onclick = () => act(bVer, async () => {
    if (!confirm('이 계약의 내용을 복사해 새 버전 초안을 만듭니다. 계속할까요?')) return;
    const n = await api('contract.newVersion', { id: c.id });
    upsert('contracts', n);
    location.hash = '#/contract/' + encodeURIComponent(n.id) + '/edit';
  });
  const bClose = el('button', { class: 'btn ghost' }, '계약 종료');
  bClose.onclick = () => act(bClose, async () => {
    const why = prompt('종료 사유를 적으세요 (예: 기간 만료, 해지 합의)');
    if (why === null) return;
    done(await api('contract.close', { id: c.id, 사유: why }), '계약을 종료했습니다.');
  });
  const bDone = el('button', { class: 'btn seal', disabled: !allOk }, '계약 완료 처리');
  bDone.onclick = () => act(bDone, async () => done(await api('contract.complete', { id: c.id }), '계약을 완료했습니다.'));
  const other = select(['PL보험증권', '기타'], 'PL보험증권');
  const info = (label, value) => el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 's' }, label), el('div', { class: 't' }, value)));
  return el('div', null,
    el('div', { class: 'inline', style: 'gap:14px;align-items:center;margin-bottom:6px' }, stamp(c.상태),
      el('div', null, el('h1', { style: 'margin:0' }, c.상호), el('div', { class: 's', style: 'color:var(--muted);font-size:14px' }, c.id + ' · ' + c.종류명 + ' · v' + c.버전))),
    el('div', { class: 'list', style: 'margin-top:12px' },
      info('구성', parts.map(p => CONTRACT_DOCS[p].title).join(' + ') || '이전 양식'),
      info('계약기간', (c.계약시작일 || '—') + ' ~ ' + (c.계약종료일 || '—')),
      info('계약 체결일', c.계약체결일 || '서명이 끝나면 정해집니다'),
      info('확정', (c.확정일시 || '—') + ' · ' + (c.확정자 || '')),
      info('PDF 지문(SHA-256 앞 16자리)', String(c.PDF해시 || '—').slice(0, 16)),
      c.상위계약번호 ? el('a', { class: 'row', href: '#/contract/' + encodeURIComponent(c.상위계약번호) }, el('div', { class: 'main' }, el('div', { class: 's' }, '이전 버전'), el('div', { class: 't' }, c.상위계약번호))) : null),
    el('div', { class: 'actions' }, bPdf, bSigned, canEdit() ? bVer : null, isStaff() && c.상태 !== '종료' ? bClose : null),
    isStaff() && c.상태 === '서명대기' ? [el('h2', null, '전자서명 (업체는 휴대폰에서 터치로 서명)'), esignPanel(d, done)] : null,
    el('h2', null, c.서명방식 === '전자' ? '증빙' : '서명본과 증빙'),
    c.상태 === '서명대기' && c.서명방식 !== '전자' ? el('p', { class: 'lead' }, '종이로 하려면 PDF를 출력해 양쪽이 계약일을 적고 서명·직인한 뒤 스캔본을 올립니다. 이때 두 당사자 중 늦게 서명한 날짜를 체결일로 입력합니다.') : null,
    el('div', { class: 'list' }, d.checklist.map(x => {
      const up = canUpload && x.상태 !== '확인';
      if (x.유형 === '서명본' && up) {
        return el('div', { class: 'row', style: 'flex-wrap:wrap' }, el('div', { class: 'main' }, el('div', { class: 't' }, '서명본 (종이)'), el('div', { class: 's' }, '체결일 = 늦게 서명한 날짜')),
          tagFor(x.상태), el('div', { class: 'inline', style: 'width:100%' }, signDate, uploader('서명본', '스캔본 올리기', needDate)));
      }
      return el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, x.유형)), tagFor(x.상태), up ? uploader(x.유형) : null);
    })),
    canUpload ? el('div', { class: 'actions' }, other, uploader(() => other.value, '다른 서류 올리기')) : null,
    el('h2', null, '올린 파일'),
    el('div', { class: 'list' }, d.attachments.length ? d.attachments.map(a => {
      const bView = el('button', { class: 'btn small ghost' }, '보기');
      bView.onclick = () => openFile(a.파일ID);
      const bOk = el('button', { class: 'btn small' }, '확인');
      bOk.onclick = () => act(bOk, async () => done(await api('attach.verify', { id: a.id, 결과: '확인' }), a.유형 + ' 확인'));
      const bNo = el('button', { class: 'btn small ghost' }, '반려');
      bNo.onclick = () => act(bNo, async () => {
        const why = prompt('반려 사유 (예: 서명 누락, 흐릿함)');
        if (why === null) return;
        done(await api('attach.verify', { id: a.id, 결과: '반려', 사유: why }), a.유형 + '을(를) 반려했습니다. 다시 올려 주세요.');
      });
      return el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, a.유형 + (a.확인자 === 'esign' ? ' (전자서명)' : '')), el('div', { class: 's' }, a.파일명 + ' · ' + Math.ceil(num(a.크기) / 1024) + 'KB · ' + a.생성일시)),
        tagFor(a.확인상태), a.파일ID ? bView : el('span', { class: 'tag' }, '권한 없음'),
        isStaff() && a.확인상태 === '미확인' ? [bOk, bNo] : null);
    }) : el('div', { class: 'empty' }, '아직 올린 파일이 없습니다.')),
    isStaff() && ['서명대기', '증빙수집'].includes(c.상태) ? el('div', { class: 'actions' }, bDone,
      allOk ? null : el('span', { class: 'note' }, '필요한 서류를 모두 확인하면 누를 수 있습니다.')) : null,
    el('h2', null, '계약서 내용'),
    parts.length ? (() => {
      const det = el('details', null, el('summary', null, '펼쳐 보기'));
      det.addEventListener('toggle', () => {
        if (det.open && !det.querySelector('.pages')) det.appendChild(renderPaged(parts, d.values, S.settings));
        det.querySelectorAll('.pages').forEach(fitPages);
      });
      return det;
    })() : el('p', { class: 'lead' }, '이전 양식 계약이라 PDF로만 볼 수 있습니다.'));
}
async function openFile(fileId) {
  if (!fileId) { toast('열 수 있는 파일이 없습니다.', 'err'); return; }
  const w = window.open('', '_blank');
  try {
    const f = await api('file.get', { fileId: fileId });
    const bytes = Uint8Array.from(atob(f.data), ch => ch.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: f.mime }));
    if (w) { w.location.href = url; } else {
      const a = el('a', { href: url, download: f.name });
      document.body.appendChild(a); a.click(); a.remove();
    }
  } catch (e) {
    if (w) w.close();
    toast(e.message, 'err');
  }
}

/* ───────── 상품 ───────── */
/* ───────── 마스터: 벤더 · 분류 · 창고 ───────── */
async function viewWarehouseEdit(id) {
  const list = (await ensureData()).warehouses;
  const w = id ? list.find(x => x.id === id) : { 유형: '3PL센터', 상태: '사용' };
  if (!w) throw new Error('창고를 찾을 수 없습니다: ' + id);
  const f = {
    이름: el('input', { value: w.이름 || '' }), 유형: select(['3PL센터', '샘플실', '사무실 보관', '기타'], w.유형),
    보관조건: el('input', { value: w.보관조건 || '', placeholder: '상온·냉장·냉동' }), 주소: el('input', { value: w.주소 || '' }),
    담당자: el('input', { value: w.담당자 || '' }), 상태: select(['사용', '중지'], w.상태)
  };
  if (!isStaff()) Object.values(f).forEach(x => { x.disabled = true; });
  const bSave = el('button', { class: 'btn primary' }, id ? '변경 저장' : '창고 등록');
  bSave.onclick = () => act(bSave, async () => {
    const payload = { id: id || undefined };
    Object.keys(f).forEach(k => { payload[k] = f[k].value; });
    upsert('warehouses', await api('warehouse.save', payload));
    toast('저장했습니다.'); location.hash = '#/masters/warehouses';
  });
  return el('div', null, el('h1', null, id ? w.이름 : '창고 등록'),
    el('div', { class: 'form' }, field('창고 이름', f.이름), el('div', { class: 'two' }, field('유형', f.유형), field('상태', f.상태)),
      field('보관 조건', f.보관조건), field('주소', f.주소), field('담당자', f.담당자)),
    isStaff() ? el('div', { class: 'actions' }, bSave, el('a', { class: 'btn ghost', href: '#/masters/warehouses' }, '목록으로')) : null);
}

/* ───────── 더보기 · 공지 · 사용자 · 감사로그 · 설정 ───────── */
async function viewNotices() {
  const list = (await ensureData()).notices;
  return el('div', null, el('h1', null, '공지사항'),
    isStaff() ? el('div', { class: 'actions' }, el('a', { class: 'btn primary', href: '#/notice/new/edit' }, '공지 쓰기')) : null,
    el('div', { class: 'list' }, list.length ? list.map(n => el('a', { class: 'row', href: '#/notice/' + encodeURIComponent(n.id) },
      el('div', { class: 'main' }, el('div', { class: 't' }, n.제목), el('div', { class: 's' }, n.id + ' · ' + (n.작성자명 || '') + ' · ' + String(n.수정일시).slice(0, 10)))))
      : el('div', { class: 'empty' }, '공지가 없습니다.')));
}
async function viewNotice(id) {
  const n = (await ensureData()).notices.find(x => x.id === id);
  if (!n) throw new Error('공지를 찾을 수 없습니다.');
  return el('div', null, el('h1', null, n.제목), el('p', { class: 'lead' }, n.id + ' · ' + (n.작성자명 || '') + ' · ' + n.수정일시),
    el('div', { class: 'form', style: 'white-space:pre-wrap' }, n.내용 || '(내용 없음)'),
    el('div', { class: 'actions' }, el('a', { class: 'btn ghost', href: '#/notices' }, '목록으로'), isStaff() ? el('a', { class: 'btn', href: '#/notice/' + encodeURIComponent(id) + '/edit' }, '고치기') : null));
}
async function viewNoticeEdit(id) {
  if (!isStaff()) throw new Error('공지는 운영기획·관리자가 씁니다.');
  const n = id ? (await ensureData()).notices.find(x => x.id === id) : {};
  if (!n) throw new Error('공지를 찾을 수 없습니다.');
  const title = el('input', { value: n.제목 || '' });
  const body = el('textarea', { value: n.내용 || '', rows: 10 });
  const bSave = el('button', { class: 'btn primary' }, id ? '변경 저장' : '공지 올리기');
  bSave.onclick = () => act(bSave, async () => {
    const d = await api('notice.save', { id: id || undefined, 제목: title.value, 내용: body.value });
    upsert('notices', d); refreshSoon(false);
    toast('공지를 올렸습니다 (' + d.id + ')'); location.hash = '#/notices';
  });
  const bDel = el('button', { class: 'btn ghost' }, '공지 지우기');
  bDel.onclick = () => act(bDel, async () => {
    if (!confirm('이 공지를 지울까요?')) return;
    await api('notice.delete', { id: id });
    S.data.notices = S.data.notices.filter(x => x.id !== id); persistData(); refreshSoon(false);
    toast('지웠습니다.'); location.hash = '#/notices';
  });
  return el('div', null, el('h1', null, id ? '공지 고치기' : '공지 쓰기'),
    el('div', { class: 'form' }, field('제목', title), field('내용', body, '글자만 저장됩니다(서식·스크립트는 들어가지 않습니다)')),
    el('div', { class: 'actions' }, bSave, id ? bDel : null));
}
async function viewAudit() {
  if (!isAdmin()) throw new Error('관리자만 볼 수 있습니다.');
  const list = await api('audit.list', { limit: 300 });
  return el('div', null, el('h1', null, '감사로그'), el('p', { class: 'lead' }, '최근 300건, 최신순'),
    el('div', { class: 'list' }, list.length ? list.map(a => el('div', { class: 'row' }, el('div', { class: 'main' },
      el('div', { class: 't' }, a.작업 + (a.대상 ? ' · ' + a.대상 : '')), el('div', { class: 's' }, a.시각 + ' · ' + a.사용자 + (a.내용 ? ' · ' + a.내용 : ''))))) : el('div', { class: 'empty' }, '기록이 없습니다.')));
}
/* ───────── 시작 ───────── */
(async function start() {
  const saved = sessionStorage.getItem('whaps');
  if (saved) {
    try {
      const sv = JSON.parse(saved);
      S.token = sv.token; S.user = sv.user; S.settings = sv.settings || {};
      const data = sessionStorage.getItem('whaps_data');
      if (data && !S.user.mustChange) {
        S.data = JSON.parse(data);
        S.data._t = 0;
        renderShell();          // 기억해 둔 자료로 바로 그리고
        refreshSoon(true);      // 최신 자료는 뒤에서 받습니다
        return;
      }
      if (!S.user.mustChange) await loadAll(); else await api('auth.me');
      renderShell();
      return;
    } catch (e) { clearSession(); }
  }
  viewLogin();
})();
