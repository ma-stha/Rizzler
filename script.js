const socket = io(window.location.origin);

socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

socket.on("startChat", () => {
  addMsg("Connected! Start chatting", "system");
});

socket.on("message", (msg) => {
  addMsg(msg, "stranger");
});

socket.on("endChat", () => {
  addMsg("Stranger left. Finding new...", "system");
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

function addMsg(text, type) {
  const div = document.createElement("div");
  div.classList.add("msg");

  if (type === "you") div.classList.add("you");
  else if (type === "stranger") div.classList.add("stranger");

  div.innerText = text;
  document.getElementById("chat").appendChild(div);
}