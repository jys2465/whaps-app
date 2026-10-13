// whaps_auth.js : 로그인 검증 오류 해결 및 보안 제어
let currentUserRole = 'user';

document.addEventListener('DOMContentLoaded', () => {
    initPinInputs();
    initSecurityShield();
});

function initSecurityShield() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) || (e.ctrlKey && e.key === 'U')) {
            e.preventDefault(); return false;
        }
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
}

function initPinInputs() {
    const pinBoxes = document.querySelectorAll('.pin-box');
    if(pinBoxes.length === 0) return;
    pinBoxes[0].focus();
    pinBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            let val = e.target.value;
            if(val.length > 0) {
                box.value = val.charAt(val.length - 1);
                if(index < pinBoxes.length - 1) {
                    pinBoxes[index + 1].focus();
                }
            }
        });
        box.addEventListener('keydown', (e) => {
            if(e.key === 'Backspace') {
                if(box.value === '' && index > 0) {
                    pinBoxes[index - 1].focus();
                    pinBoxes[index - 1].value = '';
                } else {
                    box.value = '';
                }
            } else if(e.key === 'Enter') {
                verifyLogin();
            }
        });
    });
}

function toggleHelpBox() {
    let box = document.getElementById('login-help-box');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function executeDeviceReset() {
    let cmd = document.getElementById('reset-code-input').value.trim();
    if(cmd === 'clear!') {
        localStorage.removeItem('whaps_user_pin');
        alert("비밀번호가 초기화되었습니다. 초기화된 비밀번호는 관리자에게 문의하세요.");
        document.querySelectorAll('.pin-box').forEach(b => b.value = '');
        document.querySelector('.pin-box').focus();
        toggleHelpBox();
    } else { alert("명령어가 틀렸습니다."); }
}

function verifyLogin() {
    let pinBoxes = document.querySelectorAll('.pin-box');
    let enteredPin = Array.from(pinBoxes).map(b => b.value).join('');
    let roleBadge = document.getElementById('user-role-badge');
    let noticeRegBtn = document.getElementById('home-sub-btn-notice');

    if(enteredPin === '6369') {
        currentUserRole = 'admin';
        if(roleBadge) { roleBadge.innerText = "관리자"; roleBadge.className = "text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700"; }
        if(noticeRegBtn) noticeRegBtn.style.display = 'inline-flex';
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
    } else if(enteredPin === '1234') {
        currentUserRole = 'user';
        if(roleBadge) { roleBadge.innerText = "일반 사용자"; roleBadge.className = "text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600"; }
        if(noticeRegBtn) noticeRegBtn.style.display = 'none';
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        if(typeof switchHomeSubTab === 'function') switchHomeSubTab('home-sub-dash');
    } else {
        alert('비밀번호가 일치하지 않습니다.');
        pinBoxes.forEach(b => b.value = '');
        pinBoxes[0].focus();
    }
}

function logout() {
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'flex';
    let pinBoxes = document.querySelectorAll('.pin-box');
    pinBoxes.forEach(b => b.value = '');
    if(pinBoxes.length > 0) pinBoxes[0].focus();
}