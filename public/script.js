const socket = io();

const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const chatContainer = document.getElementById('chat-container');
const inputEl = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const nextBtn = document.getElementById('next-btn');

const popupOverlay = document.getElementById('popup-overlay');
const btnContinue = document.getElementById('btn-continue');
const btnPopupNext = document.getElementById('btn-popup-next');

let isUnlocked = false;
let timeLeft = 120;
let timerInterval;
let typingTimeout;

socket.on('waiting', () => {
    resetChatState('Finding someone...');
});

socket.on('connected', () => {
    isUnlocked = false;
    chatContainer.innerHTML = '';
    statusEl.innerText = 'Connected. Make it count.';
    statusEl.style.color = '#fff';
    
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();

    appendMessage('You are now chatting with a random stranger.', 'system');
    startTimer();
});

socket.on('chat message', (msg) => {
    appendMessage(msg, 'stranger');
    statusEl.innerText = isUnlocked ? 'Unlocked — keep talking' : 'Connected. Make it count.';
});

socket.on('typing', () => {
    statusEl.innerText = 'Stranger is typing...';
    statusEl.style.color = '#7b4bff';
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        statusEl.innerText = isUnlocked ? 'Unlocked — keep talking' : 'Connected. Make it count.';
        statusEl.style.color = '#fff';
    }, 1500);
});

socket.on('stranger left', () => {
    clearInterval(timerInterval);
    timerEl.classList.add('hidden');
    popupOverlay.classList.remove('active');
    
    statusEl.innerText = 'Stranger left...';
    statusEl.style.color = 'var(--danger)';
    inputEl.disabled = true;
    sendBtn.disabled = true;
    
    appendMessage('Stranger has disconnected.', 'system');

    setTimeout(() => {
        socket.emit('request match');
    }, 1500);
});

socket.on('unlocked', () => {
    isUnlocked = true;
    popupOverlay.classList.remove('active');
    timerEl.classList.add('hidden');
    statusEl.innerText = 'Unlocked — keep talking 🔓';
    
    appendMessage('Connection unlocked 🔓', 'system');
    
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();
});

function sendMessage() {
    const msg = inputEl.value.trim();
    if (msg) {
        socket.emit('chat message', msg);
        appendMessage(msg, 'self');
        inputEl.value = '';
    }
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

inputEl.addEventListener('input', () => {
    socket.emit('typing');
});

nextBtn.addEventListener('click', () => socket.emit('leave'));
btnPopupNext.addEventListener('click', () => {
    popupOverlay.classList.remove('active');
    socket.emit('leave');
});

btnContinue.addEventListener('click', () => {
    socket.emit('vote continue');
    btnContinue.innerText = "Waiting for stranger...";
    btnContinue.disabled = true;
    btnContinue.style.opacity = '0.5';
});

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 120;
    timerEl.innerText = '02:00';
    timerEl.classList.remove('red', 'hidden');

    timerInterval = setInterval(() => {
        timeLeft--;
        
        let m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        let s = (timeLeft % 60).toString().padStart(2, '0');
        timerEl.innerText = `${m}:${s}`;

        if (timeLeft <= 10) timerEl.classList.add('red');

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            showPopup();
        }
    }, 1000);
}

function showPopup() {
    inputEl.disabled = true;
    sendBtn.disabled = true;
    
    btnContinue.innerText = "Continue";
    btnContinue.disabled = false;
    btnContinue.style.opacity = '1';
    
    popupOverlay.classList.add('active');
}

function appendMessage(msg, type) {
    const div = document.createElement('div');
    div.classList.add('msg', type);
    div.innerText = msg;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function resetChatState(statusText) {
    clearInterval(timerInterval);
    isUnlocked = false;
    timerEl.classList.add('hidden');
    popupOverlay.classList.remove('active');
    
    statusEl.innerText = statusText;
    statusEl.style.color = 'var(--text-muted)';
    
    inputEl.disabled = true;
    sendBtn.disabled = true;
    chatContainer.innerHTML = '';
}