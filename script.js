const socket = io(window.location.origin);

function setStatus(text) {
  document.getElementById("status").innerText = text;
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

socket.on("connect", () => {
  setStatus("Finding someone...");
  addMsg("Looking for someone...", "system");
});

socket.on("startChat", () => {
  clearChat();
  setStatus("Connected. Make it count.");
  addMsg("Connected! Start chatting", "system");
});

socket.on("message", (msg) => {
  addMsg(msg, "stranger");
});

socket.on("endChat", () => {
  setStatus("Finding someone...");
  addMsg("No match. Rizz again.", "system");
  socket.emit("nextUser");
});

function send() {
  const input = document.getElementById("msg");
  const msg = input.value.trim();
  if (!msg) return;

  socket.emit("message", msg);
  addMsg(msg, "you");
  input.value = "";
}

function exitChat() {
  location.reload();
}