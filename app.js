/* 화프스(WHAPS) 화면 v2.0 — 데이터는 모두 서버(Apps Script)를 거칩니다. 화면에는 비밀을 두지 않습니다. */
'use strict';

const S = { token: null, user: null, settings: {}, cache: {}, wide: false };
const STAFF = ['관리자', '운영기획'];
const DATE_KEY = /(체결일|시작일|종료일|납기일)$/;
const PARTY = ['공급자_', '개발사_', '물류사_', '제조사_'];
const CONTRACT_STATES = ['작성중', '서명대기', '증빙수집', '완료', '종료'];
const REQUIRED_DOCS = ['서명본', '사업자등록증', '통장사본'];
const TRADE_TYPES = ['직매입1(업체배송)', '직매입2-NB(3PL)', '직매입2-PB(3PL)', '입점중개'];

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
const canEdit = () => S.user && S.user.role !== '조회';
const keyLabel = k => k.replace(/^@/, '').replace(/_/g, ' ');
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

/* ───────── 서버 호출 ───────── */
class ApiError extends Error { constructor(msg, code) { super(msg); this.code = code; } }
async function api(action, payload) {
  const body = JSON.stringify({ action: action, payload: payload || {}, token: S.token });
  const bar = $('#progress');
  if (bar) bar.classList.add('on');
  let j;
  try {
    if (window.__WHAPS_TEST_HANDLER__) {
      j = JSON.parse(window.__WHAPS_TEST_HANDLER__(body));
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
    if (bar) bar.classList.remove('on');
  }
  if (!j.ok) {
    if (j.code === 'auth') { clearSession(); setTimeout(() => viewLogin(j.msg), 0); }
    if (j.code === 'must_change') setTimeout(() => { location.hash = '#/password'; }, 0);
    throw new ApiError(j.msg || '요청을 처리하지 못했습니다.', j.code);
  }
  return j.data;
}
async function cached(action) {
  if (!S.cache[action]) S.cache[action] = await api(action);
  return S.cache[action];
}
function invalidate() { for (const a of arguments) delete S.cache[a]; }
function setSession(d) {
  S.token = d.token; S.user = d.user; S.settings = d.settings || {};
  sessionStorage.setItem('whaps', JSON.stringify({ token: S.token, user: S.user, settings: S.settings }));
}
function clearSession() { S.token = null; S.user = null; S.cache = {}; sessionStorage.removeItem('whaps'); }
function saveUser() { sessionStorage.setItem('whaps', JSON.stringify({ token: S.token, user: S.user, settings: S.settings })); }

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
function renderDoc(tpl, values, settings) {
  const box = el('article', { class: 'paper', 'aria-label': '계약서 미리보기' });
  tpl.blocks.forEach(b => {
    if (b.t === 'title') box.appendChild(el('h2', { class: 'doc-title' }, fillNodes(b.x, values, settings)));
    else if (b.t === 'table') {
      const tb = el('table');
      b.rows.forEach(r => tb.appendChild(el('tr', null, r.map(c => el('td', { class: c.h ? 'h' : null, colspan: c.s ? String(c.s) : null }, fillNodes(c.x, values, settings))))));
      box.appendChild(tb);
    } else box.appendChild(el('p', { class: b.t === 'p' ? null : b.t }, fillNodes(b.x, values, settings)));
  });
  return box;
}
function partyValues(vendor) {
  const masked = s => /\*/.test(String(s || ''));
  const out = {};
  PARTY.forEach(px => {
    const m = {};
    m[px + '상호'] = vendor.상호;
    m[px + '사업자등록번호'] = vendor.사업자등록번호; m[px + '사업자번호'] = vendor.사업자등록번호;
    m[px + '대표자명'] = vendor.대표자; m[px + '대표자'] = vendor.대표자;
    m[px + '사업장주소'] = vendor.사업장주소; m[px + '주소'] = vendor.사업장주소;
    m[px + '담당자명'] = vendor.담당자;
    Object.keys(m).forEach(k => { if (m[k] && !masked(m[k])) out[k] = m[k]; });
  });
  return out;
}
const isPartyKey = k => PARTY.some(px => k.startsWith(px));

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
function renderShell() {
  const nav = el('nav', { class: 'tabs', 'aria-label': '주 메뉴' },
    [['#/home', 'home', '홈'], ['#/contracts', 'contract', '계약'], ['#/products', 'product', '상품'], ['#/masters/vendors', 'master', '마스터'], ['#/more', 'more', '더보기']]
      .map(([h, ic, t]) => el('a', { href: h, 'data-base': h.split('/')[1] }, icon(ic), t)));
  $('#root').replaceChildren(
    el('div', { class: 'progress', id: 'progress' }),
    el('header', { class: 'bar' }, el('img', { src: 'wp1.png', alt: 'WP' }), el('span', { class: 'name' }, '화프스'),
      el('span', { class: 'who' }, S.user.name, el('br'), S.user.role)),
    el('main', { id: 'main' }), nav);
  route();
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
async function route() {
  if (!S.token) return viewLogin();
  const main = $('#main');
  if (!main) return renderShell();
  let h = location.hash || '#/home';
  if (S.user.mustChange && h !== '#/password') { location.hash = '#/password'; return; }
  const base = h.split('/')[1];
  const alias = { contract: 'contracts', product: 'products', vendor: 'masters', warehouse: 'masters', notices: 'more', notice: 'more', users: 'more', audit: 'more', settings: 'more', password: 'more' };
  document.querySelectorAll('nav.tabs a').forEach(a => a.classList.toggle('on', a.dataset.base === (alias[base] || base)));
  for (const [re, fn] of ROUTES) {
    const m = h.match(re);
    if (!m) continue;
    S.wide = false;
    main.replaceChildren(el('div', { class: 'empty' }, '불러오는 중…'));
    try {
      const node = await fn(m);
      if (location.hash !== h && location.hash) return;
      main.className = S.wide ? 'wide' : '';
      if (node) main.replaceChildren(node);
      window.scrollTo(0, 0);
    } catch (e) {
      if (e.code === 'auth' || e.code === 'must_change') return;
      main.replaceChildren(el('div', { class: 'note warn' }, e.message), el('div', { class: 'actions' }, el('button', { class: 'btn', onclick: route }, '다시 시도')));
    }
    return;
  }
  location.hash = '#/home';
}
window.addEventListener('hashchange', route);

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
    location.hash = '#/home';
  });
  return el('div', null, el('h1', null, '비밀번호 바꾸기'),
    S.user.mustChange ? el('p', { class: 'note warn' }, '임시 비밀번호로 로그인했습니다. 계속하려면 새 비밀번호를 정하세요.') : null,
    el('div', { class: 'form' }, field('지금 비밀번호', old, S.user.mustChange ? '관리자에게 받은 임시 비밀번호' : null),
      field('새 비밀번호', n1, '영문과 숫자를 섞어 8자 이상'), field('새 비밀번호 확인', n2), btn));
}

