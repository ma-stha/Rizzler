const socket = io();

const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const chatContainer = document.getElementById('chat-container');
const inputEl = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const nextBtn = document.getElementById('next-btn');
const userCountNum = document.getElementById('user-count-num');
const connectionDot = document.getElementById('connection-dot');

const lobbyScreen = document.getElementById('lobby-screen');
const startSearchBtn = document.getElementById('start-search-btn');
const ageCheck = document.getElementById('age-check'); // NEW: Age Gate

const popupOverlay = document.getElementById('popup-overlay');
const btnContinue = document.getElementById('btn-continue');
const btnPopupNext = document.getElementById('btn-popup-next');

const leaveConfirmOverlay = document.getElementById('leave-confirm-overlay');
const btnStay = document.getElementById('btn-stay');
const btnConfirmLeave = document.getElementById('btn-confirm-leave');

let isUnlocked = false;
let hasActiveChat = false; 
let timeLeft = 120;
let timerInterval;
let typingTimeout;
let typingIndicator = null;
let audioContext = null;

let userPrefs = { myGender: 'male', searchGender: 'female' };

// --- UI PILL & CHECKBOX LOGIC --- //
function setupPillGroup(groupId, prefKey) {
    const container = document.getElementById(groupId);
    const pills = container.querySelectorAll('.pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            userPrefs[prefKey] = pill.getAttribute('data-value');
        });
    });
}
setupPillGroup('my-gender-group', 'myGender');
setupPillGroup('search-gender-group', 'searchGender');

// Enable/Disable Match button based on checkbox
ageCheck.addEventListener('change', () => {
    startSearchBtn.disabled = !ageCheck.checked;
});

function playSound(type) {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'pop') { 
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, audioContext.currentTime); osc.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1); gainNode.gain.setValueAtTime(0.5, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1); osc.start(); osc.stop(audioContext.currentTime + 0.1);
    } else if (type === 'tick') { 
        osc.type = 'triangle'; osc.frequency.setValueAtTime(800, audioContext.currentTime); gainNode.gain.setValueAtTime(0.2, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05); osc.start(); osc.stop(audioContext.currentTime + 0.05);
    } else if (type === 'chime') { 
        osc.type = 'sine'; osc.frequency.setValueAtTime(440, audioContext.currentTime); osc.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.3); gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5); osc.start(); osc.stop(audioContext.currentTime + 0.5);
    }
}

startSearchBtn.addEventListener('click', () => {
    if (!ageCheck.checked) return; // Extra layer of protection
    
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();

    lobbyScreen.classList.add('hidden');
    socket.emit('start matching', userPrefs);
});

// --- CONNECTION MONITORING --- //
socket.on('disconnect', () => {
    connectionDot.classList.remove('pulse');
    connectionDot.classList.add('offline');
    if (hasActiveChat || lobbyScreen.classList.contains('hidden')) {
        statusEl.innerText = 'Connection lost. Reconnecting...';
        statusEl.style.color = 'var(--warning)';
        inputEl.disabled = true;
        sendBtn.disabled = true;
    }
});

socket.on('connect', () => {
    connectionDot.classList.remove('offline');
    connectionDot.classList.add('pulse');
    if (lobbyScreen.classList.contains('hidden') && !hasActiveChat) {
        socket.emit('start matching', userPrefs);
    }
});

socket.on('user count', (count) => { userCountNum.innerText = count; });

socket.on('waiting', () => { resetChatState('Searching for a match...'); });

socket.on('connected', () => {
    isUnlocked = false;
    hasActiveChat = true; 
    chatContainer.innerHTML = '';
    statusEl.innerText = 'Match found. Make it count.';
    statusEl.style.color = '#fff';
    playSound('chime');
    
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();

    appendMessage('You matched with someone who fits your vibe.', 'system');
    startTimer();
});

socket.on('chat message', (msg) => {
    removeTypingIndicator();
    appendMessage(msg, 'stranger');
    playSound('pop');
    socket.emit('mark read');
    statusEl.innerText = isUnlocked ? 'Unlocked — keep talking' : 'Match found. Make it count.';
});

socket.on('message read', () => {
    const myMsgs = document.querySelectorAll('.msg.self');
    if (myMsgs.length > 0) {
        const lastMsg = myMsgs[myMsgs.length - 1];
        document.querySelectorAll('.receipt').forEach(el => el.remove());
        const receipt = document.createElement('div'); receipt.classList.add('receipt'); receipt.innerText = 'Seen';
        lastMsg.insertAdjacentElement('afterend', receipt);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
});

socket.on('typing', () => {
    showTypingIndicator();
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => removeTypingIndicator(), 1500);
});

