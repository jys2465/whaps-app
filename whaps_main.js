// whaps_main.js : 3일 이내 NEW 아이콘 배지 적용, 최신순 정렬 및 탭 토글 완비
let quillEditor;

document.addEventListener('DOMContentLoaded', () => {
    quillEditor = new Quill('#editor-container', {
        theme: 'snow',
        modules: { toolbar: [['bold', 'italic', 'underline'], [{list: 'ordered'}, {list: 'bullet'}], ['link']] }
    });
    renderNotices();
    renderManageNotices();
    renderVendorTable();
    renderProductTable();
    renderWarehouseTable();
    renderCategoryTable();
    updatePreview();
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('nav .tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

function switchHomeSubTab(subId) {
    document.querySelectorAll('.home-sub-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.home-sub-btn').forEach(el => {
        el.classList.remove('active', 'btn-primary');
        el.classList.add('btn-outline');
    });

    document.getElementById(subId).classList.add('active');
    let activeBtn = document.getElementById(subId === 'home-sub-dash' ? 'home-sub-btn-dash' : 'home-sub-btn-notice');
    if(activeBtn) {
        activeBtn.classList.remove('btn-outline');
        activeBtn.classList.add('active', 'btn-primary');
    }
}

function switchSub(mod, mode) {
    if(mod === 'vendor') {
        document.querySelectorAll('.sub-sec').forEach(el => el.style.display = 'none');
        document.getElementById(`vendor-${mode}`).style.display = 'block';

        let listBtn = document.getElementById('sub-btn-vendor-list');
        let regBtn = document.getElementById('sub-btn-vendor-reg');
        if (mode === 'list') {
            listBtn.className = 'sub-vendor-tab btn btn-primary text-xs';
            regBtn.className = 'sub-vendor-tab btn btn-outline text-xs';
        } else {
            listBtn.className = 'sub-vendor-tab btn btn-outline text-xs';
            regBtn.className = 'sub-vendor-tab btn btn-primary text-xs';
        }
    }
}

function switchProd(mode) {
    document.getElementById('prod-list').style.display = mode === 'list' ? 'block' : 'none';
    document.getElementById('prod-reg').style.display = mode === 'reg' ? 'block' : 'none';

    let listBtn = document.getElementById('sub-btn-prod-list');
    let regBtn = document.getElementById('sub-btn-prod-reg');
    if (mode === 'list') {
        listBtn.className = 'sub-prod-tab btn btn-primary text-xs';
        regBtn.className = 'sub-prod-tab btn btn-outline text-xs';
    } else {
        listBtn.className = 'sub-prod-tab btn btn-outline text-xs';
        regBtn.className = 'sub-prod-tab btn btn-primary text-xs';
    }
}

// [NEW 기능] 3일 이내 작성된 글인지 판별하는 함수
function isWithin3Days(dateStr) {
    if(!dateStr) return false;
    let postDate = new Date(dateStr);
    let today = new Date();
    let diffTime = today - postDate;
    let diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 3;
}

// 공지 목록 렌더링 (최신순 정렬 및 3일 이내 NEW 아이콘 부착)
function renderNotices() {
    let tbody = document.getElementById('notice-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    let sortedList = [...noticeDataStore].sort((a, b) => b.id.localeCompare(a.id));
    sortedList.forEach(item => {
        if(!item.id) return;
        let tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        
        // 3일 이내인 경우 NEW 배지 추가
        let newBadge = isWithin3Days(item.date) ? ` <span style="background:#ef4444; color:white; font-size:10px; padding:1px 4px; border-radius:4px; font-weight:bold;">NEW</span>` : '';

        tr.innerHTML = `<td>${item.id}</td><td>${item.title}${newBadge}</td><td>${item.writer || ''}</td><td>${item.date}</td>`;
        tr.addEventListener('click', () => openNoticeDetail(item.title, item.content));
        tbody.appendChild(tr);
    });
}

function renderManageNotices() {
    let tbody = document.getElementById('manage-notice-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    let sortedList = [...noticeDataStore].sort((a, b) => b.id.localeCompare(a.id));
    sortedList.forEach(item => {
        if(!item.id) return;
        let tr = document.createElement('tr');
        
        let newBadge = isWithin3Days(item.date) ? ` <span style="background:#ef4444; color:white; font-size:10px; padding:1px 4px; border-radius:4px; font-weight:bold;">NEW</span>` : '';

        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.title}${newBadge}</td>
            <td>${item.writer || ''}</td>
            <td>${item.date}</td>
            <td>
                <button class="btn btn-warning" style="padding: 2px 6px; font-size: 11px; margin-right: 4px;" onclick="editNotice('${item.id}')">수정</button>
                <button class="btn btn-outline" style="padding: 2px 6px; font-size: 11px;" onclick="deleteNotice('${item.id}')">삭제</button>
            </td>`;
        tr.addEventListener('click', (e) => {
            if(e.target.tagName !== 'BUTTON') openNoticeDetail(item.title, item.content);
        });
        tbody.appendChild(tr);
    });
}

function saveNoticeFromTab() {
    if(currentUserRole !== 'admin') { alert('관리자만 등록 가능합니다.'); return; }
    let editId = document.getElementById('edit-notice-id').value;
    let title = document.getElementById('man-notice-title').value;
    let writer = document.getElementById('man-notice-writer').value;
    let content = quillEditor.root.innerHTML;
    if(!title || !writer) { alert('제목과 작성자를 입력해주세요.'); return; }

    let noticeId = editId;
    if (!noticeId) {
        let yy = String(new Date().getFullYear()).slice(-2);
        let nextSeq = noticeDataStore.length + 1;
        noticeId = `NT${yy}-${String(nextSeq).padStart(3, '0')}`;
    }

    let todayStr = new Date().toISOString().slice(0, 10);
    let noticeData = {
        action: "save",
        id: noticeId,
        title: title,
        writer: writer,
        date: todayStr,
        content: content
    };

    if (editId) {
        let target = noticeDataStore.find(n => n.id === editId);
        if (target) {
            target.title = title;
            target.writer = writer;
            target.content = content;
            target.date = todayStr;
        }
        alert('공지사항이 수정되었습니다.');
    } else {
        noticeDataStore.unshift(noticeData); // 메모리상에서도 맨 앞에 추가
        alert(`신규 공지사항이 등록되었습니다. (ID: ${noticeId})`);
    }

    syncToGoogleSheet("공지", noticeData);
    renderNotices();
    renderManageNotices();
    resetNoticeForm();
    switchHomeSubTab('home-sub-dash');
}

function editNotice(id) {
    if (currentUserRole !== 'admin') { alert('관리자 권한이 필요합니다.'); return; }
    let target = noticeDataStore.find(n => n.id === id);
    if(!target) return;

    document.getElementById('edit-notice-id').value = target.id;
    document.getElementById('man-notice-title').value = target.title;
    document.getElementById('man-notice-writer').value = target.writer;
    quillEditor.root.innerHTML = target.content;

    document.getElementById('notice-form-heading').innerText = `공지사항 수정 편집 (${target.id})`;
    document.getElementById('notice-submit-btn').innerText = '수정 사항 저장';

    let btnContainer = document.getElementById('notice-btn-container');
    if (!document.getElementById('notice-reset-btn')) {
        let resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.id = 'notice-reset-btn';
        resetBtn.className = 'btn btn-outline w-full justify-center';
        resetBtn.innerHTML = '<i class="fa-solid fa-plus"></i> 새로 생성하기';
        resetBtn.onclick = resetNoticeForm;
        btnContainer.appendChild(resetBtn);
    }

    switchHomeSubTab('home-sub-notice');
}

function resetNoticeForm() {
    document.getElementById('edit-notice-id').value = '';
    document.getElementById('man-notice-title').value = '';
    document.getElementById('man-notice-writer').value = '';
    quillEditor.setText('');
    document.getElementById('notice-form-heading').innerText = '신규 공지사항 등록';
    document.getElementById('notice-submit-btn').innerText = '공지 등록하기';
    
    let resetBtn = document.getElementById('notice-reset-btn');
    if (resetBtn) resetBtn.remove();
}

function deleteNotice(id) {
    if(currentUserRole !== 'admin') { alert('관리자 권한이 필요합니다.'); return; }
    if(confirm(`[${id}] 공지사항을 삭제하시겠습니까?`)) {
        noticeDataStore = noticeDataStore.filter(n => n.id !== id);
        syncToGoogleSheet("공지", { action: "delete", id: id });
        renderNotices();
        renderManageNotices();
        alert('삭제되었습니다.');
    }
}

function updatePreview() {
    let kind = document.getElementById('con-kind').value;
    let vendor = document.getElementById('con-vendor').value;
    let ceo = document.getElementById('con-ceo').value;
    document.getElementById('prev-title').innerText = `[ ${kind} ]`;
    document.getElementById('contract-template-body').innerHTML = `
        <p>주식회사 아연(갑)과 <b>${vendor}</b>(을)은 공정한 거래를 위해 본 계약을 체결한다.</p><br>
        <p><strong>대표이사:</strong> ${ceo} (서명 또는 인)</p>
    `;
}

function downloadContractPdf() {
    let element = document.getElementById('contract-preview-target');
    html2pdf().from(element).save('계약서.pdf');
}

function renderVendorTable() {
    let tbody = document.getElementById('saved-vendor-table');
    if(!tbody) return;
    tbody.innerHTML = '';
    for(let k in vendorDataStore) {
        let v = vendorDataStore[k];
        tbody.innerHTML += `<tr><td>${v.code || v.코드}</td><td>${v.name || v.상호명}</td><td>${v.ceo || v.대표자명}</td><td><button class="btn btn-outline" style="padding:2px 4px; font-size:10px;">삭제</button></td></tr>`;
    }
}

function saveVendor() {
    let code = document.getElementById('ven-code').value;
    let name = document.getElementById('ven-name').value;
    let ceo = document.getElementById('ven-ceo').value;
    if(!code) return;
    let data = { action: "save", code, name, ceo };
    vendorDataStore[code] = data;
    syncToGoogleSheet("벤더", data);
    renderVendorTable();
    alert('벤더가 등록되었습니다.');
}

function renderProductTable() {
    let tbody = document.getElementById('saved-product-table');
    if(!tbody) return;
    tbody.innerHTML = '';
    for(let k in productDataStore) {
        let p = productDataStore[k];
        tbody.innerHTML += `<tr><td>${p.code || p.상품코드}</td><td>${p.name || p.상품명}</td><td>${Number(p.price || p.판매가).toLocaleString()}원</td></tr>`;
    }
}

function saveProduct() {
    let code = document.getElementById('prod-code').value;
    let name = document.getElementById('prod-name').value;
    let price = document.getElementById('prod-price').value;
    if(!code) return;
    let data = { action: "save", code, name, price };
    productDataStore[code] = data;
    syncToGoogleSheet("상품", data);
    renderProductTable();
    alert('상품이 등록되었습니다.');
}

function renderWarehouseTable() {
    let tbody = document.getElementById('saved-warehouse-table');
    if(!tbody) return;
    tbody.innerHTML = '';
    for(let k in warehouseDataStore) {
        let w = warehouseDataStore[k];
        tbody.innerHTML += `<tr><td>${w.code}</td><td>${w.name}</td></tr>`;
    }
}

function renderCategoryTable() {
    let tbody = document.getElementById('saved-category-table');
    if(!tbody) return;
    tbody.innerHTML = '';
    for(let k in categoryDataStore) {
        let c = categoryDataStore[k];
        tbody.innerHTML += `<tr><td>${c.lcode}</td><td>${c.mcode}</td></tr>`;
    }
}

function openNoticeDetail(title, content) {
    document.getElementById('modal-notice-title').innerText = title;
    document.getElementById('notice-modal-body').innerHTML = content;
    document.getElementById('noticeModal').style.display = 'flex';
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }