const socket = io();

let time = 120;
let interval;

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
}

function clearChat() {
  document.getElementById("chat").innerHTML = "";
}

function startTimer() {
  clearInterval(interval);
  time = 120;

  interval = setInterval(() => {
    time--;
    document.getElementById("timer").innerText = Math.floor(time / 60) + ":" + (time % 60).toString().padStart(2, "0");

    if (time <= 0) {
      clearInterval(interval);
      document.getElementById("popup").style.display = "block";
    }
  }, 1000);
}

socket.on("connect", () => {
  setStatus("Finding someone...");
});

socket.on("startChat", () => {
  clearChat();
  setStatus("Connected");
  document.getElementById("popup").style.display = "none";
  startTimer();
});

socket.on("message", (msg) => {
  addMsg(msg, "stranger");
});

socket.on("endChat", () => {
  clearChat();
  setStatus("Finding someone...");
  socket.emit("nextUser");
});

function send() {
  const input = document.getElementById("msg");
  const msg = input.value;

  if (!msg) return;

  socket.emit("message", msg);
  addMsg(msg, "you");
  input.value = "";
}

function next() {
  document.getElementById("popup").style.display = "none";
  clearChat();
  setStatus("Finding someone...");
  socket.emit("nextUser");
}

function continueChat() {
  document.getElementById("popup").style.display = "none";
  startTimer();
}