socket.on('stranger left', () => {
    clearInterval(timerInterval);
    hasActiveChat = false; 
    timerEl.classList.add('hide');
    popupOverlay.classList.remove('active');
    leaveConfirmOverlay.classList.remove('active');
    
    statusEl.innerText = 'Stranger disconnected...';
    statusEl.style.color = 'var(--danger)';
    inputEl.disabled = true;
    sendBtn.disabled = true;
    
    appendMessage('Stranger has left.', 'system');
    setTimeout(() => socket.emit('start matching', userPrefs), 1500);
});

socket.on('unlocked', () => {
    isUnlocked = true; popupOverlay.classList.remove('active'); timerEl.classList.add('hide');
    statusEl.innerText = 'Unlocked — keep talking 🔓';
    appendMessage('Connection unlocked 🔓', 'system');
    playSound('chime');
    inputEl.disabled = false; sendBtn.disabled = false; inputEl.focus();
});

// --- UI / EVENT LISTENERS --- //
function sendMessage() {
    const msg = inputEl.value.trim();
    if (msg) {
        document.querySelectorAll('.receipt').forEach(el => el.remove());
        socket.emit('chat message', msg);
        const newMsgNode = appendMessage(msg, 'self');
        
        const receipt = document.createElement('div'); receipt.classList.add('receipt'); receipt.innerText = 'Delivered';
        newMsgNode.insertAdjacentElement('afterend', receipt);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        inputEl.value = '';
    }
}

sendBtn.addEventListener('click', (e) => {
    e.preventDefault(); 
    sendMessage();
    inputEl.focus(); 
});

inputEl.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});
inputEl.addEventListener('input', () => socket.emit('typing'));

function attemptLeave() {
    if (hasActiveChat) {
        leaveConfirmOverlay.classList.add('active');
    } else {
        executeLeave();
    }
}

function executeLeave() {
    hasActiveChat = false;
    popupOverlay.classList.remove('active');
    leaveConfirmOverlay.classList.remove('active');
    socket.emit('leave');
}

nextBtn.addEventListener('click', attemptLeave);
btnPopupNext.addEventListener('click', attemptLeave);
btnStay.addEventListener('click', () => leaveConfirmOverlay.classList.remove('active'));
btnConfirmLeave.addEventListener('click', executeLeave);

window.addEventListener('beforeunload', (e) => {
    if (hasActiveChat) {
        e.preventDefault();
        e.returnValue = ''; 
    }
});

btnContinue.addEventListener('click', () => {
    socket.emit('vote continue');
    btnContinue.innerText = "Waiting for match..."; btnContinue.disabled = true; btnContinue.style.opacity = '0.5';
});

// --- HELPER FUNCTIONS --- //
function showTypingIndicator() {
    if (!typingIndicator) {
        typingIndicator = document.createElement('div'); typingIndicator.classList.add('typing-bubble');
        typingIndicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        chatContainer.appendChild(typingIndicator); chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}
function removeTypingIndicator() { if (typingIndicator) { typingIndicator.remove(); typingIndicator = null; } }

function startTimer() {
    clearInterval(timerInterval); timeLeft = 120; timerEl.innerText = '02:00'; timerEl.classList.remove('red', 'hide');
    timerInterval = setInterval(() => {
        timeLeft--;
        let m = Math.floor(timeLeft / 60).toString().padStart(2, '0'); let s = (timeLeft % 60).toString().padStart(2, '0');
        timerEl.innerText = `${m}:${s}`;
        if (timeLeft <= 10) { timerEl.classList.add('red'); playSound('tick'); }
        if (timeLeft <= 0) { clearInterval(timerInterval); showPopup(); }
    }, 1000);
}

function showPopup() {
    inputEl.disabled = true; sendBtn.disabled = true;
    btnContinue.innerText = "Continue"; btnContinue.disabled = false; btnContinue.style.opacity = '1';
    popupOverlay.classList.add('active');
}

function appendMessage(msg, type) {
    const div = document.createElement('div'); div.classList.add('msg', type); div.innerText = msg;
    chatContainer.appendChild(div); chatContainer.scrollTop = chatContainer.scrollHeight; return div;
}

function resetChatState(statusText) {
    clearInterval(timerInterval); isUnlocked = false; hasActiveChat = false; timerEl.classList.add('hide'); popupOverlay.classList.remove('active'); leaveConfirmOverlay.classList.remove('active');
    statusEl.innerText = statusText; statusEl.style.color = 'var(--text-muted)';
    inputEl.disabled = true; sendBtn.disabled = true; chatContainer.innerHTML = '';
}