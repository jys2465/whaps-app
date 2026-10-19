/* 화프스(WHAPS) 화면 v4.0 — 데이터는 모두 서버(Apps Script)를 거칩니다. 화면에는 비밀을 두지 않습니다. */
'use strict';

const S = { token: null, user: null, settings: {}, data: null, detail: {}, wide: false, flash: null };
const STAFF = ['관리자', '운영기획'];
const CONTRACT_STATES = ['작성중', '서명대기', '증빙수집', '완료', '종료'];
const SHIP_METHODS = ['자사배송', '업체배송'];
// FORMS_DEFAULT, CONTRACT_KINDS, KEY_META, compileKind, docsKeys, metaOf, PRODUCT_STATES, ORDER_STATES 등은 templates.js에 있습니다.
const VENDOR_KINDS = ['공급사', 'PB제조사', '물류사', '개발사', '기타'];
// 계약 양식·입력값 정의·상태 목록·계산 함수(compileKind, docsKeys, metaOf, adCalc, termsTable, fmtComma, nextBizDay 등)는 templates.js에 있습니다.

/* ───────── 작은 도구 ───────── */
// 화면 조각을 바꿔 끼울 때 빈 값(null·false)이 "null" 글자로 찍히지 않게, 목록은 펼쳐서 넣습니다.
(function () {
  const rc = Element.prototype.replaceChildren;
  Element.prototype.replaceChildren = function () {
    const kids = [].concat.apply([], Array.prototype.slice.call(arguments).map(k => (Array.isArray(k) ? k.flat(Infinity) : [k])))
      .filter(k => k !== null && k !== undefined && k !== false);
    return rc.apply(this, kids);
  };
})();
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
    dashboard: d.dashboard, choices: d.choices || [], details: d.details || {}, vendor: d.vendor || null,
    forms: d.forms || null, purchases: d.purchases || [], settlements: d.settlements || [], expenses: d.expenses || [], at: d.at, _t: Date.now() };
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

/* ───────── 숫자 칸: 오른쪽 정렬 + 천 단위 쉼표 자동 ───────── */
function numInput(value, attrs) {
  const decimal = attrs && attrs.decimal;
  const i = el('input', Object.assign({ class: 'num', inputmode: decimal ? 'decimal' : 'numeric', autocomplete: 'off', value: fmtComma(value) }, attrs || {}));
  i.removeAttribute('decimal');
  i.addEventListener('input', () => {
    const before = i.value, pos = i.selectionStart || before.length;
    const digitsLeft = before.slice(0, pos).replace(/[^0-9.-]/g, '').length;
    let raw = before.replace(decimal ? /[^0-9.-]/g : /[^0-9-]/g, '');
    if (decimal) { const k = raw.indexOf('.'); if (k >= 0) raw = raw.slice(0, k + 1) + raw.slice(k + 1).replace(/\./g, ''); }
    const out = raw.endsWith('.') ? fmtComma(raw.slice(0, -1)) + '.' : fmtComma(raw);
    if (out === before) return;
    i.value = out;
    let n = 0, p = 0;
    while (p < out.length && n < digitsLeft) { if (/[0-9.-]/.test(out[p])) n++; p++; }
    try { i.setSelectionRange(p, p); } catch (e) { /* 일부 입력 형식은 커서 지정 불가 */ }
  });
  return i;
}
const numCell = (v, unit) => el('span', { class: 'num' }, v === '' || v === null || v === undefined || isNaN(Number(v)) ? '—' : fmtComma(Math.round(Number(v))) + (unit || ''));

/* ───────── 화면 안내: 진행 단계 + 이 화면에서 할 일 ───────── */
function guideBox(g) {
  if (!g) return null;
  return el('div', { class: 'guide', role: 'note' },
    g.steps ? el('ol', { class: 'steps' }, g.steps.map((s, i) => el('li', { class: i === g.cur ? 'on' : (i < g.cur ? 'done' : null) }, el('b', null, String(i + 1)), s))) : null,
    g.desc ? el('p', null, g.desc) : null);
}
const FLOW_CONTRACT = ['종류·상대방 고르기', '입력값 채우기', '확정 (PDF)', '서명 (전자·종이)', '증빙 확인', '완료'];
const FLOW_PRODUCT = ['등록 (판매대기)', '정보·가격 확인', '판매중 (몰 노출)', '판매보류 · 판매종료', '삭제대기 → 삭제'];
const GUIDES = {
  home: { desc: '오늘 처리할 계약·서류와 운영 점검 결과를 모아 보여 줍니다. 항목을 누르면 그 화면으로 갑니다.' },
  contracts: { steps: FLOW_CONTRACT, cur: 0, desc: '도장 모양 상태를 눌러 걸러 봅니다. 새 계약은 "새 계약"에서 시작합니다.' },
  contractEdit: { steps: FLOW_CONTRACT, cur: 1, desc: '계약 종류와 상대방을 고르면 거래형태에 맞는 조항만 들어간 계약서가 오른쪽에 바로 보입니다. 상대방 정보는 벤더 마스터에서 자동으로 들어가고, 회색 글씨는 입력 예시입니다.' },
  products: { steps: FLOW_PRODUCT, cur: 0, desc: '상품을 등록하면 "판매대기"로 시작합니다. 운영기획이 정보를 확인하고 "판매중"으로 바꾸면 몰 노출 대상이 됩니다.' },
  productEdit: { steps: FLOW_PRODUCT, cur: 1, desc: '공급사를 고르면 거래형태가 정해지고, 상품마다 배송방식을 고릅니다. 분류는 대분류 → 중분류 → 소분류 순서로 고르고, 가격을 넣으면 아래 자동 계산이 바로 바뀝니다.' },
  vendors: { steps: ['벤더 등록', '구분·거래형태 정하기', '담당자·연락처·이메일 넣기', '계약 작성'], cur: 0, desc: '계약 상대는 모두 벤더로 등록합니다. 공급사는 거래형태를, 계약서에 들어갈 담당자·연락처·이메일을 꼭 채우세요.' },
  vendorEdit: { steps: ['벤더 등록', '구분·거래형태 정하기', '담당자·연락처·이메일 넣기', '계약 작성'], cur: 1, desc: '사업자등록번호는 검증번호까지 확인합니다. 계좌번호는 운영기획·관리자만 전체를 볼 수 있습니다.' },
  categories: { steps: ['대분류 만들기', '중분류 추가', '소분류 추가', '상품에 연결'], cur: 0, desc: '분류는 3단계 트리입니다. 줄마다 그 분류(하위 포함)에 속한 상품 수를 상태별로 보여 줍니다.' },
  warehouses: { steps: ['창고 등록', '입고 매입에서 선택'], cur: 0, desc: '3PL 센터·샘플실 등 상품을 두는 곳을 등록합니다. 입고 매입을 등록할 때 고릅니다.' },
  orders: { steps: ['아임웹에서 주문 엑셀 내려받기', '화프스에 올리기', '칸 이름·상태 맞추기', '미리보기 점검', '저장'], cur: 1, desc: '아임웹 관리자 → 주문 → 엑셀 다운로드로 받은 파일을 그대로 올립니다. 같은 주문을 다시 올리면 덮어써서 상태만 바뀌고 중복되지 않습니다. 고객 이름·연락처·주소는 저장하지 않습니다.' },
  purchases: { steps: ['입고 등록', '검수 확인', '매입 확정 (운영기획)', '정산에 포함'], cur: 0, desc: '자사배송 직매입 상품이 창고에 들어오면 검수 합격 수량으로 등록합니다. 업체배송 상품은 주문이 구매확정되면 자동으로 매입됩니다.' },
  settle: { steps: ['구분·기간 고르기', '미리보기', '정산서 만들기', '확정', '지급(입금) 완료'], cur: 0, desc: '정산에 넣은 주문·매입에는 정산번호가 붙어 두 번 정산되지 않습니다. 정산 뒤 취소·반품된 주문은 다음 정산에서 자동으로 빼 줍니다(마이너스).' },
  pl: { steps: ['연도 고르기', '월별 매출·원가 확인', '비용 넣기', '영업이익 확인'], cur: 1, desc: '구매확정된 주문으로 계산합니다. 인건비·임차료 같은 비용은 아래에서 월별로 넣습니다.' },
  check: { steps: ['점검 실행', '항목 눌러 고치기', '다시 점검'], cur: 0, desc: '정산·손익이 틀어질 수 있는 빈칸과 불일치를 찾아 줍니다. 빨간 "오류"부터 고치세요.' },
  forms: { steps: ['양식 고르기', '조항 고치기·추가', '미리보기 확인', '저장 (새 판)'], cur: 0, desc: '계약서 문구를 직접 고치는 곳입니다(관리자). 저장하면 새 판이 되고, 이미 확정된 계약서는 바뀌지 않습니다.' },
  formEdit: { steps: ['양식 고르기', '조항 고치기·추가', '미리보기 확인', '저장 (새 판)'], cur: 1, desc: '조항마다 적용 조건(거래형태·배송방식)을 정하면 해당 계약에만 들어갑니다. {{이름}}을 쓰면 계약 작성 화면에 입력칸이 생깁니다.' },
  users: { desc: '계정을 만들면 임시 비밀번호가 한 번만 보입니다. 업체 계정은 계약 화면의 "업체에 전자서명 요청"으로도 만들어집니다.' },
  audit: { desc: '누가 언제 무엇을 바꿨는지 최근 기록부터 보여 줍니다.' },
  settings: { desc: '선택 목록, 직인·로고, 회사 정보와 공휴일(지급일 계산용)을 관리합니다.' },
  notices: { desc: '팀 공지를 올리고 읽습니다.' },
  more: { desc: '자주 쓰지 않는 메뉴와 설정이 모여 있습니다.' },
  password: { desc: '영문과 숫자를 섞어 8자 이상으로 정하세요.' }
};

