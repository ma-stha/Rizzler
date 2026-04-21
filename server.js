const socket = io();

let time = 120;
let interval;
let isTimerRunning = false;

socket.on("startChat", () => {
  clearChat();
  addMsg("You have 2 minutes. Impress them.", "system");
  setStatus("You’re in. Make it count.");
  startTimer();
  document.getElementById("msg").focus();
});

socket.on("message", (msg) => {
  addMsg(msg, "stranger");
});

socket.on("typing", () => {
  const t = document.getElementById("typing");
  t.innerText = "Someone is typing...";
  setTimeout(() => t.innerText = "", 1000);
});

socket.on("continueChat", () => {
  addMsg("Connection unlocked 🔓", "system");
  document.getElementById("actions").style.display = "none";
});

socket.on("endChat", () => {
  addMsg("No match. Rizz again.", "system");
  setStatus("Finding someone...");
  setTimeout(() => {
    clearChat();
    socket.emit("nextUser");
  }, 1200);
});

function send() {
  const input = document.getElementById("msg");
  const msg = input.value.trim();
  if (!msg) return;

  socket.emit("message", msg);
  addMsg(msg, "you");
  input.value = "";
}

function typing() {
  socket.emit("typing");
}

function addMsg(text, type) {
  const div = document.createElement("div");
  div.classList.add("msg");

  if (type === "you") div.classList.add("you");
  else if (type === "stranger") div.classList.add("stranger");
  else div.classList.add("system");

  div.innerText = text;
  document.getElementById("chat").appendChild(div);

  const chat = document.getElementById("chat");
  chat.scrollTop = chat.scrollHeight;
}

function clearChat() {
  document.getElementById("chat").innerHTML = "";
}

function startTimer() {
  if (isTimerRunning) return;

  isTimerRunning = true;
  time = 120;

  clearInterval(interval);

  interval = setInterval(() => {
    time--;
    const timerEl = document.getElementById("timer");
    timerEl.innerText = format(time);

    if (time < 20) timerEl.style.color = "#ff4d8d";

    if (time <= 0) {
      clearInterval(interval);
      isTimerRunning = false;
      document.getElementById("actions").style.display = "flex";
      setStatus("Make your move.");
    }
  }, 1000);
}

function format(s) {
  let m = Math.floor(s / 60);
  let sec = s % 60;
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}

function decide(choice) {
  setStatus("Waiting on them...");
  socket.emit("decision", choice);
}

function exitChat() {
  setStatus("Finding someone...");
  clearChat();
  socket.emit("nextUser");
}

function setStatus(text) {
  document.getElementById("status").innerText = text;
}