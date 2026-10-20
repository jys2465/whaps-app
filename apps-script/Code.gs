/**
 * 화프스(WHAPS) 서버 v5.0 — Google Apps Script
 * 구글시트에 연결된 스크립트로 붙여 넣고 setup()을 실행하세요. (사용법은 README.md)
 * 화면(GitHub Pages)은 이 웹앱 주소 하나만 부르고, 판단은 모두 여기서 합니다.
 */
const APP_VERSION = '5.0.0';
const TZ = 'Asia/Seoul';
const ROLES = ['관리자', '운영기획', 'MD', '조회', '업체'];
const COMMON = ['id', '상태', '생성일시', '생성자', '수정일시', '수정자', '삭제'];
const TABS = {
  '사용자': COMMON.concat(['이름', '역할', '해시', '솔트', '비밀번호변경필요', '실패횟수', '잠금해제시각', '벤더코드']),
  '공지': COMMON.concat(['제목', '내용', '작성자명']),
  '분류': COMMON.concat(['대분류', '중분류', '소분류', '노출', '체계버전', '이름', '단계', '상위ID', '순서']),
  '창고': COMMON.concat(['이름', '유형', '보관조건', '주소', '담당자']),
  '벤더': COMMON.concat(['구분', '상호', '사업자등록번호', '대표자', '사업장주소', '업태', '종목', '담당자', '연락처',
    '이메일', '거래경로', '제조사코드', '은행', '계좌번호', '예금주', '메모', '거래형태', '대금지급주기']),
  '상품': COMMON.concat(['상품명', '공급사코드', '제조사코드', '대분류', '중분류', '거래형태', '규격', '납품단위', '판매단위',
    '바코드', '박스코드', '박스입수', '소비기한', '보관', '과세구분', '공급가', '수수료율', '일반회원가', '구독회원가', '메모',
    '분류ID', '소분류', '배송방식', '브랜드구분', '제조원', '거래조건', '배송비부담', '연결주소', '회원혜택', '몰상품코드', '운영방식', '기본창고']),
  '계약': COMMON.concat(['종류', '종류명', '벤더코드', '상호', '버전', '상위계약번호', '계약시작일', '계약종료일', '키값JSON',
    'PDF파일ID', 'PDF해시', '확정일시', '확정자', '폴더ID', '메모', '계약체결일', '거래형태', '구성', '서명방식', '서명요청일시',
    '업체서명자', '업체서명직위', '업체서명일시', '업체서명파일ID', '업체서명계정', '회사서명자', '회사서명일시', '회사서명파일ID', '회사서명계정', '서명본파일ID']),
  '계약첨부': COMMON.concat(['계약번호', '유형', '파일ID', '파일명', '크기', '확인상태', '확인자', '확인일시']),
  '선택목록': COMMON.concat(['키', '값', '계약종류', '순서']),
  '계약양식': COMMON.concat(['코드', '버전', '내용JSON', '메모']),
  '주문': COMMON.concat(['주문번호', '주문일시', '결제일시', '주문상태', '원래상태', '상품ID', '몰상품코드', '상품명', '옵션', '수량', '판매단가', '상품금액',
    '할인금액', '결제금액', '배송비', '결제수단', '배송완료일', '구매확정일', '회원구분', '송장번호', '택배사', '공급사코드', '거래형태', '배송방식', '업로드번호', '정산번호', '조정정산번호', '메모',
    '운영방식', '배송일자', '반품완료일', '출하원가', '교환처리일', '배송일자변경']),
  '매입': COMMON.concat(['매입번호', '공급사코드', '상호', '입고일', '창고ID', '상품ID', '상품명', '수량', '단가', '공급가액', '부가세', '합계', '과세구분', '정산번호', '메모',
    '원천', '인식일', '주문품목키', '운영방식', '거래형태']),
  '정산': COMMON.concat(['정산번호', '구분', '공급사코드', '상호', '기간시작', '기간종료', '지급예정일', '건수', '대상금액', '공제금액', '수수료', '수수료부가세', '공급가액', '부가세', '지급액', '지급일', '메모', '지급주기', '회차', '차이건수']),
  '정산상세': COMMON.concat(['정산번호', '원천', '원천ID', '일자', '상품ID', '상품명', '수량', '단가', '금액', '수수료율', '수수료', '부가세', '비고', '아임웹금액', '화프스금액', '차이', '차이사유']),
  '재고수불': COMMON.concat(['일자', '창고ID', '상품ID', '상품명', '구분', '소유', '수량', '단가', '금액', '원천', '원천ID', '잔량', '이동평균단가', '재고금액', '사유', '메모']),
  '광고측정': COMMON.concat(['계약번호', '공급사코드', '월', '클릭수', '무효클릭수', '노출수', '공급사보고매출', '공급사보고클릭', '금액', '확정', '정산번호', '메모']),
  '광고클릭': ['시각', '계약번호', '상품ID', '기기', '유효', '사유'],
  'PG정산': COMMON.concat(['거래일', '주문번호', '결제금액', '수수료', '부가세', '업로드번호']),
  '비용': COMMON.concat(['월', '항목', '금액', '메모']),
  '감사로그': ['시각', '사용자', '작업', '대상', '내용'],
  '설정': ['키', '값', '설명']
};
const SETTINGS_DEFAULT = [
  ['회사_상호', '주식회사 지씨더블유', '계약서의 공급받는 자 상호'],
  ['회사_사업자번호', '248-86-03563', '계약서에 들어가는 우리 회사 사업자등록번호'],
  ['회사_대표자', '박찬우', '계약서 서명란 대표자'],
  ['회사_주소', '서울특별시 강남구 역삼로 512, 5층-760 (대치동, 인테크빌딩)', '사업장 주소 정정신고 후 바꾸세요'],
  ['VAT', '0.1', '부가세율'],
  ['PG율', '0.033', 'PG 수수료율(VAT 별도)'],
  ['원가보전선_직매입', '0.10', '직매입 세제외 마진율 하한'],
  ['원가보전선_위탁판매', '0.05', '위탁판매 수수료율 하한'],
  ['계약만료알림일', '60', '만료 며칠 전부터 홈에 표시'],
  ['첨부최대MB', '10', '업로드 파일 최대 크기(MB)'],
  ['로고파일ID', '', '계약서 바닥글 로고(화면에서 자동 등록)'],
  ['로고비율', '', '로고 세로÷가로 비율(자동)'],
  ['직인파일ID', '', '회사 직인 이미지(전자서명에 사용)'],
  ['직인비율', '', '직인 세로÷가로 비율(자동)'],
  ['기본출고창고', '', '재고형 주문이 나가는 보관창고(비우면 W02부터 처음 쓰는 창고). 상품에 기본창고를 정하면 그것이 우선'],
  ['정산차이_반올림', '10', '정산 줄의 아임웹 금액과 화프스 계산 차이가 이 금액(원) 미만이면 "반올림 차이"로 자동 등록'],
  ['재고마감월', '', '이 달까지 재고 수불을 고정합니다(재고 화면의 "재고 마감"으로 바꿈). 마감한 달은 다시 계산하지 않아 빨라집니다'],
  ['광고링크주소', '', '광고 추적 링크의 시작 주소(화프스 주소 + go.html). 예) https://아이디.github.io/whaps/go.html'],
  ['공휴일', '2026-01-01,2026-02-16,2026-02-17,2026-02-18,2026-03-02,2026-05-05,2026-05-25,2026-06-03,2026-08-17,2026-09-24,2026-09-25,2026-09-26,2026-10-05,2026-10-09,2026-12-25,2027-01-01', '지급일 계산용 공휴일(쉼표로 구분). 2027년 공휴일은 확정되면 추가하세요']
];
const PDF_FONT = 'Noto Sans KR';
const MM = 2.8346457;  // 1mm = 2.83pt
const A4 = { w: 595.28, h: 841.89, top: 20 * MM, bottom: 35 * MM, left: 20 * MM, right: 20 * MM };  // 아래 35mm: 본문과 바닥 로고 사이 약 1.5cm
const VENDOR_KINDS = ['공급사', 'PB제조사', '물류사', '개발사', '기타'];
const VENDOR_KIND_MAP = { '벤더': '공급사', '제조사': 'PB제조사', '3PL': '물류사', '수탁사': '물류사' };   // v2 → v3
const VENDOR_STATES = ['후보', '계약중', '중단'];
const PRODUCT_STATE_MAP = { '후보': '판매대기', '승인': '판매중', '판매': '판매중', '중단': '판매종료', '검토중': '판매대기', '판매중지': '판매종료' };   // v2·v3 → v4
const WAREHOUSE_TYPES = ['3PL센터', '샘플실', '사무실 보관', '기타'];
const VIRTUAL_WH = 'W01';      // 가상창고: 주문형 직매입 상품이 송장발행일에 들어오고 같은 날 나가는 창고(잔액은 매일 0)
const CONTRACT_STATES = ['작성중', '서명대기', '증빙수집', '완료', '종료'];
const ATTACH_TYPES = ['서명본', '사업자등록증', '통장사본', 'PL보험증권', '기타'];
const SENSITIVE_DOCS = ['사업자등록증', '통장사본'];
const VENDOR_UPLOAD_TYPES = ['사업자등록증', '통장사본', 'PL보험증권'];
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const TOKEN_TTL = 21600; // 6시간
const STAFF = ['관리자', '운영기획'];
const EDITORS = ['관리자', '운영기획', 'MD'];
// 업체 계정이 부를 수 있는 작업(그 밖은 모두 거절)
const VENDOR_ACTIONS = ['auth.me', 'auth.logout', 'auth.changePassword', 'bootstrap', 'contract.get', 'file.get', 'esign.sign', 'attach.upload'];

// 쓰기 작업별 허용 역할 (읽기 작업은 업체를 뺀 로그인한 모든 역할)
const PERM = {
  'notice.save': STAFF, 'notice.delete': STAFF,
  'vendor.save': EDITORS, 'category.save': STAFF, 'warehouse.save': STAFF, 'product.save': EDITORS,
  'contract.saveDraft': EDITORS, 'contract.deleteDraft': EDITORS, 'contract.confirm': STAFF,
  'contract.newVersion': EDITORS, 'contract.complete': STAFF, 'contract.close': STAFF,
  'attach.upload': STAFF.concat(['업체']), 'attach.verify': STAFF, 'settings.logo': STAFF, 'settings.seal': STAFF, 'choice.save': STAFF,
  'esign.request': STAFF, 'esign.sign': STAFF.concat(['업체']),
  'vendor.import': STAFF, 'category.import': STAFF, 'warehouse.import': STAFF, 'product.import': STAFF,
  'form.save': ['관리자'], 'form.reset': ['관리자'],
  'order.import': STAFF, 'order.link': STAFF, 'purchase.save': EDITORS, 'purchase.state': STAFF,
  'settle.create': STAFF, 'settle.state': STAFF, 'settle.diffSave': STAFF, 'expense.save': STAFF,
  'stock.move': STAFF, 'stock.sync': STAFF, 'stock.close': STAFF, 'ad.measureSave': STAFF, 'pg.import': STAFF,
  'user.list': ['관리자'], 'user.save': ['관리자'], 'user.resetPassword': ['관리자'],
  'audit.list': ['관리자'], 'settings.save': ['관리자']
};

class AppError extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}

/* ───────────────────────── 진입점 ───────────────────────── */
function doGet() { return out_({ ok: true, data: { app: 'WHAPS', version: APP_VERSION } }); }

// 한 번의 요청 안에서는 같은 시트를 다시 읽지 않습니다(속도).
let MEMO = null;
function doPost(e) {
  MEMO = memo_();
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return out_({ ok: false, code: 'bad_request', msg: '요청 형식이 올바르지 않습니다.' }); }
  try {
    const action = String(req.action || '');
    const payload = req.payload || {};
    if (action === 'ping') return out_({ ok: true, data: { version: APP_VERSION } });
    if (action === 'login') return out_({ ok: true, data: login_(payload) });
    if (action === 'ad.click') return out_({ ok: true, data: adClick_(payload) });     // 광고 추적 링크(로그인 없음)
    const user = session_(req.token);
    const fn = ACTIONS[action];
    if (!fn) throw new AppError('bad_action', '알 수 없는 작업입니다: ' + action);
    if (user.role === '업체' && VENDOR_ACTIONS.indexOf(action) < 0) throw new AppError('forbidden', '이 작업을 할 권한이 없습니다.');
    if (PERM[action] && PERM[action].indexOf(user.role) < 0) throw new AppError('forbidden', '이 작업을 할 권한이 없습니다.');
    if (user.mustChange && ['auth.me', 'auth.logout', 'auth.changePassword'].indexOf(action) < 0) {
      throw new AppError('must_change', '처음 로그인했거나 비밀번호가 초기화되었습니다. 비밀번호를 먼저 바꾸세요.');
    }
    let data;
    MEMO.dirty = false; MEMO.opsDirty = false;
    if (PERM[action] && action !== 'user.list' && action !== 'audit.list') {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { data = fn(payload, user, req.token); } finally { lock.releaseLock(); }
    } else {
      data = fn(payload, user, req.token);
    }
    bumpDirty_();
    return out_({ ok: true, data: data });
  } catch (err) {
    bumpDirty_();
    if (err instanceof AppError) return out_({ ok: false, code: err.code, msg: err.message });
    console.error(err && err.stack ? err.stack : err);
    return out_({ ok: false, code: 'server', msg: '서버 오류: ' + (err && err.message ? err.message : String(err)) });
  }
}

/* ───────────────────────── 최초 설정 · 이전 작업 ───────────────────────── */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABS).forEach(function (name) {
    let s = ss.getSheetByName(name);
    if (!s) s = ss.insertSheet(name);
    const want = TABS[name];
    const lastCol = Math.max(s.getLastColumn(), 1);
    const cur = s.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    if (cur.join('') === '') {
      s.getRange(1, 1, 1, want.length).setValues([want]);
    } else {
      want.forEach(function (k) {
        if (cur.indexOf(k) < 0) { s.getRange(1, s.getLastColumn() + 1).setValue(k); cur.push(k); }
      });
    }
    s.setFrozenRows(1);
    s.getRange(1, 1, s.getMaxRows(), Math.max(s.getLastColumn(), want.length)).setNumberFormat('@');
  });
  const have = readRaw_('설정').map(function (r) { return r['키']; });
  SETTINGS_DEFAULT.forEach(function (r) { if (have.indexOf(r[0]) < 0) appendRow_('설정', r); });
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ROOT_FOLDER_ID')) props.setProperty('ROOT_FOLDER_ID', DriveApp.createFolder('WHAPS').getId());
  const report = migrate_();
  if (!readRaw_('사용자').length) {
    const pw = tempPassword_();
    const salt = Utilities.getUuid();
    const t = now_();
    appendObj_('사용자', { id: 'admin', 상태: '사용', 생성일시: t, 생성자: 'setup', 수정일시: t, 수정자: 'setup', 삭제: 'N',
      이름: '관리자', 역할: '관리자', 해시: hash_(pw, salt), 솔트: salt, 비밀번호변경필요: 'Y', 실패횟수: '0', 잠금해제시각: '' });
    Logger.log('첫 관리자 아이디: admin   임시 비밀번호: ' + pw + '   (처음 로그인하면 바꾸게 됩니다)');
  } else {
    Logger.log('사용자가 이미 있어서 시트 구조와 설정만 점검했습니다.');
  }
  Logger.log('이전 작업(v3·v4 → v5): ' + JSON.stringify(report));
  bumpVersion_();
}
// v2 자료를 v3 구조로 옮깁니다(여러 번 실행해도 안전).
function migrate_() {
  const sys = { id: 'setup' };
  const rep = { 벤더구분: 0, 분류트리: 0, 상품상태: 0, 상품분류: 0, 선택목록추가: 0, 선택목록정리: 0 };
  readRaw_('벤더').forEach(function (v) {
    if (VENDOR_KIND_MAP[v['구분']]) { v['구분'] = VENDOR_KIND_MAP[v['구분']]; save_('벤더', v, sys, false); rep.벤더구분++; }
  });
  // 분류: 대·중·소 한 줄짜리 → 트리(이름·단계·상위ID)
  const rows = readRaw_('분류');
  const next = idGen_(rows, 'K', 3);
  const nodes = rows.filter(function (r) { return r['이름'] && r['삭제'] !== 'Y'; });
  const findChild = function (parent, name) { return nodes.filter(function (n) { return (n['상위ID'] || '') === parent && n['이름'] === name; })[0]; };
  rows.filter(function (r) { return !r['이름'] && r['대분류'] && r['삭제'] !== 'Y'; }).forEach(function (old) {
    let parent = '';
    [old['대분류'], old['중분류'], old['소분류']].forEach(function (name, i) {
      name = str_(name);
      if (!name) return;
      let n = findChild(parent, name);
      if (!n) {
        n = { id: next(), 상태: '사용', 이름: name, 단계: String(i + 1), 상위ID: parent, 순서: String(nodes.filter(function (x) { return (x['상위ID'] || '') === parent; }).length + 1),
          노출: old['노출'] || 'Y', 체계버전: old['체계버전'] || '9+1' };
        save_('분류', n, sys, true);
        nodes.push(n);
        rep.분류트리++;
      }
      parent = n.id;
    });
    old['삭제'] = 'Y';
    old['상태'] = '이전됨';
    save_('분류', old, sys, false);
  });
  const all = read_('분류').filter(function (r) { return r['이름']; });
  readRaw_('상품').forEach(function (p) {
    let changed = false;
    if (PRODUCT_STATE_MAP[p['상태']]) { p['상태'] = PRODUCT_STATE_MAP[p['상태']]; changed = true; rep.상품상태++; }
    if (!p['분류ID'] && p['대분류']) {
      let parent = '', last = null;
      [p['대분류'], p['중분류']].forEach(function (name) {
        if (!name || (parent === null)) return;
        const n = all.filter(function (x) { return (x['상위ID'] || '') === parent && x['이름'] === name; })[0];
        if (n) { last = n; parent = n.id; } else parent = null;
      });
      if (last) { p['분류ID'] = last.id; changed = true; rep.상품분류++; }
    }
    if (changed) save_('상품', p, sys, false);
  });
  // 선택목록: v2의 계약 종류 코드(01~10) 항목은 정리하고, v3 기본값 중 없는 것만 추가
  const old = /^(0[1-9]|10)$/;
  const ch = readRaw_('선택목록');
  ch.forEach(function (c) { if (c['삭제'] !== 'Y' && old.test(c['계약종류'])) { c['삭제'] = 'Y'; save_('선택목록', c, sys, false); rep.선택목록정리++; } });
  const live = ch.filter(function (c) { return c['삭제'] !== 'Y'; });
  const nextL = idGen_(ch, 'L', 3);
  // v5: 대금 지급주기 선택 목록을 4종(월 1~4회)으로 교체
  const cycles = CHOICE_DEFAULTS.filter(function (d) { return d[0] === '대금지급주기'; }).map(function (d) { return d[1]; });
  live.forEach(function (c) { if (c['키'] === '대금지급주기' && cycles.indexOf(c['값']) < 0 && c['삭제'] !== 'Y') { c['삭제'] = 'Y'; save_('선택목록', c, sys, false); rep.선택목록정리++; } });
  CHOICE_DEFAULTS.forEach(function (d) {
    const dup = live.some(function (c) { return c['삭제'] !== 'Y' && c['키'] === d[0] && c['값'] === d[1] && (c['계약종류'] || '') === d[2]; });
    if (dup) return;
    save_('선택목록', { id: nextL(), 상태: '사용', 키: d[0], 값: d[1], 계약종류: d[2], 순서: d[3] }, sys, true);
    rep.선택목록추가++;
  });
  Object.assign(rep, migrateV5_(sys));
  return rep;
}
// v4 → v5: 배송방식 → 운영방식, 가상창고 W01, 매입 원장 원천, 지급주기, 계약 양식 태그 (여러 번 실행해도 안전)
function migrateV5_(sys) {
  const rep = { 상품운영방식: 0, 주문운영방식: 0, 창고W01: '', 매입원천: 0, 벤더지급주기: 0, 양식태그: 0 };
  readRaw_('상품').forEach(function (p) {
    if (p['삭제'] === 'Y') return;
    const md = modeOf(p['운영방식'] || p['배송방식']);
    if (p['배송방식'] || (md && md !== p['운영방식'])) { p['운영방식'] = md; p['배송방식'] = ''; save_('상품', p, sys, false); rep.상품운영방식++; }
  });
  const om = matrixOf_('주문');
  om.objs.forEach(function (o) {
    if (!o.id || o['운영방식'] || !o['배송방식']) return;
    o['운영방식'] = modeOf(o['배송방식']); mxPut_(om, o); rep.주문운영방식++;
  });
  if (rep.주문운영방식) mxSave_(om);
  // 창고: W01은 가상창고로 고정. 예전에 W01을 다른 창고로 썼다면 새 코드로 옮기고 매입의 창고 코드도 바꿉니다.
  const whs = readRaw_('창고');
  const w01 = whs.filter(function (w) { return w.id === VIRTUAL_WH; })[0];
  if (w01 && w01['유형'] !== '가상') {
    const nid = idGen_(whs, 'W', 2)();
    w01.id = nid; save_('창고', w01, sys, false);
    const pm = matrixOf_('매입');
    pm.objs.forEach(function (r) { if (r['창고ID'] === VIRTUAL_WH) { r['창고ID'] = nid; mxPut_(pm, r); } });
    mxSave_(pm);
    readRaw_('상품').forEach(function (p) { if (p['기본창고'] === VIRTUAL_WH) { p['기본창고'] = nid; save_('상품', p, sys, false); } });
    rep.창고W01 = '기존 W01 → ' + nid;
  }
  if (!readRaw_('창고').some(function (w) { return w.id === VIRTUAL_WH; })) {
    save_('창고', { id: VIRTUAL_WH, 상태: '사용', 이름: '가상창고', 유형: '가상', 보관조건: '', 주소: '', 담당자: '' }, sys, true);
    rep.창고W01 = (rep.창고W01 ? rep.창고W01 + ', ' : '') + 'W01 가상창고 만듦';
  }
  const pm2 = matrixOf_('매입');
  pm2.objs.forEach(function (r) { if (r.id && !r['원천']) { r['원천'] = '센터입고'; r['인식일'] = r['입고일']; r['운영방식'] = '재고형'; r['거래형태'] = '직매입'; mxPut_(pm2, r); rep.매입원천++; } });
  if (rep.매입원천) mxSave_(pm2);
  readRaw_('벤더').forEach(function (v) {
    if (v['삭제'] === 'Y') return;
    const t = v['구분'] === 'PB제조사' ? '직매입' : v['거래형태'];
    const want = cycleOf(v['대금지급주기']) || PAY_CYCLE_DEFAULT[t] || '';
    if (want !== (v['대금지급주기'] || '')) { v['대금지급주기'] = want; save_('벤더', v, sys, false); rep.벤더지급주기++; }
  });
  readRaw_('계약양식').forEach(function (r) {
    if (r['삭제'] === 'Y' || !/자사배송|업체배송/.test(r['내용JSON'] || '')) return;
    try {
      const f = JSON.parse(r['내용JSON']);
      (f.sections || []).forEach(function (sec) { if (sec.when) sec.when = sec.when.map(modeOf); });
      r['내용JSON'] = JSON.stringify(f); save_('계약양식', r, sys, false); rep.양식태그++;
    } catch (e) { /* 깨진 판은 그대로 */ }
  });
  return rep;
}
// 오픈 전에 시험으로 넣은 주문·매입·정산·재고·광고 측정을 모두 지웁니다(삭제 표시). Apps Script 편집기에서 직접 한 번 실행하세요.
function clearTestOps() {
  MEMO = memo_();
  let n = 0;
  ['주문', '매입', '정산', '정산상세', '재고수불', '광고측정', 'PG정산'].forEach(function (tab) {
    const mx = matrixOf_(tab);
    mx.objs.forEach(function (r) { if (r.id && r['삭제'] !== 'Y') { r['삭제'] = 'Y'; mxPut_(mx, r); n++; } });
    mxSave_(mx);
  });
  audit_({ id: 'setup' }, '시험 운영 자료 정리', '', n + '건');
  bumpVersion_();
  Logger.log('시험 주문·매입·정산·재고 ' + n + '건을 지웠습니다. 오픈 전 기초재고는 매입 화면에서 "기초재고"로 한 번 등록하세요.');
}
// 시험으로 만든 계약과 첨부를 모두 지웁니다(삭제 표시). Apps Script 편집기에서 직접 한 번 실행하세요.
function clearTestContracts() {
  let n = 0;
  ['계약', '계약첨부'].forEach(function (tab) {
    readRaw_(tab).forEach(function (r) { if (r['삭제'] !== 'Y') { r['삭제'] = 'Y'; save_(tab, r, { id: 'setup' }, false); n++; } });
  });
  audit_({ id: 'setup' }, '시험 계약 정리', '', n + '건');
  bumpVersion_();
  Logger.log('시험 계약과 첨부 ' + n + '건을 지웠습니다.');
}