/* ───────── 홈 ───────── */
async function viewHome() {
  const d = await api('dashboard');
  const todo = [];
  d.waitingSign.forEach(c => todo.push(el('a', { class: 'row', href: '#/contract/' + c.id }, stamp('서명대기', true),
    el('div', { class: 'main' }, el('div', { class: 't' }, c.상호), el('div', { class: 's' }, '서명본을 올려야 합니다 · ' + c.종류명)))));
  if (d.docsToCheck) todo.push(el('a', { class: 'row', href: '#/contracts/' + encodeURIComponent('증빙수집') }, stamp('증빙수집', true),
    el('div', { class: 'main' }, el('div', { class: 't' }, '확인할 서류 ' + d.docsToCheck + '건'), el('div', { class: 's' }, '올라온 서명본·증빙을 확인하세요'))));
  d.expiring.forEach(c => todo.push(el('a', { class: 'row', href: '#/contract/' + c.id }, stamp('완료', true),
    el('div', { class: 'main' }, el('div', { class: 't' }, c.상호 + ' 만료 ' + c.남은일 + '일 전'), el('div', { class: 's' }, c.종류명 + ' · ' + c.계약종료일)))));
  return el('div', null,
    el('h1', null, S.user.name + '님, 오늘 처리할 일'),
    el('div', { class: 'list' }, todo.length ? todo : el('div', { class: 'empty' }, '지금 처리할 계약 업무가 없습니다.')),
    el('h2', null, '계약 현황'),
    el('div', { class: 'stamps' }, CONTRACT_STATES.map(s => el('a', { href: '#/contracts/' + encodeURIComponent(s) }, stamp(s, true), el('b', null, d.contracts[s] || 0), el('span', { class: 'cap' }, s)))),
    el('h2', null, '상품 현황'),
    el('div', { class: 'list' }, el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, '등록된 벤더 ' + d.vendors + '곳'),
      el('div', { class: 's' }, Object.entries(d.products).map(([k, v]) => k + ' ' + v).join('  |  '))))),
    el('h2', null, '공지'),
    el('div', { class: 'list' }, d.notices.length ? d.notices.map(n => el('a', { class: 'row', href: '#/notice/' + encodeURIComponent(n.id) },
      el('div', { class: 'main' }, el('div', { class: 't' }, n.제목), el('div', { class: 's' }, (n.작성자명 || '') + ' · ' + String(n.수정일시).slice(0, 10)))))
      : el('div', { class: 'empty' }, '공지가 없습니다.')),
    el('div', { class: 'actions' }, el('a', { class: 'btn ghost', href: '#/notices' }, '공지 전체 보기'), isStaff() ? el('a', { class: 'btn', href: '#/notice/new/edit' }, '공지 쓰기') : null));
}

/* ───────── 계약 ───────── */
async function viewContracts(state) {
  const list = await api('contract.list', state ? { 상태: state } : {});
  return el('div', null,
    el('h1', null, '계약'),
    el('div', { class: 'chips' }, el('a', { class: 'chip' + (state ? '' : ' on'), href: '#/contracts' }, '전체'),
      CONTRACT_STATES.map(s => el('a', { class: 'chip' + (state === s ? ' on' : ''), href: '#/contracts/' + encodeURIComponent(s) }, s))),
    canEdit() ? el('div', { class: 'actions' }, el('a', { class: 'btn primary', href: '#/contract/new' }, '새 계약 만들기')) : null,
    el('div', { class: 'list' }, list.length ? list.map(c => el('a', { class: 'row', href: '#/contract/' + encodeURIComponent(c.id) }, stamp(c.상태, true),
      el('div', { class: 'main' }, el('div', { class: 't' }, c.상호), el('div', { class: 's' }, c.id + ' · ' + c.종류명 + (c.버전 !== '1' ? ' · v' + c.버전 : '') + ' · ' + String(c.수정일시).slice(0, 10)))))
      : el('div', { class: 'empty' }, state ? state + ' 상태의 계약이 없습니다.' : '아직 계약이 없습니다. 새 계약을 만들어 보세요.')));
}

