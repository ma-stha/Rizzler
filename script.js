const socket = io();

let time = 120;
let interval = null;

function setStatus(text) {
  document.getElementById("status").innerText = text;
}

function addMsg(text, type) {
  const div = document.createElement("div");
  div.classList.add("msg");

  if (type === "you") div.classList.add("you");
  else div.classList.add("stranger");

  div.innerText = text;
  document.getElementById("chat").appendChild(div);

  const chat = document.getElementById("chat");
  chat.scrollTop = chat.scrollHeight;
}

function clearChat() {
  document.getElementById("chat").innerHTML = "";
}

/* ✅ STOP TIMER (IMPORTANT FIX) */
function stopTimer() {
  clearInterval(interval);
  interval = null;
  document.getElementById("timer").innerText = "";
}

/* ✅ START TIMER */
function startTimer() {
  stopTimer(); // safety

  time = 120;

  interval = setInterval(() => {
    time--;

    const min = Math.floor(time / 60);
    const sec = (time % 60).toString().padStart(2, "0");

    document.getElementById("timer").innerText = `${min}:${sec}`;

    if (time <= 0) {
      clearInterval(interval);
      interval = null;

      document.getElementById("popup").style.display = "block";
    }
  }, 1000);
}

/* SOCKET EVENTS */

socket.on("connect", () => {
  stopTimer(); // ✅ important
  setStatus("Finding someone...");
});

socket.on("startChat", () => {
  clearChat();
  setStatus("Connected. Make it count.");
  document.getElementById("popup").style.display = "none";
  startTimer();
});

socket.on("message", (msg) => {
  addMsg(msg, "stranger");
});

/* ✅ FIX HERE */
socket.on("endChat", () => {
  stopTimer(); // 🔥 THIS FIXES YOUR BUG
  clearChat();
  setStatus("Finding someone...");
  socket.emit("nextUser");
});

/* ACTIONS */

function send() {
  const input = document.getElementById("msg");
  const msg = input.value.trim();

  if (!msg) return;

  socket.emit("message", msg);
  addMsg(msg, "you");

  input.value = "";
}

function next() {
  stopTimer(); // 🔥 ALSO STOP HERE
  clearChat();
  setStatus("Finding someone...");
  socket.emit("nextUser");
}

function continueChat() {
  document.getElementById("popup").style.display = "none";
  startTimer();
}