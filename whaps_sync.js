// whaps_sync.js : 날짜 포맷 고정 및 최신순 역순 정렬 연동
const FIXED_GAS_URL = "https://script.google.com/macros/s/AKfycbxh-8Oo7FRn2Sv2GqgPrUmwpg1PM_PhzjUFe3p_l08LTUCXod-ebjCMdnwoGH3RiwAXKQ/exec";

document.addEventListener('DOMContentLoaded', () => {
    localStorage.setItem('whaps_gas_url', FIXED_GAS_URL);
    fetchAllData();
});

// 날짜 문자열을 YYYY-MM-DD로 깨끗하게 파싱하는 유틸 함수
function cleanDateStr(rawDate) {
    if (!rawDate) return new Date().toISOString().slice(0, 10);
    let str = String(rawDate);
    if (str.includes('GMT') || str.includes('Mon') || str.includes('Tue') || str.includes('Wed') || str.includes('Thu') || str.includes('Fri') || str.includes('Sat') || str.includes('Sun')) {
        try {
            let d = new Date(str);
            if (!isNaN(d.getTime())) {
                let yyyy = d.getFullYear();
                let mm = String(d.getMonth() + 1).padStart(2, '0');
                let dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
        } catch(e) {}
    }
    if (str.includes('T')) return str.split('T')[0];
    return str.slice(0, 10);
}

function fetchAllData() {
    let gasUrl = localStorage.getItem('whaps_gas_url') || FIXED_GAS_URL;
    
    // 1. 공지사항 동기화 (최신순 내림차순 정렬 적용)
    fetch(`${gasUrl}?sheet=공지`)
        .then(res => res.json())
        .then(res => {
            if(res.status === 'success' && res.data) {
                let loadedNotices = res.data.map(item => ({
                    id: item.번호 || item.id || "",
                    title: item.제목 || item.title || "",
                    writer: item.작성자 || item.writer || "",
                    date: cleanDateStr(item.작성일 || item.date),
                    content: item.내용 || item.content || ""
                }));
                // 번호 기준 내림차순(최신순) 정렬 보장
                loadedNotices.sort((a, b) => b.id.localeCompare(a.id));
                noticeDataStore = loadedNotices;
                
                if(typeof renderNotices === 'function') renderNotices();
                if(typeof renderManageNotices === 'function') renderManageNotices();
            }
        }).catch(e => console.log("공지 로드 오류:", e));

    // 2. 벤더 마스터 동기화
    fetch(`${gasUrl}?sheet=벤더`)
        .then(res => res.json())
        .then(res => {
            if(res.status === 'success' && res.data) {
                vendorDataStore = {};
                res.data.forEach(v => { vendorDataStore[v.code || v.코드] = v; });
                if(typeof renderVendorTable === 'function') renderVendorTable();
            }
        }).catch(e => console.log("벤더 로드 오류:", e));

    // 3. 상품 마스터 동기화
    fetch(`${gasUrl}?sheet=상품`)
        .then(res => res.json())
        .then(res => {
            if(res.status === 'success' && res.data) {
                productDataStore = {};
                res.data.forEach(p => { productDataStore[p.code || p.상품코드] = p; });
                if(typeof renderProductTable === 'function') renderProductTable();
            }
        }).catch(e => console.log("상품 로드 오류:", e));
}

function syncToGoogleSheet(sheetName, dataObj) {
    let gasUrl = localStorage.getItem('whaps_gas_url') || FIXED_GAS_URL;
    let payload = { sheet: sheetName, ...dataObj };
    
    if(sheetName === "공지") {
        payload = {
            sheet: "공지",
            action: dataObj.action,
            번호: dataObj.id,
            제목: dataObj.title,
            작성자: dataObj.writer,
            작성일: dataObj.date,
            내용: dataObj.content
        };
    }

    fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    }).then(res => res.json()).then(res => console.log(`[${sheetName}] 구글시트 동기화 성공:`, res)).catch(e => console.log(`[${sheetName}] 동기화 오류:`, e));
}

function handleExcelUpload(event) {
    let file = event.target.files[0];
    if(!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        let data = new Uint8Array(e.target.result);
        let workbook = XLSX.read(data, {type: 'array'});
        let firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        let rows = XLSX.utils.sheet_to_json(firstSheet);
        orderDataStore = rows;
        renderOrderTable();
        alert('엑셀 주문 데이터가 성공적으로 업로드되었습니다.');
    };
    reader.readAsArrayBuffer(file);
}

function renderOrderTable() {
    let tbody = document.getElementById('order-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    orderDataStore.forEach(item => {
        tbody.innerHTML += `<tr><td>${item.주문번호 || item.orderNo || ''}</td><td>${item.상품명 || item.productName || ''}</td></tr>`;
    });
}