async function viewContractEdit(id) {
  if (!canEdit()) throw new Error('조회 권한으로는 계약을 작성할 수 없습니다.');
  const vendors = await cached('vendor.list');
  const got = id ? await api('contract.get', { id: id }) : null;
  if (got && got.contract.상태 !== '작성중') { location.hash = '#/contract/' + encodeURIComponent(id); return null; }
  S.wide = true;
  let curId = got ? got.contract.id : null;
  let code = got ? got.contract.종류 : '01';
  let vendorId = got ? got.contract.벤더코드 : '';
  const values = Object.assign({}, got ? got.values : {});
  const tpl = () => CONTRACT_TEMPLATES[code];
  const fieldsBox = el('div', { class: 'form' });
  const preview = el('div', { class: 'preview-wrap' });
  const status = el('p', { class: 'note' });

  const typeSel = select(Object.values(CONTRACT_TEMPLATES).map(t => [t.code, t.code + '. ' + t.title]), code, {
    onchange: () => { code = typeSel.value; applyVendor(); buildFields(); refresh(); }
  });
  const venSel = select([['', vendors.length ? '벤더를 고르세요' : '먼저 마스터에서 벤더를 등록하세요']].concat(vendors.map(v => [v.id, v.상호 + ' (' + v.id + ', ' + v.구분 + ')'])), vendorId, {
    onchange: () => { vendorId = venSel.value; applyVendor(); buildFields(); refresh(); }
  });
  function applyVendor() {
    const v = vendors.find(x => x.id === vendorId);
    if (!v) return;
    const pv = partyValues(v);
    tpl().keys.forEach(k => { if (pv[k]) values[k] = pv[k]; });
  }
  function buildFields() {
    fieldsBox.replaceChildren(...tpl().keys.map(k => {
      const dateish = DATE_KEY.test(k) && values[k] !== '해당없음';
      const inp = el('input', { type: dateish ? 'date' : 'text', value: values[k] || '', 'aria-label': keyLabel(k) });
      inp.addEventListener('input', () => { values[k] = inp.value.trim(); refresh(); });
      const na = el('button', { type: 'button', class: 'btn small ghost' }, '해당없음');
      na.onclick = () => { inp.type = 'text'; inp.value = '해당없음'; values[k] = '해당없음'; refresh(); };
      return el('label', { class: 'field' + (isPartyKey(k) ? ' auto' : '') }, el('span', null, keyLabel(k)), el('div', { class: 'inline' }, inp, na),
        isPartyKey(k) ? el('small', null, '벤더를 고르면 자동으로 채워집니다') : null);
    }));
  }
  function refresh() {
    preview.replaceChildren(renderDoc(tpl(), values, S.settings));
    const empty = tpl().keys.filter(k => !values[k]).length;
    status.textContent = empty ? '빈 칸 ' + empty + '개 — 미리보기에 노란색으로 표시됩니다. 해당 없으면 "해당없음"을 누르세요.' : '모든 칸이 채워졌습니다.';
    status.className = 'note' + (empty ? ' warn' : '');
  }
  const pick = () => { const o = {}; tpl().keys.forEach(k => { o[k] = values[k] || ''; }); return o; };
  async function save() {
    if (!vendorId) throw new Error('벤더를 먼저 고르세요.');
    const d = await api('contract.saveDraft', { id: curId, 종류: code, 벤더코드: vendorId, values: pick() });
    curId = d.id;
    history.replaceState(null, '', '#/contract/' + encodeURIComponent(d.id) + '/edit');
    return d;
  }
  const bSave = el('button', { class: 'btn' }, '임시저장');
  bSave.onclick = () => act(bSave, async () => { const d = await save(); toast('임시저장했습니다 (' + d.id + ')'); });
  const bConfirm = el('button', { class: 'btn seal' }, '확정하고 PDF 만들기');
  bConfirm.onclick = () => act(bConfirm, async () => {
    if (!confirm('확정하면 계약번호와 PDF가 만들어지고, 그 뒤에는 고칠 수 없습니다(바꿀 때는 새 버전). 확정할까요?')) return;
    await save();
    const d = await api('contract.confirm', { id: curId });
    toast(d.id + ' 계약을 확정했습니다. PDF를 출력해 서명받으세요.');
    location.hash = '#/contract/' + encodeURIComponent(d.id);
  });
  const bPrint = el('button', { class: 'btn ghost' }, '미리보기 인쇄');
  bPrint.onclick = () => window.print();
  const bDel = el('button', { class: 'btn ghost' }, '초안 지우기');
  bDel.onclick = () => act(bDel, async () => {
    if (!curId) { location.hash = '#/contracts'; return; }
    if (!confirm('이 초안을 지울까요?')) return;
    await api('contract.deleteDraft', { id: curId });
    toast('초안을 지웠습니다.');
    location.hash = '#/contracts';
  });
  buildFields();
  refresh();
  return el('div', null,
    el('h1', null, curId ? '계약 작성 · ' + curId : '새 계약'),
    el('div', { class: 'split' },
      el('div', null,
        el('div', { class: 'form' }, field('계약 종류', typeSel), field('계약 상대(벤더)', venSel, '상대방 정보는 벤더 마스터에서 가져옵니다')),
        el('h2', null, '키값 입력'), status, fieldsBox,
        el('div', { class: 'actions' }, bSave, isStaff() ? bConfirm : null, bPrint, bDel),
        isStaff() ? null : el('p', { class: 'note' }, '확정은 운영기획·관리자가 합니다. 임시저장한 뒤 알려 주세요.')),
      preview));
}

