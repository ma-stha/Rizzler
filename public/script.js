const socket = io();

const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const chatContainer = document.getElementById('chat-container');
const inputEl = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const nextBtn = document.getElementById('next-btn');
const userCountNum = document.getElementById('user-count-num');

const popupOverlay = document.getElementById('popup-overlay');
const btnContinue = document.getElementById('btn-continue');
const btnPopupNext = document.getElementById('btn-popup-next');

let isUnlocked = false;
let timeLeft = 120;
let timerInterval;
let typingTimeout;
let typingIndicator = null;
let audioContext = null;

// --- NEW: Audio Engine --- //
function playSound(type) {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'pop') { // Message received
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        osc.start(); osc.stop(audioContext.currentTime + 0.1);
    } else if (type === 'tick') { // Timer running out
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
        osc.start(); osc.stop(audioContext.currentTime + 0.05);
    } else if (type === 'chime') { // Connected
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        osc.start(); osc.stop(audioContext.currentTime + 0.5);
    }
}

// Unlock audio on first click (Browser requirement)
document.body.addEventListener('click', () => {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
}, { once: true });

// --- SOCKET EVENTS --- //

socket.on('user count', (count) => {
    userCountNum.innerText = count;
});

socket.on('waiting', () => {
    resetChatState('Finding someone...');
});

socket.on('connected', () => {
    isUnlocked = false;
    chatContainer.innerHTML = '';
    statusEl.innerText = 'Connected. Make it count.';
    statusEl.style.color = '#fff';
    playSound('chime');
    
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();

    appendMessage('You are now chatting with a random stranger.', 'system');
    startTimer();
});

socket.on('chat message', (msg) => {
    removeTypingIndicator();
    appendMessage(msg, 'stranger');
    playSound('pop');
    socket.emit('mark read'); // Tell them we saw it!
    statusEl.innerText = isUnlocked ? 'Unlocked — keep talking' : 'Connected. Make it count.';
});

socket.on('message read', () => {
    // Find the last message we sent and add "Seen"
    const myMsgs = document.querySelectorAll('.msg.self');
    if (myMsgs.length > 0) {
        const lastMsg = myMsgs[myMsgs.length - 1];
        // Remove old receipts
        document.querySelectorAll('.receipt').forEach(el => el.remove());
        const receipt = document.createElement('div');
        receipt.classList.add('receipt');
        receipt.innerText = 'Seen';
        lastMsg.insertAdjacentElement('afterend', receipt);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
});

socket.on('typing', () => {
    showTypingIndicator();
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        removeTypingIndicator();
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
    setTimeout(() => socket.emit('request match'), 1500);
});

socket.on('unlocked', () => {
    isUnlocked = true;
    popupOverlay.classList.remove('active');
    timerEl.classList.add('hidden');
    statusEl.innerText = 'Unlocked — keep talking 🔓';
    appendMessage('Connection unlocked 🔓', 'system');
    playSound('chime');
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();
});

// --- UI / EVENT LISTENERS --- //

function sendMessage() {
    const msg = inputEl.value.trim();
    if (msg) {
        // Remove old "Delivered/Seen" receipts before sending a new one
        document.querySelectorAll('.receipt').forEach(el => el.remove());
        
        socket.emit('chat message', msg);
        const newMsgNode = appendMessage(msg, 'self');
        
        // Add "Delivered" receipt
        const receipt = document.createElement('div');
        receipt.classList.add('receipt');
        receipt.innerText = 'Delivered';
        newMsgNode.insertAdjacentElement('afterend', receipt);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        inputEl.value = '';
    }
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
inputEl.addEventListener('input', () => socket.emit('typing'));
nextBtn.addEventListener('click', () => socket.emit('leave'));
btnPopupNext.addEventListener('click', () => { popupOverlay.classList.remove('active'); socket.emit('leave'); });

btnContinue.addEventListener('click', () => {
    socket.emit('vote continue');
    btnContinue.innerText = "Waiting for stranger...";
    btnContinue.disabled = true;
    btnContinue.style.opacity = '0.5';
});

// --- HELPER FUNCTIONS --- //

function showTypingIndicator() {
    if (!typingIndicator) {
        typingIndicator = document.createElement('div');
        typingIndicator.classList.add('typing-bubble');
        typingIndicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        chatContainer.appendChild(typingIndicator);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function removeTypingIndicator() {
    if (typingIndicator) {
        typingIndicator.remove();
        typingIndicator = null;
    }
}

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

        if (timeLeft <= 10) {
            timerEl.classList.add('red');
            playSound('tick'); // Tension sound!
        }

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
    return div;
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