function login_(p) {
  const id = String(p.id || '').trim();
  const pw = String(p.password || '');
  if (!id || !pw) throw new AppError('login', '아이디와 비밀번호를 입력하세요.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const u = readRaw_('사용자').filter(function (x) { return x.id === id && x['삭제'] !== 'Y'; })[0];
    if (!u || u['상태'] !== '사용') throw new AppError('login', '아이디 또는 비밀번호가 맞지 않습니다.');
    const until = Number(u['잠금해제시각'] || 0);
    if (until && Date.now() < until) {
      throw new AppError('locked', '비밀번호를 5번 틀려 잠겼습니다. ' + Math.ceil((until - Date.now()) / 60000) + '분 뒤 다시 시도하세요.');
    }
    if (hash_(pw, u['솔트']) !== u['해시']) {
      let n = Number(u['실패횟수'] || 0) + 1;
      if (n >= 5) { u['잠금해제시각'] = String(Date.now() + 15 * 60000); n = 0; }
      u['실패횟수'] = String(n);
      updateObj_('사용자', u._row, u);
      audit_({ id: id }, '로그인 실패', id, '');
      throw new AppError('login', '아이디 또는 비밀번호가 맞지 않습니다.');
    }
    u['실패횟수'] = '0';
    u['잠금해제시각'] = '';
    updateObj_('사용자', u._row, u);
    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    const sess = { id: u.id, name: u['이름'], role: u['역할'], mustChange: u['비밀번호변경필요'] === 'Y', vendorId: u['역할'] === '업체' ? (u['벤더코드'] || '') : '' };
    CacheService.getScriptCache().put('t_' + token, JSON.stringify(sess), TOKEN_TTL);
    audit_(sess, '로그인', u.id, '');
    return { token: token, user: sess, settings: settings_(), data: sess.mustChange ? null : bootstrap_({}, sess) };
  } finally {
    lock.releaseLock();
  }
}
/* ───────────────────────── 작업 목록 ───────────────────────── */
const ACTIONS = {
  'auth.me': function (p, u) { return { user: u, settings: settings_() }; },
  'auth.logout': function (p, u, token) { CacheService.getScriptCache().remove('t_' + token); audit_(u, '로그아웃', u.id, ''); return true; },
  'auth.changePassword': changePassword_,
  'dashboard': dashboard_,
  'bootstrap': bootstrap_,
  'vendor.import': function (p, u) { return import_('vendor.import', p, u); },
  'category.import': categoryImport_,
  'warehouse.import': function (p, u) { return import_('warehouse.import', p, u); },
  'product.import': function (p, u) { return import_('product.import', p, u); },
  'settings.logo': logoSave_,
  'settings.seal': sealSave_,
  'choice.save': choiceSave_,
  'notice.list': function () { return read_('공지').map(clean_).sort(function (a, b) { return b.id < a.id ? -1 : 1; }); },
  'notice.save': noticeSave_,
  'notice.delete': function (p, u) {
    const n = findById_('공지', str_(p.id));
    if (!n) throw new AppError('not_found', '공지를 찾을 수 없습니다.');
    n['삭제'] = 'Y';
    save_('공지', n, u, false);
    audit_(u, '공지 삭제', n.id, n['제목']);
    return true;
  },
  'vendor.list': function (p, u) { return read_('벤더').map(function (v) { return vendorOut_(v, u); }); },
  'vendor.save': vendorSave_,
  'category.list': function () { return categories_(); },
  'category.save': categorySave_,
  'warehouse.list': function () { return read_('창고').map(clean_); },
  'warehouse.save': warehouseSave_,
  'product.list': function () { return read_('상품').map(clean_); },
  'product.save': productSave_,
  'contract.list': contractList_,
  'contract.get': contractGet_,
  'contract.saveDraft': contractSaveDraft_,
  'contract.deleteDraft': contractDeleteDraft_,
  'contract.confirm': contractConfirm_,
  'contract.newVersion': contractNewVersion_,
  'contract.complete': contractComplete_,
  'contract.close': contractClose_,
  'esign.request': esignRequest_,
  'form.list': function () { return formsAll_(); },
  'form.history': formHistory_,
  'form.save': formSave_,
  'form.reset': formReset_,
  'order.import': orderImport_,
  'order.list': function (p, u) { return cached_('orders', p, function () { return orderList_(p, u); }); },
  'order.link': orderLink_,
  'purchase.list': purchaseList_,
  'purchase.save': purchaseSave_,
  'purchase.state': purchaseState_,
  'settle.preview': settlePreview_,
  'settle.create': settleCreate_,
  'settle.get': settleGet_,
  'settle.state': settleState_,
  'settle.diffSave': settleDiffSave_,
  'purchase.auto': purchaseAuto_,
  'stock.list': function (p, u) { return cached_('stock', { s: canSeeSensitive_(u) }, function () { return stockList_(p, u); }); },
  'stock.ledger': stockLedger_,
  'stock.move': stockMove_,
  'stock.sync': function (p, u) { const r = opsSync_(u); return Object.assign(r, stockList_({}, u)); },
  'stock.close': stockClose_,
  'ops.home': function (p, u) { return canSeeSensitive_(u) ? cached_('home', { d: today_() }, opsHome_) : null; },
  'expense.list': function (p, u) { if (!canSeeSensitive_(u)) throw new AppError('forbidden', '비용은 운영기획·관리자만 볼 수 있습니다.'); return read_('비용').map(clean_); },
  'ad.list': adList_,
  'ad.measureSave': adMeasureSave_,
  'pg.import': pgImport_,
  'settle.list': function (p, u) { if (!canSeeSensitive_(u)) throw new AppError('forbidden', '정산은 운영기획·관리자만 볼 수 있습니다.'); return read_('정산').map(clean_); },
  'expense.save': expenseSave_,
  'pl.report': function (p, u) { if (!canSeeSensitive_(u)) throw new AppError('forbidden', '손익은 운영기획·관리자만 볼 수 있습니다.'); return cached_('pl', { y: str_(p.year), d: today_() }, function () { return plReport_(p, u); }); },
  'check.run': function (p, u) { return cached_('check', { d: today_(), s: canSeeSensitive_(u) }, function () { return checkRun_(p, u); }); },
  'esign.sign': esignSign_,
  'attach.upload': attachUpload_,
  'attach.verify': attachVerify_,
  'file.get': fileGet_,
  'user.list': function () { return read_('사용자').map(clean_); },
  'user.save': userSave_,
  'user.resetPassword': userReset_,
  'audit.list': function (p) {
    const rows = readRaw_('감사로그');
    const n = Math.min(Number(p.limit) || 200, 1000);
    return rows.slice(-n).reverse().map(clean_);
  },
  'settings.save': function (p, u) {
    const key = need_(p.키, '키');
    const row = readRaw_('설정').filter(function (r) { return r['키'] === key; })[0];
    if (!row) throw new AppError('not_found', '없는 설정입니다: ' + key);
    if (key === '재고마감월') throw new AppError('invalid', '재고 마감은 재고 화면의 "재고 마감"에서 바꿉니다.');
    row['값'] = str_(p.값);
    updateObj_('설정', row._row, row);
    audit_(u, '설정 변경', key, row['값']);
    return settings_();
  }
};

/* ───────────────────────── 계정 ───────────────────────── */
function userSave_(p, u) {
  const id = str_(p.id, 40);
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(id)) throw new AppError('invalid', '아이디는 영문·숫자 3자 이상으로 정하세요.');
  const role = oneOf_(str_(p.역할), ROLES, '역할');
  const state = oneOf_(str_(p.상태) || '사용', ['사용', '중지'], '상태');
  let row = findById_('사용자', id);
  let temp = null;
  if (p.isNew) {
    if (row) throw new AppError('duplicate', '이미 있는 아이디입니다.');
    temp = tempPassword_();
    const salt = Utilities.getUuid();
    row = { id: id, 해시: hash_(temp, salt), 솔트: salt, 비밀번호변경필요: 'Y', 실패횟수: '0', 잠금해제시각: '' };
  } else if (!row) {
    throw new AppError('not_found', '사용자를 찾을 수 없습니다.');
  }
  if (row.id === u.id && (role !== '관리자' || state !== '사용')) throw new AppError('invalid', '내 계정의 관리자 권한은 스스로 해제할 수 없습니다.');
  let vendorId = '';
  if (role === '업체') {
    vendorId = str_(p.벤더코드) || row['벤더코드'] || '';
    const v = findById_('벤더', vendorId);
    if (!v || v['삭제'] === 'Y') throw new AppError('invalid', '업체 계정은 연결할 벤더 코드가 필요합니다.');
  }
  row['이름'] = need_(p.이름, '이름');
  row['역할'] = role;
  row['상태'] = state;
  row['벤더코드'] = vendorId;
  const saved = save_('사용자', row, u, !!p.isNew);
  audit_(u, p.isNew ? '사용자 추가' : '사용자 수정', id, role + '/' + state + (vendorId ? '/' + vendorId : ''));
  return { user: saved, tempPassword: temp };
}

/* ───────────────────────── 홈 · 전체 자료 ───────────────────────── */
function dashboard_(p, u) {
  const cs = read_('계약');
  const at = read_('계약첨부');
  const st = settings_();
  const warn = Number(st['계약만료알림일'] || 60);
  const counts = {};
  CONTRACT_STATES.forEach(function (s) { counts[s] = 0; });
  cs.forEach(function (c) { counts[c['상태']] = (counts[c['상태']] || 0) + 1; });
  const lite = function (c) { return { id: c.id, 상호: c['상호'], 종류명: c['종류명'], 상태: c['상태'], 계약종료일: c['계약종료일'], 수정일시: c['수정일시'],
    서명방식: c['서명방식'], 업체서명일시: c['업체서명일시'], 회사서명일시: c['회사서명일시'] }; };
  const pending = at.filter(function (a) { return a['확인상태'] === '미확인'; });
  const products = read_('상품');
  const pcounts = {};
  PRODUCT_STATES.forEach(function (s) { pcounts[s] = 0; });
  products.forEach(function (x) { pcounts[x['상태']] = (pcounts[x['상태']] || 0) + 1; });
  return {
    contracts: counts,
    waitingSign: cs.filter(function (c) { return c['상태'] === '서명대기'; }).map(lite),
    collecting: cs.filter(function (c) { return c['상태'] === '증빙수집'; }).map(lite),
    docsToCheck: pending.length,
    expiring: cs.filter(function (c) {
      const d = daysUntil_(c['계약종료일']);
      return c['상태'] === '완료' && d >= 0 && d <= warn;
    }).map(function (c) { const o = lite(c); o.남은일 = daysUntil_(c['계약종료일']); return o; }),
    vendors: read_('벤더').length,
    products: pcounts,
    notices: read_('공지').sort(function (a, b) { return b.id < a.id ? -1 : 1; }).slice(0, 5).map(clean_),
    ops: null                                         // 운영 요약은 'ops.home'으로 따로 받습니다(주문을 올려도 이 캐시는 그대로)
  };
}
// 앱을 열 때 한 번에 필요한 목록을 모두 돌려줍니다(왕복 횟수를 줄여 속도 개선).
function bootstrap_(p, u) {
  if (u.role === '업체') return vendorBootstrap_(u);
  const key = 'bs_' + dataVersion_() + '_' + (canSeeSensitive_(u) ? 'staff' : 'basic');
  const hit = cacheGet_(key);
  if (hit) { const d = JSON.parse(hit); d.user = u; return d; }
  const atts = read_('계약첨부');
  const details = {};
  read_('계약').forEach(function (c) {
    const mine = atts.filter(function (a) { return a['계약번호'] === c.id; }).map(function (a) { return attachOut_(a, u); });
    details[c.id] = { contract: contractLite_(c), values: valuesOf_(c), attachments: mine, checklist: checklist_(mine, c) };
  });
  const d = {
    user: u, settings: settings_(), dashboard: dashboard_(p, u),
    vendors: read_('벤더').map(function (v) { return vendorOut_(v, u); }),
    categories: categories_(), warehouses: read_('창고').map(clean_),
    products: read_('상품').map(clean_), contracts: contractList_({}),
    notices: read_('공지').map(clean_).sort(function (a, b) { return b.id < a.id ? -1 : 1; }),
    choices: choices_(), details: details, forms: formsAll_(), at: now_()
  };
  cachePut_(key, JSON.stringify(d), 600);
  return d;
}
// 업체 계정: 자기 회사 정보와 확정된 자기 계약만
function vendorBootstrap_(u) {
  const v = findById_('벤더', u.vendorId);
  if (!v || v['삭제'] === 'Y') throw new AppError('forbidden', '연결된 업체 정보가 없습니다. 담당자에게 문의하세요.');
  const st = settings_();
  const company = {};
  ['회사_상호', '회사_사업자번호', '회사_대표자', '회사_주소', '첨부최대MB'].forEach(function (k) { company[k] = st[k]; });
  const cs = read_('계약').filter(function (c) { return c['벤더코드'] === v.id && c['상태'] !== '작성중'; });
  const details = {};
  cs.forEach(function (c) { details[c.id] = contractGet_({ id: c.id }, u); });
  return { user: u, settings: company, vendor: clean_(v), contracts: cs.map(function (c) { return vendorLite_(contractLite_(c)); }),
    details: details, vendors: [], categories: [], warehouses: [], products: [], notices: [], choices: [], dashboard: null, at: now_() };
}
function vendorLite_(o) { delete o['메모']; delete o['확정자']; delete o['회사서명계정']; delete o['폴더ID']; return o; }
function choicesFor_(kind, trade) {
  const m = {};
  choices_().forEach(function (c) {
    const scope = c['계약종류'];
    if (scope && scope !== kind && scope !== trade) return;
    (m[c['키']] = m[c['키']] || []).push(c['값']);
  });
  return m;
}
function choiceSave_(p, u) {
  const rows = readRaw_('선택목록');
  const old = p.id ? rows.filter(function (x) { return x.id === str_(p.id); })[0] : null;
  if (p.id && !old) throw new AppError('not_found', '목록 항목을 찾을 수 없습니다.');
  const row = old || { id: idGen_(rows, 'L', 3)() };
  row['키'] = need_(p.키, '키');
  if (!KEY_META[row['키']] || KEY_META[row['키']].t !== 'select') throw new AppError('invalid', '선택 목록을 쓰는 입력값이 아닙니다: ' + row['키']);
  row['값'] = need_(p.값, '값');
  row['계약종류'] = str_(p.계약종류);
  if (row['계약종류'] && !CONTRACT_KINDS[row['계약종류']] && TRADE_TYPES.indexOf(row['계약종류']) < 0) throw new AppError('invalid', '적용 대상은 계약 종류나 거래형태여야 합니다: ' + row['계약종류']);
  row['순서'] = String(Number(p.순서) || 1);
  row['상태'] = '사용';
  if (p.삭제) row['삭제'] = 'Y';
  save_('선택목록', row, u, !old);
  audit_(u, p.삭제 ? '선택목록 삭제' : (old ? '선택목록 수정' : '선택목록 추가'), row.id, row['키'] + ' = ' + row['값'] + ' (' + (row['계약종류'] || '전체') + ')');
  return choices_();
}
// 회사 직인(전자서명용) 이미지 등록
function sealSave_(p, u) {
  const mime = oneOf_(str_(p.mime), ['image/png', 'image/jpeg'], '직인 형식(PNG·JPG)');
  const bytes = Utilities.base64Decode(String(p.data || ''));
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new AppError('invalid', '2MB 이하의 직인 이미지를 올리세요.');
  const ratio = Number(p.ratio);
  if (!(ratio > 0.2 && ratio < 5)) throw new AppError('invalid', '직인 비율을 알 수 없습니다.');
  const root = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID'));
  const file = root.createFile(Utilities.newBlob(bytes, mime, '회사_직인.' + (mime === 'image/png' ? 'png' : 'jpg')));
  const rows = readRaw_('설정');
  [['직인파일ID', file.getId()], ['직인비율', String(Math.round(ratio * 10000) / 10000)]].forEach(function (kv) {
    const r = rows.filter(function (x) { return x['키'] === kv[0]; })[0];
    if (r) { r['값'] = kv[1]; updateObj_('설정', r._row, r); } else appendRow_('설정', [kv[0], kv[1], '자동']);
  });
  audit_(u, '회사 직인 등록', file.getId(), str_(p.name, 80));
  return settings_();
}

/* ───────────────────────── 벤더 ───────────────────────── */
function vendorBuild_(p, row, u, ctx) {
  const isNew = !row;
  if (!isNew && !canSeeSensitive_(u)) throw new AppError('forbidden', '등록된 벤더는 관리자·운영기획만 고칠 수 있습니다.');
  row = row || { id: ctx.next() };
  const biz = str_(p.사업자등록번호);
  if (biz) {
    if (!bizNoOk_(biz)) throw new AppError('invalid', '사업자등록번호가 올바르지 않습니다(10자리, 검증번호 불일치): ' + biz);
    const digits = biz.replace(/[^0-9]/g, '');
    const dup = ctx.rows.filter(function (x) { return x.id !== row.id && x['삭제'] !== 'Y' && String(x['사업자등록번호']).replace(/[^0-9]/g, '') === digits; })[0];
    if (dup) throw new AppError('duplicate', '같은 사업자등록번호의 벤더가 이미 있습니다: ' + dup.id + ' ' + dup['상호']);
  }
  row['상호'] = need_(p.상호, '상호');
  const kind = VENDOR_KIND_MAP[str_(p.구분)] || str_(p.구분) || '공급사';
  row['구분'] = oneOf_(kind, VENDOR_KINDS, '구분');
  const trade = str_(p.거래형태);
  row['거래형태'] = row['구분'] === '공급사' ? (trade ? oneOf_(trade, TRADE_TYPES, '거래형태') : '') : '';
  row['상태'] = canSeeSensitive_(u) ? oneOf_(str_(p.상태) || '후보', VENDOR_STATES, '상태') : '후보';
  const tr = row['구분'] === 'PB제조사' ? '직매입' : row['거래형태'];
  const cyc = cycleOf(str_(p.대금지급주기));
  if (str_(p.대금지급주기) && !cyc) throw new AppError('invalid', '대금 지급주기는 ' + PAY_CYCLES.join(' / ') + ' 중에서 고르세요: ' + p.대금지급주기);
  row['대금지급주기'] = (tr === '직매입' || tr === '위탁판매') ? (cyc || row['대금지급주기'] || PAY_CYCLE_DEFAULT[tr]) : '';
  row['사업자등록번호'] = biz ? fmtBizNo_(biz) : '';
  ['대표자', '사업장주소', '업태', '종목', '담당자', '연락처', '이메일', '거래경로', '은행', '계좌번호', '예금주', '메모']
    .forEach(function (k) { row[k] = str_(p[k]); });
  row['제조사코드'] = '';
  return row;
}
function vendorSave_(p, u) {
  const rows = readRaw_('벤더');
  const old = p.id ? rows.filter(function (x) { return x.id === str_(p.id) && x['삭제'] !== 'Y'; })[0] : null;
  if (p.id && !old) throw new AppError('not_found', '벤더를 찾을 수 없습니다.');
  const row = vendorBuild_(p, old, u, { rows: rows, next: idGen_(rows, 'V', 4) });
  const saved = save_('벤더', row, u, !old);
  audit_(u, old ? '벤더 수정' : '벤더 등록', row.id, row['상호'] + ' / ' + row['구분'] + (row['거래형태'] ? ' / ' + row['거래형태'] : ''));
  return vendorOut_(saved, u);
}

/* ───────────────────────── 분류 (대·중·소 트리) ───────────────────────── */
function categories_() {
  return read_('분류').filter(function (r) { return r['이름']; }).map(clean_).sort(function (a, b) {
    return (Number(a['단계']) - Number(b['단계'])) || (Number(a['순서']) - Number(b['순서'])) || String(a['이름']).localeCompare(String(b['이름']));
  });
}
function catPath_(nodes, id) {
  const by = {};
  nodes.forEach(function (n) { by[n.id] = n; });
  const names = [];
  let n = by[id], guard = 0;
  while (n && guard++ < 5) { names.unshift(n['이름']); n = by[n['상위ID']]; }
  return names;
}
function catDescendants_(nodes, id) {
  const out = [id];
  for (let i = 0; i < out.length; i++) nodes.forEach(function (n) { if (n['상위ID'] === out[i]) out.push(n.id); });
  return out;
}
function categorySave_(p, u) {
  const rows = readRaw_('분류');
  const nodes = rows.filter(function (r) { return r['이름'] && r['삭제'] !== 'Y'; });
  let row = p.id ? nodes.filter(function (n) { return n.id === str_(p.id); })[0] : null;
  if (p.id && !row) throw new AppError('not_found', '분류를 찾을 수 없습니다.');
  if (p.삭제) {
    if (nodes.some(function (n) { return n['상위ID'] === row.id; })) throw new AppError('invalid', '하위 분류가 있어서 지울 수 없습니다. 하위 분류를 먼저 지우세요.');
    const used = read_('상품').filter(function (x) { return x['분류ID'] === row.id; }).length;
    if (used) throw new AppError('invalid', '이 분류를 쓰는 상품이 ' + used + '개 있어서 지울 수 없습니다.');
    row['삭제'] = 'Y';
    save_('분류', row, u, false);
    audit_(u, '분류 삭제', row.id, row['이름']);
    return categories_();
  }
  let parent = null;
  const isNew = !row;
  if (isNew) {
    const pid = str_(p.상위ID);
    if (pid) {
      parent = nodes.filter(function (n) { return n.id === pid; })[0];
      if (!parent) throw new AppError('invalid', '상위 분류를 찾을 수 없습니다.');
    }
    const level = parent ? Number(parent['단계']) + 1 : 1;
    if (level > 3) throw new AppError('invalid', '소분류 아래에는 더 만들 수 없습니다.');
    row = { id: idGen_(rows, 'K', 3)(), 단계: String(level), 상위ID: parent ? parent.id : '' };
  }
  const name = need_(p.이름, '분류 이름');
  const siblings = nodes.filter(function (n) { return (n['상위ID'] || '') === (row['상위ID'] || '') && n.id !== row.id; });
  if (siblings.some(function (n) { return n['이름'] === name; })) throw new AppError('duplicate', '같은 단계에 같은 이름의 분류가 이미 있습니다: ' + name);
  row['이름'] = name;
  row['노출'] = oneOf_(str_(p.노출) || row['노출'] || 'Y', ['Y', 'N'], '노출');
  row['순서'] = String(Number(p.순서) || Number(row['순서']) || siblings.length + 1);
  row['체계버전'] = str_(p.체계버전) || row['체계버전'] || '9+1';
  row['상태'] = '사용';
  save_('분류', row, u, isNew);
  audit_(u, isNew ? '분류 추가' : '분류 수정', row.id, catPath_(nodes.concat(isNew ? [row] : []), row.id).join(' > '));
  return categories_();
}
// 엑셀: 한 행 = 한 분류. id가 있으면 그 분류의 이름·노출·순서를 고치고, 없으면 대·중·소 경로를 따라 없는 분류를 만듭니다.
function categoryImport_(p, u) {
  const items = Array.isArray(p.rows) ? p.rows : [];
  if (!items.length) throw new AppError('invalid', '올릴 행이 없습니다.');
  if (items.length > 1000) throw new AppError('invalid', '한 번에 1,000행까지 올릴 수 있습니다.');
  const rows = readRaw_('분류');
  const work = rows.map(function (r) { return Object.assign({}, r); });
  const live = function () { return work.filter(function (n) { return n['이름'] && n['삭제'] !== 'Y'; }); };
  const next = idGen_(rows, 'K', 3);
  const touched = {}, created = [];
  const errors = [];
  items.forEach(function (raw, i) {
    try {
      const names = [str_(raw.대분류), str_(raw.중분류), str_(raw.소분류)];
      const depth = names[2] ? 3 : (names[1] ? 2 : (names[0] ? 1 : 0));
      let node;
      if (str_(raw.id)) {
        node = live().filter(function (n) { return n.id === str_(raw.id); })[0];
        if (!node) throw new AppError('not_found', '없는 분류 코드입니다: ' + raw.id + ' (새로 만들려면 id 칸을 비우세요)');
        const nm = names[Number(node['단계']) - 1];
        if (!nm) throw new AppError('invalid', node.id + '는 ' + ['대', '중', '소'][Number(node['단계']) - 1] + '분류입니다. 그 칸에 이름을 적으세요.');
        if (live().some(function (n) { return n.id !== node.id && (n['상위ID'] || '') === (node['상위ID'] || '') && n['이름'] === nm; })) throw new AppError('duplicate', '같은 단계에 같은 이름이 있습니다: ' + nm);
        node['이름'] = nm;
      } else {
        if (!depth) throw new AppError('invalid', '대분류를 적으세요.');
        if (names.slice(0, depth).some(function (x) { return !x; })) throw new AppError('invalid', '대분류부터 차례로 채우세요(중간 칸이 비었습니다).');
        let parent = '';
        for (let lv = 1; lv <= depth; lv++) {
          let n = live().filter(function (x) { return (x['상위ID'] || '') === parent && x['이름'] === names[lv - 1]; })[0];
          if (!n) {
            n = { id: next(), 상태: '사용', 이름: names[lv - 1], 단계: String(lv), 상위ID: parent, 노출: 'Y', 체계버전: str_(raw.체계버전) || '9+1',
              순서: String(live().filter(function (x) { return (x['상위ID'] || '') === parent; }).length + 1), 삭제: 'N' };
            work.push(n); created.push(n);
          }
          parent = n.id; node = n;
        }
      }
      if (str_(raw.노출)) node['노출'] = oneOf_(str_(raw.노출), ['Y', 'N'], '노출');
      if (str_(raw.순서)) node['순서'] = String(Number(raw.순서) || 1);
      if (str_(raw.체계버전)) node['체계버전'] = str_(raw.체계버전);
      if (created.indexOf(node) < 0 && (str_(raw.id) || str_(raw.노출) || str_(raw.순서) || str_(raw.체계버전))) touched[node.id] = node;
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      errors.push({ 행: i + 2, 오류: e.message });
    }
  });
  if (errors.length) return { saved: false, errors: errors.slice(0, 200), 오류수: errors.length };
  Object.keys(touched).forEach(function (id) { const n = touched[id]; if (n._row) save_('분류', n, u, false); });
  created.forEach(function (n) { save_('분류', n, u, true); });
  audit_(u, '엑셀 올리기', '분류', '신규 ' + created.length + '건, 수정 ' + Object.keys(touched).filter(function (id) { return touched[id]._row; }).length + '건');
  return { saved: true, 신규: created.length, 수정: Object.keys(touched).filter(function (id) { return touched[id]._row; }).length, list: categories_() };
}

/* ───────────────────────── 상품 ───────────────────────── */
function productCtx_(rows) {
  const vendors = {};
  read_('벤더').forEach(function (v) { vendors[v.id] = v; });
  const nodes = read_('분류').filter(function (r) { return r['이름']; });
  const cats = {};
  nodes.forEach(function (n) { cats[n.id] = n; });
  const whs = {};
  read_('창고').forEach(function (w) { whs[w.id] = w; });
  return { rows: rows, next: idGen_(rows, 'P', 4), vendors: vendors, cats: cats, nodes: nodes, whs: whs };
}
function productBuild_(p, row, u, ctx) {
  const isNew = !row;
  const prev = isNew ? '' : (PRODUCT_STATE_MAP[row['상태']] || row['상태']);
  if (!isNew && prev !== '판매대기' && !canSeeSensitive_(u)) throw new AppError('forbidden', prev + ' 상태의 상품은 관리자·운영기획만 고칠 수 있습니다.');
  row = row || { id: ctx.next() };
  row['상품명'] = need_(p.상품명, '상품명');
  const state = PRODUCT_STATE_MAP[str_(p.상태)] || str_(p.상태) || '판매대기';
  row['상태'] = oneOf_(state, PRODUCT_STATES, '상태');
  if (['판매대기', '삭제대기'].indexOf(row['상태']) < 0 && !canSeeSensitive_(u)) throw new AppError('forbidden', '판매중·판매보류·판매종료·삭제는 운영기획·관리자만 정할 수 있습니다.');
  if (row['상태'] === '삭제' && ['삭제대기', '삭제'].indexOf(prev) < 0) throw new AppError('invalid', '먼저 삭제대기로 바꾼 뒤 삭제하세요.');
  const mall = str_(p.몰상품코드, 60);
  if (mall && ctx.rows.some(function (x) { return x.id !== row.id && x['삭제'] !== 'Y' && x['상태'] !== '삭제' && x['몰상품코드'] === mall; })) throw new AppError('duplicate', '같은 몰상품코드를 쓰는 상품이 이미 있습니다: ' + mall);
  row['몰상품코드'] = mall;
  const vid = str_(p.공급사코드);
  let vendor = null;
  if (vid) {
    vendor = ctx.vendors[vid];
    if (!vendor) throw new AppError('invalid', '없는 벤더 코드입니다: ' + vid);
    if (['공급사', 'PB제조사'].indexOf(vendor['구분']) < 0) throw new AppError('invalid', '상품의 공급사는 구분이 공급사 또는 PB제조사인 벤더여야 합니다: ' + vid);
  }
  row['공급사코드'] = vid;
  const trade = vendor ? (vendor['구분'] === 'PB제조사' ? '직매입' : (vendor['거래형태'] || '')) : '';
  row['거래형태'] = trade;
  const md = modeOf(str_(p.운영방식) || str_(p.배송방식)) || '재고형';
  row['운영방식'] = (trade === '직매입' || trade === '위탁판매' || !trade) ? oneOf_(md, OP_MODES, '운영방식') : '';
  row['배송방식'] = '';
  const wh = str_(p.기본창고);
  if (wh) {
    const w = ctx.whs[wh];
    if (!w) throw new AppError('invalid', '없는 창고입니다: ' + wh);
    if (w['유형'] === '가상') throw new AppError('invalid', '가상창고(W01)는 기본창고로 정할 수 없습니다. 실제 보관창고(W02~)를 고르세요.');
  }
  row['기본창고'] = row['운영방식'] === '재고형' ? wh : '';
  let cid = str_(p.분류ID);
  if (!cid && str_(p.대분류)) {                // 엑셀: 분류 이름으로 찾기
    let parent = '', node = null;
    [str_(p.대분류), str_(p.중분류), str_(p.소분류)].forEach(function (nm) {
      if (!nm || parent === null) return;
      node = ctx.nodes.filter(function (n) { return (n['상위ID'] || '') === parent && n['이름'] === nm; })[0] || null;
      parent = node ? node.id : null;
    });
    if (!node || parent === null) throw new AppError('invalid', '분류에 없는 경로입니다: ' + [p.대분류, p.중분류, p.소분류].filter(function (x) { return str_(x); }).join(' > '));
    cid = node.id;
  }
  if (cid && !ctx.cats[cid]) throw new AppError('invalid', '없는 분류입니다: ' + cid);
  const path = cid ? catPath_(ctx.nodes, cid) : [];
  row['분류ID'] = cid;
  row['대분류'] = path[0] || ''; row['중분류'] = path[1] || ''; row['소분류'] = path[2] || '';
  ['규격', '납품단위', '판매단위', '바코드', '박스코드', '소비기한', '보관', '메모', '제조원', '거래조건', '배송비부담', '연결주소', '회원혜택']
    .forEach(function (k) { row[k] = str_(p[k]); });
  row['브랜드구분'] = oneOf_(str_(p.브랜드구분) || 'NB', ['NB', 'PB'], '브랜드 구분');
  row['과세구분'] = oneOf_(str_(p.과세구분) || '과세', ['과세', '면세'], '과세구분');
  row['박스입수'] = num_(p.박스입수, '박스당 입수');
  row['공급가'] = num_(p.공급가, '공급가');
  row['수수료율'] = num_(p.수수료율, '수수료율');
  row['일반회원가'] = num_(p.일반회원가, '일반회원가');
  row['구독회원가'] = num_(p.구독회원가, '구독회원가');
  row['제조사코드'] = '';
  return row;
}
function productSave_(p, u) {
  const rows = readRaw_('상품');
  const old = p.id ? rows.filter(function (x) { return x.id === str_(p.id) && x['삭제'] !== 'Y'; })[0] : null;
  if (p.id && !old) throw new AppError('not_found', '상품을 찾을 수 없습니다.');
  const before = old ? { 운영방식: old['운영방식'], 거래형태: old['거래형태'], 공급사코드: old['공급사코드'] } : null;
  const row = productBuild_(p, old ? Object.assign({}, old) : null, u, productCtx_(rows));
  const saved = save_('상품', row, u, !old);
  audit_(u, old ? '상품 수정' : '상품 등록', row.id, row['상품명'] + ' / ' + row['상태'] + ' / ' + (tradeCode(row['거래형태'], row['운영방식']) || '-'));
  // 운영방식·거래형태가 바뀌면 아직 정산하지 않은 주문에도 반영하고 매입·재고를 다시 계산합니다.
  if (before && (before.운영방식 !== row['운영방식'] || before.거래형태 !== row['거래형태'] || before.공급사코드 !== row['공급사코드'])) {
    const om = matrixOf_('주문');
    let n = 0;
    om.objs.forEach(function (o) {
      if (o['삭제'] === 'Y' || o['상품ID'] !== row.id || o['정산번호']) return;
      o['운영방식'] = row['운영방식']; o['거래형태'] = row['거래형태']; o['공급사코드'] = row['공급사코드']; mxPut_(om, stamp_(o, u, false)); n++;
    });
    if (n) { mxSave_(om); opsSync_(u); audit_(u, '상품 변경 반영', row.id, '정산 전 주문 ' + n + '줄'); }
  }
  return saved;
}