async function viewContract(id) {
  const d = await api('contract.get', { id: id });
  const c = d.contract;
  if (c.상태 === '작성중') { location.hash = '#/contract/' + encodeURIComponent(c.id) + '/edit'; return null; }
  const tpl = CONTRACT_TEMPLATES[c.종류];
  const maxMb = Number(S.settings.첨부최대MB || 10);
  const reload = () => route();
  async function upload(type, file) {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error('PDF·JPG·PNG 파일만 올릴 수 있습니다.');
    if (file.size > maxMb * 1024 * 1024) throw new Error(maxMb + 'MB보다 작은 파일을 올리세요.');
    const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('파일을 읽지 못했습니다.')); r.readAsDataURL(file); });
    await api('attach.upload', { 계약번호: c.id, 유형: type, 파일명: file.name, mime: file.type, data: data });
    toast(type + '을(를) 올렸습니다.');
    reload();
  }
  function uploader(type, label) {
    const inp = el('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png', class: 'sr' });
    const b = el('button', { class: 'btn small' }, label || '올리기');
    b.onclick = () => inp.click();
    inp.onchange = () => act(b, () => upload(typeof type === 'function' ? type() : type, inp.files[0]));
    return el('span', null, b, inp);
  }
  const canUpload = isStaff() && ['서명대기', '증빙수집', '완료'].includes(c.상태);
  const allOk = d.checklist.every(x => x.상태 === '확인');
  const bPdf = el('button', { class: 'btn primary' }, '계약서 PDF 열기');
  bPdf.onclick = () => openFile(c.PDF파일ID);
  const bVer = el('button', { class: 'btn' }, '새 버전 만들기');
  bVer.onclick = () => act(bVer, async () => {
    if (!confirm('이 계약의 내용을 복사해 새 버전 초안을 만듭니다. 계속할까요?')) return;
    const n = await api('contract.newVersion', { id: c.id });
    location.hash = '#/contract/' + encodeURIComponent(n.id) + '/edit';
  });
  const bClose = el('button', { class: 'btn ghost' }, '계약 종료');
  bClose.onclick = () => act(bClose, async () => {
    const why = prompt('종료 사유를 적으세요 (예: 기간 만료, 해지 합의)');
    if (why === null) return;
    await api('contract.close', { id: c.id, 사유: why });
    toast('계약을 종료했습니다.');
    reload();
  });
  const bDone = el('button', { class: 'btn seal', disabled: !allOk }, '계약 완료 처리');
  bDone.onclick = () => act(bDone, async () => { await api('contract.complete', { id: c.id }); toast('계약을 완료했습니다.'); reload(); });
  const other = select(['PL보험증권', '기타'], 'PL보험증권');
  return el('div', null,
    el('div', { class: 'inline', style: 'gap:14px;align-items:center;margin-bottom:6px' }, stamp(c.상태),
      el('div', null, el('h1', { style: 'margin:0' }, c.상호), el('div', { class: 's', style: 'color:var(--muted);font-size:14px' }, c.id + ' · ' + c.종류명 + ' · v' + c.버전))),
    el('div', { class: 'list', style: 'margin-top:12px' },
      el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 's' }, '계약기간'), el('div', { class: 't' }, (c.계약시작일 || '—') + ' ~ ' + (c.계약종료일 || '—') + ' (1년, 자동 연장)'))),
      el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 's' }, '확정'), el('div', { class: 't' }, (c.확정일시 || '—') + ' · ' + (c.확정자 || '')))),
      el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 's' }, 'PDF 지문(SHA-256 앞 16자리)'), el('div', { class: 't' }, String(c.PDF해시 || '—').slice(0, 16)))),
      c.상위계약번호 ? el('a', { class: 'row', href: '#/contract/' + encodeURIComponent(c.상위계약번호) }, el('div', { class: 'main' }, el('div', { class: 's' }, '이전 버전'), el('div', { class: 't' }, c.상위계약번호))) : null),
    el('div', { class: 'actions' }, bPdf, canEdit() ? bVer : null, isStaff() && c.상태 !== '종료' ? bClose : null),
    el('h2', null, '서명본과 증빙'),
    el('p', { class: 'lead' }, 'PDF를 출력해 양쪽이 서명·직인한 뒤 스캔본을 올리고, 사업자등록증과 통장사본을 받아 확인하면 완료할 수 있습니다.'),
    el('div', { class: 'list' }, d.checklist.map(x => el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, x.유형)), tagFor(x.상태),
      canUpload && x.상태 !== '확인' ? uploader(x.유형) : null))),
    canUpload ? el('div', { class: 'actions' }, other, uploader(() => other.value, '다른 서류 올리기')) : null,
    el('h2', null, '올린 파일'),
    el('div', { class: 'list' }, d.attachments.length ? d.attachments.map(a => {
      const bView = el('button', { class: 'btn small ghost' }, '보기');
      bView.onclick = () => openFile(a.파일ID);
      const bOk = el('button', { class: 'btn small' }, '확인');
      bOk.onclick = () => act(bOk, async () => { await api('attach.verify', { id: a.id, 결과: '확인' }); toast(a.유형 + ' 확인'); reload(); });
      const bNo = el('button', { class: 'btn small ghost' }, '반려');
      bNo.onclick = () => act(bNo, async () => {
        const why = prompt('반려 사유 (예: 서명 누락, 흐릿함)');
        if (why === null) return;
        await api('attach.verify', { id: a.id, 결과: '반려', 사유: why });
        toast(a.유형 + '을(를) 반려했습니다. 다시 올려 주세요.');
        reload();
      });
      return el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, a.유형), el('div', { class: 's' }, a.파일명 + ' · ' + Math.ceil(num(a.크기) / 1024) + 'KB · ' + a.생성일시)),
        tagFor(a.확인상태), a.파일ID ? bView : el('span', { class: 'tag' }, '권한 없음'),
        isStaff() && a.확인상태 === '미확인' ? [bOk, bNo] : null);
    }) : el('div', { class: 'empty' }, '아직 올린 파일이 없습니다.')),
    isStaff() && ['서명대기', '증빙수집'].includes(c.상태) ? el('div', { class: 'actions' }, bDone,
      allOk ? null : el('span', { class: 'note' }, '서명본·사업자등록증·통장사본을 모두 확인하면 누를 수 있습니다.')) : null,
    el('h2', null, '계약서 내용'),
    el('details', null, el('summary', null, '펼쳐 보기'), renderDoc(tpl, d.values, S.settings)));

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
async function viewProducts() {
  const list = await cached('product.list');
  const q = el('input', { type: 'search', placeholder: '상품명·코드 검색', 'aria-label': '상품 검색' });
  const box = el('div', { class: 'list' });
  const draw = () => {
    const s = q.value.trim();
    const rows = list.filter(p => !s || (p.상품명 + p.id + (p.바코드 || '')).includes(s));
    box.replaceChildren(...(rows.length ? rows.map(p => el('a', { class: 'row', href: '#/product/' + encodeURIComponent(p.id) },
      el('div', { class: 'main' }, el('div', { class: 't' }, p.상품명), el('div', { class: 's' }, p.id + ' · ' + (p.거래형태 || '거래형태 미정') + ' · 일반가 ' + won(num(p.일반회원가)))),
      el('span', { class: 'tag' + (p.상태 === '승인' || p.상태 === '판매' ? ' ok' : '') }, p.상태)))
      : [el('div', { class: 'empty' }, list.length ? '검색 결과가 없습니다.' : '아직 등록된 상품이 없습니다.')]));
  };
  q.addEventListener('input', draw);
  draw();
  return el('div', null, el('h1', null, '상품'), el('p', { class: 'lead' }, '상품 선정 양식의 핵심 항목만 담았습니다. 승인·판매 상태는 운영기획·관리자가 정합니다.'),
    el('div', { class: 'form', style: 'padding:10px' }, q),
    canEdit() ? el('div', { class: 'actions' }, el('a', { class: 'btn primary', href: '#/product/new' }, '상품 등록')) : null, box);
}
function calcProduct(p) {
  const vat = Number(S.settings.VAT || 0.1), pg = Number(S.settings.PG율 || 0.033);
  const net = x => (p.과세구분 === '면세' ? x : x / (1 + vat));
  const g = num(p.일반회원가), sub = num(p.구독회원가), cost = num(p.공급가), fee = num(p.수수료율);
  const market = String(p.거래형태 || '').startsWith('입점');
  const r = {};
  r.일반세제외 = g ? net(g) : null;
  r.일반마진 = g && cost && !market ? (net(g) - cost) / net(g) : null;
  r.구독세제외 = sub ? net(sub) : null;
  r.구독마진 = sub && cost && !market ? (net(sub) - cost) / net(sub) : null;
  r.PG = sub ? sub * pg * (1 + vat) : null;
  r.수수료 = market && sub && fee ? sub * fee / 100 : null;
  r.순수익 = r.PG === null ? null : (market ? (r.수수료 === null ? null : r.수수료 - r.PG) : (r.구독세제외 && cost ? r.구독세제외 - cost - r.PG : null));
  r.market = market;
  return r;
}
async function viewProductEdit(id) {
  const [list, vendors, cats] = await Promise.all([cached('product.list'), cached('vendor.list'), cached('category.list')]);
  const p = id ? list.find(x => x.id === id) : { 상태: '후보', 과세구분: '과세', 거래형태: TRADE_TYPES[1], 보관: '상온' };
  if (!p) throw new Error('상품을 찾을 수 없습니다: ' + id);
  const f = {};
  const inp = (k, attrs) => (f[k] = el('input', Object.assign({ value: p[k] || '' }, attrs || {})));
  const sel = (k, opts) => (f[k] = select(opts, p[k] || (Array.isArray(opts[0]) ? opts[0][0] : opts[0])));
  const vOpts = [['', '선택 안 함']].concat(vendors.map(v => [v.id, v.상호 + ' (' + v.id + ')']));
  const bigs = Array.from(new Set(cats.map(c => c.대분류))).filter(Boolean);
  const calcBox = el('div', { class: 'calc' });
  const ro = !canEdit() || (id && p.상태 !== '후보' && !isStaff());
  const drawCalc = () => {
    const cur = {}; Object.keys(f).forEach(k => { cur[k] = f[k].value; });
    const r = calcProduct(cur);
    const floor = Number(S.settings.원가보전선_직매입 || 0.1);
    const cell = (label, val, bad) => el('div', null, el('small', null, label), el('b', { class: bad ? 'bad' : null }, val));
    calcBox.replaceChildren(
      cell('일반가 세제외', won(r.일반세제외)), cell('일반가 마진율', r.market ? '수수료 방식' : pct(r.일반마진), r.일반마진 !== null && r.일반마진 < floor),
      cell('구독가 세제외', won(r.구독세제외)), cell('구독가 마진율', r.market ? '수수료 방식' : pct(r.구독마진), r.구독마진 !== null && r.구독마진 < floor),
      cell('PG수수료(구독가)', won(r.PG)), cell(r.market ? '수수료 − PG' : '구독가 순수익', won(r.순수익), r.순수익 !== null && r.순수익 < 0));
  };
  const form = el('div', { class: 'form' },
    field('상품명', inp('상품명', { required: true }), '아임웹 노출명 기준'),
    el('div', { class: 'two' }, field('거래형태', sel('거래형태', TRADE_TYPES)), field('상태', sel('상태', isStaff() ? ['후보', '승인', '판매', '중단'] : ['후보']))),
    el('div', { class: 'two' }, field('공급사', sel('공급사코드', vOpts)), field('제조사', sel('제조사코드', vOpts))),
    el('div', { class: 'two' }, field('대분류', sel('대분류', [['', '선택']].concat(bigs))), field('중분류', inp('중분류'))),
    el('div', { class: 'two' }, field('규격', inp('규격', { placeholder: '3kg 박스(10개 내외)' })), field('판매단위', inp('판매단위', { placeholder: '1박스' }))),
    el('div', { class: 'two' }, field('납품단위', inp('납품단위', { placeholder: '10박스' })), field('박스당 입수', inp('박스입수', { inputmode: 'numeric' }))),
    el('div', { class: 'two' }, field('상품 바코드', inp('바코드', { inputmode: 'numeric' })), field('박스 코드', inp('박스코드', { inputmode: 'numeric' }))),
    el('div', { class: 'two' }, field('소비기한', inp('소비기한', { placeholder: '제조일로부터 6개월' })), field('보관', sel('보관', ['상온', '냉장', '냉동']))),
    el('div', { class: 'two' }, field('과세 구분', sel('과세구분', ['과세', '면세'])), field('공급가(VAT 별도)', inp('공급가', { inputmode: 'numeric' }), '직매입만')),
    el('div', { class: 'two' }, field('일반회원가', inp('일반회원가', { inputmode: 'numeric' })), field('구독회원가', inp('구독회원가', { inputmode: 'numeric' }))),
    field('수수료율(%)', inp('수수료율', { inputmode: 'decimal' }), '입점중개만 · 소비자 결제금액 기준'),
    el('h2', { style: 'margin:6px 0 0' }, '자동 계산'), calcBox,
    field('메모', (f.메모 = el('textarea', { value: p.메모 || '' }))));
  Object.values(f).forEach(x => { x.addEventListener('input', drawCalc); x.addEventListener('change', drawCalc); if (ro) x.disabled = true; });
  drawCalc();
  const bSave = el('button', { class: 'btn primary' }, id ? '변경 저장' : '상품 등록');
  bSave.onclick = () => act(bSave, async () => {
    const payload = { id: id || undefined };
    Object.keys(f).forEach(k => { payload[k] = f[k].value; });
    const d = await api('product.save', payload);
    invalidate('product.list');
    toast((id ? '저장했습니다 ' : '등록했습니다 ') + '(' + d.id + ')');
    location.hash = '#/products';
  });
  return el('div', null, el('h1', null, id ? p.상품명 : '상품 등록'), id ? el('p', { class: 'lead' }, p.id + ' · 마지막 수정 ' + p.수정일시) : null,
    ro && canEdit() ? el('p', { class: 'note' }, p.상태 + ' 상태의 상품은 운영기획·관리자만 고칠 수 있습니다.') : null,
    form, ro ? null : el('div', { class: 'actions' }, bSave, el('a', { class: 'btn ghost', href: '#/products' }, '목록으로')));
}

