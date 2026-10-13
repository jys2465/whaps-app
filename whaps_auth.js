let currentUserRole = 'user';
let enteredPinCode = '';

document.addEventListener('DOMContentLoaded', () => {
    initSecurityShield();
    updatePinDots();
});

function initSecurityShield() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) || (e.ctrlKey && e.key === 'U')) {
            e.preventDefault(); return false;
        }
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
}

function pressKey(num) {
    if (num === 'C') {
        enteredPinCode = '';
    } else if (num === 'DEL') {
        enteredPinCode = enteredPinCode.slice(0, -1);
    } else {
        if (enteredPinCode.length < 4) {
            enteredPinCode += num;
        }
    }
    
    updatePinDots();

    if (enteredPinCode.length === 4) {
        setTimeout(verifyLogin, 150);
    }
}

function updatePinDots() {
    for (let i = 0; i < 4; i++) {
        let dot = document.getElementById(`dot-${i}`);
        if (!dot) continue;
        if (i < enteredPinCode.length) {
            dot.style.backgroundColor = '#ffffff';
        } else {
            dot.style.backgroundColor = 'transparent';
        }
    }
}

function toggleHelpBox() {
    let box = document.getElementById('login-help-box');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function executeDeviceReset() {
    let cmd = document.getElementById('reset-code-input').value.trim();
    if(cmd === 'clear!') {
        localStorage.removeItem('whaps_user_pin');
        alert("비밀번호가 초기화되었습니다. 관리자에게 문의하세요.");
        enteredPinCode = '';
        updatePinDots();
        toggleHelpBox();
    } else { alert("명령어가 틀렸습니다."); }
}

function verifyLogin() {
    let roleBadge = document.getElementById('user-role-badge');
    let noticeRegBtn = document.getElementById('home-sub-btn-notice');

    if(enteredPinCode === '6369') {
        currentUserRole = 'admin';
        if(roleBadge) { roleBadge.innerText = "관리자"; roleBadge.className = "text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700"; }
        if(noticeRegBtn) noticeRegBtn.style.display = 'inline-flex';
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        enteredPinCode = '';
        updatePinDots();
    } else if(enteredPinCode === '1234') {
        currentUserRole = 'user';
        if(roleBadge) { roleBadge.innerText = "일반 사용자"; roleBadge.className = "text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600"; }
        if(noticeRegBtn) noticeRegBtn.style.display = 'none';
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        if(typeof switchHomeSubTab === 'function') switchHomeSubTab('home-sub-dash');
        enteredPinCode = '';
        updatePinDots();
    } else {
        alert('비밀번호가 일치하지 않습니다.');
        enteredPinCode = '';
        updatePinDots();
    }
}

function logout() {
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'flex';
    enteredPinCode = '';
    updatePinDots();
}