/* ───────────────────────── 엑셀 일괄 등록 (모두 통과해야 한 번에 저장) ───────────────────────── */
const IMPORTS = {
  'vendor.import': { tab: '벤더', prefix: 'V', width: 4, build: vendorBuild_, label: '벤더' },
  'warehouse.import': { tab: '창고', prefix: 'W', width: 2, build: warehouseBuild_, label: '창고', ctx: function (rows) { return { rows: rows, next: whIdGen_(rows) }; } },
  'product.import': { tab: '상품', prefix: 'P', width: 4, build: productBuild_, label: '상품', ctx: productCtx_ }
};
/* ───────────────────────── 계약 ───────────────────────── */
function kindOf_(code) {
  const k = CONTRACT_KINDS[code];
  if (!k) throw new AppError('invalid', '없는 계약 종류입니다: ' + code);
  return k;
}
function valuesOf_(c) { try { return JSON.parse(c['키값JSON'] || '{}'); } catch (e) { return {}; } }
function contractLite_(c) {
  const o = clean_(c);
  delete o['키값JSON'];
  return o;
}
function contractList_(p) {
  let list = read_('계약');
  if (p.상태) list = list.filter(function (c) { return c['상태'] === p.상태; });
  return list.map(contractLite_).sort(function (a, b) { return String(b['수정일시']).localeCompare(String(a['수정일시'])); });
}
function attachOut_(a, u) {
  const o = clean_(a);
  if (SENSITIVE_DOCS.indexOf(o['유형']) >= 0 && !canSeeSensitive_(u) && u.role !== '업체') o['파일ID'] = '';
  return o;
}
function attachmentsOf_(id, u) {
  return read_('계약첨부').filter(function (a) { return a['계약번호'] === id; }).map(function (a) { return attachOut_(a, u); });
}
function requiredDocs_(c) {
  const k = CONTRACT_KINDS[c['종류']];
  let req = k ? k.required.slice() : ['서명본', '사업자등록증', '통장사본'];
  if (c['종류'] === 'K1' && c['거래형태'] === '제휴입점') req = req.filter(function (t) { return t !== '통장사본'; });   // 광고료는 우리가 받는 돈
  return req;
}
function checklist_(atts, c) {
  return requiredDocs_(c || {}).map(function (t) {
    const list = atts.filter(function (a) { return a['유형'] === t; });
    const ok = list.some(function (a) { return a['확인상태'] === '확인'; });
    const waiting = list.some(function (a) { return a['확인상태'] === '미확인'; });
    return { 유형: t, 상태: ok ? '확인' : (waiting ? '미확인' : '없음') };
  });
}
function contractGet_(p, u) {
  const c = findById_('계약', str_(p.id));
  if (!c || c['삭제'] === 'Y') throw new AppError('not_found', '계약을 찾을 수 없습니다.');
  if (u.role === '업체' && (c['벤더코드'] !== u.vendorId || c['상태'] === '작성중')) throw new AppError('not_found', '계약을 찾을 수 없습니다.');
  const atts = attachmentsOf_(c.id, u);
  const lite = contractLite_(c);
  return { contract: u.role === '업체' ? vendorLite_(lite) : lite, values: valuesOf_(c), attachments: atts, checklist: checklist_(atts, c) };
}
// 계약 종류 + 상대방(벤더)의 거래형태로 묶음 구성을 정합니다.
function contractDates_(code, values) {
  const start = values['계약시작일'] || values['광고_시작일'] || values['독점_시작일'] || values['조건표_적용일'] || '';
  let end = '';
  if (code === 'AD') end = values['광고_종료일'] || '';
  else if (['K1', 'PB', 'LG', 'IT', 'S3'].indexOf(code) >= 0 && isDate_(start)) end = addYearMinusDay_(start);
  return { start: start, end: end };
}
// 계약 종류 + 상대방의 거래형태 + 고른 배송방식 → 들어갈 문서(해당 조항만)
function contractDocs_(code, vendor, opt, forms) {
  const k = kindOf_(code);
  if (k.party.indexOf(vendor['구분']) < 0) throw new AppError('invalid', k.name + '의 상대방은 ' + k.party.join('·') + '여야 합니다. 이 벤더의 구분: ' + vendor['구분']);
  const trade = vendor['구분'] === 'PB제조사' ? '직매입' : (vendor['거래형태'] || '');
  if (k.party.indexOf('공급사') >= 0 && !trade) throw new AppError('invalid', '벤더의 거래형태(직매입·위탁판매·제휴입점)를 먼저 정하세요.');
  if (k.trade && trade !== k.trade) throw new AppError('invalid', k.name + '은(는) 거래형태가 ' + k.trade + '인 벤더와 맺습니다.');
  const modes = k.ship && trade !== '제휴입점' ? OP_MODES.filter(function (m) { return opt && (opt[m] || opt[m === '재고형' ? '자사배송' : '업체배송']); }) : [];
  if (k.ship && trade !== '제휴입점' && !modes.length) throw new AppError('invalid', '운영방식(재고형·주문형) 중 하나 이상 고르세요.');
  const ctx = { trade: trade, modes: modes };
  return { ctx: ctx, docs: compileKind(code, forms, ctx) };
}
function fillAuto_(values, keys, docs, vendor, trade) {
  const party = { 상대_상호: vendor['상호'], 상대_사업자등록번호: vendor['사업자등록번호'], 상대_주소: vendor['사업장주소'], 상대_대표자: vendor['대표자'],
    상대_담당자: vendor['담당자'], 상대_연락처: vendor['연락처'], 상대_이메일: vendor['이메일'], 거래형태: trade };
  Object.keys(party).forEach(function (k) { if (keys.indexOf(k) >= 0) values[k] = str_(party[k]); });
  keys.forEach(function (k) { if (metaOf(k).t === 'won' && values[k]) values[k] = fmtComma(values[k]); });
  if (keys.indexOf('광고_과금조건') >= 0 || keys.indexOf('광고료_총액') >= 0 || keys.indexOf('광고_게재일수') >= 0) {
    const m = adMethod(values);
    const r = adCalc(values['광고_시작일'], values['광고_종료일'], values['광고_일단가']);
    const r0 = adCalc(values['광고_시작일'], values['광고_종료일'], 0);
    values['광고_게재일수'] = r0 ? String(r0.days) : '';
    values['광고료_총액'] = adHasFixed(m) && r && values['광고_일단가'] ? fmtComma(r.total) : '';
    values['광고_과금조건'] = adTerms(values);
  }
  if (docs.some(function (d) { return d.blocks.some(function (b) { return b.t === 'terms'; }); })) {
    const mine = read_('상품').filter(function (p) { return p['공급사코드'] === vendor.id; }).map(clean_);
    values._terms = termsTable(trade, mine, values);
  }
}
function applyChoices_(code, trade, values, keys) {
  const ch = choicesFor_(code, trade);
  keys.forEach(function (k) {
    const m = metaOf(k);
    if (m.t !== 'select') return;
    const list = ch[k] || [];
    if (list.length === 1 && !values[k] && !m.custom) values[k] = list[0];
    const v = str_(values[k]);
    if (!v || list.indexOf(v) >= 0 || (m.na && v === m.na)) return;
    if (m.custom && v.length <= 60) return;
    throw new AppError('invalid', (m.label || k) + '은(는) 목록에서 고르세요: ' + list.join(' / '));
  });
}
function validateValues_(keys, values) {
  const missing = [];
  keys.forEach(function (k) {
    const m = metaOf(k);
    const v = str_(values[k]);
    if (m.opt || k === '거래조건표_번호') return;
    if (!v) { missing.push(m.label || k); return; }
    if (m.t === 'date' && !isDate_(v)) throw new AppError('invalid', (m.label || k) + '은(는) 2026-10-30 같은 날짜로 적으세요.');
    if (k === '상대_사업자등록번호' && !bizNoOk_(v)) throw new AppError('invalid', '상대방 사업자등록번호가 올바르지 않습니다. 벤더 정보를 고치세요.');
  });
  if (keys.indexOf('광고_과금방식') >= 0 && values['광고_과금방식']) {
    const m = adMethod(values), pf = adPerf(m), need = [];
    if (adHasFixed(m) && !str_(values['광고_일단가'])) need.push('일 단가');
    if ((pf === 'CPC' || pf === 'CPM') && !str_(values['광고_성과단가'])) need.push('성과 단가');
    if (pf === 'CPS' && !(Number(String(values['광고_판매요율'] || '').replace(/[^0-9.]/g, '')) > 0)) need.push('판매당 요율');
    if (pf && !str_(values['광고_월상한'])) need.push('월 예산 상한');
    if (need.length) missing.push.apply(missing, need.map(function (x) { return x + '(' + m + ')'; }));
  }
  if (missing.length) throw new AppError('invalid', '빈 칸이 있습니다: ' + missing.join(', ') + ' (상대방 정보는 벤더 등록 화면에서 채웁니다)');
}
function contractSaveDraft_(p, u) {
  const code = str_(p.종류);
  const k = kindOf_(code);
  const vendor = findById_('벤더', str_(p.벤더코드));
  if (!vendor || vendor['삭제'] === 'Y') throw new AppError('invalid', '상대방(벤더)을 먼저 고르세요.');
  const opt = {};
  OP_MODES.forEach(function (s) { opt[s] = !!(p.opt && (p.opt[s] || p.opt[s === '재고형' ? '자사배송' : '업체배송'])); });
  const cd = contractDocs_(code, vendor, opt, formsAll_());
  const keys = docsKeys(cd.docs);
  const values = {};
  keys.forEach(function (key) {
    const m = metaOf(key);
    if (m.t === 'auto' || m.t === 'calc') return;
    values[key] = str_((p.values || {})[key], key === '특약사항' ? 5000 : 1000);
  });
  fillAuto_(values, keys, cd.docs, vendor, cd.ctx.trade);
  applyChoices_(code, cd.ctx.trade, values, keys);
  values._opt = opt;
  values._ctx = cd.ctx;
  const isNew = !p.id;
  let row;
  if (isNew) {
    row = { id: nextId_('계약', 'D' + yy_() + '-', 4), 상태: '작성중', 버전: '1', 상위계약번호: '' };
  } else {
    row = findById_('계약', str_(p.id));
    if (!row || row['삭제'] === 'Y') throw new AppError('not_found', '계약을 찾을 수 없습니다.');
    if (row['상태'] !== '작성중') throw new AppError('locked', '확정된 계약은 고칠 수 없습니다. 새 버전을 만드세요.');
  }
  const dt = contractDates_(code, values);
  row['종류'] = code;
  row['종류명'] = k.name;
  row['벤더코드'] = vendor.id;
  row['상호'] = vendor['상호'];
  row['거래형태'] = cd.ctx.trade;
  row['구성'] = kindDocs(code).join(',') + (cd.ctx.modes.length ? ' / ' + cd.ctx.modes.join('·') : '');
  row['계약시작일'] = dt.start;
  row['계약종료일'] = dt.end;
  row['키값JSON'] = JSON.stringify(values);
  row['메모'] = str_(p.메모);
  const saved = save_('계약', row, u, isNew);
  audit_(u, isNew ? '계약 작성' : '계약 임시저장', row.id, k.name + ' / ' + vendor['상호'] + ' / ' + row['구성']);
  return contractLite_(saved);
}
function contractConfirm_(p, u) {
  const row = findById_('계약', str_(p.id));
  if (!row || row['삭제'] === 'Y') throw new AppError('not_found', '계약을 찾을 수 없습니다.');
  if (row['상태'] !== '작성중') throw new AppError('invalid', '이미 확정된 계약입니다.');
  const vendor = findById_('벤더', row['벤더코드']);
  if (!vendor || vendor['삭제'] === 'Y') throw new AppError('invalid', '상대방 벤더를 찾을 수 없습니다.');
  const values = valuesOf_(row);
  const forms = formsAll_();
  const cd = contractDocs_(row['종류'], vendor, values._opt || {}, forms);
  const keys = docsKeys(cd.docs);
  fillAuto_(values, keys, cd.docs, vendor, cd.ctx.trade);       // 확정 시점의 벤더·상품 정보로 다시 채움
  applyChoices_(row['종류'], cd.ctx.trade, values, keys);
  validateValues_(keys, values);
  const draftId = row.id;
  const newId = nextId_('계약', 'C' + yy_() + '-', 4);
  if (keys.indexOf('거래조건표_번호') >= 0) values['거래조건표_번호'] = newId;
  values._ctx = cd.ctx;
  values._forms = {};                                           // 확정한 양식을 함께 저장(나중에 양식을 고쳐도 이 계약은 그대로)
  values._formVer = {};
  kindDocs(row['종류']).forEach(function (c) { values._forms[c] = formPlain_(forms[c]); values._formVer[c] = forms[c]._ver; });
  const year = Utilities.formatDate(new Date(), TZ, 'yyyy');
  const folder = folder_(['계약', year, newId + '_' + row['상호'].replace(/[\\\/:*?"<>|]/g, '')]);
  const fileName = newId + '_v' + row['버전'] + '_계약서';
  const pdf = renderPdf_(cd.docs, values, settings_(), fileName, folder, null);
  row.id = newId;
  row['상태'] = '서명대기';
  row['PDF파일ID'] = pdf.getId();
  row['PDF해시'] = sha256Hex_(pdf.getBlob().getBytes());
  row['폴더ID'] = folder.getId();
  row['확정일시'] = now_();
  row['확정자'] = u.id;
  row['키값JSON'] = JSON.stringify(values);
  save_('계약', row, u, false);
  audit_(u, '계약 확정', newId, '초안 ' + draftId + ' → ' + newId + ' / ' + row['구성'] + ' / 양식 ' + JSON.stringify(values._formVer) + ' / PDF 해시 ' + row['PDF해시'].slice(0, 16));
  return contractGet_({ id: newId }, u);
}
// 확정된 계약의 문서: 확정 때 저장한 양식으로 다시 만듭니다.
function contractDocsOf_(c, values) {
  const forms = values._forms || formsAll_();
  return compileKind(c['종류'], forms, values._ctx || {});
}

function contractDeleteDraft_(p, u) {
  const row = findById_('계약', str_(p.id));
  if (!row || row['상태'] !== '작성중') throw new AppError('invalid', '작성중인 계약만 지울 수 있습니다.');
  row['삭제'] = 'Y';
  save_('계약', row, u, false);
  audit_(u, '계약 초안 삭제', row.id, row['상호']);
  return true;
}
function contractNewVersion_(p, u) {
  const src = findById_('계약', str_(p.id));
  if (!src || src['삭제'] === 'Y') throw new AppError('not_found', '계약을 찾을 수 없습니다.');
  if (src['상태'] === '작성중') throw new AppError('invalid', '작성중인 계약은 그대로 고치면 됩니다.');
  const row = {
    id: nextId_('계약', 'D' + yy_() + '-', 4), 상태: '작성중', 종류: src['종류'], 종류명: src['종류명'], 거래형태: src['거래형태'], 구성: src['구성'],
    벤더코드: src['벤더코드'], 상호: src['상호'], 버전: String(Number(src['버전'] || 1) + 1), 상위계약번호: src.id,
    계약시작일: src['계약시작일'], 계약종료일: src['계약종료일'], 키값JSON: (function () { const v = valuesOf_(src); delete v._forms; delete v._formVer; return JSON.stringify(v); })(), 메모: ''
  };
  const saved = save_('계약', row, u, true);
  audit_(u, '계약 새 버전', row.id, src.id + ' → v' + row['버전']);
  return contractLite_(saved);
}
function contractComplete_(p, u) {
  const row = findById_('계약', str_(p.id));
  if (!row || row['삭제'] === 'Y') throw new AppError('not_found', '계약을 찾을 수 없습니다.');
  if (row['상태'] !== '증빙수집' && row['상태'] !== '서명대기') throw new AppError('invalid', '완료할 수 있는 상태가 아닙니다: ' + row['상태']);
  const lacking = checklist_(read_('계약첨부').filter(function (a) { return a['계약번호'] === row.id; }), row)
    .filter(function (c) { return c['상태'] !== '확인'; }).map(function (c) { return c['유형']; });
  if (lacking.length) throw new AppError('invalid', '확인되지 않은 서류가 있습니다: ' + lacking.join(', '));
  row['상태'] = '완료';
  save_('계약', row, u, false);
  audit_(u, '계약 완료', row.id, row['상호']);
  const v = findById_('벤더', row['벤더코드']);
  if (v) {
    let ch = false;
    if (v['상태'] === '후보') { v['상태'] = '계약중'; ch = true; }
    const cyc = row['종류'] === 'K1' ? cycleOf(valuesOf_(row)['대금지급주기']) : '';
    if (cyc && cyc !== v['대금지급주기']) { v['대금지급주기'] = cyc; ch = true; audit_(u, '지급주기 반영', v.id, cyc + ' (계약 ' + row.id + ')'); }
    if (ch) save_('벤더', v, u, false);
  }
  return contractGet_({ id: row.id }, u);
}
function contractClose_(p, u) {
  const row = findById_('계약', str_(p.id));
  if (!row || row['삭제'] === 'Y') throw new AppError('not_found', '계약을 찾을 수 없습니다.');
  if (row['상태'] === '작성중') throw new AppError('invalid', '작성중인 계약은 지우기를 쓰세요.');
  row['상태'] = '종료';
  row['메모'] = (row['메모'] ? row['메모'] + ' / ' : '') + '종료 사유: ' + str_(p.사유 || '미기재');
  save_('계약', row, u, false);
  audit_(u, '계약 종료', row.id, str_(p.사유));
  return contractGet_({ id: row.id }, u);
}

/* ───────────────────────── 전자서명 ───────────────────────── */
// 업체 계정을 만들거나(없으면) 비밀번호를 다시 발급하고, 계약을 전자서명 방식으로 표시합니다.
function esignRequest_(p, u) {
  const c = findById_('계약', str_(p.id));
  if (!c || c['삭제'] === 'Y') throw new AppError('not_found', '계약을 찾을 수 없습니다.');
  if (c['상태'] !== '서명대기') throw new AppError('invalid', '서명대기 상태의 계약만 전자서명을 요청할 수 있습니다.');
  const v = findById_('벤더', c['벤더코드']);
  if (!v || v['삭제'] === 'Y') throw new AppError('invalid', '상대방 벤더를 찾을 수 없습니다.');
  const users = readRaw_('사용자');
  let acct = users.filter(function (x) { return x['벤더코드'] === v.id && x['역할'] === '업체' && x['삭제'] !== 'Y'; })[0];
  let temp = null, created = false;
  if (!acct) {
    let uid = v.id.toLowerCase();
    if (users.some(function (x) { return x.id === uid; })) uid = uid + '-' + Utilities.getUuid().slice(0, 4);
    temp = tempPassword_();
    const salt = Utilities.getUuid();
    acct = { id: uid, 상태: '사용', 이름: v['상호'], 역할: '업체', 벤더코드: v.id, 해시: hash_(temp, salt), 솔트: salt, 비밀번호변경필요: 'Y', 실패횟수: '0', 잠금해제시각: '' };
    save_('사용자', acct, u, true);
    created = true;
    audit_(u, '업체 계정 생성', uid, v.id + ' ' + v['상호']);
  } else if (p.reset || acct['상태'] !== '사용') {
    temp = tempPassword_();
    acct['솔트'] = Utilities.getUuid();
    acct['해시'] = hash_(temp, acct['솔트']);
    acct['비밀번호변경필요'] = 'Y';
    acct['실패횟수'] = '0';
    acct['잠금해제시각'] = '';
    acct['상태'] = '사용';
    save_('사용자', acct, u, false);
    audit_(u, '업체 계정 비밀번호 발급', acct.id, v.id);
  }
  c['서명방식'] = '전자';
  c['서명요청일시'] = now_();
  save_('계약', c, u, false);
  audit_(u, '전자서명 요청', c.id, acct.id);
  return { account: acct.id, tempPassword: temp, created: created, detail: contractGet_({ id: c.id }, u) };
}
// 서명: 업체 계정은 상대방 쪽, 운영기획·관리자는 회사 쪽(직인 또는 직접 서명)
function esignSign_(p, u) {
  const c = findById_('계약', str_(p.id));
  if (!c || c['삭제'] === 'Y') throw new AppError('not_found', '계약을 찾을 수 없습니다.');
  const vendorSide = u.role === '업체';
  if (vendorSide && c['벤더코드'] !== u.vendorId) throw new AppError('not_found', '계약을 찾을 수 없습니다.');
  if (c['상태'] !== '서명대기') throw new AppError('invalid', '서명대기 상태의 계약만 서명할 수 있습니다.');
  const pre = vendorSide ? '업체' : '회사';
  if (c[pre + '서명일시']) throw new AppError('invalid', '이미 서명했습니다.');
  if (!p.동의) throw new AppError('invalid', '계약 내용 확인과 전자서명 동의에 체크하세요.');
  const name = need_(p.서명자, '서명자 이름');
  let fileId;
  const st = settings_();
  if (!vendorSide && p.직인) {
    fileId = st['직인파일ID'];
    if (!fileId) throw new AppError('invalid', '등록된 직인이 없습니다. 설정에서 직인을 먼저 올리세요.');
  } else {
    const bytes = Utilities.base64Decode(String(p.image || '').replace(/^data:image\/png;base64,/, ''));
    if (!bytes.length || bytes.length > 400 * 1024) throw new AppError('invalid', '서명 이미지가 비었거나 너무 큽니다. 다시 서명하세요.');
    fileId = DriveApp.getFolderById(c['폴더ID']).createFile(Utilities.newBlob(bytes, 'image/png', c.id + '_' + pre + '서명.png')).getId();
  }
  c[pre + '서명자'] = name;
  if (vendorSide) c['업체서명직위'] = str_(p.직위, 40);
  c[pre + '서명일시'] = now_();
  c[pre + '서명파일ID'] = fileId;
  c[pre + '서명계정'] = u.id;
  if (!c['서명방식']) c['서명방식'] = '전자';
  save_('계약', c, u, false);
  audit_(u, pre + ' 전자서명', c.id, name + ' / 원본 PDF ' + String(c['PDF해시']).slice(0, 16));
  if (c['업체서명일시'] && c['회사서명일시']) esignFinalize_(c, u, st);
  return contractGet_({ id: c.id }, u);
}
// 양쪽 서명이 끝나면 서명 이미지를 넣은 서명본 PDF와 전자서명 확인서를 만들어 서명본으로 등록합니다.
function esignFinalize_(c, u, st) {
  const values = valuesOf_(c);
  const docs = contractDocsOf_(c, values);
  const signDate = String(c['업체서명일시'] > c['회사서명일시'] ? c['업체서명일시'] : c['회사서명일시']).slice(0, 10);
  const seal = c['회사서명파일ID'] === st['직인파일ID'];
  const sig = {
    company: { blob: DriveApp.getFileById(c['회사서명파일ID']).getBlob(), seal: seal, ratio: seal ? Number(st['직인비율'] || 1) : 1 / 3 },
    vendor: { blob: DriveApp.getFileById(c['업체서명파일ID']).getBlob(), seal: false, ratio: 1 / 3 }
  };
  const cert = [
    ['계약번호', c.id + ' (v' + c['버전'] + ')'],
    ['계약서', docs.map(function (d) { return d.title; }).join(', ')],
    ['원본 PDF 지문 (SHA-256)', String(c['PDF해시'])],
    ['공급받는 자 서명', c['회사서명자'] + (seal ? ' (직인)' : '') + ' · ' + c['회사서명일시']],
    ['상대방 서명', c['업체서명자'] + (c['업체서명직위'] ? ' ' + c['업체서명직위'] : '') + ' · ' + c['업체서명일시']],
    ['계약 체결일', signDate + ' (두 당사자 중 늦게 서명한 날)'],
    ['동의 내용', '양 당사자는 위 계약서의 내용을 확인하였으며, 전자서명으로 계약을 체결하는 데 동의하였다.']
  ];
  const folder = DriveApp.getFolderById(c['폴더ID']);
  const pdf = renderPdf_(docs, values, st, c.id + '_v' + c['버전'] + '_전자서명본', folder, { sig: sig, signDate: signDate, cert: cert });
  const aid = nextId_('계약첨부', c.id + '-F', 2);
  const bytes = pdf.getBlob().getBytes();
  save_('계약첨부', { id: aid, 상태: '등록', 계약번호: c.id, 유형: '서명본', 파일ID: pdf.getId(), 파일명: pdf.getName(), 크기: String(bytes.length),
    확인상태: '확인', 확인자: 'esign', 확인일시: now_() }, u, true);
  c['계약체결일'] = signDate;
  c['서명본파일ID'] = pdf.getId();
  c['상태'] = '증빙수집';
  save_('계약', c, u, false);
  audit_(u, '전자서명 완료', c.id, '체결일 ' + signDate + ' / 서명본 해시 ' + sha256Hex_(bytes).slice(0, 16));
}

/* ───────────────────────── 첨부 ───────────────────────── */
function attachUpload_(p, u) {
  const c = findById_('계약', str_(p.계약번호));
  if (!c || c['삭제'] === 'Y') throw new AppError('not_found', '계약을 찾을 수 없습니다.');
  const vendorSide = u.role === '업체';
  if (vendorSide && c['벤더코드'] !== u.vendorId) throw new AppError('not_found', '계약을 찾을 수 없습니다.');
  if (['서명대기', '증빙수집', '완료'].indexOf(c['상태']) < 0) throw new AppError('invalid', '확정된 계약에만 첨부할 수 있습니다.');
  const type = oneOf_(str_(p.유형), vendorSide ? VENDOR_UPLOAD_TYPES : ATTACH_TYPES, '서류 유형');
  const mime = oneOf_(str_(p.mime), ALLOWED_MIME, '파일 형식(PDF·JPG·PNG만)');
  let signed = '';
  if (type === '서명본') {
    signed = str_(p.체결일);
    if (!isDate_(signed)) throw new AppError('invalid', '서명본을 올릴 때는 계약 체결일(두 당사자 중 늦게 서명한 날짜)을 입력하세요.');
  }
  const bytes = Utilities.base64Decode(String(p.data || ''));
  const maxMb = Number(settings_()['첨부최대MB'] || 10);
  if (!bytes.length) throw new AppError('invalid', '빈 파일입니다.');
  if (bytes.length > maxMb * 1024 * 1024) throw new AppError('invalid', '파일이 ' + maxMb + 'MB를 넘습니다.');
  const ext = mime === 'application/pdf' ? 'pdf' : (mime === 'image/png' ? 'png' : 'jpg');
  const id = nextId_('계약첨부', c.id + '-F', 2);
  const name = id + '_' + type + '.' + ext;
  const folder = DriveApp.getFolderById(c['폴더ID']);
  const file = folder.createFile(Utilities.newBlob(bytes, mime, name));
  const row = { id: id, 상태: '등록', 계약번호: c.id, 유형: type, 파일ID: file.getId(), 파일명: name,
    크기: String(bytes.length), 확인상태: '미확인', 확인자: '', 확인일시: '' };
  save_('계약첨부', row, u, true);
  if (type === '서명본') {
    c['계약체결일'] = signed;
    if (!c['서명방식']) c['서명방식'] = '서면';
    if (c['상태'] === '서명대기') c['상태'] = '증빙수집';
    save_('계약', c, u, false);
  }
  audit_(u, '서류 업로드', id, type + (signed ? ' / 체결일 ' + signed : '') + ' / 원본 ' + str_(p.파일명, 120));
  return contractGet_({ id: c.id }, u);
}
function attachVerify_(p, u) {
  const a = findById_('계약첨부', str_(p.id));
  if (!a || a['삭제'] === 'Y') throw new AppError('not_found', '서류를 찾을 수 없습니다.');
  const result = oneOf_(str_(p.결과), ['확인', '반려'], '확인 결과');
  a['확인상태'] = result;
  a['확인자'] = u.id;
  a['확인일시'] = now_();
  if (result === '반려') a['삭제'] = 'Y';
  save_('계약첨부', a, u, false);
  audit_(u, '서류 ' + result, a.id, a['유형'] + (p.사유 ? ' / ' + str_(p.사유) : ''));
  return contractGet_({ id: a['계약번호'] }, u);
}
function fileGet_(p, u) {
  const fid = str_(p.fileId);
  if (!fid) throw new AppError('invalid', '파일이 지정되지 않았습니다.');
  const att = read_('계약첨부').filter(function (a) { return a['파일ID'] === fid; })[0];
  const con = read_('계약').filter(function (c) { return c['PDF파일ID'] === fid || c['서명본파일ID'] === fid; })[0];
  if (!att && !con) throw new AppError('not_found', '등록된 파일이 아닙니다.');
  if (u.role === '업체') {
    const owner = con || findById_('계약', att['계약번호']);
    if (!owner || owner['벤더코드'] !== u.vendorId || owner['상태'] === '작성중') throw new AppError('forbidden', '이 파일을 열 권한이 없습니다.');
  } else if (att && SENSITIVE_DOCS.indexOf(att['유형']) >= 0) {
    if (!canSeeSensitive_(u)) throw new AppError('forbidden', '이 서류는 관리자·운영기획만 열 수 있습니다.');
    audit_(u, '민감 서류 열람', att.id, att['유형']);
  }
  const f = DriveApp.getFileById(fid);
  const blob = f.getBlob();
  return { name: f.getName(), mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}
/* ───────────────────────── 계약서 PDF (구글 문서 → PDF) ───────────────────────── */
// docs: compileKind로 만든 문서들(해당 조항만) · opts: { sig, signDate, cert } (전자서명본일 때)
function renderPdf_(docs, values, settings, fileName, folder, opts) {
  const doc = DocumentApp.create(fileName);
  const docId = doc.getId();
  try {
    buildPdf_(doc, docs, values, settings, opts || {});
    doc.saveAndClose();
    const docFile = DriveApp.getFileById(docId);
    const pdf = folder.createFile(docFile.getAs(MimeType.PDF).setName(fileName + '.pdf'));
    docFile.setTrashed(true);
    return pdf;
  } catch (e) {
    try { DriveApp.getFileById(docId).setTrashed(true); } catch (x) { /* 이미 없음 */ }
    throw e;
  }
}
function fmtKDate_(s) { return s ? Number(s.slice(0, 4)) + '년 ' + Number(s.slice(5, 7)) + '월 ' + Number(s.slice(8, 10)) + '일' : ''; }
function buildPdf_(doc, docs, values, settings, opts) {
  const body = doc.getBody();
  body.setPageWidth(A4.w).setPageHeight(A4.h);
  body.setMarginTop(A4.top).setMarginBottom(A4.bottom).setMarginLeft(A4.left).setMarginRight(A4.right);
  const contentW = A4.w - A4.left - A4.right;
  const LS = 1.0;                                            // 구글 문서 줄간격 1.0 ≈ 브라우저 줄높이 1.7 (Noto Sans KR)
  footerLogo_(doc, settings);
  let first = true;
  const para = function (text) {
    let p;
    if (first) { p = body.getParagraphs()[0]; p.setText(text); }   // Paragraph.setText는 반환값이 없음(void)
    else { p = body.appendParagraph(text); }
    first = false;
    p.setLineSpacing(LS).setSpacingBefore(0).setSpacingAfter(0);
    return p;
  };
  const cellPara = function (cell) { return cell.getChild(0).asParagraph().setLineSpacing(LS).setSpacingBefore(0).setSpacingAfter(0); };
  const gridTable = function (head, rows, size) {
    const width = head.length;
    const data = [head].concat(rows.length ? rows : [['등록된 항목이 없습니다'].concat(new Array(width - 1).fill(''))]);
    const table = body.appendTable(data.map(function (r) { return r.map(function () { return ''; }); }));
    table.setBorderColor('#C9CED8');
    data.forEach(function (r, ri) {
      r.forEach(function (x, ci) {
        const cell = table.getCell(ri, ci);
        const f = fillText_(String(x === undefined || x === null ? '' : x), values, settings);
        cell.setText(f.text);
        cell.setPaddingTop(1.2 * MM).setPaddingBottom(1.2 * MM).setPaddingLeft(2 * MM).setPaddingRight(2 * MM);
        cellPara(cell);
        styleText_(cell.editAsText(), f, size || 8.8, ri === 0);
        if (ri === 0) cell.setBackgroundColor('#EEF1F6');
        else if (isNumCell(f.text)) cellPara(cell).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
      });
    });
    first = false;
  };
  const sigImage = function (cell, s) {
    if (!s || !s.blob) return;
    const w = s.seal ? 15 * MM : 28 * MM;
    cell.getChild(0).asParagraph().appendInlineImage(s.blob).setWidth(Math.round(w)).setHeight(Math.round(w * (s.ratio || 1 / 3)));
  };
  docs.forEach(function (t, pi) {
    if (pi > 0) body.appendPageBreak();
    t.blocks.forEach(function (b) {
      if (b.t === 'party') {                                // 서명 블록: 선 없음, 좌우 균등, 같은 항목은 같은 행
        const gap = 10 * MM, lab = 8.4 * 9.5;
        const val = (contentW - gap - lab * 2) / 2;
        const head = body.appendTable([['', '']]);
        head.setBorderWidth(0);
        head.setColumnWidth(0, contentW / 2).setColumnWidth(1, contentW / 2);
        ['left', 'right'].forEach(function (side, ci) {
          const cell = head.getCell(0, ci);
          cell.setText(b[side].title);
          cell.setPaddingTop(0).setPaddingBottom(2 * MM).setPaddingLeft(0).setPaddingRight(0);
          cellPara(cell);
          cell.editAsText().setFontFamily(PDF_FONT).setFontSize(10).setBold(true).setUnderline(false).setForegroundColor('#16233F');
        });
        const n = Math.max(b.left.lines.length, b.right.lines.length);
        const grid = [];
        for (let i = 0; i < n; i++) grid.push(['', '', '', '', '']);
        const tb = body.appendTable(grid);
        tb.setBorderWidth(0);
        [lab, val, gap, lab, val].forEach(function (w, ci) { tb.setColumnWidth(ci, w); });
        for (let r = 0; r < n; r++) {
          [['left', 0], ['right', 3]].forEach(function (sd) {
            const ln = b[sd[0]].lines[r];
            if (!ln) return;
            const lc = tb.getCell(r, sd[1]), vc = tb.getCell(r, sd[1] + 1);
            lc.setText(ln[0]);
            const f = fillText_(ln[1], values, settings);
            vc.setText(f.text);
            [lc, vc].forEach(function (c) { c.setPaddingTop(1 * MM).setPaddingBottom(1 * MM).setPaddingLeft(0).setPaddingRight(4); cellPara(c); });
            lc.editAsText().setFontFamily(PDF_FONT).setFontSize(9.5).setBold(false).setUnderline(false).setForegroundColor('#555555');
            styleText_(vc.editAsText(), f, 9.5, false);
            if (ln[0] === '대표자' && opts.sig) sigImage(vc, sd[0] === 'left' ? opts.sig.company : opts.sig.vendor);
          });
          tb.getCell(r, 2).setPaddingTop(0).setPaddingBottom(0);
        }
        first = false;
        return;
      }
      if (b.t === 'table') {                                // 본문 표(SLA 등)는 선 유지
        const width = Math.max.apply(null, b.rows.map(function (r) { return r.length; }));
        const table = body.appendTable(b.rows.map(function () { const a = []; for (let i = 0; i < width; i++) a.push(''); return a; }));
        table.setBorderColor('#C9CED8');
        b.rows.forEach(function (r, ri) {
          r.forEach(function (c, ci) {
            const cell = table.getCell(ri, ci);
            const f = fillText_(c.x, values, settings);
            cell.setText(f.text);
            cell.setPaddingTop(1.2 * MM).setPaddingBottom(1.2 * MM).setPaddingLeft(2 * MM).setPaddingRight(2 * MM);
            cellPara(cell);
            styleText_(cell.editAsText(), f, 8.8, !!c.h);
            if (c.h) cell.setBackgroundColor('#EEF1F6');
            else if (isNumCell(f.text)) cellPara(cell).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
          });
        });
        first = false;
        return;
      }
      if (b.t === 'terms') {                                // 별지 1: 상품 데이터로 만든 거래조건표
        const tt = values._terms || { title: '상품', head: ['상품코드', '상품명'], rows: [] };
        const p = para(tt.title);
        p.setSpacingBefore(3.2 * MM).setSpacingAfter(0.8 * MM);
        styleText_(p.editAsText(), { text: tt.title, ranges: [] }, 9.5, true);
        gridTable(tt.head, tt.rows, 8.3);
        return;
      }
      if (b.t === 'sp') {                                   // 특약사항: 여러 줄, 입력값이므로 굵게·밑줄
        const v = String(values['특약사항'] || '').trim() || '없음';
        v.split(/\r?\n/).filter(function (x) { return x.trim() !== ''; }).forEach(function (line) {
          const p = para(line);
          p.setSpacingAfter(0.6 * MM).setIndentStart(3 * MM).setIndentFirstLine(3 * MM);
          styleText_(p.editAsText(), { text: line, ranges: [[0, line.length - 1]] }, 9.5, false);
        });
        return;
      }
      const text = (b.t === 'center' && opts.signDate) ? fmtKDate_(opts.signDate) : b.x;
      const f = fillText_(text, values, settings);
      const p = para(f.text);
      const tx = p.editAsText();
      if (b.t === 'title') {
        p.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(7 * MM);
        styleText_(tx, f, 16, true);
        if (f.text.length) tx.setForegroundColor('#16233F');
      } else if (b.t === 'h') {
        p.setSpacingBefore(3.2 * MM).setSpacingAfter(0.8 * MM);
        styleText_(tx, f, 9.5, true);
      } else if (b.t === 'center') {                       // 계약일 줄: 위 25mm, 아래 20mm 띄움
        p.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(25 * MM).setSpacingAfter(20 * MM);
        styleText_(tx, opts.signDate ? { text: f.text, ranges: [[0, f.text.length - 1]] } : f, 11, false);
      } else if (b.t === 'li') {
        p.setSpacingAfter(0.6 * MM).setIndentStart(5 * MM).setIndentFirstLine(5 * MM);
        styleText_(tx, f, 9.5, false);
      } else {
        p.setSpacingAfter(1.1 * MM);
        styleText_(tx, f, 9.5, false);
      }
    });
  });
  if (opts.cert) {                                          // 전자서명 확인서
    body.appendPageBreak();
    const p = body.appendParagraph('전자서명 확인서');
    p.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(7 * MM).setLineSpacing(LS);
    styleText_(p.editAsText(), { text: '전자서명 확인서', ranges: [] }, 16, true);
    gridTable(['항목', '내용'], opts.cert, 9);
    const noteText = '이 확인서는 공급받는 자의 전자계약 시스템이 서명 시점의 기록으로 자동 작성하였습니다.';
    const note = body.appendParagraph(noteText);
    note.setSpacingBefore(4 * MM).setLineSpacing(LS);
    styleText_(note.editAsText(), { text: noteText, ranges: [] }, 8, false);
  }
}

/* ───────────────────────── 공통 도구 (v2에서 그대로) ───────────────────────── */
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function ss_() {
  if (MEMO) { if (!MEMO.ss) MEMO.ss = SpreadsheetApp.getActive(); return MEMO.ss; }
  return SpreadsheetApp.getActive();
}
// 요청 하나 동안 쓰는 기억 공간: 같은 시트는 한 번만 읽고(mx), 바뀐 줄만 다시 씁니다.
function memo_() { return { ss: null, rows: {}, heads: {}, mx: {}, sheets: {}, dirty: false, opsDirty: false }; }
// 운영 자료(주문·매입·재고·정산 등)는 따로 버전을 둡니다. 주문을 올려도 계약·상품 목록 캐시는 그대로 씁니다.
const OPS_TABS = ['주문', '매입', '정산', '정산상세', '재고수불', '광고측정', '광고클릭', 'PG정산', '비용'];
function touched_(name) {
  if (!MEMO || name === '감사로그') return;
  if (OPS_TABS.indexOf(name) >= 0) MEMO.opsDirty = true; else MEMO.dirty = true;
}
function bumpDirty_() {
  if (!MEMO) return;
  if (MEMO.dirty) bumpVersion_();
  if (MEMO.opsDirty) bumpOpsVersion_();
  MEMO.dirty = false; MEMO.opsDirty = false;
}
// 시트를 직접 고친 뒤: 기억해 둔 줄을 버립니다.
function forget_(name) { if (MEMO) { delete MEMO.rows[name]; delete MEMO.mx[name]; } touched_(name); }

function sheet_(name) {
  if (MEMO && MEMO.sheets[name]) return MEMO.sheets[name];
  const s = ss_().getSheetByName(name);
  if (!s) throw new AppError('setup', '"' + name + '" 시트가 없습니다. Apps Script에서 setup()을 먼저 실행하세요.');
  if (MEMO) MEMO.sheets[name] = s;
  return s;
}

function headers_(name) {
  if (MEMO && MEMO.heads[name]) return MEMO.heads[name];
  const s = sheet_(name);
  const h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(String);
  if (MEMO) MEMO.heads[name] = h;
  return h;
}

function readRaw_(name) {
  if (MEMO && MEMO.rows[name]) return MEMO.rows[name].map(function (o) { return Object.assign({}, o); });
  // 같은 요청에서 이미 읽은 시트(mx)가 있으면 다시 읽지 않습니다.
  const list = matrixOf_(name).objs.filter(anyVal_)
    .map(function (o) { const c = Object.assign({}, o); c._row = o._idx + 2; delete c._idx; return c; });
  if (MEMO) MEMO.rows[name] = list.map(function (o) { return Object.assign({}, o); });
  return list;
}
function anyVal_(o) { for (const k in o) if (k !== '_idx' && o[k] !== '') return true; return false; }

function readSheet_(name) {
  const s = sheet_(name);
  const lr = s.getLastRow(), lc = s.getLastColumn();
  if (lr < 2) return [];
  const v = s.getRange(1, 1, lr, lc).getValues();
  const h = v[0].map(String);
  const outRows = [];
  for (let i = 1; i < v.length; i++) {
    const o = { _row: i + 1 };
    let any = false;
    for (let j = 0; j < h.length; j++) {
      const x = v[i][j];
      o[h[j]] = x instanceof Date ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : (x === null || x === undefined ? '' : String(x));
      if (o[h[j]] !== '') any = true;
    }
    if (any) outRows.push(o);
  }
  return outRows;
}

function read_(name) { return readRaw_(name).filter(function (o) { return o['삭제'] !== 'Y'; }); }

function rowArr_(h, obj) { return h.map(function (k) { return obj[k] === undefined || obj[k] === null ? '' : String(obj[k]); }); }

function appendRow_(name, arr) {
  forget_(name);
  const s = sheet_(name);
  const r = s.getLastRow() + 1;
  s.getRange(r, 1, 1, arr.length).setNumberFormat('@').setValues([arr]);
}

function appendObj_(name, obj) { appendRow_(name, rowArr_(headers_(name), obj)); }

function updateObj_(name, row, obj) {
  forget_(name);
  const h = headers_(name);
  sheet_(name).getRange(row, 1, 1, h.length).setNumberFormat('@').setValues([rowArr_(h, obj)]);
}

function findById_(name, id) {
  const list = readRaw_(name);
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

function save_(tab, obj, user, isNew) {
  obj['수정일시'] = now_();
  obj['수정자'] = user.id;
  if (isNew) {
    obj['생성일시'] = obj['수정일시'];
    obj['생성자'] = user.id;
    obj['삭제'] = 'N';
    appendObj_(tab, obj);
  } else {
    updateObj_(tab, obj._row, obj);
  }
  return clean_(obj);
}

function clean_(o) {
  const c = {};
  Object.keys(o).forEach(function (k) { if (k !== '_row' && k !== '해시' && k !== '솔트') c[k] = o[k]; });
  return c;
}

function nextId_(tab, prefix, width) {
  let max = 0;
  readRaw_(tab).forEach(function (o) {
    const id = String(o.id || '');
    if (id.indexOf(prefix) === 0) {
      const n = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return prefix + String(max + 1).padStart(width, '0');
}

function audit_(user, act, target, detail) {
  appendRow_('감사로그', [now_(), user && user.id ? user.id : '', act, target || '', detail ? String(detail).slice(0, 1000) : '']);
}

function settings_() {
  const m = {};
  readRaw_('설정').forEach(function (r) { m[r['키']] = r['값']; });
  return m;
}

function hash_(pw, salt) {
  let h = salt + '|' + pw;
  for (let i = 0; i < 300; i++) {
    const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8);
    h = b.map(function (x) { return ('0' + ((x + 256) % 256).toString(16)).slice(-2); }).join('');
  }
  return h;
}

function tempPassword_() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function session_(token) {
  if (!token) throw new AppError('auth', '로그인이 필요합니다.');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('t_' + token);
  if (!raw) throw new AppError('auth', '로그인이 만료되었습니다. 다시 로그인하세요.');
  cache.put('t_' + token, raw, TOKEN_TTL);
  return JSON.parse(raw);
}

function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }

function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

function yy_() { return Utilities.formatDate(new Date(), TZ, 'yy'); }

function str_(v, max) { return String(v === undefined || v === null ? '' : v).trim().slice(0, max || 500); }

function need_(v, label) { if (!str_(v)) throw new AppError('invalid', label + '을(를) 입력하세요.'); return str_(v); }

function oneOf_(v, list, label) { if (list.indexOf(v) < 0) throw new AppError('invalid', label + ' 값이 올바르지 않습니다: ' + v); return v; }

function isDate_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function bizNoOk_(s) {
  const d = String(s).replace(/[^0-9]/g, '');
  if (d.length !== 10) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d.charAt(i)) * w[i];
  sum += Math.floor(Number(d.charAt(8)) * 5 / 10);
  return (10 - (sum % 10)) % 10 === Number(d.charAt(9));
}

function fmtBizNo_(s) { const d = String(s).replace(/[^0-9]/g, ''); return d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5); }

function num_(v, label) {
  const s = str_(v).replace(/,/g, '');
  if (s === '') return '';
  if (isNaN(Number(s))) throw new AppError('invalid', label + '은(는) 숫자로 입력하세요.');
  return s;
}

function addYearMinusDay_(s) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function daysUntil_(s) {
  if (!isDate_(s)) return 99999;
  return Math.round((new Date(s + 'T00:00:00Z') - new Date(today_() + 'T00:00:00Z')) / 86400000);
}

function canSeeSensitive_(u) { return STAFF.indexOf(u.role) >= 0; }

function maskBiz_(s) { const d = String(s || ''); return d ? d.slice(0, 7) + '*****' : ''; }

function maskAcct_(s) { const d = String(s || '').replace(/[^0-9]/g, ''); return d ? '****' + d.slice(-4) : ''; }

function folder_(path) {
  const props = PropertiesService.getScriptProperties();
  let f = DriveApp.getFolderById(props.getProperty('ROOT_FOLDER_ID'));
  path.forEach(function (name) {
    const it = f.getFoldersByName(name);
    f = it.hasNext() ? it.next() : f.createFolder(name);
  });
  return f;
}

function sha256Hex_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map(function (x) { return ('0' + ((x + 256) % 256).toString(16)).slice(-2); }).join('');
}

function changePassword_(p, u, token) {
  const pw = String(p.newPassword || '');
  if (pw.length < 8 || !/[0-9]/.test(pw) || !/[A-Za-z]/.test(pw)) {
    throw new AppError('invalid', '새 비밀번호는 영문과 숫자를 섞어 8자 이상으로 정하세요.');
  }
  const row = findById_('사용자', u.id);
  if (!row) throw new AppError('not_found', '사용자를 찾을 수 없습니다.');
  if (hash_(String(p.oldPassword || ''), row['솔트']) !== row['해시']) throw new AppError('invalid', '지금 비밀번호가 맞지 않습니다.');
  const salt = Utilities.getUuid();
  row['솔트'] = salt;
  row['해시'] = hash_(pw, salt);
  row['비밀번호변경필요'] = 'N';
  save_('사용자', row, u, false);
  u.mustChange = false;
  CacheService.getScriptCache().put('t_' + token, JSON.stringify(u), TOKEN_TTL);
  audit_(u, '비밀번호 변경', u.id, '');
  return { user: u };
}

function userReset_(p, u) {
  const row = findById_('사용자', str_(p.id));
  if (!row) throw new AppError('not_found', '사용자를 찾을 수 없습니다.');
  const temp = tempPassword_();
  row['솔트'] = Utilities.getUuid();
  row['해시'] = hash_(temp, row['솔트']);
  row['비밀번호변경필요'] = 'Y';
  row['실패횟수'] = '0';
  row['잠금해제시각'] = '';
  save_('사용자', row, u, false);
  audit_(u, '비밀번호 초기화', row.id, '');
  return { tempPassword: temp };
}

function dataVersion_() {
  const c = CacheService.getScriptCache();
  let v = c.get('data_ver');
  if (!v) { v = String(Date.now()); c.put('data_ver', v, 21600); }
  return v;
}

function bumpVersion_() { CacheService.getScriptCache().put('data_ver', String(Date.now()), 21600); }
function opsVersion_() {
  const c = CacheService.getScriptCache();
  let v = c.get('ops_ver');
  if (!v) { v = String(Date.now()); c.put('ops_ver', v, 21600); }
  return v;
}
function bumpOpsVersion_() { CacheService.getScriptCache().put('ops_ver', String(Date.now()), 21600); }
// 무거운 조회(손익·점검·재고)는 자료가 바뀌기 전까지 결과를 기억해 둡니다(최대 1시간).
function cached_(name, params, fn) {
  const key = 'c_' + name + '_' + dataVersion_() + '_' + opsVersion_() + '_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(params || {}))).slice(0, 12);
  const hit = cacheGet_(key);
  if (hit) return JSON.parse(hit);
  const out = fn();
  try { cachePut_(key, JSON.stringify(out), 3600); } catch (e) { /* 캐시 실패는 무시 */ }
  return out;
}
// 캐시 한 칸은 100KB까지라 30,000자씩 나눠 담습니다.

function cachePut_(key, text, ttl) {
  const c = CacheService.getScriptCache();
  const n = Math.ceil(text.length / 30000);
  if (n > 80) return;                                   // 너무 크면 캐시하지 않음
  const map = {};
  for (let i = 0; i < n; i++) map[key + '_' + i] = text.slice(i * 30000, (i + 1) * 30000);
  map[key + '_n'] = String(n);
  c.putAll(map, ttl);
}

function cacheGet_(key) {
  const c = CacheService.getScriptCache();
  const n = Number(c.get(key + '_n') || 0);
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(key + '_' + i);
  const got = c.getAll(keys);
  let out = '';
  for (let i = 0; i < n; i++) { const part = got[key + '_' + i]; if (part === undefined || part === null) return null; out += part; }
  return out;
}

function choices_() {
  return read_('선택목록').map(clean_).sort(function (a, b) { return (a['키'] + a['계약종류'] + String(a['순서']).padStart(3, '0')).localeCompare(b['키'] + b['계약종류'] + String(b['순서']).padStart(3, '0')); });
}
// 이 계약 종류에서 키별로 고를 수 있는 값 (계약종류 빈칸 = 모든 계약)

function logoSave_(p, u) {
  const mime = oneOf_(str_(p.mime), ['image/png', 'image/jpeg'], '로고 형식(PNG·JPG)');
  const bytes = Utilities.base64Decode(String(p.data || ''));
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new AppError('invalid', '2MB 이하의 로고 이미지를 올리세요.');
  const ratio = Number(p.ratio);
  if (!(ratio > 0.05 && ratio < 5)) throw new AppError('invalid', '로고 비율을 알 수 없습니다.');
  const root = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID'));
  const file = root.createFile(Utilities.newBlob(bytes, mime, '계약서_로고.' + (mime === 'image/png' ? 'png' : 'jpg')));
  const rows = readRaw_('설정');
  [['로고파일ID', file.getId()], ['로고비율', String(Math.round(ratio * 10000) / 10000)]].forEach(function (kv) {
    const r = rows.filter(function (x) { return x['키'] === kv[0]; })[0];
    if (r) { r['값'] = kv[1]; updateObj_('설정', r._row, r); } else appendRow_('설정', [kv[0], kv[1], '자동']);
  });
  audit_(u, '계약서 로고 등록', file.getId(), str_(p.name, 80));
  return settings_();
}

function noticeSave_(p, u) {
  const title = need_(p.제목, '제목');
  const body = str_(p.내용, 20000);
  let row, isNew = !p.id;
  if (isNew) {
    row = { id: nextId_('공지', 'NT' + yy_() + '-', 3), 상태: '게시', 작성자명: u.name };
  } else {
    row = findById_('공지', str_(p.id));
    if (!row) throw new AppError('not_found', '공지를 찾을 수 없습니다.');
  }
  row['제목'] = title.slice(0, 200);
  row['내용'] = body;
  const saved = save_('공지', row, u, isNew);
  audit_(u, isNew ? '공지 등록' : '공지 수정', row.id, row['제목']);
  return saved;
}

function vendorOut_(v, u) {
  const o = clean_(v);
  if (!canSeeSensitive_(u)) {
    o['사업자등록번호'] = maskBiz_(o['사업자등록번호']);
    o['계좌번호'] = maskAcct_(o['계좌번호']);
  }
  return o;
}

function idGen_(rows, prefix, width) {
  let max = 0;
  rows.forEach(function (o) {
    const id = String(o.id || '');
    if (id.indexOf(prefix) === 0) { const n = parseInt(id.slice(prefix.length), 10); if (!isNaN(n) && n > max) max = n; }
  });
  return function () { max += 1; return prefix + String(max).padStart(width, '0'); };
}
// 벤더 한 건을 검증해 행으로 만듭니다(낱건 저장과 엑셀 일괄 등록이 함께 씀).

function warehouseBuild_(p, row, u, ctx) {
  if (row && row.id === VIRTUAL_WH) throw new AppError('invalid', 'W01은 시스템이 쓰는 가상창고라 고칠 수 없습니다.');
  if (str_(p.id) === VIRTUAL_WH) throw new AppError('invalid', 'W01은 시스템이 쓰는 가상창고라 고칠 수 없습니다.');
  row = row || { id: ctx.next() };
  row['이름'] = need_(p.이름, '창고 이름');
  row['유형'] = oneOf_(str_(p.유형) || '3PL센터', WAREHOUSE_TYPES, '유형(가상창고는 W01 하나뿐입니다)');
  row['보관조건'] = str_(p.보관조건);
  row['주소'] = str_(p.주소);
  row['담당자'] = str_(p.담당자);
  row['상태'] = oneOf_(str_(p.상태) || '사용', ['사용', '중지'], '상태');
  return row;
}

// 보관창고 코드는 W02부터(W01은 가상창고 예약)
function whIdGen_(rows) { const g = idGen_(rows.concat([{ id: VIRTUAL_WH }]), 'W', 2); return g; }
function warehouseSave_(p, u) {
  const rows = readRaw_('창고');
  const old = p.id ? rows.filter(function (x) { return x.id === str_(p.id) && x['삭제'] !== 'Y'; })[0] : null;
  if (p.id && !old) throw new AppError('not_found', '창고를 찾을 수 없습니다.');
  const row = warehouseBuild_(p, old, u, { rows: rows, next: whIdGen_(rows) });
  const saved = save_('창고', row, u, !old);
  audit_(u, old ? '창고 수정' : '창고 등록', row.id, row['이름']);
  return saved;
}

function import_(action, p, u) {
  const cfg = IMPORTS[action];
  const items = Array.isArray(p.rows) ? p.rows : [];
  if (!items.length) throw new AppError('invalid', '올릴 행이 없습니다.');
  if (items.length > 1000) throw new AppError('invalid', '한 번에 1,000행까지 올릴 수 있습니다.');
  const s = sheet_(cfg.tab);
  const h = headers_(cfg.tab);
  const lr = s.getLastRow();
  const matrix = lr >= 2 ? s.getRange(2, 1, lr - 1, h.length).getValues().map(function (r) { return r.map(function (x) { return x instanceof Date ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x === null || x === undefined ? '' : x); }); }) : [];
  const work = matrix.map(function (r, i) { const o = { _idx: i }; h.forEach(function (k, j) { o[k] = r[j]; }); return o; }).filter(function (o) { return o.id; });
  const ctx = cfg.ctx ? cfg.ctx(work) : { rows: work, next: idGen_(work, cfg.prefix, cfg.width) };
  const errors = [], done = [];
  const t = now_();
  items.forEach(function (raw, i) {
    try {
      const id = str_(raw.id);
      if (cfg.tab === '창고' && id === VIRTUAL_WH) return;          // 가상창고 줄은 건너뜀(고칠 수 없음)
      let old = null;
      if (id) {
        old = work.filter(function (x) { return x.id === id && x['삭제'] !== 'Y'; })[0];
        if (!old) throw new AppError('not_found', '없는 코드입니다: ' + id + ' (새로 등록하려면 id 칸을 비우세요)');
      }
      // 수정일 때는 파일에 있는 칸만 바꾸고, 없는 칸은 기존 값을 그대로 둡니다.
      const input = old ? Object.assign({}, old, raw) : raw;
      const row = cfg.build(input, old ? Object.assign({}, old) : null, u, ctx);
      row['수정일시'] = t; row['수정자'] = u.id;
      if (old) { Object.assign(old, row); done.push(old); }
      else { row['생성일시'] = t; row['생성자'] = u.id; row['삭제'] = 'N'; work.push(row); done.push(row); }
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      errors.push({ 행: i + 2, 오류: e.message });
    }
  });
  if (errors.length) return { saved: false, errors: errors.slice(0, 200), 오류수: errors.length };
  let added = 0, changed = 0;
  done.forEach(function (o) {
    const arr = rowArr_(h, o);
    if (o._idx !== undefined) { matrix[o._idx] = arr; changed++; } else { matrix.push(arr); added++; }
  });
  forget_(cfg.tab);
  s.getRange(2, 1, matrix.length, h.length).setNumberFormat('@').setValues(matrix);
  audit_(u, '엑셀 올리기', cfg.label, '신규 ' + added + '건, 수정 ' + changed + '건');
  const list = read_(cfg.tab).map(function (x) { return cfg.tab === '벤더' ? vendorOut_(x, u) : clean_(x); });
  return { saved: true, 신규: added, 수정: changed, list: list };
}

function fillText_(text, values, settings) {
  const re = /\{\{([^}]+)\}\}/g;
  const ranges = [];
  let out = '', last = 0, m;
  while ((m = re.exec(text)) !== null) {
    out += text.slice(last, m.index);
    const k = m[1];
    const v = k.charAt(0) === '@' ? String(settings[k.slice(1)] || '') : String(values[k] || '');
    if (v.length) ranges.push([out.length, out.length + v.length - 1]);
    out += v;
    last = re.lastIndex;
  }
  out += text.slice(last);
  return { text: out, ranges: ranges };
}

function styleText_(t, f, size, bold) {
  if (!f.text.length) return;
  t.setFontFamily(PDF_FONT).setFontSize(size).setBold(!!bold).setUnderline(false).setForegroundColor('#1b1f27');
  f.ranges.forEach(function (r) { t.setBold(r[0], r[1], true); t.setUnderline(r[0], r[1], true); });
}

function footerLogo_(doc, settings) {
  const id = settings['로고파일ID'];
  if (!id) return;
  let blob;
  try { blob = DriveApp.getFileById(id).getBlob(); } catch (e) { return; }
  const footer = doc.addFooter();
  const ps = footer.getParagraphs();
  const p = ps.length ? ps[0] : footer.appendParagraph('');
  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  const w = 26 * MM;                                   // 로고 폭 26mm
  const ratio = Number(settings['로고비율'] || 0.27);
  p.appendInlineImage(blob).setWidth(Math.round(w)).setHeight(Math.round(w * ratio));
}

/* ───────────────────────── 계약 양식 (관리자 편집) ───────────────────────── */
// 지금 쓰는 양식: 구글시트 "계약양식"의 사용 중인 최신 판, 없으면 기본값
function formsAll_() {
  const out = {};
  Object.keys(FORMS_DEFAULT).forEach(function (c) { out[c] = Object.assign({}, FORMS_DEFAULT[c], { _ver: 0, _default: true }); });
  read_('계약양식').filter(function (r) { return r['상태'] === '사용'; }).forEach(function (r) {
    if (!out[r['코드']]) return;
    try { const f = JSON.parse(r['내용JSON']); f._ver = Number(r['버전']) || 0; f._default = false; f._at = r['수정일시']; f._by = r['수정자']; out[r['코드']] = f; } catch (e) { /* 깨진 판은 무시하고 기본값 */ }
  });
  return out;
}
function formPlain_(f) { return { code: f.code, title: f.title, party: f.party, left: f.left, right: f.right, sections: f.sections }; }
function formValidate_(code, f) {
  if (!f || typeof f !== 'object') throw new AppError('invalid', '양식 내용이 없습니다.');
  const title = need_(f.title, '양식 제목');
  if (title.length > 60) throw new AppError('invalid', '양식 제목은 60자 이내로 적으세요.');
  const party = FORMS_DEFAULT[code].party;
  if (!Array.isArray(f.sections) || !f.sections.length) throw new AppError('invalid', '조항이 하나도 없습니다.');
  if (f.sections.length > 60) throw new AppError('invalid', '조항은 60개까지 만들 수 있습니다.');
  const settingsKeys = ['회사_상호', '회사_사업자번호', '회사_대표자', '회사_주소'];
  const out = { code: code, title: title, party: party, left: FORMS_DEFAULT[code].left, right: FORMS_DEFAULT[code].right, sections: [] };
  f.sections.forEach(function (s, i) {
    const type = oneOf_(str_(s.type), ['intro', 'clause', 'closing', 'terms'], (i + 1) + '번째 항목의 종류');
    const body = String(s.body === undefined || s.body === null ? '' : s.body).replace(/\r/g, '');
    if (body.length > 4000) throw new AppError('invalid', (i + 1) + '번째 항목이 너무 깁니다(4,000자 이내).');
    const opens = (body.match(/\{\{/g) || []).length, closes = (body.match(/\}\}/g) || []).length;
    if (opens !== closes) throw new AppError('invalid', (i + 1) + '번째 항목의 {{ }} 괄호 짝이 맞지 않습니다.');
    (body.match(/\{\{([^}]*)\}\}/g) || []).forEach(function (m) {
      const k = m.slice(2, -2);
      if (k.charAt(0) === '@') { if (settingsKeys.indexOf(k.slice(1)) < 0) throw new AppError('invalid', '회사 정보 키는 ' + settingsKeys.map(function (x) { return '@' + x; }).join(', ') + '만 쓸 수 있습니다: ' + k); }
      else if (!/^[가-힣A-Za-z0-9_]{1,30}$/.test(k)) throw new AppError('invalid', '입력값 이름은 한글·영문·숫자·밑줄로 30자 이내여야 합니다: ' + k);
    });
    const sec = { type: type };
    if (type === 'clause') {
      sec.title = need_(s.title, (i + 1) + '번째 조항의 제목');
      if (sec.title.length > 40) throw new AppError('invalid', '조항 제목은 40자 이내로 적으세요: ' + sec.title);
      sec.when = (Array.isArray(s.when) ? s.when : []).map(function (t) { return oneOf_(str_(t), FORM_TAGS, '적용 조건'); });
    }
    if (type !== 'terms') sec.body = body;
    out.sections.push(sec);
  });
  if (FORMS_DEFAULT[code].sections.some(function (s) { return s.type === 'terms'; }) && !out.sections.some(function (s) { return s.type === 'terms'; })) {
    throw new AppError('invalid', '이 양식에는 거래조건표 자리가 꼭 있어야 합니다.');
  }
  if (JSON.stringify(out).length > 45000) throw new AppError('invalid', '양식 전체가 너무 깁니다.');
  return out;
}
function formWrite_(code, form, u, memo) {
  const rows = readRaw_('계약양식').filter(function (r) { return r['코드'] === code && r['삭제'] !== 'Y'; });
  const ver = rows.reduce(function (m, r) { return Math.max(m, Number(r['버전']) || 0); }, 0) + 1;
  rows.filter(function (r) { return r['상태'] === '사용'; }).forEach(function (r) { r['상태'] = '이전'; save_('계약양식', r, u, false); });
  save_('계약양식', { id: code + '-v' + ver, 상태: '사용', 코드: code, 버전: String(ver), 내용JSON: JSON.stringify(form), 메모: str_(memo, 200) }, u, true);
  audit_(u, '계약 양식 저장', code + ' v' + ver, str_(memo, 200));
  return ver;
}
function formSave_(p, u) {
  const code = str_(p.code);
  if (!FORMS_DEFAULT[code]) throw new AppError('invalid', '없는 양식입니다: ' + code);
  formWrite_(code, formValidate_(code, p.form), u, p.메모);
  return formsAll_();
}
function formReset_(p, u) {
  const code = str_(p.code);
  if (!FORMS_DEFAULT[code]) throw new AppError('invalid', '없는 양식입니다: ' + code);
  formWrite_(code, formPlain_(FORMS_DEFAULT[code]), u, '기본 양식으로 되돌림');
  return formsAll_();
}
function formHistory_(p) {
  const code = str_(p.code);
  return read_('계약양식').filter(function (r) { return r['코드'] === code; }).map(function (r) {
    return { 버전: r['버전'], 상태: r['상태'], 수정자: r['수정자'], 수정일시: r['수정일시'], 메모: r['메모'] };
  }).sort(function (a, b) { return Number(b.버전) - Number(a.버전); });
}

/* ───────────────────────── 운영 공통 ───────────────────────── */
function holidays_() { return String(settings_()['공휴일'] || '').split(/[\s,]+/).filter(function (s) { return isDate_(s); }); }
function vat_() { return Number(settings_()['VAT'] || 0.1); }
function won_(n) { return Math.round(Number(n) || 0); }
function dateOf_(s) { return String(s || '').slice(0, 10); }
// 시트 전체를 한 번에 읽고 한 번에 쓰는 도구(많은 줄을 빠르고 일관되게 저장)
// 시트 전체를 한 번에 읽어(호출 1번) 요청이 끝날 때까지 기억합니다.
function matrixOf_(tab) {
  if (MEMO && MEMO.mx[tab]) return MEMO.mx[tab];
  const s = sheet_(tab), h = headers_(tab), lr = s.getLastRow();
  const m = lr >= 2 ? s.getRange(2, 1, lr - 1, h.length).getValues().map(function (r) { return r.map(function (x) { return x instanceof Date ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x === null || x === undefined ? '' : x); }); }) : [];
  const objs = m.map(function (r, i) { const o = { _idx: i }; h.forEach(function (k, j) { o[k] = r[j]; }); return o; });
  const mx = { tab: tab, s: s, h: h, m: m, objs: objs, dirty: {} };
  if (MEMO) MEMO.mx[tab] = mx;
  return mx;
}
function mxPut_(mx, o) {
  const arr = rowArr_(mx.h, o);
  if (o._idx !== undefined && o._idx < mx.m.length) mx.m[o._idx] = arr;
  else { o._idx = mx.m.length; mx.m.push(arr); mx.objs.push(o); }
  mx.dirty[o._idx] = true;
  if (MEMO) delete MEMO.rows[mx.tab];
}
// 바뀐 줄만 씁니다. 붙어 있는 줄은 한 덩어리로, 덩어리가 많으면 처음~끝을 한 번에.
function mxSave_(mx) {
  const idx = Object.keys(mx.dirty).map(Number).sort(function (a, b) { return a - b; });
  mx.dirty = {};
  if (!idx.length) return 0;
  if (MEMO) delete MEMO.rows[mx.tab];
  touched_(mx.tab);
  const runs = [];
  idx.forEach(function (i) { const r = runs[runs.length - 1]; if (r && i === r[1] + 1) r[1] = i; else runs.push([i, i]); });
  const blocks = runs.length > 8 ? [[idx[0], idx[idx.length - 1]]] : runs;
  blocks.forEach(function (b) { mx.s.getRange(b[0] + 2, 1, b[1] - b[0] + 1, mx.h.length).setNumberFormat('@').setValues(mx.m.slice(b[0], b[1] + 1)); });
  return idx.length;
}
function stamp_(o, u, isNew) { const t = now_(); o['수정일시'] = t; o['수정자'] = u.id; if (isNew) { o['생성일시'] = t; o['생성자'] = u.id; o['삭제'] = 'N'; } return o; }