/* ───────── 마스터: 벤더 · 분류 · 창고 ───────── */
async function viewMasters(tab) {
  const head = el('div', null, el('h1', null, '마스터'),
    el('div', { class: 'chips' }, [['vendors', '벤더'], ['categories', '분류'], ['warehouses', '창고']].map(([k, t]) => el('a', { class: 'chip' + (k === tab ? ' on' : ''), href: '#/masters/' + k }, t))));
  if (tab === 'vendors') {
    const list = await cached('vendor.list');
    const q = el('input', { type: 'search', placeholder: '상호·코드·사업자번호 검색', 'aria-label': '벤더 검색' });
    const box = el('div', { class: 'list' });
    const draw = () => {
      const s = q.value.trim();
      const rows = list.filter(v => !s || (v.상호 + v.id + (v.사업자등록번호 || '')).includes(s));
      box.replaceChildren(...(rows.length ? rows.map(v => el('a', { class: 'row', href: '#/vendor/' + encodeURIComponent(v.id) },
        el('div', { class: 'main' }, el('div', { class: 't' }, v.상호), el('div', { class: 's' }, v.id + ' · ' + v.구분 + ' · ' + (v.사업자등록번호 || '사업자번호 없음'))),
        el('span', { class: 'tag' + (v.상태 === '계약중' ? ' ok' : '') }, v.상태)))
        : [el('div', { class: 'empty' }, list.length ? '검색 결과가 없습니다.' : '등록된 벤더가 없습니다. 계약 전에 벤더부터 등록하세요.')]));
    };
    q.addEventListener('input', draw);
    draw();
    head.append(el('div', { class: 'form', style: 'padding:10px' }, q), canEdit() ? el('div', { class: 'actions' }, el('a', { class: 'btn primary', href: '#/vendor/new' }, '벤더 등록')) : null, box);
    return head;
  }
  if (tab === 'categories') {
    const list = await cached('category.list');
    const big = el('input'), mid = el('input'), small = el('input');
    const show = select(['Y', 'N'], 'Y'), ver = select(['9+1', 'v3'], '9+1');
    const bAdd = el('button', { class: 'btn primary' }, '분류 추가');
    bAdd.onclick = () => act(bAdd, async () => {
      await api('category.save', { 대분류: big.value, 중분류: mid.value, 소분류: small.value, 노출: show.value, 체계버전: ver.value });
      invalidate('category.list'); toast('분류를 추가했습니다.'); route();
    });
    const groups = {};
    list.forEach(c => { (groups[c.대분류] = groups[c.대분류] || []).push(c); });
    head.append(
      isStaff() ? el('div', { class: 'form' }, el('div', { class: 'two' }, field('대분류', big), field('중분류', mid)), el('div', { class: 'two' }, field('소분류', small), field('고객 노출', show)), field('체계 버전', ver, 'v3 유지와 9+1 신안 중 결정 전이라 둘 다 담을 수 있습니다'), bAdd) : null,
      Object.keys(groups).length ? Object.keys(groups).map(g => el('div', null, el('h2', null, g), el('div', { class: 'list' }, groups[g].map(c => {
        const bDel = el('button', { class: 'btn small ghost' }, '지우기');
        bDel.onclick = () => act(bDel, async () => {
          if (!confirm('이 분류를 지울까요?')) return;
          await api('category.save', Object.assign({}, c, { 삭제: true })); invalidate('category.list'); route();
        });
        return el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, [c.중분류, c.소분류].filter(Boolean).join(' > ') || '(대분류만)'), el('div', { class: 's' }, c.id + ' · ' + c.체계버전)),
          el('span', { class: 'tag' }, c.노출 === 'Y' ? '노출' : '숨김'), isStaff() ? bDel : null);
      })))) : el('div', { class: 'list' }, el('div', { class: 'empty' }, '등록된 분류가 없습니다.')));
    return head;
  }
  const list = await cached('warehouse.list');
  head.append(isStaff() ? el('div', { class: 'actions' }, el('a', { class: 'btn primary', href: '#/warehouse/new' }, '창고 등록')) : null,
    el('div', { class: 'list' }, list.length ? list.map(w => el('a', { class: 'row', href: '#/warehouse/' + encodeURIComponent(w.id) },
      el('div', { class: 'main' }, el('div', { class: 't' }, w.이름), el('div', { class: 's' }, w.id + ' · ' + w.유형 + ' · ' + (w.보관조건 || '보관조건 미정'))), el('span', { class: 'tag' }, w.상태)))
      : el('div', { class: 'empty' }, '등록된 창고가 없습니다. 3PL 센터와 샘플실을 등록하세요.')));
  return head;
}
async function viewVendorEdit(id) {
  const list = await cached('vendor.list');
  const v = id ? list.find(x => x.id === id) : { 구분: '공급사', 상태: '후보', 거래경로: '직거래' };
  if (!v) throw new Error('벤더를 찾을 수 없습니다: ' + id);
  const locked = !canEdit() || (id && !isStaff());
  const f = {};
  const inp = (k, attrs) => (f[k] = el('input', Object.assign({ value: v[k] || '' }, attrs || {})));
  const sel = (k, opts) => (f[k] = select(opts, v[k] || opts[0]));
  const bizMsg = el('small');
  const biz = inp('사업자등록번호', { inputmode: 'numeric', placeholder: '000-00-00000' });
  biz.addEventListener('input', () => {
    const s = biz.value.replace(/[^0-9]/g, '');
    bizMsg.textContent = !s ? '' : s.length < 10 ? '10자리를 입력하세요' : bizNoOk(s) ? '올바른 번호입니다' : '검증번호가 맞지 않습니다';
    bizMsg.className = s.length === 10 && !bizNoOk(s) ? 'err' : '';
  });
  const form = el('div', { class: 'form' },
    el('div', { class: 'two' }, field('구분', sel('구분', ['공급사', '제조사', '벤더', '3PL', '수탁사', '기타'])), field('상태', sel('상태', isStaff() ? ['후보', '계약중', '중단'] : ['후보']))),
    field('상호', inp('상호', { required: true })),
    el('label', { class: 'field' }, el('span', null, '사업자등록번호'), biz, bizMsg),
    el('div', { class: 'two' }, field('대표자', inp('대표자')), field('거래경로', sel('거래경로', ['직거래', '벤더 경유', '수입사 경유']))),
    field('사업장 주소', inp('사업장주소')),
    el('div', { class: 'two' }, field('업태', inp('업태')), field('종목', inp('종목'))),
    el('div', { class: 'two' }, field('담당자', inp('담당자')), field('연락처', inp('연락처', { type: 'tel' }))),
    field('이메일', inp('이메일', { type: 'email' })),
    field('제조사(벤더 경유일 때)', sel('제조사코드', [['', '없음']].concat(list.filter(x => x.구분 === '제조사' && x.id !== v.id).map(x => [x.id, x.상호 + ' (' + x.id + ')'])))),
    isStaff() || !id ? el('div', { class: 'two' }, field('은행', inp('은행')), field('예금주', inp('예금주'))) : null,
    isStaff() || !id ? field('계좌번호', inp('계좌번호', { inputmode: 'numeric' }), '관리자·운영기획만 전체 번호를 볼 수 있습니다') : null,
    field('메모', (f.메모 = el('textarea', { value: v.메모 || '' }))));
  if (locked) Object.values(f).forEach(x => { x.disabled = true; });
  const bSave = el('button', { class: 'btn primary' }, id ? '변경 저장' : '벤더 등록');
  bSave.onclick = () => act(bSave, async () => {
    const payload = { id: id || undefined };
    Object.keys(f).forEach(k => { payload[k] = f[k].value; });
    const d = await api('vendor.save', payload);
    invalidate('vendor.list');
    toast((id ? '저장했습니다 ' : '등록했습니다 ') + '(' + d.id + ')');
    location.hash = '#/masters/vendors';
  });
  return el('div', null, el('h1', null, id ? v.상호 : '벤더 등록'), id ? el('p', { class: 'lead' }, v.id + ' · 마지막 수정 ' + v.수정일시) : null,
    locked && id ? el('p', { class: 'note' }, '등록된 벤더는 운영기획·관리자만 고칠 수 있습니다.') : null,
    form, locked ? null : el('div', { class: 'actions' }, bSave, el('a', { class: 'btn ghost', href: '#/masters/vendors' }, '목록으로')),
    id && canEdit() ? el('div', { class: 'actions' }, el('a', { class: 'btn', href: '#/contract/new' }, '이 벤더와 계약 만들기')) : null);
}
async function viewWarehouseEdit(id) {
  const list = await cached('warehouse.list');
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
    await api('warehouse.save', payload);
    invalidate('warehouse.list'); toast('저장했습니다.'); location.hash = '#/masters/warehouses';
  });
  return el('div', null, el('h1', null, id ? w.이름 : '창고 등록'),
    el('div', { class: 'form' }, field('창고 이름', f.이름), el('div', { class: 'two' }, field('유형', f.유형), field('상태', f.상태)),
      field('보관 조건', f.보관조건), field('주소', f.주소), field('담당자', f.담당자)),
    isStaff() ? el('div', { class: 'actions' }, bSave, el('a', { class: 'btn ghost', href: '#/masters/warehouses' }, '목록으로')) : null);
}