/* ───────── 엑셀 서식 안내 ───────── */
function excelHelp(kind) {
  const cfg = XL[kind];
  return el('details', { class: 'xlhelp' }, el('summary', null, '엑셀 서식 안내'),
    el('ul', null,
      el('li', null, el('b', null, '내려받기: '), '"화프스_' + cfg.title + '_날짜.xlsx" 파일 하나가 내려옵니다. 첫 시트 "' + cfg.title + '"는 1행이 칸 이름이고 2행부터 한 줄에 한 건이며, 둘째 시트 "작성 안내"에 칸별 쓰는 법이 있습니다.'),
      el('li', null, el('b', null, '올리기: '), '내려받은 파일을 고쳐 그대로 올립니다(.xlsx · .xls · .csv). 1행의 칸 이름은 바꾸지 마세요. id 칸이 비면 새로 등록, 코드가 있으면 그 건을 고칩니다.'),
      el('li', null, el('b', null, '숫자: '), '금액·수량은 숫자로 내려오고 천 단위 쉼표로 보입니다. 올릴 때는 쉼표가 있어도 됩니다. 바코드처럼 0으로 시작하는 코드는 글자 그대로 둡니다.'),
      el('li', null, el('b', null, '안전: '), '한 행이라도 틀리면 아무것도 저장하지 않고 틀린 행 번호와 이유를 보여 줍니다.'),
      el('li', null, el('b', null, '칸: '), cfg.cols.join(' · '))));
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
// 계약서 블록을 화면 요소로 만듭니다(화면 미리보기와 인쇄가 함께 씀). 숫자 칸은 오른쪽 정렬.
function docNodes(tpl, values, settings) {
  const td = (content, head, text) => el('td', { class: (head ? 'h' : '') + (!head && isNumCell(text) ? ' num' : '') || null }, content);
  return tpl.blocks.map(b => {
    if (b.t === 'title') return { t: b.t, node: el('h2', { class: 'doc-title' }, fillNodes(b.x, values, settings)) };
    if (b.t === 'party') {
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
      b.rows.forEach(r => tb.appendChild(el('tr', null, r.map(c => {
        const filled = String(c.x).replace(/\{\{(@?)([^}]+)\}\}/g, (m, at, k) => (at ? settings[k] : values[k]) || '');
        return td(fillNodes(c.x, values, settings), c.h, filled);
      }))));
      return { t: b.t, node: tb };
    }
    if (b.t === 'terms') {
      const tt = values._terms || { title: '상품', head: ['상품코드', '상품명'], rows: [] };
      const rows = tt.rows.length ? tt.rows : [['등록된 상품이 없습니다'].concat(tt.head.slice(1).map(() => ''))];
      const tb = el('table', { class: 'terms' }, el('tr', null, tt.head.map(h => el('td', { class: 'h' }, h))),
        rows.map(r => el('tr', null, r.map(x => td(el('span', { class: 'fv' }, String(x || '')), false, String(x || ''))))));
      return { t: 'table', node: el('div', null, el('p', { class: 'h' }, tt.title), tb) };
    }
    return { t: b.t, node: el('p', { class: b.t === 'p' ? null : b.t }, fillNodes(b.x, values, settings)) };
  });
}
// 여러 문서(계약서 + 별지)를 문서마다 새 쪽에서 시작하게 나누고, 전체 쪽 번호를 붙입니다.
function paginateDocs(docs, values, settings) {
  const pages = [];
  docs.forEach(t => paginate(t, values, settings).forEach(p => pages.push(p)));
  pages.forEach((p, i) => { const n = p.querySelector('.pg-num'); if (n) n.textContent = (i + 1) + ' / ' + pages.length; });
  return pages;
}
function renderPaged(docs, values, settings) {
  const pages = paginateDocs(docs, values, settings);
  const wrap = el('div', { class: 'pages', 'aria-label': '계약서 미리보기', 'data-pages': String(pages.length) }, pages);
  requestAnimationFrame(() => fitPages(wrap));
  return wrap;
}
async function printDoc(docs, values, settings) {
  const prev = document.getElementById('print-root');
  if (prev) prev.remove();
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const root = el('div', { id: 'print-root', 'aria-hidden': 'true' }, paginateDocs(docs, values, settings));
  document.body.appendChild(root);
  await Promise.all(Array.from(root.querySelectorAll('img')).map(img => (img.complete ? null : new Promise(r => { img.onload = r; img.onerror = r; }))));
  const cleanup = () => { root.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
function choicesFor(kind, trade) {
  const m = {};
  ((S.data && S.data.choices) || []).forEach(c => {
    if (c.계약종류 && c.계약종류 !== kind && c.계약종류 !== trade) return;
    (m[c.키] = m[c.키] || []).push(c.값);
  });
  return m;
}
const vendorTrade = v => (v ? (v.구분 === 'PB제조사' ? '직매입' : (v.거래형태 || '')) : '');
function partyValues(vendor) {
  const masked = s => /\*/.test(String(s || ''));
  const m = { 상대_상호: vendor.상호, 상대_사업자등록번호: vendor.사업자등록번호, 상대_주소: vendor.사업장주소, 상대_대표자: vendor.대표자,
    상대_담당자: vendor.담당자, 상대_연락처: vendor.연락처, 상대_이메일: vendor.이메일, 거래형태: vendorTrade(vendor) };
  const out = {};
  Object.keys(m).forEach(k => { out[k] = m[k] && !masked(m[k]) ? m[k] : ''; });
  return out;
}
const keyLabel = k => metaOf(k).label || k.replace(/^@/, '').replace(/_/g, ' ');
// 미리보기용 값: 입력값 + 상대방 정보 + 광고료 계산 + 거래조건표
function previewValues(vendor, docs, values) {
  const v = Object.assign({}, values);
  if (vendor) Object.assign(v, partyValues(vendor));
  const keys = docsKeys(docs);
  keys.forEach(k => { if (metaOf(k).t === 'won' && v[k]) v[k] = fmtComma(v[k]); });
  if (keys.includes('광고료_총액')) {
    const r = adCalc(v.광고_시작일, v.광고_종료일, v.광고_일단가);
    v.광고_게재일수 = r ? String(r.days) : '';
    v.광고료_총액 = r && v.광고_일단가 ? fmtComma(r.total) : '';
  }
  if (vendor && docs.some(d => d.blocks.some(b => b.t === 'terms'))) v._terms = termsTable(vendorTrade(vendor), ((S.data && S.data.products) || []).filter(p => p.공급사코드 === vendor.id), v);
  if (keys.includes('거래조건표_번호') && !v.거래조건표_번호) v.거래조건표_번호 = '확정 때 자동';
  return v;
}
// 확정된 계약은 확정 때 저장한 양식으로, 작성 중이면 지금 양식으로 문서를 만듭니다.
function docsOfDetail(d) {
  const forms = d.values._forms || (S.data && S.data.forms) || FORMS_DEFAULT;
  return compileKind(d.contract.종류, forms, d.values._ctx || {});
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
  ops: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
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
    : [['#/home', 'home', '홈'], ['#/contracts', 'contract', '계약'], ['#/products', 'product', '상품'], ['#/ops/orders', 'ops', '운영'], ['#/masters/vendors', 'master', '마스터'], ['#/more', 'more', '더보기']];
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
      isAdmin() ? [item('#/forms', '계약서 양식 관리', '조항 추가·문구 수정·적용 조건 (관리자)'), item('#/users', '사용자 관리', '계정 추가, 역할, 업체 계정, 비밀번호 초기화'), item('#/audit', '감사로그', '누가 언제 무엇을 바꿨는지')] : null,
      isStaff() ? item('#/settings', '회사 정보·선택 목록·로고·직인', '계약서에 들어가는 우리 회사 정보와 키값 목록') : null),
    el('h2', null, '운영'),
    el('div', { class: 'list' }, item('#/ops/orders', '주문', '아임웹 주문 엑셀 올리기·조회'), item('#/ops/purchases', '매입', '자사배송 입고 등록·확정'), isStaff() ? [item('#/ops/settle', '정산', '직매입·위탁판매·광고료'), item('#/ops/pl', '손익', '월별 매출·원가·영업이익'), item('#/ops/check', '데이터 점검', '연동 오류 찾기')] : null),
    el('p', { class: 'lead', style: 'margin-top:16px' }, '화프스 v4.0 · ' + S.user.id + ' (' + S.user.role + ')'));
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
const contractGuide = m => { const d = S.data && S.data.details && S.data.details[decodeURIComponent(m[1])]; const st = d && d.contract.상태; return { steps: FLOW_CONTRACT, cur: { 서명대기: 3, 증빙수집: 4, 완료: 5, 종료: 5 }[st] || 2, desc: st === '서명대기' ? '전자서명을 요청하거나 PDF를 출력해 서명받습니다. 종이로 했다면 스캔본을 올리고 늦게 서명한 날짜를 체결일로 넣습니다.' : '서명이 끝나면 필요한 서류를 확인하고 계약 완료로 처리합니다.' }; };
const ROUTES = [
  [/^#\/home$/, () => viewHome(), 'home'],
  [/^#\/contracts(?:\/([^/]+))?$/, m => viewContracts(m[1] ? decodeURIComponent(m[1]) : ''), 'contracts'],
  [/^#\/contract\/new$/, () => viewContractEdit(null), 'contractEdit'],
  [/^#\/contract\/([^/]+)\/edit$/, m => viewContractEdit(decodeURIComponent(m[1])), 'contractEdit'],
  [/^#\/contract\/([^/]+)$/, m => viewContract(decodeURIComponent(m[1])), m => (isVendor() ? null : contractGuide(m))],
  [/^#\/products(?:\/([^/]+))?$/, m => viewProducts(m[1] ? decodeURIComponent(m[1]) : ''), 'products'],
  [/^#\/product\/([^/]+)$/, m => viewProductEdit(m[1] === 'new' ? null : decodeURIComponent(m[1])), 'productEdit'],
  [/^#\/masters\/(vendors|categories|warehouses)$/, m => viewMasters(m[1]), m => m[1]],
  [/^#\/vendor\/([^/]+)$/, m => viewVendorEdit(m[1] === 'new' ? null : decodeURIComponent(m[1])), 'vendorEdit'],
  [/^#\/warehouse\/([^/]+)$/, m => viewWarehouseEdit(m[1] === 'new' ? null : decodeURIComponent(m[1])), 'warehouses'],
  [/^#\/ops\/?$/, () => { location.hash = '#/ops/orders'; return null; }],
  [/^#\/ops\/orders$/, () => viewOrders(), 'orders'],
  [/^#\/ops\/purchases$/, () => viewPurchases(), 'purchases'],
  [/^#\/ops\/settle$/, () => viewSettle(), 'settle'],
  [/^#\/ops\/settle\/([^/]+)$/, m => viewSettleOne(decodeURIComponent(m[1]))],
  [/^#\/ops\/pl$/, () => viewPL(), 'pl'],
  [/^#\/ops\/check$/, () => viewCheck(), 'check'],
  [/^#\/forms$/, () => viewForms(), 'forms'],
  [/^#\/form\/([^/]+)$/, m => viewFormEdit(decodeURIComponent(m[1])), 'formEdit'],
  [/^#\/more$/, () => viewMore(), 'more'],
  [/^#\/notices$/, () => viewNotices(), 'notices'],
  [/^#\/notice\/([^/]+)\/edit$/, m => viewNoticeEdit(m[1] === 'new' ? null : decodeURIComponent(m[1])), 'notices'],
  [/^#\/notice\/([^/]+)$/, m => viewNotice(decodeURIComponent(m[1]))],
  [/^#\/users$/, () => viewUsers(), 'users'],
  [/^#\/audit$/, () => viewAudit(), 'audit'],
  [/^#\/settings$/, () => viewSettings(), 'settings'],
  [/^#\/password$/, () => viewPassword(), 'password']
];
// 화면 제목 바로 아래에 진행 단계와 안내를 붙입니다.
function withGuide(node, key, m) {
  if (!node || !key) return node;
  const g = typeof key === 'function' ? key(m) : key;
  const info = typeof g === 'string' ? GUIDES[g] : g;
  if (!info) return node;
  const h1 = node.querySelector && node.querySelector('h1');
  const box = guideBox(info);
  if (h1 && h1.parentNode) h1.parentNode.insertBefore(box, h1.nextSibling); else node.prepend(box);
  return node;
}
async function route(silent) {
  if (!S.token) return viewLogin();
  const main = $('#main');
  if (!main) return renderShell();
  let h = location.hash || '#/home';
  if (S.user.mustChange && h !== '#/password') { location.hash = '#/password'; return; }
  if (isVendor() && !/^#\/(home|contract\/[^/]+|more|password)$/.test(h)) { location.hash = '#/home'; return; }
  const base = h.split('/')[1];
  const alias = { contract: 'contracts', product: 'products', vendor: 'masters', warehouse: 'masters', notices: 'more', notice: 'more', users: 'more', audit: 'more', settings: 'more', password: 'more', forms: 'more', form: 'more' };
  document.querySelectorAll('nav.tabs a').forEach(a => a.classList.toggle('on', a.dataset.base === (alias[base] || base)));
  for (const [re, fn, gk] of ROUTES) {
    const m = h.match(re);
    if (!m) continue;
    S.wide = false;
    const slow = silent === true ? null : setTimeout(() => main.replaceChildren(el('div', { class: 'empty' }, '불러오는 중…')), 200);
    try {
      const node = withGuide(await fn(m), gk, m);
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
  categories: { title: '분류', action: 'category.import', need: '대분류', nums: ['순서'], cols: ['id', '단계', '대분류', '중분류', '소분류', '노출', '순서'],
    guide: { id: '비우면 대·중·소 경로를 따라 없는 분류를 만듦. 코드(K001)를 넣으면 그 분류의 이름·노출·순서를 고침', 단계: '내려받을 때 참고용(올릴 때는 무시)', 대분류: '필수', 중분류: '중분류를 만들 때', 소분류: '소분류를 만들 때', 노출: 'Y / N', 순서: '같은 단계 안의 순서(숫자)' } },
  warehouses: { title: '창고', action: 'warehouse.import', need: '이름', cols: ['id', '이름', '유형', '보관조건', '주소', '담당자', '상태'],
    guide: { id: '비우면 새로 등록, W01 같은 코드를 넣으면 수정', 이름: '필수', 유형: '3PL센터 / 샘플실 / 사무실 보관 / 기타', 상태: '사용 / 중지' } },
  products: { title: '상품', action: 'product.import', need: '상품명', nums: ['박스입수', '공급가', '수수료율', '일반회원가', '구독회원가'], cols: ['id', '상태', '상품명', '공급사코드', '몰상품코드', '브랜드구분', '분류ID', '대분류', '중분류', '소분류', '배송방식', '규격', '납품단위', '판매단위', '바코드', '박스코드', '박스입수', '소비기한', '보관', '과세구분', '공급가', '수수료율', '일반회원가', '구독회원가', '제조원', '거래조건', '배송비부담', '연결주소', '회원혜택', '메모'],
    guide: { id: '비우면 새로 등록, P0001 같은 코드를 넣으면 수정', 상태: PRODUCT_STATES.join(' / ') + ' (MD는 판매대기·삭제대기만)', 상품명: '필수', 몰상품코드: '아임웹 자체상품코드(주문 연결에 씀, 상품마다 달라야 함)', 공급사코드: '벤더 코드(V0001). 거래형태는 공급사에서 자동', 브랜드구분: 'NB / PB', 분류ID: '분류 코드(K001). 비우면 대·중·소 이름으로 찾음', 배송방식: SHIP_METHODS.join(' / ') + ' (직매입·위탁판매만)', 보관: '상온 / 냉장 / 냉동', 과세구분: '과세 / 면세', 공급가: '숫자, VAT 별도 (직매입)', 수수료율: '% 숫자 (위탁판매)', 바코드: '숫자 그대로(앞자리 0 유지)', 연결주소: '제휴입점 상품의 판매 페이지', 회원혜택: '제휴입점 회원 전용 혜택' } }
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
  const walk = pid => t.kids(pid).forEach(n => { const p = t.path(n.id); out.push({ id: n.id, 단계: n.단계, 대분류: p[0] || '', 중분류: p[1] || '', 소분류: p[2] || '', 노출: n.노출, 순서: n.순서 }); walk(n.id); });
  walk('');
  return out;
}

/* ───────── 상품 ───────── */
async function viewProducts(state) {
  const data = await ensureData();
  const all = data.products;
  const vname = id => { const v = data.vendors.find(x => x.id === id); return v ? v.상호 : '공급사 미정'; };
  const cnt = st => all.filter(p => p.상태 === st).length;
  const cur = state && PRODUCT_STATES.includes(state) ? state : '';
  const list = all.filter(p => (cur ? p.상태 === cur : p.상태 !== '삭제'));
  const q = el('input', { type: 'search', placeholder: '상품명·코드·몰상품코드·바코드 검색', 'aria-label': '상품 검색' });
  const box = el('div', { class: 'list' });
  const draw = () => {
    const sq = q.value.trim();
    const rows = list.filter(p => !sq || (p.상품명 + p.id + (p.몰상품코드 || '') + (p.바코드 || '')).includes(sq));
    box.replaceChildren(...(rows.length ? rows.map(p => el('a', { class: 'row', href: '#/product/' + encodeURIComponent(p.id) },
      el('div', { class: 'main' }, el('div', { class: 't' }, p.상품명), el('div', { class: 's' }, p.id + (p.몰상품코드 ? ' · ' + p.몰상품코드 : '') + ' · ' + vname(p.공급사코드) + ' · ' + (p.거래형태 || '거래형태 미정') + (p.배송방식 ? ' · ' + p.배송방식 : ''))),
      el('div', { class: 'amt' }, el('small', null, '일반가'), numCell(p.일반회원가, '원')),
      el('span', { class: 'tag' + (p.상태 === '판매중' ? ' ok' : (['삭제대기', '삭제', '판매종료'].includes(p.상태) ? ' no' : '')) }, p.상태)))
      : [el('div', { class: 'empty' }, all.length ? '해당하는 상품이 없습니다.' : '아직 등록된 상품이 없습니다.')]));
  };
  q.addEventListener('input', draw);
  draw();
  const chip = (st, label, n) => el('a', { class: 'chip' + (st === cur ? ' on' : ''), href: '#/products' + (st ? '/' + encodeURIComponent(st) : ''), title: st ? PRODUCT_STATE_INFO[st] : '삭제를 뺀 전체' }, label + ' ' + n);
  return el('div', null, el('h1', null, '상품'),
    el('div', { class: 'chips' }, chip('', '전체', all.filter(p => p.상태 !== '삭제').length), PRODUCT_STATES.map(st => chip(st, st, cnt(st)))),
    cur ? el('p', { class: 'lead' }, cur + ': ' + PRODUCT_STATE_INFO[cur]) : null,
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
  const p = id ? data.products.find(x => x.id === id) : { 상태: '판매대기', 과세구분: '과세', 보관: '상온', 브랜드구분: 'NB', 배송방식: '자사배송' };
  if (!p) throw new Error('상품을 찾을 수 없습니다: ' + id);
  const ro = !canEdit() || (id && p.상태 !== '판매대기' && !isStaff());
  const f = {};
  const inp = (k, attrs) => (f[k] = el('input', Object.assign({ value: p[k] || '' }, attrs || {})));
  const sel = (k, opts) => (f[k] = select(opts, p[k] || (Array.isArray(opts[0]) ? opts[0][0] : opts[0])));
  const numf = (k, attrs) => (f[k] = numInput(p[k] || '', attrs || {}));
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
  const costField = field('공급가 (원, VAT 별도)', numf('공급가'), '직매입');
  const feeField = field('수수료율 (%)', numf('수수료율', { decimal: true }), '위탁판매 · 결제금액 기준');
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
    const cell = (label, val, bad) => el('div', null, el('small', null, label), el('b', { class: 'num' + (bad ? ' bad' : '') }, val));
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
    el('div', { class: 'two' }, field('공급사', f.공급사코드), field('상태', sel('상태', isStaff() ? PRODUCT_STATES : (p.상태 === '판매대기' || !id ? ['판매대기', '삭제대기'] : [p.상태])), PRODUCT_STATE_INFO[p.상태 || '판매대기'])),
    field('몰상품코드 (아임웹 자체상품코드)', inp('몰상품코드', { placeholder: '예) IM-10023', autocapitalize: 'off' }), '주문 엑셀을 올릴 때 이 코드로 상품을 찾습니다. 상품마다 달라야 합니다.'),
    tradeLine,
    el('div', { class: 'two' }, shipField, field('브랜드 구분', sel('브랜드구분', ['NB', 'PB']))),
    el('label', { class: 'field' }, el('span', null, '분류 (대 → 중 → 소)'), el('div', { class: 'inline cats' }, cs[0], cs[1], cs[2])),
    el('div', { class: 'two' }, field('규격', inp('규격', { placeholder: '3kg 박스(10개 내외)' })), field('판매단위', inp('판매단위', { placeholder: '1박스' }))),
    el('div', { class: 'two' }, field('납품단위', inp('납품단위', { placeholder: '10박스' })), field('박스당 입수', numf('박스입수'))),
    el('div', { class: 'two' }, field('상품 바코드', inp('바코드', { inputmode: 'numeric' })), field('박스 코드', inp('박스코드', { inputmode: 'numeric' }))),
    el('div', { class: 'two' }, field('소비기한', inp('소비기한', { placeholder: '제조일로부터 6개월' })), field('보관', sel('보관', ['상온', '냉장', '냉동']))),
    el('div', { class: 'two' }, field('제조원 (표시사항)', inp('제조원', { placeholder: '예) ○○식품(주)' })), field('과세 구분', sel('과세구분', ['과세', '면세']))),
    el('div', { class: 'two' }, costField, feeField),
    el('div', { class: 'two' }, field('일반회원가 (원)', numf('일반회원가')), field('구독회원가 (원)', numf('구독회원가'))),
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
    ro && canEdit() ? el('p', { class: 'note' }, p.상태 + ' 상태의 상품은 운영기획·관리자만 고칠 수 있습니다. 삭제가 필요하면 운영기획에 요청하세요.') : null,
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
    const under = id => { const out = [id]; for (let i = 0; i < out.length; i++) t.nodes.forEach(n => { if (n.상위ID === out[i]) out.push(n.id); }); return out; };
    const counts = id => { const ids = under(id); const c = { 전체: 0 }; PRODUCT_STATES.forEach(st => { c[st] = 0; }); data.products.forEach(x => { if (ids.includes(x.분류ID)) { c[x.상태] = (c[x.상태] || 0) + 1; if (x.상태 !== '삭제') c.전체++; } }); return c; };
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
      const c = counts(n.id);
      return el('div', { class: 'row tree l' + lv }, el('div', { class: 'main' }, el('div', { class: 't' }, n.이름, el('span', { class: 'cnt' }, ' 상품 ' + c.전체)),
        el('div', { class: 's' }, n.id + ' · ' + ['대', '중', '소'][lv - 1] + '분류'),
        el('div', { class: 'cnts' }, PRODUCT_STATES.map(st => el('span', { class: c[st] ? 'on' : null, title: PRODUCT_STATE_INFO[st] }, st + ' ' + c[st])))),
        el('span', { class: 'tag' }, n.노출 === 'Y' ? '노출' : '숨김'), btns);
    };
    const rows = [];
    const walk = pid => t.kids(pid).forEach(n => { rows.push(nodeRow(n)); walk(n.id); });
    walk('');
    const nm = el('input', { placeholder: '예) 신선식품' });
    const bAdd = el('button', { class: 'btn primary' }, '대분류 추가');
    bAdd.onclick = () => act(bAdd, () => save({ 이름: nm.value }, '대분류를 추가했습니다.'));
    appendKids(head, excelBar('categories'),
      isStaff() ? el('div', { class: 'form' }, field('새 대분류', nm), bAdd, el('small', null, '중분류·소분류는 아래 목록의 "추가" 버튼으로 만듭니다.')) : null,
      el('p', { class: 'lead' }, '분류별 상품 수는 하위 분류까지 합친 수입니다. 상태 이름에 손을 올리면 뜻이 보이고, 전체 수에는 삭제한 상품을 넣지 않습니다.'),
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
  const numIdx = (cfg.nums || []).map(c => cfg.cols.indexOf(c));
  Object.keys(ws).forEach(k => {
    if (k[0] === '!') return;
    const a = XLSX.utils.decode_cell(k);
    const v = String(ws[k].v === undefined ? '' : ws[k].v);
    if (a.r > 0 && numIdx.includes(a.c) && v !== '' && !isNaN(Number(v.replace(/,/g, '')))) { ws[k] = { t: 'n', v: Number(v.replace(/,/g, '')), z: cfg.cols[a.c] === '수수료율' ? '0.##' : '#,##0' }; }
    else { ws[k].t = 's'; ws[k].v = v; }
  });
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
  const inp = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', class: 'sr' });
  const bUp = el('button', { class: 'btn small ghost' }, '엑셀 올리기');
  bUp.onclick = () => inp.click();
  inp.onchange = () => act(bUp, async () => { out.replaceChildren(); const f = inp.files[0]; inp.value = ''; if (f) await importExcel(kind, f, out); });
  return el('div', null, el('div', { class: 'actions', style: 'margin:8px 0' }, bDown, isStaff() ? [bUp, inp] : null), excelHelp(kind), out);
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
  const opt = Object.assign({ 자사배송: false, 업체배송: false }, values._opt || {});
  const vendor = () => vendors.find(v => v.id === vendorId);
  const trade = () => vendorTrade(vendor());
  const shipsOn = () => !!CONTRACT_KINDS[kind].ship && ['직매입', '위탁판매'].includes(trade());
  const ctx = () => ({ trade: trade(), ships: shipsOn() ? SHIP_TAGS.filter(s => opt[s]) : [] });
  const docs = () => (vendor() ? compileKind(kind, data.forms || FORMS_DEFAULT, ctx()) : []);
  const fieldsBox = el('div', { class: 'form' }), optBox = el('div'), partyBox = el('div'), venWrap = el('div');
  const preview = el('div', { class: 'preview-wrap' });
  const status = el('p', { class: 'note' });
  const kindSel = select(Object.keys(CONTRACT_KINDS).map(k => [k, CONTRACT_KINDS[k].name]), kind, { onchange: () => { kind = kindSel.value; buildVendorSel(); rebuild(); } });
  const kindHint = el('small');
  let venSel;
  function buildVendorSel() {
    const allowed = CONTRACT_KINDS[kind].party;
    const need = CONTRACT_KINDS[kind].trade;
    const list = vendors.filter(v => allowed.includes(v.구분) && (!need || vendorTrade(v) === need));
    if (!list.some(v => v.id === vendorId)) vendorId = '';
    venSel = select([['', list.length ? '상대방을 고르세요' : (need ? need + ' ' : '') + allowed.join('·') + ' 벤더를 먼저 등록하세요']].concat(list.map(v => [v.id, v.상호 + ' (' + v.id + (vendorTrade(v) ? ', ' + vendorTrade(v) : '') + ')'])), vendorId,
      { onchange: () => { vendorId = venSel.value; defaultOpt(); rebuild(); } });
    venWrap.replaceChildren(field('상대방 (' + (need ? need + ' ' : '') + allowed.join('·') + ')', venSel, '상대방 정보는 벤더 마스터에서 가져옵니다'));
    kindHint.textContent = CONTRACT_KINDS[kind].desc || '';
  }
  function defaultOpt() {
    if (!shipsOn() || opt.자사배송 || opt.업체배송) return;
    const ps = data.products.filter(p => p.공급사코드 === vendorId && SELLABLE.includes(p.상태));
    opt.자사배송 = !ps.length || ps.some(p => p.배송방식 === '자사배송');
    opt.업체배송 = ps.some(p => p.배송방식 === '업체배송');
  }
  function buildOpt() {
    const v = vendor(), items = [];
    if (v && CONTRACT_KINDS[kind].party.includes('공급사') && !trade()) {
      items.push(el('p', { class: 'note warn' }, '이 벤더의 거래형태가 정해지지 않았습니다. ', el('a', { href: '#/vendor/' + encodeURIComponent(v.id) }, '벤더 정보에서 거래형태를 정하세요.')));
    }
    if (shipsOn()) {
      const ck = (k, label) => { const c = el('input', { type: 'checkbox', checked: !!opt[k] }); c.onchange = () => { opt[k] = c.checked; rebuild(); }; return el('label', { class: 'check' }, c, label); };
      items.push(el('div', { class: 'checks' }, el('span', { class: 's' }, '배송방식'), ck('자사배송', '자사배송 (우리 창고 출고)'), ck('업체배송', '업체배송 (공급사 직배송)')));
    }
    const ds = docs();
    items.push(el('p', { class: 'lead' }, ds.length ? '들어가는 문서: ' + ds.map(d => d.title).join(' + ') + ' · 조항 ' + ds[0].blocks.filter(b => b.t === 'h').length + '개' : '상대방을 고르면 계약서가 만들어집니다.'));
    optBox.replaceChildren(...items);
  }
  function inputFor(k) {
    const m = metaOf(k);
    const ch = choicesFor(kind, trade())[k] || [];
    if (m.t === 'select') {
      if (ch.length === 1 && !values[k] && !m.custom) values[k] = ch[0];
      const extra = (m.na ? [[m.na, m.na]] : []).concat(m.custom ? [['__custom', '직접 입력…']] : []);
      const isCustom = values[k] && !ch.includes(values[k]) && values[k] !== m.na;
      const s = select((ch.length === 1 && !m.custom ? [] : [['', '선택하세요']]).concat(ch.map(v => [v, v])).concat(extra), isCustom ? '__custom' : (values[k] || ''));
      const free = el('input', { value: isCustom ? values[k] : '', placeholder: m.ex ? '예) ' + m.ex : '', style: isCustom ? '' : 'display:none', 'aria-label': m.label + ' 직접 입력' });
      s.addEventListener('change', () => {
        free.style.display = s.value === '__custom' ? '' : 'none';
        values[k] = s.value === '__custom' ? free.value.trim() : s.value;
        if (s.value === '__custom') free.focus();
        refresh();
      });
      free.addEventListener('input', () => { values[k] = free.value.trim(); refresh(); });
      return field(m.label, el('div', { class: 'stack' }, s, free), ch.length ? (m.custom ? '목록에서 고르거나 "직접 입력"을 고릅니다' : (ch.length === 1 ? '지금은 선택지가 하나입니다' : '목록에서 고릅니다')) : '설정에서 선택 목록을 먼저 만드세요');
    }
    if (m.t === 'textarea') {
      const ta = el('textarea', { value: values[k] || '', rows: 4, placeholder: '예) ' + (m.ex || '') });
      ta.addEventListener('input', () => { values[k] = ta.value; refresh(); });
      return field(m.label, ta, '줄마다 적습니다. 비워 두면 계약서에 "없음"으로 들어갑니다.');
    }
    if (m.t === 'calc' || m.t === 'auto') return null;
    const inp = m.t === 'won' ? numInput(values[k] || '', { placeholder: m.ex ? '예) ' + fmtComma(m.ex) : '', 'aria-label': m.label })
      : el('input', { type: m.t === 'date' ? 'date' : 'text', value: values[k] || '', placeholder: m.ex ? '예) ' + m.ex : '', 'aria-label': m.label });
    inp.addEventListener('input', () => { values[k] = m.t === 'won' ? fmtComma(inp.value) : inp.value.trim(); refresh(); });
    return field(m.label + (KEY_META[k] ? '' : ' (양식에 새로 추가된 칸)'), inp, m.t === 'won' ? '숫자만 넣으면 쉼표가 붙습니다' : null);
  }
  function buildFields() {
    const keys = docsKeys(docs());
    const pv = vendor() ? partyValues(vendor()) : {};
    const autos = keys.filter(k => metaOf(k).t === 'auto' && k in pv);
    const missing = autos.filter(k => !pv[k]);
    partyBox.replaceChildren(vendor() ? el('div', { class: 'form' },
      el('div', { class: 's' }, '상대방 정보 (벤더 마스터에서 자동)'),
      el('div', { class: 'kv' }, autos.map(k => el('div', null, el('small', null, keyLabel(k).replace('상대방 ', '')), el('b', { class: pv[k] ? null : 'bad' }, pv[k] || '비어 있음')))),
      missing.length ? el('p', { class: 'note warn' }, '비어 있는 정보가 있어 확정할 수 없습니다. ', el('a', { href: '#/vendor/' + encodeURIComponent(vendorId) }, '벤더 정보 채우기')) : null) : null);
    const calc = keys.filter(k => metaOf(k).t === 'calc');
    fieldsBox.replaceChildren(...keys.map(inputFor).filter(Boolean),
      calc.length ? el('p', { class: 'note', id: 'calcline' }) : null,
      keys.includes('거래조건표_번호') ? el('p', { class: 'lead' }, '별지 1 거래조건표는 이 공급사의 상품 정보(판매대기·판매중·판매보류)로 자동으로 만들어지고, 번호는 확정할 때 계약번호로 붙습니다.') : null);
  }
  let pageTimer = null;
  function refresh() {
    const ds = docs();
    const pv = previewValues(vendor(), ds, values);
    const cl = document.getElementById('calcline');
    if (cl) { const r = adCalc(pv.광고_시작일, pv.광고_종료일, pv.광고_일단가); cl.textContent = r && pv.광고료_총액 ? '게재 ' + r.days + '일 · 할인율 ' + Math.round(r.rate * 100) + '% · 광고료 총액 ' + pv.광고료_총액 + '원(VAT 별도)' : '게재 시작일·종료일과 일 단가를 넣으면 광고료가 자동 계산됩니다.'; }
    clearTimeout(pageTimer);
    pageTimer = setTimeout(() => {
      preview.replaceChildren(ds.length ? renderPaged(ds, pv, S.settings) : el('div', { class: 'empty' }, '계약 종류와 상대방을 고르면 미리보기가 나옵니다.'));
      const pg = preview.querySelector('.pages');
      const n = pg ? pg.querySelectorAll('.pg').length : 0;
      const body = pg ? paginate(ds[0], pv, S.settings).length : 0;
      preview.prepend(el('p', { class: 'note' + (body > 3 ? ' warn' : '') }, '계약서 본문 ' + body + '쪽' + (n > body ? ' + 별지 ' + (n - body) + '쪽' : '') + (body > 3 ? ' — 3쪽을 넘습니다. 특약사항을 줄이거나 양식을 다듬으세요.' : '')));
    }, 150);
    const keys = docsKeys(ds);
    const empty = keys.filter(k => { const m = metaOf(k); return !m.opt && m.t !== 'auto' && m.t !== 'calc' && !values[k]; }).length;
    status.textContent = !ds.length ? '상대방을 고르세요.' : (empty ? '빈 칸 ' + empty + '개 — 미리보기에 노란색으로 표시됩니다.' : '모든 칸이 채워졌습니다. 계약일은 서명할 때 정해집니다.');
    status.className = 'note' + (empty || !ds.length ? ' warn' : '');
  }
  function rebuild() { buildOpt(); buildFields(); refresh(); }
  const pick = () => { const o = {}; docsKeys(docs()).forEach(k => { const m = metaOf(k); if (m.t !== 'auto' && m.t !== 'calc') o[k] = values[k] || ''; }); return o; };
  async function save() {
    if (!vendorId) throw new Error('상대방(벤더)을 먼저 고르세요.');
    const d = await api('contract.saveDraft', { id: curId, 종류: kind, 벤더코드: vendorId, opt: opt, values: pick() });
    curId = d.id;
    upsert('contracts', d);
    rememberDetail({ contract: d, values: Object.assign(pick(), { _opt: opt, _ctx: ctx() }), attachments: [], checklist: [] });
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
  bPrint.onclick = () => act(bPrint, () => printDoc(docs(), previewValues(vendor(), docs(), values), S.settings));
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
        el('div', { class: 'form' }, field('계약 종류', kindSel), kindHint, venWrap, optBox),
        partyBox,
        el('h2', null, '입력값'), status, fieldsBox,
        el('div', { class: 'actions' }, bSave, isStaff() ? bConfirm : null, bPrint, bDel),
        isStaff() ? null : el('p', { class: 'note' }, '확정은 운영기획·관리자가 합니다. 임시저장한 뒤 알려 주세요.'),
        isAdmin() ? el('p', { class: 'lead' }, '조항 문구를 바꾸려면 ', el('a', { href: '#/forms' }, '더보기 → 계약서 양식 관리'), '에서 고칩니다.') : null),
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
  const parts = docsOfDetail(d);
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
  const parts = docsOfDetail(d);
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
      info('구성', parts.map(p => p.title).join(' + ') + (String(c.구성 || '').includes('/') ? ' · ' + String(c.구성).split('/')[1].trim() : '') + (d.values._formVer ? ' · 양식 ' + Object.keys(d.values._formVer).map(k => k + (d.values._formVer[k] ? ' v' + d.values._formVer[k] : ' 기본')).join(', ') : '')),
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
/* ───────── 운영: 주문 · 매입 · 정산 · 손익 · 점검 ───────── */
function opsTabs(cur) {
  return el('div', { class: 'chips' }, [['orders', '주문'], ['purchases', '매입'], ['settle', '정산'], ['pl', '손익'], ['check', '데이터 점검']]
    .filter(([k]) => isStaff() || ['orders', 'purchases'].includes(k))
    .map(([k, t]) => el('a', { class: 'chip' + (k === cur ? ' on' : ''), href: '#/ops/' + k }, t)));
}
const kd = d => new Date(Date.now() + 9 * 3600000 - (d || 0) * 86400000).toISOString().slice(0, 10);
function gridTable(head, rows, numCols) {
  numCols = numCols || [];
  return el('div', { class: 'gridwrap' }, el('table', { class: 'grid' },
    el('thead', null, el('tr', null, head.map((h, i) => el('th', { class: numCols.includes(i) ? 'num' : null }, h)))),
    el('tbody', null, rows.length ? rows.map(r => el('tr', null, r.map((c, i) => el('td', { class: numCols.includes(i) ? 'num' : null }, typeof c === 'number' ? fmtComma(c) : c))))
      : el('tr', null, el('td', { colspan: String(head.length), class: 'empty' }, '없습니다.')))));
}

/* 주문: 아임웹 엑셀 → 칸 맞추기 → 미리보기 → 저장 */
const ORDER_FIELDS = [
  ['품목키', '품목 주문번호', ['품목주문번호', '상품주문번호', '주문상품번호', '품목 주문번호', '주문품목번호', '품목번호'], false],
  ['주문번호', '주문번호', ['주문번호', '주문 번호', '주문코드'], true],
  ['주문일시', '주문일', ['주문일시', '주문일', '주문 일시', '주문날짜', '주문 날짜'], true],
  ['결제일시', '결제일', ['결제일시', '결제일', '결제 일시'], false],
  ['주문상태', '주문상태', ['품목주문상태', '품목 주문상태', '주문상태', '주문 상태', '처리상태', '상태'], true],
  ['몰상품코드', '상품코드', ['자체상품코드', '판매자상품코드', '상품코드', '상품번호', '품목코드'], false],
  ['상품명', '상품명', ['상품명', '품목명', '상품 이름'], true],
  ['옵션', '옵션', ['옵션', '옵션명', '옵션정보', '선택옵션'], false],
  ['수량', '수량', ['수량', '주문수량', '구매수량'], true],
  ['판매단가', '판매가', ['판매가', '판매단가', '상품가격', '단가'], false],
  ['상품금액', '상품금액', ['상품금액', '상품합계', '상품구매금액', '상품 금액', '주문금액'], false],
  ['할인금액', '할인금액', ['할인금액', '총할인금액', '쿠폰할인', '상품할인', '할인'], false],
  ['결제금액', '결제금액', ['결제금액', '실결제금액', '최종결제금액', '총결제금액', '결제 금액'], true],
  ['배송비', '배송비', ['배송비', '배송료'], false],
  ['결제수단', '결제수단', ['결제수단', '결제방법'], false],
  ['배송완료일', '배송완료일', ['배송완료일', '배송완료일시', '배송 완료일'], false],
  ['구매확정일', '구매확정일', ['구매확정일', '구매확정일시', '구매 확정일'], false],
  ['회원구분', '회원등급', ['회원등급', '회원그룹', '회원구분'], false],
  ['송장번호', '송장번호', ['송장번호', '운송장번호'], false],
  ['택배사', '택배사', ['택배사', '배송업체'], false]
];
const cellStr = v => (v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ') : String(v === undefined || v === null ? '' : v).trim());
async function orderUploadFlow(file, box) {
  await loadXlsx();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
  if (!raw.length) throw new Error('첫 시트에 주문 줄이 없습니다.');
  const heads = Object.keys(raw[0]);
  const map = {};
  ORDER_FIELDS.forEach(([k, , syn]) => { map[k] = syn.find(s => heads.includes(s)) || ''; });
  const stateMap = {};
  const mapBox = el('div', { class: 'form' }), stateBox = el('div'), prevBox = el('div');
  let lastRows = null;
  function drawMap() {
    mapBox.replaceChildren(el('h2', { style: 'margin:0' }, '1. 칸 맞추기'), el('p', { class: 'lead' }, file.name + ' · ' + raw.length + '줄. 화프스 칸마다 파일의 어느 칸을 쓸지 확인하세요. * 표시는 꼭 필요합니다.'),
      el('div', { class: 'mapgrid' }, ORDER_FIELDS.map(([k, label, , req]) => {
        const s = select([['', '(쓰지 않음)']].concat(heads.map(h => [h, h])), map[k]);
        s.onchange = () => { map[k] = s.value; drawStates(); prevBox.replaceChildren(); };
        return field(label + (req ? ' *' : ''), s);
      })));
  }
  function drawStates() {
    const col = map.주문상태;
    const vals = col ? [...new Set(raw.map(r => cellStr(r[col])))].filter(Boolean) : [];
    vals.forEach(v => { if (!(v in stateMap)) stateMap[v] = normOrderState(v); });
    stateBox.replaceChildren(el('div', { class: 'form' }, el('h2', { style: 'margin:0' }, '2. 주문상태 맞추기'),
      el('p', { class: 'lead' }, '파일의 상태 이름을 화프스 표준 상태로 바꿉니다. 비어 있는 것은 꼭 골라 주세요.'),
      vals.length ? el('div', { class: 'mapgrid' }, vals.map(v => {
        const s = select([['', '고르세요']].concat(ORDER_STATES.map(x => [x, x])), stateMap[v]);
        s.onchange = () => { stateMap[v] = s.value; prevBox.replaceChildren(); };
        return field(v, s);
      })) : el('p', { class: 'note warn' }, '주문상태 칸을 먼저 맞추세요.')));
  }
  function build() {
    const miss = ORDER_FIELDS.filter(([k, , , req]) => req && !map[k] && !(k === '결제금액' && map.상품금액) && !(k === '상품명' && map.몰상품코드)).map(f => f[1]);
    if (miss.length) throw new Error('꼭 필요한 칸이 없습니다: ' + miss.join(', '));
    const unmapped = Object.keys(stateMap).filter(v => !stateMap[v]);
    if (unmapped.length) throw new Error('주문상태를 골라 주세요: ' + unmapped.join(', '));
    const rows = raw.map(r => { const o = {}; ORDER_FIELDS.forEach(([k]) => { o[k] = map[k] ? cellStr(r[map[k]]) : ''; }); o.원래상태 = o.주문상태; o.주문상태 = stateMap[o.주문상태] || ''; return o; })
      .filter(o => o.주문번호);
    const notes = [];
    const groups = {};
    rows.forEach((o, i) => { (groups[o.주문번호] = groups[o.주문번호] || []).push(i); });
    const n = v => Number(String(v).replace(/[^0-9.-]/g, '')) || 0;
    let payAlloc = 0, shipAlloc = 0;
    Object.values(groups).forEach(idx => {
      if (idx.length < 2) return;
      const pays = idx.map(i => n(rows[i].결제금액)), items = idx.map(i => n(rows[i].상품금액) || n(rows[i].판매단가) * n(rows[i].수량));
      if (map.결제금액 && pays.every(p => p === pays[0]) && pays[0] > 0) {      // 주문 전체 금액이 줄마다 반복 → 품목 금액 비율로 나눔
        const base = items.reduce((a, b) => a + b, 0) || idx.length;
        let left = pays[0];
        idx.forEach((i, j) => { const share = j === idx.length - 1 ? left : Math.round(pays[0] * (items.reduce((a, b) => a + b, 0) ? items[j] : 1) / base); rows[i].결제금액 = String(share); left -= share; });
        payAlloc++;
      }
      const ships = idx.map(i => n(rows[i].배송비));
      if (ships.every(s => s === ships[0]) && ships[0] > 0) { idx.forEach((i, j) => { if (j) rows[i].배송비 = '0'; }); shipAlloc++; }
    });
    if (payAlloc) notes.push('결제금액이 주문 전체 금액으로 줄마다 반복된 주문 ' + payAlloc + '건은 상품금액 비율로 나눴습니다(이중 계산 방지).');
    if (shipAlloc) notes.push('배송비가 줄마다 반복된 주문 ' + shipAlloc + '건은 첫 줄에만 넣었습니다.');
    if (!map.품목키) {
      const seq = {};
      rows.forEach(o => { seq[o.주문번호] = (seq[o.주문번호] || 0) + 1; o.품목키 = o.주문번호 + '-' + seq[o.주문번호]; });
      notes.push('품목 주문번호 칸이 없어 "주문번호-순번"으로 구분합니다. 다시 올릴 때도 같은 순서의 파일을 쓰세요.');
    }
    return { rows, notes };
  }
  const bPrev = el('button', { class: 'btn primary' }, '3. 미리보기 (저장 안 함)');
  bPrev.onclick = () => act(bPrev, async () => {
    const b = build();
    const r = await api('order.import', { rows: b.rows, dryRun: true, 파일명: file.name });
    lastRows = r.errors ? null : b.rows;
    const s = r.summary || {};
    const bSave = el('button', { class: 'btn seal', disabled: !!r.errors }, '4. 저장하기');
    bSave.onclick = () => act(bSave, async () => {
      const res = await api('order.import', { rows: lastRows, 파일명: file.name });
      toast('주문을 저장했습니다: 신규 ' + res.summary.신규 + ', 수정 ' + res.summary.수정 + ', 그대로 ' + res.summary.그대로);
      S.flash = { orders: [res.summary.첫주문일 || kd(90), res.summary.끝주문일 || kd(0)] };
      box.replaceChildren(); route(true);
    });
    prevBox.replaceChildren(el('div', { class: 'form' }, el('h2', { style: 'margin:0' }, '미리보기 결과'),
      b.notes.map(t => el('p', { class: 'note' }, t)),
      r.errors ? el('div', { class: 'note warn' }, el('b', null, '오류 ' + r.오류수 + '건 — 고친 뒤 다시 올리세요. 저장하지 않았습니다.'), el('ul', null, r.errors.slice(0, 30).map(e => el('li', null, e.행 + '행: ' + e.오류))))
        : el('div', { class: 'kv' }, [['신규', s.신규], ['수정', s.수정], ['그대로', s.그대로], ['상품 미연결', s.미연결], ['자동 구매확정', s.자동구매확정], ['결제금액 합계', fmtComma(s.결제합계) + '원'], ['주문 기간', (s.첫주문일 || '') + ' ~ ' + (s.끝주문일 || '')]]
          .map(([k, v]) => el('div', null, el('small', null, k), el('b', { class: 'num' }, String(v))))),
      r.warnings && r.warnings.length ? el('details', null, el('summary', null, '확인할 점 ' + (r.경고수 || r.warnings.length) + '건'), el('ul', null, r.warnings.map(w => el('li', null, w.행 + '행: ' + w.내용)))) : null,
      el('div', { class: 'actions' }, bSave)));
  });
  drawMap(); drawStates();
  box.replaceChildren(mapBox, stateBox, el('div', { class: 'actions' }, bPrev), prevBox);
}
async function viewOrders() {
  const data = await ensureData();
  const upBox = el('div');
  const inp = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', class: 'sr' });
  const bUp = el('button', { class: 'btn primary' }, '아임웹 주문 엑셀 올리기');
  bUp.onclick = () => inp.click();
  inp.onchange = () => act(bUp, async () => { const f = inp.files[0]; inp.value = ''; if (f) await orderUploadFlow(f, upBox); });
  const range = S.flash && S.flash.orders ? S.flash.orders : null;
  if (range) S.flash = null;
  const from = el('input', { type: 'date', value: range ? range[0] : kd(90) }), to = el('input', { type: 'date', value: range ? range[1] : kd(0) });
  const st = select([['', '모든 상태']].concat(ORDER_STATES.map(x => [x, x])), '');
  const un = el('input', { type: 'checkbox' }), q = el('input', { type: 'search', placeholder: '주문번호·상품명' });
  const listBox = el('div');
  const prodSel = select([['', '연결할 상품']].concat(data.products.filter(p => p.상태 !== '삭제').map(p => [p.id, p.상품명 + ' (' + p.id + ')'])), '');
  const saveMall = el('input', { type: 'checkbox', checked: true });
  async function load() {
    const r = await api('order.list', { from: from.value, to: to.value, 상태: st.value, 미연결: un.checked, q: q.value.trim() }, { silent: true });
    const s = r.summary;
    const checks = [];
    const rows = r.rows.map(o => {
      const c = !o.상품ID && !o.정산번호 ? el('input', { type: 'checkbox', value: o.id, 'data-mall': o.몰상품코드 || '' }) : null;
      if (c) checks.push(c);
      return [c || '', String(o.주문일시).slice(0, 16), o.주문번호, o.상품명 + (o.옵션 ? ' / ' + o.옵션 : ''), Number(o.수량), Number(o.결제금액), o.주문상태 + (o.원래상태 && o.원래상태 !== o.주문상태 ? ' (' + o.원래상태 + ')' : ''),
        o.상품ID ? o.상품ID + ' · ' + (o.거래형태 || '') : el('span', { class: 'bad' }, '미연결'), o.정산번호 || ''];
    });
    const bLink = el('button', { class: 'btn small' }, '고른 주문을 이 상품에 연결');
    bLink.onclick = () => act(bLink, async () => {
      const ids = checks.filter(c => c.checked).map(c => c.value);
      if (!ids.length) throw new Error('연결할 주문을 체크하세요.');
      if (!prodSel.value) throw new Error('연결할 상품을 고르세요.');
      const mall = checks.filter(c => c.checked).map(c => c.dataset.mall).find(Boolean);
      const res = await api('order.link', { ids, 상품ID: prodSel.value, 몰상품코드저장: saveMall.checked, 몰상품코드: mall });
      toast(res.linked + '줄을 연결했습니다.'); refreshSoon(true); load();
    });
    listBox.replaceChildren(
      el('div', { class: 'kv' }, [['줄 수', s.줄수], ['결제금액 합계', fmtComma(s.결제합계) + '원'], ['미연결', s.미연결]].concat(Object.keys(s.상태별).map(k => [k, s.상태별[k]]))
        .map(([k, v]) => el('div', null, el('small', null, k), el('b', { class: 'num' + (k === '미연결' && v ? ' bad' : '') }, String(v))))),
      r.잘림 ? el('p', { class: 'note' }, '최근 1,000줄만 보여 줍니다. 기간을 줄여 보세요.') : null,
      gridTable(['', '주문일', '주문번호', '상품 / 옵션', '수량', '결제금액', '상태', '연결 상품', '정산'], rows, [4, 5]),
      isStaff() && checks.length ? el('div', { class: 'form' }, el('b', null, '미연결 주문 연결'), prodSel, el('label', { class: 'check' }, saveMall, '이 주문의 상품코드를 상품의 몰상품코드로 저장(다음부터 자동 연결)'), bLink) : null);
  }
  const bFind = el('button', { class: 'btn' }, '조회');
  bFind.onclick = () => act(bFind, load);
  setTimeout(() => load().catch(e => listBox.replaceChildren(el('p', { class: 'note warn' }, e.message))), 0);
  return el('div', null, el('h1', null, '주문'), opsTabs('orders'),
    isStaff() ? el('div', { class: 'form' }, el('b', null, '주문 올리기'),
      el('p', { class: 'lead', style: 'margin:0' }, '아임웹 관리자 → 주문 관리 → 엑셀 다운로드(품목 단위 권장)로 받은 파일을 고칠 필요 없이 올립니다. 첫 시트의 1행이 칸 이름이어야 합니다.'),
      el('div', { class: 'actions', style: 'margin:0' }, bUp, inp), upBox) : null,
    el('h2', null, '주문 조회'),
    el('div', { class: 'form' }, el('div', { class: 'inline' }, field('주문일 부터', from), field('까지', to), field('상태', st)), el('div', { class: 'inline' }, q, el('label', { class: 'check' }, un, '미연결만'), bFind)),
    listBox);
}

/* 매입: 자사배송 직매입 입고 */
async function viewPurchases() {
  const data = await ensureData();
  const list = data.purchases || [];
  const vendors = data.vendors.filter(v => vendorTrade(v) === '직매입');
  const ven = select([['', '공급사 고르기']].concat(vendors.map(v => [v.id, v.상호 + ' (' + v.id + ')'])), '');
  const date = el('input', { type: 'date', value: kd(0) });
  const wh = select([['', '창고 선택 안 함']].concat(data.warehouses.map(w => [w.id, w.이름])), '');
  const memo = el('input', { placeholder: '예) 11월 1차 입고' });
  const lines = el('div', { class: 'lines' });
  const total = el('p', { class: 'note' });
  let editNo = '';
  const prodsOf = () => data.products.filter(p => p.공급사코드 === ven.value && p.배송방식 !== '업체배송' && SELLABLE.includes(p.상태));
  function sum() {
    let s = 0;
    lines.querySelectorAll('.line').forEach(l => { s += num(l.querySelector('.q').value) * num(l.querySelector('.u').value); });
    total.textContent = '공급가액 합계 ' + fmtComma(Math.round(s)) + '원 (부가세 별도, 면세 상품은 부가세 없음)';
  }
  function addLine(v) {
    v = v || {};
    const ps = prodsOf();
    const p = select([['', ps.length ? '상품 고르기' : '이 공급사의 자사배송 상품이 없습니다']].concat(ps.map(x => [x.id, x.상품명 + ' (' + x.id + ')'])), v.상품ID || '');
    const q = numInput(v.수량 || '', { class: 'num q', placeholder: '수량' });
    const u = numInput(v.단가 || '', { class: 'num u', placeholder: '단가' });
    const amt = el('span', { class: 'num' });
    const upd = () => { amt.textContent = fmtComma(Math.round(num(q.value) * num(u.value))) + '원'; sum(); };
    p.onchange = () => { const x = data.products.find(y => y.id === p.value); if (x && !u.value) u.value = fmtComma(x.공급가); upd(); };
    q.addEventListener('input', upd); u.addEventListener('input', upd);
    const del = el('button', { class: 'btn small ghost', type: 'button' }, '빼기');
    const line = el('div', { class: 'line' }, p, q, u, amt, del);
    del.onclick = () => { line.remove(); sum(); };
    lines.appendChild(line); upd();
  }
  ven.onchange = () => { lines.replaceChildren(); addLine(); };
  const bAdd = el('button', { class: 'btn small', type: 'button' }, '+ 상품 줄 추가');
  bAdd.onclick = () => { if (!ven.value) return toast('공급사를 먼저 고르세요.', 'err'); addLine(); };
  const bSave = el('button', { class: 'btn primary' }, '입고 등록');
  bSave.onclick = () => act(bSave, async () => {
    const ls = [...lines.querySelectorAll('.line')].map(l => ({ 상품ID: l.querySelector('select').value, 수량: l.querySelector('.q').value, 단가: l.querySelector('.u').value })).filter(l => l.상품ID);
    S.data.purchases = await api('purchase.save', { 매입번호: editNo || undefined, 공급사코드: ven.value, 입고일: date.value, 창고ID: wh.value, 메모: memo.value, lines: ls });
    persistData(); toast(editNo ? '매입을 고쳤습니다.' : '입고를 등록했습니다. 운영기획이 확정하면 정산에 들어갑니다.'); route(true);
  });
  const groups = {};
  list.filter(r => r.상태 !== '삭제').forEach(r => { (groups[r.매입번호] = groups[r.매입번호] || []).push(r); });
  const rows = Object.keys(groups).sort().reverse().map(no => {
    const g = groups[no], h = g[0];
    const st = h.상태, sup = g.reduce((a, r) => a + num(r.공급가액), 0), tax = g.reduce((a, r) => a + num(r.부가세), 0);
    const btns = [];
    if (st === '등록' && isStaff()) { const b = el('button', { class: 'btn small seal' }, '확정'); b.onclick = () => act(b, async () => { S.data.purchases = await api('purchase.state', { 매입번호: no, 상태: '확정' }); persistData(); toast(no + ' 확정'); route(true); }); btns.push(b); }
    if (st === '등록') { const b = el('button', { class: 'btn small ghost' }, '고치기'); b.onclick = () => { editNo = no; ven.value = h.공급사코드; date.value = h.입고일; wh.value = h.창고ID || ''; memo.value = h.메모 || ''; lines.replaceChildren(); g.forEach(r => addLine(r)); bSave.textContent = no + ' 고쳐 저장'; window.scrollTo(0, 0); }; btns.push(b); }
    if (st !== '취소' && !g.some(r => r.정산번호) && isStaff()) { const b = el('button', { class: 'btn small ghost' }, '취소'); b.onclick = () => act(b, async () => { if (!confirm(no + ' 매입을 취소할까요?')) return; S.data.purchases = await api('purchase.state', { 매입번호: no, 상태: '취소' }); persistData(); route(true); }); btns.push(b); }
    return [no, h.입고일, h.상호, g.map(r => r.상품명 + ' ×' + fmtComma(r.수량)).join(', '), sup, tax, el('span', { class: 'tag' + (st === '확정' ? ' ok' : st === '취소' ? ' no' : '') }, st), g[0].정산번호 || '', el('span', null, btns)];
  });
  return el('div', null, el('h1', null, '매입 (입고)'), opsTabs('purchases'),
    el('div', { class: 'form' }, el('b', null, editNo ? editNo + ' 고치기' : '입고 등록'),
      el('div', { class: 'two' }, field('공급사 (직매입)', ven), field('입고일', date)), el('div', { class: 'two' }, field('창고', wh), field('메모', memo)),
      el('div', { class: 'lineshead' }, el('span', null, '상품'), el('span', { class: 'num' }, '수량'), el('span', { class: 'num' }, '단가 (VAT 별도)'), el('span', { class: 'num' }, '금액'), el('span')),
      lines, el('div', { class: 'inline' }, bAdd), total, el('div', { class: 'actions', style: 'margin:0' }, bSave)),
    el('h2', null, '매입 목록'),
    gridTable(['매입번호', '입고일', '공급사', '상품', '공급가액', '부가세', '상태', '정산', ''], rows, [4, 5]),
    el('p', { class: 'lead' }, '업체배송 상품의 매입은 주문이 구매확정되면 정산할 때 자동으로 들어갑니다(이 목록에는 나오지 않습니다).'));
}

/* 정산 */
function settlePreset(kind) {
  const d = new Date(Date.now() + 9 * 3600000);
  const ymd = x => x.toISOString().slice(0, 10);
  if (kind === '직매입') { const w = d.getUTCDay() || 7; const mon = new Date(d.getTime() - (w + 6) * 86400000); return [ymd(mon), ymd(new Date(mon.getTime() + 6 * 86400000))]; }
  if (kind === '위탁판매') {
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    if (day > 15) return [ymd(new Date(Date.UTC(y, m, 1))), ymd(new Date(Date.UTC(y, m, 15)))];
    return [ymd(new Date(Date.UTC(y, m - 1, 16))), ymd(new Date(Date.UTC(y, m, 0)))];
  }
  return [ymd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))), ymd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))];
}
async function viewSettle() {
  if (!isStaff()) throw new Error('정산은 운영기획·관리자만 볼 수 있습니다.');
  const data = await ensureData();
  const kind = select(['직매입', '위탁판매', '광고료'], '직매입');
  const p0 = settlePreset('직매입');
  const s = el('input', { type: 'date', value: p0[0] }), e = el('input', { type: 'date', value: p0[1] });
  const rule = el('p', { class: 'lead' });
  const setRule = () => {
    const p = settlePreset(kind.value); s.value = p[0]; e.value = p[1];
    rule.textContent = { 직매입: '직매입: 월~일 마감, 다음 주 목요일 지급(공휴일이면 다음 영업일). 입고 확정 매입 + 업체배송 구매확정 주문.', 위탁판매: '위탁판매: 1~15일·16일~말일 마감, 마감일부터 10일째 지급(공휴일이면 다음 영업일). 지급액 = 결제금액 − 수수료 − 수수료 부가세.', 광고료: '광고료: 체결된 제휴입점 계약의 광고료를 청구합니다. 납부기한은 게재 시작일 전날.' }[kind.value];
  };
  kind.onchange = setRule; setRule();
  const out = el('div');
  const bPrev = el('button', { class: 'btn primary' }, '미리보기');
  bPrev.onclick = () => act(bPrev, async () => {
    const r = await api('settle.preview', { 구분: kind.value, 기간시작: s.value, 기간종료: e.value });
    const ws = r.vendors.map(v => {
      const c = el('input', { type: 'checkbox', checked: true, value: v.공급사코드 });
      const t = v.totals;
      return { c, row: [c, v.상호, t.건수, kind.value === '위탁판매' ? t.대상금액 : t.공급가액, kind.value === '위탁판매' ? t.수수료 : t.부가세, kind.value === '위탁판매' ? t.수수료부가세 : 0, t.지급액, v.지급예정일] };
    });
    const bMake = el('button', { class: 'btn seal', disabled: !ws.length }, '고른 공급사 정산서 만들기');
    bMake.onclick = () => act(bMake, async () => {
      const pick = ws.filter(w => w.c.checked).map(w => w.c.value);
      if (!pick.length) throw new Error('공급사를 하나 이상 고르세요.');
      const res = await api('settle.create', { 구분: kind.value, 기간시작: s.value, 기간종료: e.value, 공급사들: pick });
      S.data.settlements = res.list; persistData();
      toast('정산서 ' + res.made.length + '건을 만들었습니다(작성 상태). 확인 후 확정하세요.'); route(true);
    });
    const isC = kind.value === '위탁판매';
    out.replaceChildren(el('h2', null, '미리보기: ' + r.기간시작 + ' ~ ' + r.기간종료),
      r.warnings.length ? el('div', { class: 'note warn' }, el('b', null, '빠진 줄이 있습니다'), el('ul', null, r.warnings.map(w => el('li', null, w)))) : null,
      gridTable(['', '공급사', '건수', isC ? '결제금액' : '공급가액', isC ? '수수료' : '부가세', isC ? '수수료 부가세' : '', kind.value === '광고료' ? '청구액' : '지급액', kind.value === '광고료' ? '납부기한' : '지급예정일'], ws.map(w => w.row), [2, 3, 4, 5, 6]),
      el('p', { class: 'lead' }, '아직 정산되지 않은 줄을 기간 종료일까지 모두 모읍니다(늦게 올린 주문도 빠지지 않게). 정산 뒤 취소·반품된 주문은 마이너스 줄로 들어갑니다.'),
      el('div', { class: 'actions' }, bMake));
  });
  const heads = (data.settlements || []).slice().sort((a, b) => String(b.id).localeCompare(String(a.id)));
  const listRows = heads.map(h => [el('a', { href: '#/ops/settle/' + encodeURIComponent(h.id) }, h.id), h.구분, h.상호, h.기간시작 + '~' + h.기간종료, Number(h.건수), Number(h.지급액), h.지급예정일, el('span', { class: 'tag' + (h.상태 === '지급완료' ? ' ok' : h.상태 === '작성' ? ' wait' : '') }, h.상태), h.지급일 || '']);
  return el('div', null, el('h1', null, '정산'), opsTabs('settle'),
    el('div', { class: 'form' }, el('div', { class: 'inline' }, field('구분', kind), field('기간 시작', s), field('기간 종료', e)), rule, el('div', { class: 'actions', style: 'margin:0' }, bPrev)),
    out, el('h2', null, '정산서'), gridTable(['정산번호', '구분', '공급사', '기간', '건수', '지급(청구)액', '예정일', '상태', '지급일'], listRows, [4, 5]));
}
async function viewSettleOne(id) {
  if (!isStaff()) throw new Error('정산은 운영기획·관리자만 볼 수 있습니다.');
  const r = await api('settle.get', { id });
  const h = r.head;
  const isC = h.구분 === '위탁판매';
  const done = list => { S.data.settlements = list; persistData(); refreshSoon(false); };
  const btns = [];
  if (h.상태 === '작성') {
    const b1 = el('button', { class: 'btn seal' }, '확정');
    b1.onclick = () => act(b1, async () => { if (!confirm('확정하면 이 정산서는 지울 수 없습니다. 확정할까요?')) return; done(await api('settle.state', { id, 작업: '확정' })); toast('확정했습니다.'); route(true); });
    const b2 = el('button', { class: 'btn ghost' }, '정산서 지우기');
    b2.onclick = () => act(b2, async () => { if (!confirm('지우면 들어 있던 주문·매입이 다시 정산 대상이 됩니다. 지울까요?')) return; done(await api('settle.state', { id, 작업: '삭제' })); toast('지웠습니다.'); location.hash = '#/ops/settle'; });
    btns.push(b1, b2);
  }
  if (h.상태 === '확정') {
    const d = el('input', { type: 'date', value: h.지급예정일 });
    const b = el('button', { class: 'btn seal' }, h.구분 === '광고료' ? '입금 완료' : '지급 완료');
    b.onclick = () => act(b, async () => { done(await api('settle.state', { id, 작업: '지급완료', 지급일: d.value })); toast('처리했습니다.'); route(true); });
    btns.push(field(h.구분 === '광고료' ? '입금일' : '지급일', d), b);
  }
  const bX = el('button', { class: 'btn ghost' }, '엑셀로 받기');
  bX.onclick = () => act(bX, async () => {
    await loadXlsx();
    const head = ['일자', '원천', '상품', '수량', isC ? '결제금액' : '금액', '수수료', '부가세', '비고'];
    const aoa = [['정산번호', h.id, '구분', h.구분, '공급사', h.상호], ['기간', h.기간시작 + ' ~ ' + h.기간종료, '지급예정일', h.지급예정일, '지급액', Number(h.지급액)], [], head]
      .concat(r.lines.map(l => [l.일자, l.원천, l.상품명, Number(l.수량) || '', Number(l.금액), Number(l.수수료) || 0, Number(l.부가세) || 0, l.비고]));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    Object.keys(ws).forEach(k => { if (k[0] !== '!' && ws[k].t === 'n') ws[k].z = '#,##0'; });
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 36 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 24 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '정산서');
    XLSX.writeFile(wb, '정산서_' + h.id + '_' + h.상호 + '.xlsx');
  });
  const kv = [['구분', h.구분], ['공급사', h.상호], ['기간', h.기간시작 + ' ~ ' + h.기간종료], ['건수', h.건수]]
    .concat(isC ? [['결제금액', fmtComma(h.대상금액) + '원'], ['수수료', fmtComma(h.수수료) + '원'], ['수수료 부가세', fmtComma(h.수수료부가세) + '원']] : [['공급가액', fmtComma(h.공급가액) + '원'], ['부가세', fmtComma(h.부가세) + '원']])
    .concat([[h.구분 === '광고료' ? '청구액' : '지급액', fmtComma(h.지급액) + '원'], [h.구분 === '광고료' ? '납부기한' : '지급예정일', h.지급예정일], ['지급(입금)일', h.지급일 || '—']]);
  return el('div', null, el('h1', null, '정산서 ' + h.id), opsTabs('settle'),
    guideBox({ steps: GUIDES.settle.steps, cur: { 작성: 2, 확정: 3, 지급완료: 4 }[h.상태] }),
    el('div', { class: 'inline', style: 'gap:10px;align-items:center' }, el('span', { class: 'tag' + (h.상태 === '지급완료' ? ' ok' : '') }, h.상태)),
    el('div', { class: 'kv', style: 'margin:12px 0' }, kv.map(([k, v]) => el('div', null, el('small', null, k), el('b', { class: 'num' }, String(v))))),
    el('div', { class: 'actions' }, btns, bX),
    gridTable(['일자', '원천', '상품', '수량', isC ? '결제금액' : '금액', '수수료', '부가세', '비고'], r.lines.map(l => [l.일자, l.원천, l.상품명, Number(l.수량) || '', Number(l.금액), Number(l.수수료) || 0, Number(l.부가세) || 0, l.비고]), [3, 4, 5, 6]));
}

/* 손익 */
async function viewPL() {
  if (!isStaff()) throw new Error('손익은 운영기획·관리자만 볼 수 있습니다.');
  const data = await ensureData();
  const y0 = kd(0).slice(0, 4);
  const yr = select([String(+y0 - 1), y0, String(+y0 + 1)], y0);
  const out = el('div');
  async function load() {
    const r = await api('pl.report', { year: yr.value }, { silent: true });
    const lines = [['직매입 매출 (VAT 제외)', '직매입매출'], ['위탁 수수료', '위탁수수료'], ['광고료', '광고매출'], ['배송비 수입', '배송비매출'], ['매출 합계', '매출', 1], ['매출원가', '매출원가'], ['PG 수수료', 'PG수수료'], ['공헌이익', '공헌이익', 1], ['비용(판관비)', '비용'], ['영업이익', '영업이익', 1], ['참고: 결제금액', '결제금액'], ['참고: 판매수량', '판매수량']];
    const head = ['항목'].concat(r.months.map(m => +m.월.slice(5) + '월')).concat(['합계']);
    const rows = lines.map(([label, k, strong]) => [strong ? el('b', null, label) : label].concat(r.months.map(m => m[k])).concat([r.total[k]]));
    const rate = r.total.매출 ? (r.total.영업이익 / r.total.매출 * 100).toFixed(1) + '%' : '—';
    const w = r.warnings;
    out.replaceChildren(
      el('div', { class: 'kv' }, [['연 매출', fmtComma(r.total.매출) + '원'], ['공헌이익', fmtComma(r.total.공헌이익) + '원'], ['영업이익', fmtComma(r.total.영업이익) + '원'], ['영업이익률', rate]]
        .map(([k, v]) => el('div', null, el('small', null, k), el('b', { class: 'num' + (k.includes('이익') && String(v).startsWith('-') ? ' bad' : '') }, v)))),
      w.미연결 || w.공급가없음 || w.수수료율없음 ? el('p', { class: 'note warn' }, '계산에서 빠지거나 0으로 들어간 줄: 상품 미연결 ' + w.미연결 + ', 공급가 없음 ' + w.공급가없음 + ', 수수료율 없음 ' + w.수수료율없음 + ' — ', el('a', { href: '#/ops/check' }, '데이터 점검')) : null,
      gridTable(head, rows, head.map((_, i) => i).slice(1)),
      el('p', { class: 'lead' }, r.기준),
      el('h2', null, '많이 팔린 상품 (결제금액 순)'),
      gridTable(['상품', '거래형태', '수량', '결제금액', '매출', '이익(PG 뺌)'], r.top.map(t => [t.상품명, t.거래형태, t.수량, t.결제금액, t.매출, t.이익]), [2, 3, 4, 5]));
  }
  yr.onchange = () => act(null, load);
  setTimeout(() => load().catch(e => out.replaceChildren(el('p', { class: 'note warn' }, e.message))), 0);
  const m = el('input', { type: 'month', value: kd(0).slice(0, 7) });
  const item = el('input', { list: 'exp-items', placeholder: '예) 인건비' });
  const amt = numInput('', { placeholder: '예) 3,000,000' });
  const memo = el('input', { placeholder: '메모' });
  const bAdd = el('button', { class: 'btn primary' }, '비용 넣기');
  bAdd.onclick = () => act(bAdd, async () => { S.data.expenses = await api('expense.save', { 월: m.value, 항목: item.value, 금액: amt.value, 메모: memo.value }); persistData(); toast('넣었습니다.'); route(true); });
  const exps = (data.expenses || []).slice().sort((a, b) => String(b.월).localeCompare(String(a.월)));
  return el('div', null, el('h1', null, '손익'), opsTabs('pl'),
    el('div', { class: 'form' }, field('연도', yr)), out,
    el('h2', null, '비용 넣기 (월별)'),
    el('datalist', { id: 'exp-items' }, ['인건비', '임차료', '광고선전비', '물류비', '포장비', '지급수수료', '통신비', '소모품비', '기타'].map(x => el('option', { value: x }))),
    el('div', { class: 'form' }, el('div', { class: 'inline' }, field('월', m), field('항목', item), field('금액 (원)', amt)), field('메모', memo), bAdd),
    gridTable(['월', '항목', '금액', '메모', ''], exps.map(x => {
      const b = el('button', { class: 'btn small ghost' }, '지우기');
      b.onclick = () => act(b, async () => { if (!confirm(x.월 + ' ' + x.항목 + '을(를) 지울까요?')) return; S.data.expenses = await api('expense.save', { id: x.id, 삭제: true }); persistData(); route(true); });
      return [x.월, x.항목, Number(x.금액), x.메모 || '', b];
    }), [2]));
}

/* 데이터 점검 */
async function viewCheck() {
  if (!isStaff()) throw new Error('운영기획·관리자만 볼 수 있습니다.');
  const r = await api('check.run', {});
  const items = r.items;
  const bad = items.filter(i => i.수준 === '오류').length;
  return el('div', null, el('h1', null, '데이터 점검'), opsTabs('check'),
    el('p', { class: 'note' + (bad ? ' warn' : '') }, items.length ? '오류 ' + bad + '가지, 주의 ' + (items.length - bad) + '가지가 있습니다. (' + r.at + ')' : '문제를 찾지 못했습니다. (' + r.at + ')'),
    el('div', { class: 'list' }, items.map(i => el('a', { class: 'row', href: i.링크 || '#/ops/check' },
      el('span', { class: 'tag ' + (i.수준 === '오류' ? 'no' : 'wait') }, i.수준),
      el('div', { class: 'main' }, el('div', { class: 't' }, i.내용), el('div', { class: 's' }, i.영역)),
      el('b', { class: 'num' }, fmtComma(i.건수) + '건')))),
    el('div', { class: 'actions' }, el('button', { class: 'btn', onclick: () => route() }, '다시 점검')));
}

/* ───────── 계약서 양식 관리 (관리자) ───────── */
const FORM_NAMES = { K1: '상품공급계약서 (본문)', T1: '별지 1 · 거래조건표 (상품공급계약에 붙음)', S1: '거래조건표 변경 확인서', S2: '판촉 약정서', S3: '독점판매 특약', AD: '광고 게재 계약서', PB: 'PB 제조 하도급계약서', LG: '물류(3PL) 위탁계약서', IT: 'IT 개발·유지보수 계약서' };
const SEC_NAMES = { intro: '머리말', clause: '조항', closing: '맺음말', terms: '거래조건표 자리' };
async function viewForms() {
  if (!isAdmin()) throw new Error('계약서 양식은 관리자만 고칠 수 있습니다.');
  const data = await ensureData();
  const forms = data.forms || FORMS_DEFAULT;
  return el('div', null, el('h1', null, '계약서 양식 관리'),
    el('div', { class: 'list' }, Object.keys(FORM_NAMES).map(c => {
      const f = forms[c] || FORMS_DEFAULT[c];
      return el('a', { class: 'row', href: '#/form/' + c }, el('div', { class: 'main' }, el('div', { class: 't' }, FORM_NAMES[c]),
        el('div', { class: 's' }, f._default || !f._ver ? '기본 양식' : '수정본 ' + f._ver + '판 · ' + (f._by || '') + ' · ' + String(f._at || '').slice(0, 16))),
        el('span', { class: 'tag' + (f._default || !f._ver ? '' : ' ok') }, f._default || !f._ver ? '기본' : 'v' + f._ver));
    })),
    el('p', { class: 'lead' }, '여기서 고친 문구는 앞으로 작성·확정하는 계약서에 들어갑니다. 이미 확정된 계약서는 확정할 때의 문구를 그대로 보관합니다.'));
}
async function viewFormEdit(code) {
  if (!isAdmin()) throw new Error('계약서 양식은 관리자만 고칠 수 있습니다.');
  const data = await ensureData();
  if (!FORMS_DEFAULT[code]) throw new Error('없는 양식입니다: ' + code);
  S.wide = true;
  const cur = (data.forms || FORMS_DEFAULT)[code];
  const f = JSON.parse(JSON.stringify({ code, title: cur.title, party: cur.party, left: cur.left, right: cur.right, sections: cur.sections }));
  const listBox = el('div', { class: 'secs' }), preview = el('div', { class: 'preview-wrap' });
  let lastTa = null;
  const kindOf = Object.keys(CONTRACT_KINDS).find(k => CONTRACT_KINDS[k].docs.includes(code));
  const sampleTrade = select(TRADE_TYPES, '직매입'), sampleShip = select([['자사배송,업체배송', '자사배송 + 업체배송'], ['자사배송', '자사배송만'], ['업체배송', '업체배송만']], '자사배송,업체배송');
  const keyBtns = el('div', { class: 'keys' },
    Object.keys(KEY_META).filter(k => KEY_META[k].t !== 'calc').concat(['@회사_상호', '@회사_대표자', '@회사_주소', '@회사_사업자번호']).map(k => {
      const b = el('button', { type: 'button', class: 'chip', title: (KEY_META[k] || {}).label || k }, k);
      b.onclick = () => {
        if (!lastTa) return toast('먼저 넣을 칸(본문)을 누르세요.', 'err');
        const s = lastTa.selectionStart, e = lastTa.selectionEnd, ins = '{{' + k + '}}';
        lastTa.value = lastTa.value.slice(0, s) + ins + lastTa.value.slice(e);
        lastTa.dispatchEvent(new Event('input')); lastTa.focus(); lastTa.setSelectionRange(s + ins.length, s + ins.length);
      };
      return b;
    }));
  let timer = null;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const ctx = { trade: sampleTrade.value, ships: sampleTrade.value === '제휴입점' ? [] : sampleShip.value.split(',') };
      const doc = compileForm(f, ctx);
      const vals = {};
      docsKeys([doc]).forEach(k => { const m = metaOf(k); vals[k] = m.ex ? (m.t === 'won' ? fmtComma(m.ex) : m.ex) : (k === '거래형태' ? ctx.trade : ''); });
      vals.상대_상호 = '(예시) 공급사'; vals.상대_대표자 = '홍길동';
      if (doc.blocks.some(b => b.t === 'terms')) vals._terms = { title: '직매입 상품 (예시)', head: ['상품코드', '상품명', '공급가'], rows: [['P0001', '사과 5kg', '28,000원']] };
      const pages = renderPaged([doc], vals, S.settings);
      const n = pages.querySelectorAll('.pg').length;
      preview.replaceChildren(el('p', { class: 'note' + (n > 3 ? ' warn' : '') }, '미리보기 ' + n + '쪽 · 조항 ' + doc.blocks.filter(b => b.t === 'h').length + '개' + (n > 3 ? ' — 3쪽을 넘습니다.' : '')), pages);
    }, 200);
  }
  function draw() {
    listBox.replaceChildren(...f.sections.map((s, i) => {
      const card = el('div', { class: 'sec' });
      const head = el('div', { class: 'inline' }, el('b', null, (s.type === 'clause' ? '조항 ' + (f.sections.slice(0, i + 1).filter(x => x.type === 'clause').length) : SEC_NAMES[s.type])));
      const mv = (d) => { const j = i + d; if (j < 0 || j >= f.sections.length) return; const t = f.sections[i]; f.sections[i] = f.sections[j]; f.sections[j] = t; draw(); refresh(); };
      const up = el('button', { class: 'btn small ghost', type: 'button', title: '위로' }, '↑'); up.onclick = () => mv(-1);
      const dn = el('button', { class: 'btn small ghost', type: 'button', title: '아래로' }, '↓'); dn.onclick = () => mv(1);
      const del = el('button', { class: 'btn small ghost', type: 'button' }, '지우기');
      del.onclick = () => { if (s.type === 'terms') return toast('거래조건표 자리는 지울 수 없습니다.', 'err'); if (confirm('이 ' + SEC_NAMES[s.type] + '을(를) 지울까요?')) { f.sections.splice(i, 1); draw(); refresh(); } };
      appendKids(head, up, dn, del);
      card.appendChild(head);
      if (s.type === 'clause') {
        const t = el('input', { value: s.title || '', placeholder: '조항 제목 (예: 품질 보증)' });
        t.addEventListener('input', () => { s.title = t.value; refresh(); });
        card.appendChild(field('제목', t));
        const when = el('div', { class: 'checks' }, el('span', { class: 's' }, '적용 조건 (비우면 모든 계약)'), FORM_TAGS.map(tag => {
          const c = el('input', { type: 'checkbox', checked: (s.when || []).includes(tag) });
          c.onchange = () => { s.when = FORM_TAGS.filter(x => x === tag ? c.checked : (s.when || []).includes(x)); refresh(); };
          return el('label', { class: 'check' }, c, tag);
        }));
        card.appendChild(when);
      }
      if (s.type !== 'terms') {
        const ta = el('textarea', { value: s.body || '', rows: Math.min(12, Math.max(3, String(s.body || '').split('\n').length + 1)) });
        ta.addEventListener('focus', () => { lastTa = ta; });
        ta.addEventListener('input', () => { s.body = ta.value; refresh(); });
        card.appendChild(field('본문', ta, '한 줄이 한 문단입니다. ①②로 항을, "1. "로 목록을, | 칸 | 칸 | 으로 표를 만듭니다.'));
      } else card.appendChild(el('p', { class: 'lead' }, '여기에 상품 데이터로 만든 거래조건표가 들어갑니다.'));
      const addHere = el('button', { class: 'btn small', type: 'button' }, '+ 아래에 조항 추가');
      addHere.onclick = () => { f.sections.splice(i + 1, 0, { type: 'clause', title: '새 조항', when: [], body: '① ' }); draw(); refresh(); };
      card.appendChild(addHere);
      return card;
    }));
  }
  const title = el('input', { value: f.title });
  title.addEventListener('input', () => { f.title = title.value; refresh(); });
  sampleTrade.onchange = refresh; sampleShip.onchange = refresh;
  const bSave = el('button', { class: 'btn seal' }, '저장 (새 판)');
  bSave.onclick = () => act(bSave, async () => {
    const memo = prompt('무엇을 바꿨는지 짧게 적어 주세요 (이력에 남습니다)', '');
    if (memo === null) return;
    S.data.forms = await api('form.save', { code, form: f, 메모: memo });
    persistData(); toast('저장했습니다. 앞으로 만드는 계약서에 들어갑니다.'); route(true);
  });
  const bReset = el('button', { class: 'btn ghost' }, '기본 양식으로 되돌리기');
  bReset.onclick = () => act(bReset, async () => {
    if (!confirm('처음 제공된 기본 양식으로 되돌립니다(새 판으로 저장). 계속할까요?')) return;
    S.data.forms = await api('form.reset', { code }); persistData(); toast('기본 양식으로 되돌렸습니다.'); route(true);
  });
  const hist = el('details', null, el('summary', null, '저장 이력'));
  hist.addEventListener('toggle', async () => {
    if (!hist.open || hist.querySelector('.list')) return;
    const h = await api('form.history', { code }, { silent: true });
    hist.appendChild(el('div', { class: 'list' }, h.length ? h.map(x => el('div', { class: 'row' }, el('div', { class: 'main' }, el('div', { class: 't' }, 'v' + x.버전 + ' · ' + x.상태), el('div', { class: 's' }, x.수정자 + ' · ' + x.수정일시 + (x.메모 ? ' · ' + x.메모 : ''))))) : el('div', { class: 'empty' }, '아직 고친 적이 없습니다(기본 양식).')));
  });
  draw(); refresh();
  return el('div', null, el('h1', null, FORM_NAMES[code]),
    el('div', { class: 'split' },
      el('div', null,
        el('div', { class: 'form' }, field('양식 제목', title),
          kindOf === 'K1' && code === 'K1' ? el('div', { class: 'inline' }, field('미리보기 거래형태', sampleTrade), field('미리보기 배송방식', sampleShip)) : null,
          el('details', null, el('summary', null, '입력값 넣기 (본문을 누른 뒤 단추를 누르면 그 자리에 들어감)'), keyBtns,
            el('p', { class: 'lead' }, '목록에 없는 이름을 {{새이름}}처럼 쓰면 계약 작성 화면에 그 이름의 입력칸이 새로 생깁니다.'))),
        listBox,
        el('div', { class: 'actions' }, bSave, bReset, el('a', { class: 'btn ghost', href: '#/forms' }, '목록으로')),
        hist),
      preview));
}

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