/* ───────────────────────── 운영 도우미 ───────────────────────── */
function mapById_(rows) { const m = {}; rows.forEach(function (r) { m[r.id] = r; }); return m; }
function tradeOfVendor_(v) { return v ? (v['구분'] === 'PB제조사' ? '직매입' : (v['거래형태'] || '')) : ''; }
function modeOfProduct_(p, trade) { return trade === '직매입' || trade === '위탁판매' ? (modeOf(p['운영방식'] || p['배송방식']) || '재고형') : ''; }
const RETURN_STATES = ['반품', '취소'];
// 반품 처리 대상: 송장이 발행된(배송일자 있는) 줄이 반품·취소되고 아임웹 반품완료일이 있을 때
function isReturned_(o) { return !!(o['배송일자'] && o['반품완료일'] && RETURN_STATES.indexOf(o['주문상태']) >= 0); }
function round2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function monthEnd_(m) { return m + '-' + ('0' + lastDay(+m.slice(0, 4), +m.slice(5, 7))).slice(-2); }
/* ───────────────────────── 주문 (아임웹 엑셀) ───────────────────────── */
function normDateTime_(s) {
  s = str_(s).replace(/\./g, '-').replace(/\//g, '-').replace('T', ' ');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return '';
  const d = m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  if (!isDate_(d)) return '';
  return m[4] ? d + ' ' + ('0' + m[4]).slice(-2) + ':' + m[5] + ':' + (m[6] || '00') : d;
}
function productMatcher_() {
  const products = read_('상품').filter(function (p) { return p['상태'] !== '삭제'; });
  const vendors = mapById_(read_('벤더'));
  const byId = {}, byMall = {}, byName = {};
  products.forEach(function (p) {
    byId[p.id] = p;
    if (p['몰상품코드']) (byMall[p['몰상품코드']] = byMall[p['몰상품코드']] || []).push(p);
    (byName[p['상품명']] = byName[p['상품명']] || []).push(p);
  });
  return function (code, name) {
    let p = null, how = '';
    if (code && byId[code]) { p = byId[code]; how = '상품코드'; }
    else if (code && byMall[code]) { if (byMall[code].length > 1) return { err: '몰상품코드 ' + code + '를 쓰는 상품이 여럿입니다' }; p = byMall[code][0]; how = '몰상품코드'; }
    else if (name && byName[name] && byName[name].length === 1) { p = byName[name][0]; how = '상품명'; }
    if (!p) return { p: null };
    const trade = tradeOfVendor_(vendors[p['공급사코드']]);
    return { p: p, how: how, trade: trade, mode: modeOfProduct_(p, trade) };
  };
}
function orderImport_(p, u) {
  const items = Array.isArray(p.rows) ? p.rows : [];
  if (!items.length) throw new AppError('invalid', '올릴 주문 줄이 없습니다.');
  if (items.length > 5000) throw new AppError('invalid', '한 번에 5,000줄까지 올릴 수 있습니다. 기간을 나눠 내려받으세요.');
  const today = today_();
  const match = productMatcher_();
  const mx = matrixOf_('주문');
  const existing = {};
  mx.objs.forEach(function (o) { if (o.id && o['삭제'] !== 'Y') existing[o.id] = o; });
  const seen = {}, errors = [], warnings = [];
  const out = { 신규: 0, 수정: 0, 그대로: 0, 미연결: 0, 자동구매확정: 0, 결제합계: 0, 첫주문일: '', 끝주문일: '', 송장발행: 0, 반품완료: 0, 배송일자없음: 0, 배송일자변경: 0 };
  const batch = 'U' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss');
  const ready = [];
  items.forEach(function (raw, i) {
    const line = i + 2;
    try {
      const id = str_(raw.품목키, 120);
      if (!id) throw new AppError('invalid', '품목 주문번호(또는 주문번호)가 없습니다.');
      if (seen[id]) throw new AppError('invalid', '같은 품목 주문이 파일에 두 번 있습니다: ' + id);
      seen[id] = true;
      const o = { id: id, 주문번호: need_(raw.주문번호, '주문번호') };
      o['주문일시'] = normDateTime_(raw.주문일시);
      if (!o['주문일시']) throw new AppError('invalid', '주문일이 날짜가 아닙니다: ' + str_(raw.주문일시));
      o['결제일시'] = normDateTime_(raw.결제일시);
      o['주문상태'] = oneOf_(str_(raw.주문상태), ORDER_STATES, '주문상태');
      o['원래상태'] = str_(raw.원래상태, 40);
      const qty = Number(String(raw.수량 === undefined ? '' : raw.수량).replace(/,/g, ''));
      if (!(qty >= 1) || Math.floor(qty) !== qty) throw new AppError('invalid', '수량은 1 이상의 정수여야 합니다: ' + str_(raw.수량));
      o['수량'] = String(qty);
      ['판매단가', '상품금액', '할인금액', '결제금액', '배송비'].forEach(function (k) {
        const v = str_(raw[k]).replace(/,/g, '');
        if (v !== '' && (isNaN(Number(v)) || Number(v) < 0)) throw new AppError('invalid', k + '는 0 이상의 숫자여야 합니다: ' + raw[k]);
        o[k] = v === '' ? '0' : String(won_(v));
      });
      if (o['결제금액'] === '0' && o['상품금액'] !== '0') o['결제금액'] = String(Math.max(0, won_(o['상품금액']) - won_(o['할인금액'])));
      ['몰상품코드', '상품명', '옵션', '결제수단', '회원구분', '송장번호', '택배사'].forEach(function (k) { o[k] = str_(raw[k], 200); });
      o['배송완료일'] = dateOf_(normDateTime_(raw.배송완료일));
      o['구매확정일'] = dateOf_(normDateTime_(raw.구매확정일));
      o['배송일자'] = dateOf_(normDateTime_(raw.배송일자));          // 송장발행일(아임웹 배송일자) = 매출·매입 기준일
      o['반품완료일'] = dateOf_(normDateTime_(raw.반품완료일));
      if (str_(raw.배송일자) && !o['배송일자']) throw new AppError('invalid', '배송일자가 날짜가 아닙니다: ' + str_(raw.배송일자));
      if (o['반품완료일'] && o['배송일자'] && o['반품완료일'] < o['배송일자']) {
        warnings.push({ 행: line, 내용: '반품완료일(' + o['반품완료일'] + ')이 배송일자보다 빨라 넣지 않았습니다: ' + id });
        o['반품완료일'] = '';
      }
      if (o['주문상태'] === '배송완료' && o['배송완료일'] && !o['구매확정일'] && addDays(o['배송완료일'], 7) <= today) {
        o['주문상태'] = '구매확정'; o['구매확정일'] = addDays(o['배송완료일'], 7); out.자동구매확정++;
      }
      if (o['주문상태'] === '구매확정' && !o['구매확정일']) {
        o['구매확정일'] = o['배송완료일'] ? (addDays(o['배송완료일'], 7) < today ? addDays(o['배송완료일'], 7) : today) : dateOf_(o['주문일시']);
      }
      if (RETURN_STATES.indexOf(o['주문상태']) >= 0 && o['배송일자'] && !o['반품완료일']) {
        warnings.push({ 행: line, 내용: o['주문상태'] + ' 상태지만 반품완료일이 없어, 매출 차감은 반품이 끝난 파일을 올릴 때 합니다: ' + id });
      }
      const mt = match(o['몰상품코드'], o['상품명']);
      if (mt.err) throw new AppError('invalid', mt.err);
      o['상품ID'] = mt.p ? mt.p.id : '';
      o['공급사코드'] = mt.p ? mt.p['공급사코드'] : '';
      o['거래형태'] = mt.p ? (mt.trade || '') : '';
      o['운영방식'] = mt.p ? (mt.mode || '') : '';
      o['배송방식'] = '';
      if (!mt.p) out.미연결++;
      else if (mt.how === '상품명') warnings.push({ 행: line, 내용: '상품코드가 맞지 않아 상품명으로 연결했습니다: ' + o['상품명'] + ' → ' + mt.p.id });
      ready.push({ line: line, o: o });
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      errors.push({ 행: line, 오류: e.message });
    }
  });
  if (errors.length) return { saved: false, errors: errors.slice(0, 200), 오류수: errors.length, warnings: warnings.slice(0, 100) };
  const keys = ['주문번호', '주문일시', '결제일시', '주문상태', '원래상태', '상품ID', '몰상품코드', '상품명', '옵션', '수량', '판매단가', '상품금액', '할인금액', '결제금액', '배송비', '결제수단',
    '배송완료일', '구매확정일', '회원구분', '송장번호', '택배사', '공급사코드', '거래형태', '운영방식', '배송일자', '반품완료일', '교환처리일', '배송일자변경'];
  ready.forEach(function (r) {
    const o = r.o, old = existing[o.id];
    out.결제합계 += won_(o['결제금액']);
    const d = dateOf_(o['주문일시']);
    if (!out.첫주문일 || d < out.첫주문일) out.첫주문일 = d;
    if (!out.끝주문일 || d > out.끝주문일) out.끝주문일 = d;
    if (old) {
      // 배송일자(송장발행일)·반품완료일은 처음 값으로 고정하고, 바뀌면 안내만 합니다.
      if (old['배송일자'] && o['배송일자'] !== old['배송일자']) {
        if (o['배송일자']) {
          o['배송일자변경'] = o['배송일자']; out.배송일자변경++;
          warnings.push({ 행: r.line, 내용: '배송일자가 ' + old['배송일자'] + ' → ' + o['배송일자'] + '로 바뀌었지만 처음 값으로 고정했습니다: ' + o.id });
        } else o['배송일자변경'] = old['배송일자변경'] || '';
        o['배송일자'] = old['배송일자'];
      } else o['배송일자변경'] = old['배송일자변경'] || '';
      if (old['반품완료일'] && o['반품완료일'] !== old['반품완료일']) o['반품완료일'] = old['반품완료일'];
      o['교환처리일'] = old['교환처리일'] || '';
    } else { o['배송일자변경'] = ''; o['교환처리일'] = ''; }
    if (o['주문상태'] === '교환' && o['배송일자'] && !o['교환처리일']) o['교환처리일'] = today;
    if (o['배송일자']) out.송장발행++;
    else if (o['송장번호']) out.배송일자없음++;
    if (isReturned_(o)) out.반품완료++;
    if (!old) { out.신규++; r.write = Object.assign({ 상태: '사용', 업로드번호: batch, 정산번호: '', 조정정산번호: '', 메모: '', 출하원가: '', 배송방식: '' }, o); return; }
    if (old['정산번호'] && (old['수량'] !== o['수량'] || old['결제금액'] !== o['결제금액'] || old['상품ID'] !== o['상품ID'])) {
      warnings.push({ 행: r.line, 내용: '정산(' + old['정산번호'] + ')이 끝난 주문이라 수량·금액·상품은 바꾸지 않았습니다: ' + o.id });
      ['수량', '판매단가', '상품금액', '할인금액', '결제금액', '배송비', '상품ID', '공급사코드', '거래형태', '운영방식'].forEach(function (k) { o[k] = old[k]; });
    }
    const changed = keys.some(function (k) { return String(old[k] || '') !== String(o[k] || ''); });
    if (!changed) { out.그대로++; return; }
    out.수정++;
    r.write = Object.assign(old, o, { 업로드번호: batch });
  });
  if (p.dryRun) return { saved: false, preview: true, summary: out, warnings: warnings.slice(0, 100), 경고수: warnings.length };
  ready.forEach(function (r) { if (r.write) mxPut_(mx, stamp_(r.write, u, r.write._idx === undefined)); });
  const sync = opsSync_(u);          // 출하원가까지 계산한 뒤 주문 시트는 한 번만 씁니다
  mxSave_(mx);
  audit_(u, '주문 올리기', batch, str_(p.파일명, 120) + ' / 신규 ' + out.신규 + ', 수정 ' + out.수정 + ', 그대로 ' + out.그대로 + ', 미연결 ' + out.미연결 + ', 송장발행 ' + out.송장발행);
  return { saved: true, summary: out, warnings: warnings.slice(0, 100), 경고수: warnings.length, batch: batch, sync: sync };
}
function orderList_(p) {
  const from = isDate_(str_(p.from)) ? str_(p.from) : '', to = isDate_(str_(p.to)) ? str_(p.to) : '';
  const basis = str_(p.기준) === '배송일자' ? '배송일자' : '주문일시';
  const q = str_(p.q);
  let rows = read_('주문').filter(function (o) {
    const d = dateOf_(o[basis]);
    if ((from || to) && !d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (p.상태 && o['주문상태'] !== p.상태) return false;
    if (p.미연결 && o['상품ID']) return false;
    if (q && (o['주문번호'] + o.id + o['상품명']).indexOf(q) < 0) return false;
    return true;
  });
  const sum = { 줄수: rows.length, 결제합계: 0, 상태별: {}, 미연결: 0, 송장발행: 0 };
  rows.forEach(function (o) { sum.결제합계 += won_(o['결제금액']); sum.상태별[o['주문상태']] = (sum.상태별[o['주문상태']] || 0) + 1; if (!o['상품ID']) sum.미연결++; if (o['배송일자']) sum.송장발행++; });
  rows.sort(function (a, b) { return String(b[basis]).localeCompare(String(a[basis])); });
  // 한 번에 300줄씩 보냅니다(화면에서 "더 보기").
  const off = Math.max(0, Number(p.offset) || 0), lim = Math.min(1000, Math.max(50, Number(p.limit) || 300));
  return { summary: sum, rows: rows.slice(off, off + lim).map(clean_), offset: off, 다음: off + lim < rows.length ? off + lim : null, 전체: rows.length };
}
// 미연결 주문을 상품에 직접 연결(정산 전 주문만)
function orderLink_(p, u) {
  const ids = (Array.isArray(p.ids) ? p.ids : []).map(String);
  if (!ids.length) throw new AppError('invalid', '연결할 주문을 고르세요.');
  const prod = findById_('상품', str_(p.상품ID));
  if (!prod || prod['삭제'] === 'Y' || prod['상태'] === '삭제') throw new AppError('invalid', '연결할 상품을 찾을 수 없습니다.');
  const trade = tradeOfVendor_(findById_('벤더', prod['공급사코드']));
  const mx = matrixOf_('주문');
  let n = 0;
  mx.objs.forEach(function (o) {
    if (ids.indexOf(o.id) < 0 || o['삭제'] === 'Y') return;
    if (o['정산번호']) throw new AppError('invalid', '정산이 끝난 주문은 다시 연결할 수 없습니다: ' + o.id);
    o['상품ID'] = prod.id; o['공급사코드'] = prod['공급사코드']; o['거래형태'] = trade || ''; o['운영방식'] = modeOfProduct_(prod, trade);
    mxPut_(mx, stamp_(o, u, false)); n++;
  });
  mxSave_(mx);
  if (p.몰상품코드저장 && p.몰상품코드 && !prod['몰상품코드']) { prod['몰상품코드'] = str_(p.몰상품코드, 60); save_('상품', prod, u, false); }
  opsSync_(u);
  audit_(u, '주문 상품 연결', prod.id, n + '줄');
  return { linked: n };
}

/* ───────────────────────── 매입 원장 · 재고 동기화 ───────────────────────── */
// 주문이 바뀔 때마다: ① 주문형 직매입의 매입(주문출고·반품회수)을 원장에 맞추고 ② 재고 수불과 출하원가를 다시 계산합니다.
function opsSync_(u) {
  const a = purchaseAutoSync_(u);
  const b = stockSync_(u);
  return { 매입: a, 재고: b };
}
function purchaseAutoSync_(u) {
  const prods = mapById_(read_('상품'));
  const vendors = mapById_(read_('벤더'));
  const vat = vat_();
  const pm = matrixOf_('매입');
  const byId = {};
  pm.objs.forEach(function (r) { if (r.id) byId[r.id] = r; });
  const want = {};
  const rep = { 생성: 0, 수정: 0, 삭제: 0, 공급가없음: 0 };
  const mk = function (id, src, o, date, q, unit, pr) {
    const supply = won_(q * unit), tax = pr['과세구분'] === '면세' ? 0 : won_(supply * vat);
    return { id: id, 상태: '확정', 매입번호: '자동', 공급사코드: o['공급사코드'], 상호: (vendors[o['공급사코드']] || {})['상호'] || '', 입고일: date, 창고ID: VIRTUAL_WH,
      상품ID: o['상품ID'], 상품명: pr['상품명'] || o['상품명'], 수량: String(q), 단가: String(unit), 공급가액: String(supply), 부가세: String(tax), 합계: String(supply + tax),
      과세구분: pr['과세구분'] || '과세', 메모: '주문 ' + o['주문번호'], 원천: src, 인식일: date, 주문품목키: o.id, 운영방식: '주문형', 거래형태: '직매입' };
  };
  read_('주문').forEach(function (o) {
    if (!o['상품ID'] || o['거래형태'] !== '직매입' || modeOf(o['운영방식']) !== '주문형' || !o['배송일자']) return;
    const pr = prods[o['상품ID']] || {};
    const q = Number(o['수량']) || 0;
    const outId = 'PO-' + o.id, old = byId[outId];
    const unit = old && old['삭제'] !== 'Y' && Number(old['단가']) ? Number(old['단가']) : Number(pr['공급가'] || 0);   // 단가는 처음 매입한 때의 공급가로 고정
    if (!unit) { rep.공급가없음++; return; }
    want[outId] = mk(outId, '주문출고', o, o['배송일자'], q, unit, pr);
    if (isReturned_(o)) want['PR-' + o.id] = mk('PR-' + o.id, '반품회수', o, o['반품완료일'], -q, unit, pr);
  });
  const cmp = ['상태', '공급사코드', '입고일', '상품ID', '수량', '단가', '공급가액', '부가세', '원천', '인식일', '삭제'];
  Object.keys(want).forEach(function (id) {
    const w = want[id], old = byId[id];
    if (old && old['정산번호']) return;                           // 정산한 줄은 그대로 (차이는 가상창고 점검에 나타남)
    if (!old) { mxPut_(pm, stamp_(Object.assign({ 정산번호: '' }, w), u, true)); rep.생성++; return; }
    w['삭제'] = 'N';
    if (cmp.some(function (k) { return String(old[k] || '') !== String(w[k] || ''); })) { Object.assign(old, w); mxPut_(pm, stamp_(old, u, false)); rep.수정++; }
  });
  pm.objs.forEach(function (r) {
    if (!r.id || r['삭제'] === 'Y' || want[r.id] || r['정산번호']) return;
    if (r['원천'] !== '주문출고' && r['원천'] !== '반품회수') return;
    r['삭제'] = 'Y'; mxPut_(pm, stamp_(r, u, false)); rep.삭제++;
  });
  if (rep.생성 || rep.수정 || rep.삭제) mxSave_(pm);
  return rep;
}
function defaultWh_(whs, st) {
  const ok = function (id) { const w = whs[id]; return w && id !== VIRTUAL_WH && w['유형'] !== '가상' && w['상태'] !== '중지'; };
  const s = st['기본출고창고'];
  if (s && ok(s)) return s;
  return Object.keys(whs).filter(ok).sort()[0] || '';
}
const STOCK_ORDER = { 기초: 0, 입고: 1, 위탁입고: 1, 반품입고: 2, 조정: 3, 실사: 3, 출고: 4, 교환출고: 5, 반품출고: 6 };
const LEDGER_SKIP = { 수정일시: 1, 수정자: 1, 생성일시: 1, 생성자: 1 };   // 줄이 바뀌었는지 비교할 때 빼는 칸
function stockCloseEnd_(st) { const m = str_((st || settings_())['재고마감월']); return /^\d{4}-\d{2}$/.test(m) ? monthEnd_(m) : ''; }
// 재고 수불: 보관창고(W02~)는 회사 소유 재고를 이동평균 단가로, 가상창고(W01)는 주문형 직매입이 같은 날 들어오고 나가는 흐름으로 계산합니다.
// 속도: 재고 마감한 달까지의 줄은 그대로 두고(다시 계산하지 않음) 그 뒤 줄만 계산하며, 시트에는 바뀐 줄만 씁니다.
function stockSync_(u) {
  const st = settings_();
  const closeEnd = stockCloseEnd_(st), openDay = closeEnd ? addDays(closeEnd, 1) : '';
  const prods = mapById_(read_('상품'));
  const whs = mapById_(read_('창고'));
  const defWh = defaultWh_(whs, st);
  const whOf = function (pid) { const p = prods[pid] || {}; return p['기본창고'] && whs[p['기본창고']] && p['기본창고'] !== VIRTUAL_WH ? p['기본창고'] : defWh; };
  const nameOf = function (pid, nm) { return (prods[pid] || {})['상품명'] || nm || pid; };
  const sm = matrixOf_('재고수불');
  // ① 마감한 줄(맨 앞부터 일자가 마감일 이하인 줄)과 그 끝의 잔액
  const co = {}, w1 = {}, whq = {}, cost = {}, outUnit = {}, frozen = {};
  let frozenN = 0;
  if (closeEnd) {
    while (frozenN < sm.objs.length) {
      const r = sm.objs[frozenN];
      if (!r.id || r['삭제'] === 'Y' || !r['일자'] || r['일자'] > closeEnd) break;
      frozen[r.id] = true;
      const q = Number(r['수량']) || 0, key = r['창고ID'] + '|' + r['상품ID'];
      whq[key] = Number(r['잔량']) || 0;
      if (r['창고ID'] === VIRTUAL_WH) { const b = w1[r['상품ID']] = w1[r['상품ID']] || { q: 0, a: 0 }; b.q += q; b.a += Number(r['금액']) || 0; if (b.q === 0) b.a = 0; }
      else if (r['소유'] !== '위탁') { const b = co[r['상품ID']] = co[r['상품ID']] || { q: 0, a: 0, avg: 0 }; b.q += q; b.a = Number(r['재고금액']) || 0; b.avg = Number(r['이동평균단가']) || 0; }
      if (r['원천'] === '주문' && (r['구분'] === '출고')) { cost[r['원천ID']] = r['소유'] === '위탁' ? '' : String(round2_(r['단가'])); outUnit[r['원천ID']] = Number(r['단가']) || 0; }
      frozenN++;
    }
  }
  // ② 계산할 일(이벤트)
  const ev = [];
  const poByOrder = {};
  read_('매입').forEach(function (r) {
    if (r['상태'] !== '확정') return;
    const src = r['원천'] || '센터입고';
    const q = Number(r['수량']) || 0, unit = Number(r['단가']) || 0;
    const d = r['인식일'] || r['입고일'];
    if (src === '센터입고' || src === '기초재고') {
      const wh = r['창고ID'] && whs[r['창고ID']] && r['창고ID'] !== VIRTUAL_WH ? r['창고ID'] : whOf(r['상품ID']);
      ev.push({ d: d, wh: wh, pid: r['상품ID'], k: src === '기초재고' ? '기초' : '입고', own: '회사', q: q, unit: unit, src: '매입', sid: r.id });
    } else if (src === '주문출고') {
      poByOrder[r['주문품목키']] = r;
      ev.push({ d: d, wh: VIRTUAL_WH, pid: r['상품ID'], k: '입고', own: '회사', q: q, unit: unit, src: '매입', sid: r.id });
    } else if (src === '반품회수') {
      ev.push({ d: d, wh: VIRTUAL_WH, pid: r['상품ID'], k: '반품출고', own: '회사', q: q, unit: unit, src: '매입', sid: r.id });
    }
  });
  const om = matrixOf_('주문');
  om.objs.forEach(function (o) {
    if (!o.id || o['삭제'] === 'Y' || !o['상품ID'] || !o['배송일자']) return;
    const tr = o['거래형태'], md = modeOf(o['운영방식']), q = Number(o['수량']) || 0;
    if (!q || (tr !== '직매입' && tr !== '위탁판매')) return;
    if (md === '주문형') {
      if (tr !== '직매입') return;                                  // 주문형 위탁은 재고가 없음
      const po = poByOrder[o.id];
      const unit = po ? Number(po['단가']) : null;
      ev.push({ d: o['배송일자'], wh: VIRTUAL_WH, pid: o['상품ID'], k: '출고', own: '회사', q: -q, unit: unit, src: '주문', sid: o.id, order: true });
      if (isReturned_(o)) ev.push({ d: o['반품완료일'], wh: VIRTUAL_WH, pid: o['상품ID'], k: '반품입고', own: '회사', q: q, unit: unit, src: '주문', sid: o.id });
      return;
    }
    const own = tr === '직매입' ? '회사' : '위탁';
    const wh = whOf(o['상품ID']);
    ev.push({ d: o['배송일자'], wh: wh, pid: o['상품ID'], k: '출고', own: own, q: -q, src: '주문', sid: o.id, order: true });
    if (isReturned_(o)) ev.push({ d: o['반품완료일'], wh: wh, pid: o['상품ID'], k: '반품입고', own: own, q: q, src: '주문', sid: o.id });
    if (tr === '직매입' && o['주문상태'] === '교환' && o['교환처리일']) ev.push({ d: o['교환처리일'], wh: wh, pid: o['상품ID'], k: '교환출고', own: own, q: -q, src: '주문', sid: o.id });
  });
  sm.objs.forEach(function (r) {
    if (!r.id || r['삭제'] === 'Y' || r['원천'] !== '수동') return;
    ev.push({ d: r['일자'], wh: r['창고ID'], pid: r['상품ID'], k: r['구분'], own: r['소유'] || '회사', q: Number(r['수량']) || 0, unit: r['단가'] === '' ? null : Number(r['단가']), src: '수동', sid: r.id, row: r });
  });
  // 마감한 달에 이미 들어간 일은 건너뛰고, 마감 뒤에 늦게 들어온 지난 날짜의 일은 마감 다음 날로 넣습니다.
  const todo = [];
  let late = 0;
  ev.forEach(function (e) {
    e.id = e.row ? e.row.id : 'A:' + e.k + ':' + e.sid;
    if (frozen[e.id]) return;
    if (closeEnd && e.d <= closeEnd) { e.late = e.d; e.d = openDay; late++; }
    todo.push(e);
  });
  todo.forEach(function (e, i) { e.i = i; });
  todo.sort(function (a, b) {
    if (a.d !== b.d) return a.d < b.d ? -1 : 1;
    const pa = (a.k === '조정' || a.k === '실사') && a.q < 0 ? 5 : STOCK_ORDER[a.k], pb = (b.k === '조정' || b.k === '실사') && b.q < 0 ? 5 : STOCK_ORDER[b.k];
    return (pa - pb) || (a.i - b.i);
  });
  const warn = { 원가없음: 0, 창고없음: 0, 마감후반영: late };
  const rows = [];
  const t = now_(), uid = u ? u.id : 'system';
  todo.forEach(function (e) {
    if (!e.wh) warn.창고없음++;
    const key = (e.wh || '') + '|' + e.pid;
    let unit = 0, amt = 0, avg = '', bal = '';
    if (e.own === '위탁') {
      unit = 0; amt = 0;
    } else if (e.wh === VIRTUAL_WH) {
      const b = w1[e.pid] = w1[e.pid] || { q: 0, a: 0 };
      if (e.unit === null || e.unit === undefined || isNaN(e.unit)) { unit = Number((prods[e.pid] || {})['공급가']) || 0; warn.원가없음++; } else unit = e.unit;
      amt = won_(e.q * unit); b.q += e.q; b.a += amt; if (b.q === 0) b.a = 0;
      bal = b.a;
    } else {
      const b = co[e.pid] = co[e.pid] || { q: 0, a: 0, avg: 0 };
      if (e.q > 0) {
        if (e.k === '반품입고' && outUnit[e.sid] !== undefined) unit = outUnit[e.sid];      // 반품은 나갈 때의 원가로 되돌림
        else if (e.unit !== null && e.unit !== undefined && !isNaN(e.unit) && e.k !== '반품입고') unit = e.unit;
        else unit = b.avg || Number((prods[e.pid] || {})['공급가']) || 0;
        amt = won_(e.q * unit); b.q += e.q; b.a += amt;
        if (b.q > 0) b.avg = b.a / b.q;
      } else if (e.q < 0) {
        unit = b.avg;
        if (!unit) { unit = Number((prods[e.pid] || {})['공급가']) || 0; warn.원가없음++; }
        amt = won_(e.q * unit); b.q += e.q; b.a += amt;
        if (b.q === 0) b.a = 0; else if (b.q < 0) b.a = won_(b.q * unit);
      }
      avg = round2_(b.avg); bal = won_(b.a);
    }
    if (e.k === '출고' && e.order) { cost[e.sid] = e.own === '위탁' ? '' : String(round2_(unit)); outUnit[e.sid] = unit; }
    whq[key] = (whq[key] || 0) + e.q;
    const base = e.row ? Object.assign({}, e.row) : { id: e.id, 상태: '사용', 생성일시: t, 생성자: 'system', 삭제: 'N', 사유: '', 메모: '' };
    Object.assign(base, { 일자: e.d, 창고ID: e.wh, 상품ID: e.pid, 상품명: nameOf(e.pid, base['상품명']), 구분: e.k, 소유: e.own, 수량: String(e.q), 단가: String(round2_(unit)), 금액: String(amt),
      원천: e.src, 원천ID: e.sid, 잔량: String(whq[key]), 이동평균단가: String(avg), 재고금액: String(bal) });
    if (e.late && !e.row) base['메모'] = '마감 후 반영 (원래 ' + e.late + ')';
    rows.push(base);
  });
  // 지운 수동 줄도 기록으로 남김(맨 뒤)
  sm.objs.forEach(function (r) { if (r.id && r['삭제'] === 'Y' && r['원천'] === '수동') rows.push(r); });
  // ③ 마감 뒤 줄을 시트의 같은 자리와 비교해 바뀐 줄만 씁니다.
  const h = sm.h, cmpIdx = h.map(function (k, j) { return LEDGER_SKIP[k] ? -1 : j; }).filter(function (j) { return j >= 0; });
  const iU = h.indexOf('수정일시'), iW = h.indexOf('수정자'), iC = h.indexOf('생성일시'), iCw = h.indexOf('생성자');
  let changed = 0;
  const oldLen = sm.m.length;
  rows.forEach(function (r, k) {
    const at = frozenN + k, arr = rowArr_(h, r), old = sm.m[at];
    if (old && cmpIdx.every(function (j) { return old[j] === arr[j]; })) return;
    if (old && old[h.indexOf('id')] === arr[h.indexOf('id')]) { arr[iC] = old[iC]; arr[iCw] = old[iCw]; }
    arr[iU] = t; arr[iW] = uid;
    if (at < sm.m.length) sm.m[at] = arr; else sm.m.push(arr);
    sm.dirty[at] = true; changed++;
  });
  const blank = h.map(function () { return ''; });
  for (let at = frozenN + rows.length; at < oldLen; at++) { if (sm.m[at].join('') !== '') { sm.m[at] = blank.slice(); sm.dirty[at] = true; changed++; } }
  mxSave_(sm);
  delete MEMO.mx['재고수불'];                                   // 줄 위치가 바뀌었을 수 있어 다음 읽기에서 새로 읽음
  let costChanged = 0;
  om.objs.forEach(function (o) {
    if (!o.id || o['삭제'] === 'Y') return;
    const want = cost[o.id] !== undefined ? cost[o.id] : '';
    if (String(o['출하원가'] || '') !== want) { o['출하원가'] = want; mxPut_(om, o); costChanged++; }
  });
  if (costChanged) mxSave_(om);
  return { 줄수: frozenN + rows.length, 마감줄: frozenN, 다시쓴줄: changed, 출하원가변경: costChanged, 경고: warn, 기본출고창고: defWh, 재고마감월: closeEnd ? closeEnd.slice(0, 7) : '' };
}
// 재고 마감: 그달까지의 수불을 고정합니다(다시 계산하지 않아 빨라짐). 다시 열기는 관리자만.
function stockClose_(p, u) {
  const m = str_(p.월);
  const cur = str_(settings_()['재고마감월']);
  if (m && !/^\d{4}-\d{2}$/.test(m)) throw new AppError('invalid', '월을 2026-12 같은 형식으로 고르세요.');
  if (m && monthEnd_(m) >= today_()) throw new AppError('invalid', '끝난 달만 마감할 수 있습니다.');
  if ((!m || (cur && m < cur)) && u.role !== '관리자') throw new AppError('forbidden', '마감한 달을 다시 여는 것은 관리자만 할 수 있습니다.');
  if (m && m > cur) {
    const bad = w01Days_(read_('재고수불')).filter(function (b) { return b.일자 <= monthEnd_(m); });
    if (bad.length) throw new AppError('invalid', '가상창고 잔액이 0이 아닌 날이 있어 마감할 수 없습니다(' + bad.slice(-3).map(function (b) { return b.일자; }).join(', ') + '). 데이터 점검에서 먼저 바로잡으세요.');
  }
  const row = readRaw_('설정').filter(function (r) { return r['키'] === '재고마감월'; })[0];
  if (row) { row['값'] = m; updateObj_('설정', row._row, row); } else appendRow_('설정', ['재고마감월', m, '이 달까지 재고 수불을 고정(재고 화면에서 마감)']);
  touched_('재고수불');
  audit_(u, m ? '재고 마감' : '재고 마감 해제', m || cur, cur + ' → ' + (m || '없음'));
  const r = stockSync_(u);
  return Object.assign({ 재고마감월: m, sync: r }, stockList_({}, u));
}
// 가상창고(W01) 일별 잔액: 하루라도 0이 아니면 오류
function w01Days_(rows) {
  const by = {};
  rows.forEach(function (r) {
    if (r['창고ID'] !== VIRTUAL_WH || r['삭제'] === 'Y') return;
    const d = by[r['일자']] = by[r['일자']] || {};
    d[r['상품ID']] = (d[r['상품ID']] || 0) + (Number(r['수량']) || 0);
  });
  const bal = {}, bad = [];
  Object.keys(by).sort().forEach(function (day) {
    Object.keys(by[day]).forEach(function (pid) { bal[pid] = (bal[pid] || 0) + by[day][pid]; });
    const off = Object.keys(bal).filter(function (pid) { return bal[pid] !== 0; });
    if (off.length) bad.push({ 일자: day, 잔량: off.reduce(function (a, pid) { return a + bal[pid]; }, 0), 상품: off.slice(0, 10).map(function (pid) { return pid + ' ' + bal[pid]; }) });
  });
  return bad;
}
function opsHome_() {
  const rows = read_('재고수불');
  const bad = w01Days_(rows);
  const neg = {};
  rows.forEach(function (r) { if (r['창고ID'] !== VIRTUAL_WH && Number(r['잔량']) < 0) neg[r['창고ID'] + '|' + r['상품ID']] = true; });
  return { 가상창고문제일: bad.length, 최근문제일: bad.slice(-3).map(function (b) { return b.일자; }), 재고음수: Object.keys(neg).length };
}

/* ───────────────────────── 매입 (센터입고 · 기초재고) ───────────────────────── */
function purchaseList_() { return read_('매입').filter(function (r) { return !r['원천'] || r['원천'] === '센터입고' || r['원천'] === '기초재고'; }).map(clean_); }
// 자동 매입(주문형 직매입의 주문출고·반품회수) 조회
function purchaseAuto_(p, u) {
  const from = isDate_(str_(p.from)) ? str_(p.from) : '', to = isDate_(str_(p.to)) ? str_(p.to) : '';
  const rows = read_('매입').filter(function (r) {
    if (r['원천'] !== '주문출고' && r['원천'] !== '반품회수') return false;
    if (from && r['인식일'] < from) return false;
    if (to && r['인식일'] > to) return false;
    if (p.공급사코드 && r['공급사코드'] !== p.공급사코드) return false;
    return true;
  }).sort(function (a, b) { return String(b['인식일']).localeCompare(String(a['인식일'])); });
  const sum = { 줄수: rows.length, 공급가액: 0, 부가세: 0, 미정산: 0 };
  rows.forEach(function (r) { sum.공급가액 += won_(r['공급가액']); sum.부가세 += won_(r['부가세']); if (!r['정산번호']) sum.미정산 += won_(r['공급가액']); });
  return { summary: sum, rows: rows.slice(0, 1000).map(clean_), 잘림: rows.length > 1000 };
}
function purchaseSave_(p, u) {
  const vendor = findById_('벤더', str_(p.공급사코드));
  if (!vendor || vendor['삭제'] === 'Y') throw new AppError('invalid', '공급사를 고르세요.');
  const trade = tradeOfVendor_(vendor);
  if (trade !== '직매입') throw new AppError('invalid', '매입 입고는 직매입 공급사만 등록합니다(위탁 재고는 재고 화면의 위탁 입고, 제휴입점은 광고료).');
  const src = oneOf_(str_(p.원천) || '센터입고', ['센터입고', '기초재고'], '구분');
  const date = str_(p.입고일);
  if (!isDate_(date)) throw new AppError('invalid', '입고일을 2026-11-03 같은 날짜로 넣으세요.');
  const whs = mapById_(read_('창고'));
  let wh = str_(p.창고ID);
  if (wh === VIRTUAL_WH) throw new AppError('invalid', '가상창고(W01)에는 입고할 수 없습니다. 실제 보관창고(W02~)를 고르세요.');
  if (wh && !whs[wh]) throw new AppError('invalid', '없는 창고입니다.');
  if (!wh) wh = defaultWh_(whs, settings_());
  if (!wh) throw new AppError('invalid', '보관창고(W02~)를 먼저 등록하세요(마스터 → 창고).');
  const lines = Array.isArray(p.lines) ? p.lines : [];
  if (!lines.length || lines.length > 100) throw new AppError('invalid', '상품 줄은 1~100개여야 합니다.');
  const vat = vat_();
  const prepared = lines.map(function (l, i) {
    const prod = findById_('상품', str_(l.상품ID));
    if (!prod || prod['삭제'] === 'Y') throw new AppError('invalid', (i + 1) + '번째 줄: 상품을 고르세요.');
    if (prod['공급사코드'] !== vendor.id) throw new AppError('invalid', (i + 1) + '번째 줄: ' + prod['상품명'] + '은(는) 이 공급사의 상품이 아닙니다.');
    if (modeOfProduct_(prod, trade) === '주문형') throw new AppError('invalid', (i + 1) + '번째 줄: ' + prod['상품명'] + '은(는) 주문형 상품이라 송장발행일에 자동으로 매입됩니다.');
    const qty = Number(String(l.수량).replace(/,/g, ''));
    if (!(qty >= 1) || Math.floor(qty) !== qty) throw new AppError('invalid', (i + 1) + '번째 줄: 수량은 1 이상의 정수입니다.');
    const unit = str_(l.단가) === '' ? Number(prod['공급가'] || 0) : Number(String(l.단가).replace(/,/g, ''));
    if (isNaN(unit) || unit < 0) throw new AppError('invalid', (i + 1) + '번째 줄: 단가가 숫자가 아닙니다.');
    if (!unit) throw new AppError('invalid', (i + 1) + '번째 줄: ' + prod['상품명'] + '의 단가(공급가)가 없습니다.');
    const supply = won_(qty * unit), tax = prod['과세구분'] === '면세' ? 0 : won_(supply * vat);
    return { 상품ID: prod.id, 상품명: prod['상품명'], 수량: String(qty), 단가: String(unit), 공급가액: String(supply), 부가세: String(tax), 합계: String(supply + tax), 과세구분: prod['과세구분'] || '과세' };
  });
  const pm = matrixOf_('매입'), rows = pm.objs;
  let no = str_(p.매입번호);
  if (no) {
    const cur = rows.filter(function (r) { return r['매입번호'] === no && r['삭제'] !== 'Y'; });
    if (!cur.length) throw new AppError('not_found', '매입을 찾을 수 없습니다: ' + no);
    if (cur.some(function (r) { return r['상태'] !== '등록'; })) throw new AppError('locked', '확정·취소된 매입은 고칠 수 없습니다.');
    cur.forEach(function (r) { r['삭제'] = 'Y'; mxPut_(pm, stamp_(r, u, false)); });
  } else {
    const pre = 'B' + yy_() + '-';
    let max = 0;
    rows.forEach(function (r) { const s = String(r['매입번호'] || ''); if (s.indexOf(pre) === 0) max = Math.max(max, parseInt(s.slice(pre.length), 10) || 0); });
    no = pre + String(max + 1).padStart(4, '0');
  }
  const ver = rows.filter(function (r) { return r['매입번호'] === no; }).length;
  prepared.forEach(function (l, i) {
    mxPut_(pm, stamp_(Object.assign({ id: no + '-' + String(ver + i + 1).padStart(3, '0'), 상태: '등록', 매입번호: no, 공급사코드: vendor.id, 상호: vendor['상호'], 입고일: date, 창고ID: wh, 정산번호: '', 메모: str_(p.메모, 300),
      원천: src, 인식일: date, 주문품목키: '', 운영방식: '재고형', 거래형태: '직매입' }, l), u, true));
  });
  mxSave_(pm);
  audit_(u, p.매입번호 ? '매입 수정' : (src === '기초재고' ? '기초재고 등록' : '매입 등록'), no, vendor['상호'] + ' / ' + prepared.length + '줄');
  return purchaseList_();
}
function purchaseState_(p, u) {
  const no = str_(p.매입번호);
  const to = oneOf_(str_(p.상태), ['확정', '취소'], '바꿀 상태');
  const cur = read_('매입').filter(function (r) { return r['매입번호'] === no && (!r['원천'] || r['원천'] === '센터입고' || r['원천'] === '기초재고'); });
  if (!cur.length) throw new AppError('not_found', '매입을 찾을 수 없습니다: ' + no);
  if (cur.some(function (r) { return r['정산번호']; })) throw new AppError('locked', '정산에 들어간 매입은 바꿀 수 없습니다. 정산서를 먼저 지우세요(작성 상태일 때만).');
  if (to === '확정' && cur.some(function (r) { return r['상태'] !== '등록'; })) throw new AppError('invalid', '등록 상태의 매입만 확정할 수 있습니다.');
  const pm = matrixOf_('매입');
  const ids = {}; cur.forEach(function (r) { ids[r.id] = true; });
  pm.objs.forEach(function (r) { if (ids[r.id] && r['삭제'] !== 'Y') { r['상태'] = to; mxPut_(pm, stamp_(r, u, false)); } });
  mxSave_(pm);
  stockSync_(u);
  audit_(u, '매입 ' + to, no, cur.length + '줄');
  return purchaseList_();
}

/* ───────────────────────── 재고 ───────────────────────── */
function stockList_(p, u) {
  const rows = read_('재고수불');
  const prods = mapById_(read_('상품'));
  const by = {};
  rows.forEach(function (r) {
    const x = by[r['상품ID']] = by[r['상품ID']] || { 상품ID: r['상품ID'], 상품명: r['상품명'], 창고별: {}, 회사수량: 0, 이동평균단가: 0, 재고금액: 0, 위탁수량: 0, 가상창고: 0 };
    const q = Number(r['수량']) || 0;
    if (r['창고ID'] === VIRTUAL_WH) { x.가상창고 += q; return; }
    x.창고별[r['창고ID']] = (x.창고별[r['창고ID']] || 0) + q;
    if (r['소유'] === '위탁') x.위탁수량 += q;
    else { x.회사수량 += q; x.이동평균단가 = Number(r['이동평균단가']) || 0; x.재고금액 = Number(r['재고금액']) || 0; }
  });
  const list = Object.keys(by).map(function (k) {
    const x = by[k], pr = prods[k] || {};
    x.상품명 = pr['상품명'] || x.상품명; x.코드 = tradeCode(pr['거래형태'], pr['운영방식']);
    if (!canSeeSensitive_(u)) { delete x.이동평균단가; delete x.재고금액; }
    return x;
  }).sort(function (a, b) { return String(a.상품명).localeCompare(String(b.상품명)); });
  const total = list.reduce(function (a, x) { return a + (x.재고금액 || 0); }, 0);
  return { items: list, 재고금액합계: canSeeSensitive_(u) ? total : null, 가상창고문제: w01Days_(rows), at: now_() };
}
function stockLedger_(p, u) {
  const from = isDate_(str_(p.from)) ? str_(p.from) : '', to = isDate_(str_(p.to)) ? str_(p.to) : '';
  const rows = read_('재고수불').filter(function (r) {
    if (p.상품ID && r['상품ID'] !== p.상품ID) return false;
    if (p.창고ID && r['창고ID'] !== p.창고ID) return false;
    if (from && r['일자'] < from) return false;
    if (to && r['일자'] > to) return false;
    return true;
  });
  const out = rows.slice(-2000).reverse().map(function (r) { const o = clean_(r); if (!canSeeSensitive_(u)) { delete o['단가']; delete o['금액']; delete o['이동평균단가']; delete o['재고금액']; } return o; });
  return { rows: out, 잘림: rows.length > 2000 };
}
// 수동 재고 기록: 조정(±수량), 실사(센 수량 → 차이를 기록), 위탁 입고(공급사 소유 재고), 지우기
function stockMove_(p, u) {
  const kind = oneOf_(str_(p.구분), ['조정', '실사', '위탁입고', '지우기'], '구분');
  const sm = matrixOf_('재고수불');
  if (kind === '지우기') {
    const r = sm.objs.filter(function (x) { return x.id === str_(p.id) && x['원천'] === '수동' && x['삭제'] !== 'Y'; })[0];
    if (!r) throw new AppError('not_found', '지울 수 있는 수동 기록이 아닙니다.');
    r['삭제'] = 'Y'; mxPut_(sm, stamp_(r, u, false)); mxSave_(sm);
    audit_(u, '재고 기록 삭제', r.id, r['구분'] + ' ' + r['상품ID'] + ' ' + r['수량']);
    stockSync_(u);
    return stockList_({}, u);
  }
  const date = str_(p.일자);
  if (!isDate_(date)) throw new AppError('invalid', '날짜를 넣으세요.');
  const whs = mapById_(read_('창고'));
  const wh = str_(p.창고ID);
  if (!whs[wh] || wh === VIRTUAL_WH || whs[wh]['유형'] === '가상') throw new AppError('invalid', '실제 보관창고(W02~)를 고르세요. 가상창고는 조정할 수 없습니다.');
  const prod = findById_('상품', str_(p.상품ID));
  if (!prod || prod['삭제'] === 'Y') throw new AppError('invalid', '상품을 고르세요.');
  const trade = tradeOfVendor_(findById_('벤더', prod['공급사코드']));
  if (modeOfProduct_(prod, trade) !== '재고형') throw new AppError('invalid', '재고형 상품만 재고를 기록합니다: ' + prod['상품명']);
  const own = trade === '위탁판매' ? '위탁' : '회사';
  if (kind === '위탁입고' && own !== '위탁') throw new AppError('invalid', '위탁 입고는 위탁판매 공급사의 재고형 상품만 합니다. 직매입은 매입 화면에서 입고하세요.');
  const n = Number(String(p.수량).replace(/,/g, ''));
  if (isNaN(n) || Math.floor(n) !== n) throw new AppError('invalid', '수량은 정수로 넣으세요.');
  let q = n, memo = str_(p.메모, 300);
  if (kind === '위탁입고' && !(n > 0)) throw new AppError('invalid', '위탁 입고 수량은 1 이상입니다.');
  if (kind === '조정' && !n) throw new AppError('invalid', '조정 수량을 넣으세요(늘리면 +, 줄이면 −).');
  if (kind === '실사') {
    if (n < 0) throw new AppError('invalid', '실사 수량은 0 이상입니다.');
    let bal = 0;
    read_('재고수불').forEach(function (r) { if (r['창고ID'] === wh && r['상품ID'] === prod.id && r['일자'] <= date && (r['소유'] || '회사') === own) bal += Number(r['수량']) || 0; });
    q = n - bal;
    memo = '장부 ' + bal + ' → 실사 ' + n + (memo ? ' · ' + memo : '');
  }
  const reason = str_(p.사유, 40) || (kind === '실사' ? '기타' : '');
  if (kind === '실사' && ['3PL 귀책', '파손·불량', '기타'].indexOf(reason) < 0) throw new AppError('invalid', '실사 차이 사유는 3PL 귀책 / 파손·불량 / 기타 중에서 고르세요.');
  const unit = str_(p.단가) === '' ? '' : String(Number(String(p.단가).replace(/,/g, '')) || 0);
  const id = idGen_(sm.objs.filter(function (x) { return x.id; }), 'M', 5)();
  mxPut_(sm, stamp_({ id: id, 상태: '사용', 일자: date, 창고ID: wh, 상품ID: prod.id, 상품명: prod['상품명'], 구분: kind, 소유: own, 수량: String(q), 단가: own === '위탁' ? '0' : unit,
    금액: '', 원천: '수동', 원천ID: id, 잔량: '', 이동평균단가: '', 재고금액: '', 사유: reason, 메모: memo }, u, true));
  mxSave_(sm);
  audit_(u, '재고 ' + kind, id, wh + ' / ' + prod.id + ' / ' + q + (reason ? ' / ' + reason : ''));
  stockSync_(u);
  return Object.assign({ id: id, 차이: q }, stockList_({}, u));
}

/* ───────────────────────── 정산 ───────────────────────── */
const DIFF_REASONS = ['할인·쿠폰', '옵션 가격', '판매가 변경', '회원가 적용', 'PG 결제수단', '반올림 차이', '기타'];
function contractRate_(vendorId) {
  const cs = read_('계약').filter(function (c) { return c['벤더코드'] === vendorId && c['종류'] === 'K1' && ['증빙수집', '완료'].indexOf(c['상태']) >= 0; })
    .sort(function (a, b) { return String(b['확정일시']).localeCompare(String(a['확정일시'])); });
  return cs.length ? Number(valuesOf_(cs[0])['수수료율'] || 0) : 0;
}
function vendorCycle_(v) { return cycleOf(v['대금지급주기']) || PAY_CYCLE_DEFAULT[tradeOfVendor_(v)] || '월 1회'; }
function memberPrice_(pr, o) { return /구독/.test(o['회원구분'] || '') && Number(pr['구독회원가']) ? Number(pr['구독회원가']) : Number(pr['일반회원가'] || 0); }
// 정산 대상 계산(저장하지 않음).
//  · 지급일로 정산: 지급월 + 7·14·21·28일 → 공급사마다 지급주기에 맞는 마감 기간을 찾습니다.
//  · 기간으로 정산: 기간시작~기간종료(광고료, 예외 처리).
// 마감일까지 아직 정산하지 않은 줄을 모두 모으므로 늦게 들어온 줄도 빠지지 않습니다.
function settleCompute_(p) {
  const kind = oneOf_(str_(p.구분), ['직매입', '위탁판매', '광고료'], '정산 구분');
  const byPay = !!str_(p.지급월);
  let payMonth = '', payDay = 0, start = '', end = '';
  if (byPay) {
    if (kind === '광고료') throw new AppError('invalid', '광고료는 기간으로 정산합니다.');
    payMonth = str_(p.지급월); payDay = Number(p.지급일);
    if (!/^\d{4}-\d{2}$/.test(payMonth)) throw new AppError('invalid', '지급월을 2026-12 같은 형식으로 고르세요.');
    if ([7, 14, 21, 28].indexOf(payDay) < 0) throw new AppError('invalid', '지급일은 7·14·21·28일 중에서 고르세요.');
  } else {
    start = str_(p.기간시작); end = str_(p.기간종료);
    if (!isDate_(start) || !isDate_(end) || end < start) throw new AppError('invalid', '정산 기간을 확인하세요.');
  }
  const vendorId = str_(p.공급사코드);
  const st = settings_(), vat = vat_(), hol = holidays_(), tol = Number(st['정산차이_반올림'] || 10);
  const prods = mapById_(read_('상품'));
  const vendors = read_('벤더');
  const vmap = mapById_(vendors);
  const plan = {};
  vendors.forEach(function (v) {
    if (vendorId && v.id !== vendorId) return;
    const t = tradeOfVendor_(v);
    if (kind === '광고료' ? t !== '제휴입점' : t !== kind) return;
    const cyc = kind === '광고료' ? '' : vendorCycle_(v);
    const per = byPay ? periodForPayDay(cyc, payMonth, payDay) : { start: start, end: end, pay: kind === '광고료' ? '' : cyclePeriod(cyc, end).pay };
    if (!per) return;
    plan[v.id] = { 지급주기: cyc, start: per.start, end: per.end, due: per.pay ? nextBizDay(per.pay, hol) : '', 회차: byPay ? payMonth + ' ' + payDay + '일 지급' : (kind === '광고료' ? '' : '기간 지정') };
  });
  const groups = {}, warnings = [];
  const add = function (vid, line) { if (plan[vid]) (groups[vid] = groups[vid] || []).push(line); };
  if (kind === '직매입') {
    read_('매입').forEach(function (r) {
      const pl = plan[r['공급사코드']];
      if (!pl || r['상태'] !== '확정' || r['정산번호'] || r['원천'] === '기초재고') return;
      const d = r['인식일'] || r['입고일'];
      if (d > pl.end) return;
      const src = r['원천'] || '센터입고';
      add(r['공급사코드'], { 원천: '매입', 원천ID: r.id, 일자: d, 상품ID: r['상품ID'], 상품명: r['상품명'] + ' (' + src + ')', 수량: r['수량'], 단가: r['단가'], 금액: won_(r['공급가액']), 부가세: won_(r['부가세']),
        비고: src === '센터입고' ? r['매입번호'] : (r['메모'] || '') });
    });
  }
  if (kind === '위탁판매') {
    const rates = {};
    read_('주문').forEach(function (o) {
      const vid = o['공급사코드'], pl = plan[vid];
      if (!pl || o['거래형태'] !== '위탁판매' || !o['상품ID'] || !o['배송일자']) return;
      const saleNow = !o['정산번호'] && o['배송일자'] <= pl.end;
      const retNow = isReturned_(o) && o['반품완료일'] <= pl.end && !o['조정정산번호'] && (!!o['정산번호'] || saleNow);
      if (!saleNow && !retNow) return;
      const pr = prods[o['상품ID']] || {};
      if (rates[vid] === undefined) rates[vid] = contractRate_(vid);
      const rate = Number(pr['수수료율'] || 0) || rates[vid];
      if (!rate) { warnings.push('수수료율이 없어 뺐습니다(상품·계약 모두 없음): ' + o['상품ID'] + ' ' + o['상품명']); return; }
      const nm = (o['상품명'] || pr['상품명'] || o['상품ID']) + (o['옵션'] ? ' / ' + o['옵션'] : '');
      const q = Number(o['수량']) || 0, pay = won_(o['결제금액']), fee = won_(pay * rate / 100);
      if (saleNow) {
        const line = { 원천: '주문', 원천ID: o.id, 일자: o['배송일자'], 상품ID: o['상품ID'], 상품명: nm, 수량: String(q), 단가: '', 금액: pay, 수수료율: String(rate), 수수료: fee, 부가세: won_(fee * vat), 비고: o['주문번호'] };
        const exp = memberPrice_(pr, o) * q;
        if (exp) {
          const act = won_(o['상품금액']) || won_(Number(o['판매단가']) * q);
          const diff = act - exp;
          line.아임웹금액 = act; line.화프스금액 = exp; line.차이 = diff;
          line.차이사유 = diff && Math.abs(diff) < tol ? '반올림 차이' : '';
        }
        add(vid, line);
      }
      if (retNow) add(vid, { 원천: '주문조정', 원천ID: o.id, 일자: o['반품완료일'], 상품ID: o['상품ID'], 상품명: nm, 수량: String(-q), 단가: '', 금액: -pay, 수수료율: String(rate), 수수료: -fee, 부가세: -won_(fee * vat),
        비고: o['주문번호'] + ' ' + o['주문상태'] + ' 차감' });
    });
  }
  if (kind === '광고료') {
    const billed = {};
    read_('정산상세').forEach(function (d) { if (d['원천'] === '광고') billed[d['원천ID']] = true; });
    read_('계약').forEach(function (c) {
      if (['K1', 'AD'].indexOf(c['종류']) < 0 || ['증빙수집', '완료'].indexOf(c['상태']) < 0 || billed[c.id]) return;
      const pl = plan[c['벤더코드']];
      if (!pl) return;
      const v = valuesOf_(c);
      if (!adHasFixed(adMethod(v)) || !v['광고료_총액'] || !v['광고_시작일'] || v['광고_시작일'] > pl.end) return;
      const amt = won_(String(v['광고료_총액']).replace(/,/g, ''));
      const due = addDays(v['광고_시작일'], -1);
      add(c['벤더코드'], { 원천: '광고', 원천ID: c.id, 일자: v['광고_시작일'], 상품ID: '', 상품명: '기간 정액 광고 ' + v['광고_시작일'] + '~' + v['광고_종료일'] + ' (' + (v['광고_게재위치'] || '') + ')', 수량: v['광고_게재일수'] || '',
        단가: String(v['광고_일단가'] || '').replace(/,/g, ''), 금액: amt, 부가세: won_(amt * vat), 비고: '납부기한 ' + due, due: due });
    });
    read_('광고측정').forEach(function (m) {
      if (m['확정'] !== 'Y' || m['정산번호'] || !(Number(m['금액']) > 0)) return;
      const pl = plan[m['공급사코드']];
      if (!pl) return;
      const mEnd = monthEnd_(m['월']);
      if (mEnd > pl.end) return;
      const amt = won_(m['금액']), due = nextBizDay(addDays(mEnd, 10), hol);
      add(m['공급사코드'], { 원천: '광고성과', 원천ID: m.id, 일자: mEnd, 상품ID: '', 상품명: '성과형 광고 ' + m['월'] + ' (' + m['계약번호'] + ')', 수량: '', 단가: '', 금액: amt, 부가세: won_(amt * vat), 비고: '납부기한 ' + due, due: due });
    });
  }
  const list = Object.keys(groups).map(function (vid) {
    const lines = groups[vid].sort(function (a, b) { return String(a.일자).localeCompare(String(b.일자)); });
    const v = vmap[vid] || {}, pl = plan[vid];
    const t = { 건수: lines.length, 대상금액: 0, 수수료: 0, 수수료부가세: 0, 공급가액: 0, 부가세: 0, 지급액: 0, 차이: 0 };
    lines.forEach(function (l) {
      if (kind === '위탁판매') { t.대상금액 += l.금액; t.수수료 += l.수수료; t.수수료부가세 += l.부가세; }
      else { t.공급가액 += l.금액; t.부가세 += l.부가세; }
      if (l.차이 && !l.차이사유) t.차이++;
    });
    t.지급액 = kind === '위탁판매' ? t.대상금액 - t.수수료 - t.수수료부가세 : t.공급가액 + t.부가세;
    const due = kind === '광고료' ? lines.map(function (l) { return l.due; }).sort()[0] : pl.due;
    return { 공급사코드: vid, 상호: v['상호'] || vid, 지급주기: pl.지급주기, 기간시작: pl.start, 기간종료: pl.end, 회차: pl.회차, 지급예정일: due, totals: t, lines: lines };
  }).sort(function (a, b) { return String(a.상호).localeCompare(String(b.상호)); });
  const skipped = byPay ? vendors.filter(function (v) { const t = tradeOfVendor_(v); return t === kind && !plan[v.id] && (!vendorId || v.id === vendorId); }).map(function (v) { return v['상호'] + '(' + vendorCycle_(v) + ')'; }) : [];
  return { 구분: kind, 지급월: payMonth, 지급일: payDay, 기간시작: start, 기간종료: end, vendors: list, 이번회차아님: skipped, warnings: warnings.filter(function (w, i, a) { return a.indexOf(w) === i; }).slice(0, 50) };
}
function settlePreview_(p, u) {
  if (!canSeeSensitive_(u)) throw new AppError('forbidden', '정산은 운영기획·관리자만 볼 수 있습니다.');
  return settleCompute_(p);
}
function settleCreate_(p, u) {
  const r = settleCompute_(p);
  const only = Array.isArray(p.공급사들) && p.공급사들.length ? p.공급사들.map(String) : null;
  const targets = r.vendors.filter(function (v) { return !only || only.indexOf(v.공급사코드) >= 0; });
  if (!targets.length) throw new AppError('invalid', '정산할 줄이 없습니다. 지급일·기간과 주문·매입 상태를 확인하세요.');
  const heads = readRaw_('정산');
  const pre = 'S' + yy_() + '-';
  let max = 0;
  heads.forEach(function (h) { const s = String(h.id || ''); if (s.indexOf(pre) === 0) max = Math.max(max, parseInt(s.slice(pre.length), 10) || 0); });
  const det = matrixOf_('정산상세'), om = matrixOf_('주문'), pm = matrixOf_('매입'), am = matrixOf_('광고측정');
  const idx = function (mx) { const m = {}; mx.objs.forEach(function (o) { if (o['삭제'] !== 'Y') m[o.id] = o; }); return m; };
  const oIdx = idx(om), pIdx = idx(pm), aIdx = idx(am);
  const made = [];
  targets.forEach(function (v) {
    const id = pre + String(++max).padStart(4, '0');
    const t = v.totals;
    save_('정산', { id: id, 상태: '작성', 정산번호: id, 구분: r.구분, 공급사코드: v.공급사코드, 상호: v.상호, 기간시작: v.기간시작, 기간종료: v.기간종료, 지급예정일: v.지급예정일,
      건수: String(t.건수), 대상금액: String(t.대상금액), 공제금액: '0', 수수료: String(t.수수료), 수수료부가세: String(t.수수료부가세), 공급가액: String(t.공급가액), 부가세: String(t.부가세), 지급액: String(t.지급액), 지급일: '', 메모: str_(p.메모, 300),
      지급주기: v.지급주기 || '', 회차: v.회차 || '', 차이건수: String(t.차이) }, u, true);
    v.lines.forEach(function (l, i) {
      mxPut_(det, stamp_({ id: id + '-' + String(i + 1).padStart(4, '0'), 상태: '사용', 정산번호: id, 원천: l.원천, 원천ID: l.원천ID, 일자: l.일자, 상품ID: l.상품ID, 상품명: l.상품명,
        수량: l.수량, 단가: l.단가 || '', 금액: String(l.금액), 수수료율: l.수수료율 || '', 수수료: String(l.수수료 || 0), 부가세: String(l.부가세 || 0), 비고: l.비고 || '',
        아임웹금액: l.아임웹금액 === undefined ? '' : String(l.아임웹금액), 화프스금액: l.화프스금액 === undefined ? '' : String(l.화프스금액), 차이: l.차이 === undefined ? '' : String(l.차이), 차이사유: l.차이사유 || '' }, u, true));
      if (l.원천 === '주문') { const o = oIdx[l.원천ID]; if (o) { o['정산번호'] = id; mxPut_(om, stamp_(o, u, false)); } }
      if (l.원천 === '주문조정') { const o = oIdx[l.원천ID]; if (o) { o['조정정산번호'] = id; mxPut_(om, stamp_(o, u, false)); } }
      if (l.원천 === '매입') { const o = pIdx[l.원천ID]; if (o) { o['정산번호'] = id; mxPut_(pm, stamp_(o, u, false)); } }
      if (l.원천 === '광고성과') { const o = aIdx[l.원천ID]; if (o) { o['정산번호'] = id; mxPut_(am, stamp_(o, u, false)); } }
    });
    made.push(id);
    audit_(u, '정산 작성', id, r.구분 + ' / ' + v.상호 + ' / ' + v.기간시작 + '~' + v.기간종료 + (v.회차 ? ' / ' + v.회차 : '') + ' / 지급 ' + t.지급액);
  });
  mxSave_(det); mxSave_(om); mxSave_(pm); mxSave_(am);
  return { made: made, list: read_('정산').map(clean_), warnings: r.warnings };
}
function settleGet_(p, u) {
  if (!canSeeSensitive_(u)) throw new AppError('forbidden', '정산은 운영기획·관리자만 볼 수 있습니다.');
  const h = findById_('정산', str_(p.id));
  if (!h || h['삭제'] === 'Y') throw new AppError('not_found', '정산서를 찾을 수 없습니다.');
  return { head: clean_(h), lines: read_('정산상세').filter(function (d) { return d['정산번호'] === h.id; }).map(clean_), reasons: DIFF_REASONS };
}
// 정산 차이 사유 등록(작성 상태에서만). 사유가 모두 들어가야 확정할 수 있습니다.
function settleDiffSave_(p, u) {
  const h = findById_('정산', str_(p.id));
  if (!h || h['삭제'] === 'Y') throw new AppError('not_found', '정산서를 찾을 수 없습니다.');
  if (h['상태'] !== '작성') throw new AppError('locked', '작성 상태의 정산서만 사유를 고칠 수 있습니다.');
  const list = Array.isArray(p.lines) ? p.lines : [];
  const dm = matrixOf_('정산상세');
  let n = 0;
  list.forEach(function (l) {
    const r = dm.objs.filter(function (x) { return x.id === str_(l.id) && x['정산번호'] === h.id && x['삭제'] !== 'Y'; })[0];
    if (!r) throw new AppError('not_found', '정산 줄을 찾을 수 없습니다: ' + l.id);
    const why = str_(l.사유, 60);
    if (why && DIFF_REASONS.indexOf(why.split(':')[0]) < 0) throw new AppError('invalid', '사유는 목록에서 고르세요(기타는 "기타: 내용"): ' + why);
    r['차이사유'] = why; mxPut_(dm, stamp_(r, u, false)); n++;
  });
  mxSave_(dm);
  const left = read_('정산상세').filter(function (d) { return d['정산번호'] === h.id && Number(d['차이']) && !d['차이사유']; }).length;
  h['차이건수'] = String(left);
  save_('정산', h, u, false);
  audit_(u, '정산 차이 사유', h.id, n + '줄, 남은 차이 ' + left);
  return settleGet_({ id: h.id }, u);
}
function settleState_(p, u) {
  const h = findById_('정산', str_(p.id));
  if (!h || h['삭제'] === 'Y') throw new AppError('not_found', '정산서를 찾을 수 없습니다.');
  const act = oneOf_(str_(p.작업), ['확정', '지급완료', '삭제'], '작업');
  if (act === '확정') {
    if (h['상태'] !== '작성') throw new AppError('invalid', '작성 상태만 확정할 수 있습니다.');
    const left = read_('정산상세').filter(function (d) { return d['정산번호'] === h.id && Number(d['차이']) && !d['차이사유']; }).length;
    if (left) throw new AppError('invalid', '아임웹 금액과 화프스 계산이 다른 줄 ' + left + '건의 사유를 먼저 넣으세요(정산 금액은 아임웹 기준입니다).');
    h['상태'] = '확정';
  }
  if (act === '지급완료') {
    if (h['상태'] !== '확정') throw new AppError('invalid', '확정된 정산서만 지급(입금)완료로 바꿀 수 있습니다.');
    const d = str_(p.지급일);
    if (!isDate_(d)) throw new AppError('invalid', '지급(입금)일을 넣으세요.');
    h['상태'] = '지급완료'; h['지급일'] = d;
  }
  if (act === '삭제') {
    if (h['상태'] !== '작성') throw new AppError('invalid', '작성 상태의 정산서만 지울 수 있습니다. 확정된 정산은 다음 정산에서 조정하세요.');
    const om = matrixOf_('주문'), pm = matrixOf_('매입'), dm = matrixOf_('정산상세'), am = matrixOf_('광고측정');
    om.objs.forEach(function (o) { let ch = false; if (o['정산번호'] === h.id) { o['정산번호'] = ''; ch = true; } if (o['조정정산번호'] === h.id) { o['조정정산번호'] = ''; ch = true; } if (ch) mxPut_(om, stamp_(o, u, false)); });
    [pm, am].forEach(function (mx) { mx.objs.forEach(function (o) { if (o['정산번호'] === h.id) { o['정산번호'] = ''; mxPut_(mx, stamp_(o, u, false)); } }); });
    dm.objs.forEach(function (o) { if (o['정산번호'] === h.id && o['삭제'] !== 'Y') { o['삭제'] = 'Y'; mxPut_(dm, stamp_(o, u, false)); } });
    mxSave_(om); mxSave_(pm); mxSave_(dm); mxSave_(am);
    h['삭제'] = 'Y';
  }
  save_('정산', h, u, false);
  audit_(u, '정산 ' + act, h.id, h['상호'] + (h['지급일'] ? ' / ' + h['지급일'] : ''));
  return read_('정산').map(clean_);
}

/* ───────────────────────── 손익 ───────────────────────── */
function expenseSave_(p, u) {
  const rows = readRaw_('비용');
  const old = p.id ? rows.filter(function (r) { return r.id === str_(p.id) && r['삭제'] !== 'Y'; })[0] : null;
  if (p.id && !old) throw new AppError('not_found', '비용을 찾을 수 없습니다.');
  const row = old || { id: idGen_(rows, 'E', 5)(), 상태: '사용' };
  if (p.삭제) row['삭제'] = 'Y';
  else {
    const m = str_(p.월);
    if (!/^\d{4}-\d{2}$/.test(m)) throw new AppError('invalid', '월은 2026-11 같은 형식으로 넣으세요.');
    row['월'] = m;
    row['항목'] = need_(p.항목, '항목');
    const amt = Number(String(p.금액).replace(/,/g, ''));
    if (isNaN(amt)) throw new AppError('invalid', '금액은 숫자로 넣으세요.');
    row['금액'] = String(won_(amt));
    row['메모'] = str_(p.메모, 300);
  }
  save_('비용', row, u, !old);
  audit_(u, p.삭제 ? '비용 삭제' : (old ? '비용 수정' : '비용 등록'), row.id, (row['월'] || '') + ' ' + (row['항목'] || '') + ' ' + (row['금액'] || ''));
  return read_('비용').map(clean_);
}
// 월별 손익(송장발행일 기준): 매출 − 매출원가 = 상품이익, − PG수수료 = 공헌이익, − 비용 = 영업이익. 반품은 반품완료 월에 뺍니다.
function plReport_(p, u) {
  if (!canSeeSensitive_(u)) throw new AppError('forbidden', '손익은 운영기획·관리자만 볼 수 있습니다.');
  const year = /^\d{4}$/.test(str_(p.year)) ? str_(p.year) : Utilities.formatDate(new Date(), TZ, 'yyyy');
  const st = settings_(), vat = vat_(), pg = Number(st['PG율'] || 0.033);
  const prods = mapById_(read_('상품'));
  const months = [];
  for (let m = 1; m <= 12; m++) months.push(year + '-' + ('0' + m).slice(-2));
  const zero = function () { return { 직매입매출: 0, 위탁수수료: 0, 광고매출: 0, 배송비매출: 0, 매출: 0, 매출원가: 0, 상품이익: 0, PG수수료: 0, 공헌이익: 0, 비용: 0, 영업이익: 0, PG실제: 0, PG차이: 0, 결제금액: 0, 판매수량: 0, 반품수량: 0 }; };
  const by = {};
  months.forEach(function (m) { by[m] = zero(); });
  const top = {}, warn = { 미연결: 0, 원가없음: 0, 수수료율없음: 0, 반품완료일없음: 0 };
  const rates = {};
  const inYear = function (d) { return d && d.slice(0, 4) === year; };
  read_('주문').forEach(function (o) {
    const sale = inYear(o['배송일자']), ret = isReturned_(o) && inYear(o['반품완료일']);
    if (!sale && !ret) { if (RETURN_STATES.indexOf(o['주문상태']) >= 0 && o['배송일자'] && !o['반품완료일'] && inYear(o['배송일자'])) warn.반품완료일없음++; return; }
    if (!o['상품ID']) { if (sale) warn.미연결++; return; }
    const pr = prods[o['상품ID']] || {};
    const pay = won_(o['결제금액']), ship = won_(o['배송비']), q = Number(o['수량']) || 0;
    let rev = 0, cogs = 0;
    if (o['거래형태'] === '직매입') {
      rev = pr['과세구분'] === '면세' ? pay : pay / (1 + vat);
      const unit = o['출하원가'] !== '' && o['출하원가'] !== undefined ? Number(o['출하원가']) : NaN;
      if (isNaN(unit)) { warn.원가없음++; cogs = q * Number(pr['공급가'] || 0); } else cogs = q * unit;
    } else if (o['거래형태'] === '위탁판매') {
      if (rates[o['공급사코드']] === undefined) rates[o['공급사코드']] = contractRate_(o['공급사코드']);
      const rate = Number(pr['수수료율'] || 0) || rates[o['공급사코드']];
      if (!rate) warn.수수료율없음++;
      rev = pay * rate / 100;
    }
    const key = o['거래형태'] === '직매입' ? '직매입매출' : '위탁수수료';
    if (sale) {
      const r = by[o['배송일자'].slice(0, 7)];
      r.결제금액 += pay; r.판매수량 += q;
      r.배송비매출 += ship / (1 + vat);
      r.PG수수료 += (pay + ship) * pg * (1 + vat);
      r[key] += rev; r.매출원가 += cogs;
    }
    if (ret) {
      const r = by[o['반품완료일'].slice(0, 7)];
      r.결제금액 -= pay; r.반품수량 += q;
      r[key] -= rev; r.매출원가 -= cogs;
    }
    const sign = (sale ? 1 : 0) - (ret ? 1 : 0);
    if (!sign) return;
    const t = top[o['상품ID']] = top[o['상품ID']] || { 상품ID: o['상품ID'], 상품명: pr['상품명'] || o['상품명'], 거래형태: o['거래형태'], 코드: tradeCode(o['거래형태'], o['운영방식']), 수량: 0, 결제금액: 0, 매출: 0, 이익: 0 };
    t.수량 += sign * q; t.결제금액 += sign * pay; t.매출 += sign * rev; t.이익 += sign * (rev - cogs) - (sale ? pay * pg * (1 + vat) : 0);
  });
  // 교환으로 보관창고에서 한 번 더 나간 재고는 매출원가에 넣습니다.
  const ledger = read_('재고수불');
  ledger.forEach(function (r) { if (r['구분'] === '교환출고' && r['소유'] !== '위탁' && inYear(r['일자'])) by[r['일자'].slice(0, 7)].매출원가 += -(Number(r['금액']) || 0); });
  // 광고: 기간 정액은 게재 일수로 나눠 월별, 성과형은 측정한 달
  read_('계약').forEach(function (c) {
    if (['K1', 'AD'].indexOf(c['종류']) < 0 || ['증빙수집', '완료'].indexOf(c['상태']) < 0) return;
    const v = valuesOf_(c);
    if (!adHasFixed(adMethod(v))) return;
    const total = won_(String(v['광고료_총액'] || '').replace(/,/g, ''));
    if (!total || !isDate_(v['광고_시작일']) || !isDate_(v['광고_종료일'])) return;
    const s = dayNum(v['광고_시작일']), e = dayNum(v['광고_종료일']), days = e - s + 1;
    for (let d = s; d <= e; d++) { const m = numDay(d).slice(0, 7); if (by[m]) by[m].광고매출 += total / days; }
  });
  read_('광고측정').forEach(function (m) { if (m['확정'] === 'Y' && by[m['월']]) by[m['월']].광고매출 += Number(m['금액']) || 0; });
  read_('비용').forEach(function (x) { if (by[x['월']]) by[x['월']].비용 += Number(x['금액']) || 0; });
  const pgRows = read_('PG정산');
  pgRows.forEach(function (x) { const m = String(x['거래일']).slice(0, 7); if (by[m]) by[m].PG실제 += (Number(x['수수료']) || 0) + (Number(x['부가세']) || 0); });
  const pgMonths = {};
  pgRows.forEach(function (x) { pgMonths[String(x['거래일']).slice(0, 7)] = true; });
  const sum = zero();
  months.forEach(function (m) {
    const r = by[m];
    r.매출 = r.직매입매출 + r.위탁수수료 + r.광고매출 + r.배송비매출;
    r.상품이익 = r.매출 - r.매출원가;
    r.공헌이익 = r.상품이익 - r.PG수수료;
    r.영업이익 = r.공헌이익 - r.비용;
    r.PG차이 = pgMonths[m] ? r.PG실제 - r.PG수수료 : 0;
    Object.keys(r).forEach(function (k) { r[k] = won_(r[k]); sum[k] += r[k]; });
  });
  const topList = Object.keys(top).map(function (k) { const t = top[k]; t.매출 = won_(t.매출); t.이익 = won_(t.이익); return t; }).sort(function (a, b) { return b.결제금액 - a.결제금액; }).slice(0, 15);
  return { year: year, months: months.map(function (m) { return Object.assign({ 월: m }, by[m]); }), total: sum, top: topList, warnings: warn, 재고검산: stockCheck_(ledger, year),
    가상창고문제: w01Days_(ledger).filter(function (b) { return inYear(b.일자); }), PG실제월: Object.keys(pgMonths).sort(),
    기준: '송장발행일(아임웹 배송일자) 기준 · 반품은 반품완료일이 속한 달에 뺌 · 직매입 매출은 부가세를 뺀 금액 · 매출원가 = 출하 수량 × 출하원가(재고형 이동평균, 주문형 매입 단가) · PG수수료 표준 = (결제금액+배송비) × PG율 × (1+부가세율) · 광고료는 기간 정액을 게재 일수로 나눠 월별, 성과형은 측정한 달' };
}
// 보관창고(회사 소유) 재고 검산: 기초재고 + 매입 − 매출원가 + 반품 재입고 ± 조정 = 기말재고
function stockCheck_(ledger, year) {
  const rows = ledger.filter(function (r) { return r['창고ID'] !== VIRTUAL_WH && r['소유'] !== '위탁'; });
  const out = [];
  let open = 0;
  rows.forEach(function (r) { if (r['일자'] < year + '-01-01') open += Number(r['금액']) || 0; });
  for (let m = 1; m <= 12; m++) {
    const mm = year + '-' + ('0' + m).slice(-2);
    const x = { 월: mm, 기초재고: won_(open), 기초등록: 0, 매입: 0, 매출원가: 0, 반품재입고: 0, 조정: 0, 기말재고: 0, 맞음: true };
    rows.forEach(function (r) {
      if (String(r['일자']).slice(0, 7) !== mm) return;
      const a = Number(r['금액']) || 0;
      if (r['구분'] === '기초') x.기초등록 += a;
      else if (r['구분'] === '입고') x.매입 += a;
      else if (r['구분'] === '출고' || r['구분'] === '교환출고') x.매출원가 += -a;
      else if (r['구분'] === '반품입고') x.반품재입고 += a;
      else x.조정 += a;
    });
    x.기말재고 = won_(x.기초재고 + x.기초등록 + x.매입 - x.매출원가 + x.반품재입고 + x.조정);
    // 장부의 마지막 재고금액 합과 맞는지 확인
    const last = {};
    rows.forEach(function (r) { if (String(r['일자']).slice(0, 7) <= mm) last[r['상품ID']] = Number(r['재고금액']) || 0; });
    const book = won_(Object.keys(last).reduce(function (a, k) { return a + last[k]; }, 0));
    x.장부재고 = book;
    x.맞음 = Math.abs(book - x.기말재고) <= Math.max(10, Object.keys(last).length * 2);
    open = x.기말재고;
    out.push(x);
  }
  return out;
}

/* ───────────────────────── 데이터 점검 ───────────────────────── */
function checkRun_(p, u) {
  const out = [];
  const add = function (area, level, text, n, link, detail) { if (n) out.push({ 영역: area, 수준: level, 내용: text, 건수: n, 링크: link || '', 상세: detail || [] }); };
  const vendors = read_('벤더'), prods = read_('상품').filter(function (x) { return ['판매대기', '판매중', '판매보류'].indexOf(x['상태']) >= 0; });
  const vmap = mapById_(vendors);
  const tradeOf = function (x) { return tradeOfVendor_(vmap[x['공급사코드']]); };
  add('벤더', '오류', '구분이 공급사인데 거래형태가 비어 있음 (계약·정산 불가)', vendors.filter(function (v) { return v['구분'] === '공급사' && !v['거래형태']; }).length, '#/masters/vendors');
  add('벤더', '주의', '상품이 있는 공급사인데 담당자·연락처·이메일 중 빈칸이 있음 (계약 확정 불가)', vendors.filter(function (v) { return prods.some(function (x) { return x['공급사코드'] === v.id; }) && (!v['담당자'] || !v['연락처'] || !v['이메일']); }).length, '#/masters/vendors');
  add('상품', '오류', '판매 상품인데 공급사가 없음', prods.filter(function (x) { return !x['공급사코드']; }).length, '#/products');
  add('상품', '오류', '직매입 상품인데 공급가가 없음 (매입·정산·매출원가 계산 불가)', prods.filter(function (x) { return tradeOf(x) === '직매입' && !Number(x['공급가']); }).length, '#/products');
  add('상품', '주의', '위탁판매 상품인데 수수료율이 없음 (계약서 요율로 계산)', prods.filter(function (x) { return tradeOf(x) === '위탁판매' && !Number(x['수수료율']); }).length, '#/products');
  add('상품', '주의', '판매가(일반회원가)가 없음 (정산 차이 비교 불가)', prods.filter(function (x) { return tradeOf(x) !== '제휴입점' && !Number(x['일반회원가']); }).length, '#/products');
  add('상품', '주의', '분류가 정해지지 않음', prods.filter(function (x) { return !x['분류ID']; }).length, '#/products');
  add('상품', '주의', '몰상품코드가 없음 (주문을 상품명으로만 연결)', prods.filter(function (x) { return x['상태'] === '판매중' && !x['몰상품코드']; }).length, '#/products');
  const mall = {};
  prods.forEach(function (x) { if (x['몰상품코드']) mall[x['몰상품코드']] = (mall[x['몰상품코드']] || 0) + 1; });
  add('상품', '오류', '몰상품코드가 두 상품 이상에 같이 들어 있음 (주문 연결 불가)', Object.keys(mall).filter(function (k) { return mall[k] > 1; }).length, '#/products');
  const whs = read_('창고').filter(function (w) { return w.id !== VIRTUAL_WH && w['유형'] !== '가상' && w['상태'] !== '중지'; });
  add('창고', '오류', '재고형 상품이 있는데 실제 보관창고(W02~)가 없음', !whs.length && prods.some(function (x) { return modeOfProduct_(x, tradeOf(x)) === '재고형'; }) ? 1 : 0, '#/masters/warehouses');
  const orders = read_('주문');
  add('주문', '오류', '상품에 연결되지 않은 주문 (정산·손익에서 빠짐)', orders.filter(function (o) { return !o['상품ID'] && ['취소'].indexOf(o['주문상태']) < 0; }).length, '#/ops/orders');
  add('주문', '오류', '송장번호는 있는데 배송일자가 없는 주문 (매출·매입이 생기지 않음 → 아임웹에서 배송일자 확인 후 다시 올리기)', orders.filter(function (o) { return o['송장번호'] && !o['배송일자']; }).length, '#/ops/orders');
  add('주문', '오류', '매출·매입 없이 구매확정된 주문 (배송일자 없음)', orders.filter(function (o) { return o['주문상태'] === '구매확정' && !o['배송일자']; }).length, '#/ops/orders');
  add('주문', '주의', '반품·취소 상태인데 반품완료일이 없는 주문 (매출 차감 대기)', orders.filter(function (o) { return RETURN_STATES.indexOf(o['주문상태']) >= 0 && o['배송일자'] && !o['반품완료일']; }).length, '#/ops/orders');
  const moved = orders.filter(function (o) { return o['배송일자변경']; });
  add('주문', '주의', '아임웹 배송일자가 바뀐 주문 (처음 값으로 고정했습니다. 맞는지 확인)', moved.length, '#/ops/orders', moved.slice(0, 20).map(function (o) { return o.id + ': ' + o['배송일자'] + ' → ' + o['배송일자변경']; }));
  const ledger = read_('재고수불');
  const w01 = w01Days_(ledger);
  add('재고', '오류', '가상창고(W01) 잔액이 0이 아닌 날 (매입과 매출원가 중 한쪽이 빠짐)', w01.length, '#/ops/stock', w01.slice(-20).map(function (b) { return b.일자 + ' 잔량 ' + b.잔량 + ' (' + b.상품.join(', ') + ')'; }));
  const neg = {};
  ledger.forEach(function (r) { if (r['창고ID'] !== VIRTUAL_WH) { const k = r['창고ID'] + ' ' + r['상품ID']; neg[k] = Number(r['잔량']); } });
  const negs = Object.keys(neg).filter(function (k) { return neg[k] < 0; });
  add('재고', '오류', '재고가 음수인 상품 (입고 등록·확정이 빠졌는지 확인)', negs.length, '#/ops/stock', negs.slice(0, 20).map(function (k) { return k + ': ' + neg[k]; }));
  const m0 = today_().slice(0, 7);
  const recount = ledger.filter(function (r) { return r['구분'] === '실사' && Number(r['수량']) && String(r['일자']).slice(0, 7) === m0; });
  add('재고', '주의', '이번 달 실사 차이 (3PL 귀책은 계약대로 배상 청구)', recount.length, '#/ops/stock', recount.slice(0, 20).map(function (r) { return r['일자'] + ' ' + r['창고ID'] + ' ' + r['상품명'] + ' ' + r['수량'] + ' · ' + (r['사유'] || ''); }));
  add('매입', '주의', '등록만 하고 7일 넘게 확정하지 않은 입고 매입', read_('매입').filter(function (r) { return r['상태'] === '등록' && addDays(r['입고일'], 7) < today_(); }).length, '#/ops/purchases');
  const heads = read_('정산');
  add('정산', '주의', '작성 상태로 남아 있는 정산서 (확정하거나 지우세요)', heads.filter(function (h) { return h['상태'] === '작성'; }).length, '#/ops/settle');
  add('정산', '주의', '사유를 넣지 않은 정산 차이가 있는 정산서 (확정 불가)', heads.filter(function (h) { return h['상태'] === '작성' && Number(h['차이건수']); }).length, '#/ops/settle');
  add('정산', '오류', '지급예정일이 지났는데 지급완료가 아닌 정산서', heads.filter(function (h) { return h['상태'] === '확정' && Number(h['지급액']) >= 0 && h['지급예정일'] < today_(); }).length, '#/ops/settle');
  const refund = heads.filter(function (h) { return h['구분'] === '위탁판매' && Number(h['지급액']) < 0 && h['상태'] !== '지급완료'; });
  add('정산', '주의', '위탁 반품분을 뺄 지급액이 없어 공급사에 반환을 청구할 정산서 (청구일부터 14일 안)', refund.length, '#/ops/settle', refund.map(function (h) { return h.id + ' ' + h['상호'] + ' ' + fmtComma(-Number(h['지급액'])) + '원'; }));
  const signed = {};
  read_('계약').forEach(function (c) { if (c['종류'] === 'K1' && ['증빙수집', '완료'].indexOf(c['상태']) >= 0) signed[c['벤더코드']] = true; });
  add('계약', '주의', '판매중 상품의 공급사인데 체결된 상품공급계약이 없음', Object.keys(prods.filter(function (x) { return x['상태'] === '판매중' && x['공급사코드']; }).reduce(function (m, x) { m[x['공급사코드']] = 1; return m; }, {})).filter(function (vid) { return !signed[vid]; }).length, '#/contracts');
  if (!holidays_().length) add('설정', '주의', '공휴일 목록이 비어 있음 (지급일 계산에 필요)', 1, '#/settings');
  return { at: now_(), items: out };
}

/* ───────────────────────── 제휴입점 광고 (성과형 측정) ───────────────────────── */
// 추적 링크(go.html)가 부릅니다. 로그인 없이 기록만 하고, 이동할 주소를 돌려줍니다.
function adClick_(p) {
  const cid = str_(p.a, 30), pid = str_(p.p, 30), dev = str_(p.d, 64);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const c = cid ? findById_('계약', cid) : null;
    const prod = pid ? findById_('상품', pid) : null;
    let url = '', valid = 'Y', why = '';
    const urlOf = function (x) { return x && x['삭제'] !== 'Y' && /^https?:\/\//.test(x['연결주소'] || '') ? x['연결주소'] : ''; };
    if (!c || c['삭제'] === 'Y' || ['K1', 'AD'].indexOf(c['종류']) < 0 || ['증빙수집', '완료'].indexOf(c['상태']) < 0) { valid = 'N'; why = '계약 없음'; url = urlOf(prod); }
    else {
      if (prod && prod['공급사코드'] !== c['벤더코드']) { valid = 'N'; why = '다른 공급사 상품'; }
      else url = urlOf(prod) || urlOf(read_('상품').filter(function (x) { return x['공급사코드'] === c['벤더코드'] && urlOf(x); })[0]);
      const v = valuesOf_(c), today = today_();
      if (valid === 'Y' && (today < v['광고_시작일'] || today > v['광고_종료일'])) { valid = 'N'; why = '게재 기간 아님'; }
    }
    if (valid === 'Y' && p.bot) { valid = 'N'; why = '자동 프로그램'; }
    if (valid === 'Y' && p.internal) { valid = 'N'; why = '내부 접속'; }
    if (!dev) { valid = 'N'; why = why || '기기 정보 없음'; }
    const sh = sheet_('광고클릭'), lr = sh.getLastRow(), n = Math.min(Math.max(lr - 1, 0), 5000);
    const recent = n > 0 ? sh.getRange(lr - n + 1, 1, n, 6).getValues() : [];
    const nowMs = Date.now();
    const tsOf = function (x) { return x instanceof Date ? x.getTime() : new Date(String(x).replace(' ', 'T') + '+09:00').getTime(); };
    let hour = 0;
    recent.forEach(function (r) {
      if (!dev || String(r[3]) !== dev) return;
      const t = tsOf(r[0]);
      if (t >= nowMs - 3600000) hour++;
      if (valid === 'Y' && String(r[1]) === cid && String(r[4]) === 'Y' && t >= nowMs - 86400000) { valid = 'N'; why = '24시간 안 반복'; }
    });
    if (hour < 30) appendRow_('광고클릭', [now_(), cid, pid, dev, valid, why]);      // 같은 기기가 1시간에 30번 넘게 누르면 기록하지 않음
    return { url: url };
  } finally {
    lock.releaseLock();
  }
}
function perfContracts_() {
  return read_('계약').filter(function (c) {
    if (['K1', 'AD'].indexOf(c['종류']) < 0 || ['증빙수집', '완료', '종료'].indexOf(c['상태']) < 0) return false;
    return !!adPerf(adMethod(valuesOf_(c)));
  });
}
function clickStats_() {
  const st = {};
  readRaw_('광고클릭').forEach(function (r) {
    const m = String(r['시각']).slice(0, 7), k = r['계약번호'] + '|' + m;
    const x = st[k] = st[k] || { 유효: 0, 무효: 0, 사유: {} };
    if (r['유효'] === 'Y') x.유효++; else { x.무효++; x.사유[r['사유'] || '기타'] = (x.사유[r['사유'] || '기타'] || 0) + 1; }
  });
  return st;
}
function adAmount_(v, m) {
  const pf = adPerf(adMethod(v));
  const unit = Number(String(v['광고_성과단가'] || '').replace(/,/g, '')) || 0;
  const cap = Number(String(v['광고_월상한'] || '').replace(/,/g, '')) || 0;
  let amt = 0;
  if (pf === 'CPC') amt = (Number(m['클릭수']) || 0) * unit;
  if (pf === 'CPM') amt = Math.floor((Number(m['노출수']) || 0) / 1000 * unit);
  if (pf === 'CPS') amt = (Number(m['공급사보고매출']) || 0) * (Number(String(v['광고_판매요율'] || '').replace(/[^0-9.]/g, '')) || 0) / 100;
  amt = won_(amt);
  return { 성과: pf, 계산: amt, 금액: cap ? Math.min(amt, cap) : amt, 상한: cap };
}
function adList_(p, u) {
  if (!canSeeSensitive_(u)) throw new AppError('forbidden', '광고 측정은 운영기획·관리자만 봅니다.');
  const st = settings_(), base = st['광고링크주소'] || '';
  const stats = clickStats_();
  const meas = read_('광고측정');
  const prods = read_('상품');
  return { 링크주소: base, contracts: perfContracts_().map(function (c) {
    const v = valuesOf_(c);
    const months = [];
    if (isDate_(v['광고_시작일']) && isDate_(v['광고_종료일'])) {
      let m = v['광고_시작일'].slice(0, 7);
      const last = v['광고_종료일'].slice(0, 7) < today_().slice(0, 7) ? v['광고_종료일'].slice(0, 7) : today_().slice(0, 7);
      for (let i = 0; i < 36 && m <= last; i++) {
        const s = stats[c.id + '|' + m] || { 유효: 0, 무효: 0, 사유: {} };
        const row = meas.filter(function (x) { return x['계약번호'] === c.id && x['월'] === m; })[0] || {};
        const cur = Object.assign({ 클릭수: String(s.유효), 무효클릭수: String(s.무효) }, row['확정'] === 'Y' ? { 클릭수: row['클릭수'], 무효클릭수: row['무효클릭수'] } : {}, { 노출수: row['노출수'] || '', 공급사보고매출: row['공급사보고매출'] || '' });
        const a = adAmount_(v, cur);
        months.push({ 월: m, 유효클릭: Number(cur.클릭수), 무효클릭: Number(cur.무효클릭수), 무효사유: s.사유, 노출수: row['노출수'] || '', 공급사보고매출: row['공급사보고매출'] || '', 공급사보고클릭: row['공급사보고클릭'] || '',
          계산: a.계산, 금액: row['확정'] === 'Y' ? Number(row['금액']) : a.금액, 상한: a.상한, 확정: row['확정'] === 'Y', 정산번호: row['정산번호'] || '', 메모: row['메모'] || '', 끝남: monthEnd_(m) < today_() });
        const y = +m.slice(0, 4), mo = +m.slice(5, 7);
        m = mo === 12 ? (y + 1) + '-01' : y + '-' + ('0' + (mo + 1)).slice(-2);
      }
    }
    const links = prods.filter(function (x) { return x['공급사코드'] === c['벤더코드'] && x['삭제'] !== 'Y' && x['연결주소']; })
      .map(function (x) { return { 상품ID: x.id, 상품명: x['상품명'], 링크: base ? base + (base.indexOf('?') >= 0 ? '&' : '?') + 'a=' + encodeURIComponent(c.id) + '&p=' + encodeURIComponent(x.id) : '' }; });
    return { 계약번호: c.id, 상호: c['상호'], 공급사코드: c['벤더코드'], 종류: c['종류명'], 상태: c['상태'], 과금방식: adMethod(v), 성과: adPerf(adMethod(v)), 조건: v['광고_과금조건'] || adTerms(v),
      시작일: v['광고_시작일'], 종료일: v['광고_종료일'], months: months, links: links };
  }) };
}
function adMeasureSave_(p, u) {
  const c = findById_('계약', str_(p.계약번호));
  if (!c || c['삭제'] === 'Y' || perfContracts_().every(function (x) { return x.id !== c.id; })) throw new AppError('not_found', '성과형 광고 계약을 찾을 수 없습니다.');
  const m = str_(p.월);
  if (!/^\d{4}-\d{2}$/.test(m)) throw new AppError('invalid', '월을 확인하세요.');
  const v = valuesOf_(c);
  const am = matrixOf_('광고측정');
  const id = 'AM-' + c.id + '-' + m;
  let row = am.objs.filter(function (x) { return x.id === id; })[0];
  if (row && row['정산번호']) throw new AppError('locked', '이미 정산(' + row['정산번호'] + ')에 들어간 달입니다.');
  const isNew = !row;
  row = row || { id: id, 상태: '사용', 계약번호: c.id, 공급사코드: c['벤더코드'], 월: m, 정산번호: '' };
  const s = clickStats_()[c.id + '|' + m] || { 유효: 0, 무효: 0 };
  row['클릭수'] = String(s.유효); row['무효클릭수'] = String(s.무효);
  ['노출수', '공급사보고매출', '공급사보고클릭'].forEach(function (k) { const x = str_(p[k]).replace(/,/g, ''); if (x !== '' && isNaN(Number(x))) throw new AppError('invalid', k + '은(는) 숫자로 넣으세요.'); row[k] = x; });
  row['메모'] = str_(p.메모, 300);
  const a = adAmount_(v, row);
  row['금액'] = String(a.금액);
  const confirm = !!p.확정;
  if (confirm && monthEnd_(m) >= today_()) throw new AppError('invalid', '달이 끝난 뒤에 확정합니다.');
  if (confirm && a.성과 === 'CPM' && !row['노출수']) throw new AppError('invalid', '노출당(CPM) 계약은 노출수를 넣어야 확정됩니다.');
  if (confirm && a.성과 === 'CPS' && !row['공급사보고매출']) throw new AppError('invalid', '판매당(CPS) 계약은 공급사가 알린 판매금액을 넣어야 확정됩니다.');
  row['확정'] = confirm ? 'Y' : 'N';
  mxPut_(am, stamp_(row, u, isNew));
  mxSave_(am);
  audit_(u, confirm ? '광고 성과 확정' : '광고 성과 저장', id, '유효 클릭 ' + row['클릭수'] + ' / 금액 ' + row['금액'] + (a.상한 && a.계산 > a.상한 ? ' (상한 적용, 계산 ' + a.계산 + ')' : ''));
  return adList_({}, u);
}

/* ───────────────────────── PG 실제 수수료 (토스페이먼츠 정산 엑셀) ───────────────────────── */
function pgImport_(p, u) {
  const items = Array.isArray(p.rows) ? p.rows : [];
  if (!items.length) throw new AppError('invalid', '올릴 줄이 없습니다.');
  if (items.length > 20000) throw new AppError('invalid', '한 번에 20,000줄까지 올릴 수 있습니다.');
  const mx = matrixOf_('PG정산');
  const have = {};
  mx.objs.forEach(function (o) { if (o.id && o['삭제'] !== 'Y') have[o.id] = o; });
  const errors = [], ready = [];
  const batch = 'G' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss');
  const n = function (v, k, line) { const s = str_(v).replace(/,/g, ''); if (s === '') return 0; if (isNaN(Number(s))) throw new AppError('invalid', line + '행: ' + k + '가 숫자가 아닙니다: ' + v); return won_(s); };
  items.forEach(function (raw, i) {
    const line = i + 2;
    try {
      const d = dateOf_(normDateTime_(raw.거래일));
      if (!d) throw new AppError('invalid', line + '행: 거래일이 날짜가 아닙니다: ' + str_(raw.거래일));
      const o = { 거래일: d, 주문번호: str_(raw.주문번호, 120), 결제금액: n(raw.결제금액, '결제금액', line), 수수료: n(raw.수수료, '수수료', line), 부가세: n(raw.부가세, '부가세', line) };
      o.id = 'G-' + d + '-' + (o.주문번호 || 'x') + '-' + o.결제금액 + '-' + i;
      const key = d + '|' + o.주문번호 + '|' + o.결제금액 + '|' + o.수수료;
      o.key = key;
      ready.push(o);
    } catch (e) { if (!(e instanceof AppError)) throw e; errors.push({ 행: line, 오류: e.message }); }
  });
  if (errors.length) return { saved: false, errors: errors.slice(0, 200), 오류수: errors.length };
  const byKey = {};
  mx.objs.forEach(function (o) { if (o['삭제'] !== 'Y') byKey[o['거래일'] + '|' + o['주문번호'] + '|' + o['결제금액'] + '|' + o['수수료']] = o; });
  let added = 0, same = 0;
  const sum = { 결제금액: 0, 수수료: 0, 부가세: 0 };
  ready.forEach(function (o) {
    sum.결제금액 += o.결제금액; sum.수수료 += o.수수료; sum.부가세 += o.부가세;
    if (byKey[o.key]) { same++; return; }
    byKey[o.key] = o;
    mxPut_(mx, stamp_({ id: o.id, 상태: '사용', 거래일: o.거래일, 주문번호: o.주문번호, 결제금액: String(o.결제금액), 수수료: String(o.수수료), 부가세: String(o.부가세), 업로드번호: batch }, u, true));
    added++;
  });
  if (added) mxSave_(mx);
  audit_(u, 'PG 정산 올리기', batch, str_(p.파일명, 120) + ' / 신규 ' + added + ', 이미 있음 ' + same);
  return { saved: true, 신규: added, 그대로: same, 합계: sum };
}