/* ───────── 더보기 · 공지 · 사용자 · 감사로그 · 설정 ───────── */
function viewMore() {
  const item = (href, t, s) => el('a', { class: 'row', href: href }, el('div', { class: 'main' }, el('div', { class: 't' }, t), s ? el('div', { class: 's' }, s) : null));
  const bOut = el('button', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, '로그아웃')));
  bOut.onclick = async () => { try { await api('auth.logout'); } catch (e) { /* 이미 만료 */ } clearSession(); location.hash = ''; viewLogin('로그아웃했습니다.'); };
  return el('div', null, el('h1', null, '더보기'),
    el('div', { class: 'list' }, item('#/notices', '공지사항', isStaff() ? '등록·수정·삭제' : '읽기'), item('#/password', '비밀번호 바꾸기'),
      isAdmin() ? [item('#/users', '사용자 관리', '계정 추가, 역할, 비밀번호 초기화'), item('#/audit', '감사로그', '누가 언제 무엇을 바꿨는지'), item('#/settings', '회사 정보와 기준값', '계약서에 들어가는 우리 회사 정보')] : null,
      bOut),
    el('h2', null, '2단계에서 열리는 메뉴'),
    el('div', { class: 'list' }, ['주문관리', '매입관리', '비용관리', '매출관리', '정산관리', '손익관리'].map(t => el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't', style: 'color:var(--muted)' }, t)), el('span', { class: 'tag' }, '12월 이후')))),
    el('p', { class: 'lead', style: 'margin-top:16px' }, '화프스 v2.0 · ' + S.user.id + ' (' + S.user.role + ')'));
}
async function viewNotices() {
  const list = await api('notice.list');
  return el('div', null, el('h1', null, '공지사항'),
    isStaff() ? el('div', { class: 'actions' }, el('a', { class: 'btn primary', href: '#/notice/new/edit' }, '공지 쓰기')) : null,
    el('div', { class: 'list' }, list.length ? list.map(n => el('a', { class: 'row', href: '#/notice/' + encodeURIComponent(n.id) },
      el('div', { class: 'main' }, el('div', { class: 't' }, n.제목), el('div', { class: 's' }, n.id + ' · ' + (n.작성자명 || '') + ' · ' + String(n.수정일시).slice(0, 10)))))
      : el('div', { class: 'empty' }, '공지가 없습니다.')));
}
async function viewNotice(id) {
  const n = (await api('notice.list')).find(x => x.id === id);
  if (!n) throw new Error('공지를 찾을 수 없습니다.');
  return el('div', null, el('h1', null, n.제목), el('p', { class: 'lead' }, n.id + ' · ' + (n.작성자명 || '') + ' · ' + n.수정일시),
    el('div', { class: 'form', style: 'white-space:pre-wrap' }, n.내용 || '(내용 없음)'),
    el('div', { class: 'actions' }, el('a', { class: 'btn ghost', href: '#/notices' }, '목록으로'), isStaff() ? el('a', { class: 'btn', href: '#/notice/' + encodeURIComponent(id) + '/edit' }, '고치기') : null));
}
async function viewNoticeEdit(id) {
  if (!isStaff()) throw new Error('공지는 운영기획·관리자가 씁니다.');
  const n = id ? (await api('notice.list')).find(x => x.id === id) : {};
  if (!n) throw new Error('공지를 찾을 수 없습니다.');
  const title = el('input', { value: n.제목 || '' });
  const body = el('textarea', { value: n.내용 || '', rows: 10 });
  const bSave = el('button', { class: 'btn primary' }, id ? '변경 저장' : '공지 올리기');
  bSave.onclick = () => act(bSave, async () => { const d = await api('notice.save', { id: id || undefined, 제목: title.value, 내용: body.value }); toast('공지를 올렸습니다 (' + d.id + ')'); location.hash = '#/notices'; });
  const bDel = el('button', { class: 'btn ghost' }, '공지 지우기');
  bDel.onclick = () => act(bDel, async () => { if (!confirm('이 공지를 지울까요?')) return; await api('notice.delete', { id: id }); toast('지웠습니다.'); location.hash = '#/notices'; });
  return el('div', null, el('h1', null, id ? '공지 고치기' : '공지 쓰기'),
    el('div', { class: 'form' }, field('제목', title), field('내용', body, '글자만 저장됩니다(서식·스크립트는 들어가지 않습니다)')),
    el('div', { class: 'actions' }, bSave, id ? bDel : null));
}
async function viewUsers() {
  if (!isAdmin()) throw new Error('관리자만 볼 수 있습니다.');
  const list = await api('user.list');
  const result = el('div');
  const flash = S.flash; S.flash = null;
  const showTemp = (who, pw) => result.replaceChildren(el('div', { class: 'note' }, who + '의 임시 비밀번호입니다. 지금 한 번만 보입니다. 본인에게 직접 전달하세요.'), el('p', { class: 'secret' }, pw));
  const nid = el('input', { autocapitalize: 'off', placeholder: '영문·숫자 3자 이상' }), nname = el('input'), nrole = select(['MD', '운영기획', '관리자', '조회'], 'MD');
  const bAdd = el('button', { class: 'btn primary' }, '계정 만들기');
  bAdd.onclick = () => act(bAdd, async () => {
    const d = await api('user.save', { isNew: true, id: nid.value.trim(), 이름: nname.value, 역할: nrole.value });
    S.flash = { who: nid.value.trim(), pw: d.tempPassword };
    route();
  });
  const rows = list.map(u => {
    const role = select(['관리자', '운영기획', 'MD', '조회'], u.역할), st = select(['사용', '중지'], u.상태);
    const bSave = el('button', { class: 'btn small' }, '저장');
    bSave.onclick = () => act(bSave, async () => { await api('user.save', { id: u.id, 이름: u.이름, 역할: role.value, 상태: st.value }); toast(u.id + ' 저장 (다음 로그인부터 적용)'); });
    const bReset = el('button', { class: 'btn small ghost' }, '비밀번호 초기화');
    bReset.onclick = () => act(bReset, async () => { if (!confirm(u.id + '의 비밀번호를 초기화할까요?')) return; const d = await api('user.resetPassword', { id: u.id }); showTemp(u.id, d.tempPassword); window.scrollTo(0, 0); });
    return el('div', { class: 'row', style: 'flex-wrap:wrap' }, el('div', { class: 'main' }, el('div', { class: 't' }, u.이름 + ' (' + u.id + ')'), el('div', { class: 's' }, '마지막 수정 ' + u.수정일시)), role, st, bSave, bReset);
  });
  if (flash) showTemp(flash.who, flash.pw);
  return el('div', null, el('h1', null, '사용자 관리'), result,
    el('div', { class: 'form' }, el('div', { class: 'two' }, field('아이디', nid), field('이름', nname)), field('역할', nrole, 'MD: 작성 · 운영기획: 확정·서류 확인 · 조회: 읽기만'), bAdd),
    el('h2', null, '계정 ' + list.length + '개'), el('div', { class: 'list' }, rows));
}
async function viewAudit() {
  if (!isAdmin()) throw new Error('관리자만 볼 수 있습니다.');
  const list = await api('audit.list', { limit: 300 });
  return el('div', null, el('h1', null, '감사로그'), el('p', { class: 'lead' }, '최근 300건, 최신순'),
    el('div', { class: 'list' }, list.length ? list.map(a => el('div', { class: 'row' }, el('div', { class: 'main' },
      el('div', { class: 't' }, a.작업 + (a.대상 ? ' · ' + a.대상 : '')), el('div', { class: 's' }, a.시각 + ' · ' + a.사용자 + (a.내용 ? ' · ' + a.내용 : ''))))) : el('div', { class: 'empty' }, '기록이 없습니다.')));
}
async function viewSettings() {
  if (!isAdmin()) throw new Error('관리자만 볼 수 있습니다.');
  const me = await api('auth.me');
  S.settings = me.settings; saveUser();
  const keys = Object.keys(S.settings);
  return el('div', null, el('h1', null, '회사 정보와 기준값'), el('p', { class: 'lead' }, '회사 정보는 모든 계약서의 "공급받는 자" 칸에 들어갑니다. 이미 확정된 계약서 PDF는 바뀌지 않습니다.'),
    el('div', { class: 'form' }, keys.map(k => {
      const i = el('input', { value: S.settings[k] });
      const b = el('button', { class: 'btn small' }, '저장');
      b.onclick = () => act(b, async () => { S.settings = await api('settings.save', { 키: k, 값: i.value }); saveUser(); toast(keyLabel(k) + ' 저장'); });
      return el('label', { class: 'field' }, el('span', null, keyLabel(k)), el('div', { class: 'inline' }, i, b));
    })));
}

/* ───────── 시작 ───────── */
(async function start() {
  const saved = sessionStorage.getItem('whaps');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      S.token = s.token; S.user = s.user; S.settings = s.settings || {};
      const me = await api('auth.me');
      S.user = me.user; S.settings = me.settings; saveUser();
      renderShell();
      return;
    } catch (e) { clearSession(); }
  }
  viewLogin();
})();
