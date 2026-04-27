const socket = io();

let timerInt;
let time = 120;
let typingEl;

function setStatus(t){
  document.getElementById("status").innerText = t;
}

function addMsg(t,type){
  const chat = document.getElementById("chat");

  const d = document.createElement("div");
  d.classList.add("msg");

  if(type==="you") d.classList.add("you");
  else if(type==="system") d.classList.add("system");
  else d.classList.add("stranger");

  d.innerText = t;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

function startTimer(){
  clearInterval(timerInt);
  time = 120;

  timerInt = setInterval(()=>{
    time--;
    document.getElementById("timer").innerText = time;

    if(time <= 0){
      clearInterval(timerInt);
      document.getElementById("popup").style.display = "block";
    }
  },1000);
}

function stopTimer(){
  clearInterval(timerInt);
  document.getElementById("timer").innerText = "";
}

socket.on("startChat",()=>{
  document.getElementById("chat").innerHTML = "";
  setStatus("Connected. Make it count.");
  document.getElementById("popup").style.display = "none";
  startTimer();
});

socket.on("message",(m)=>addMsg(m,"stranger"));

socket.on("typing",()=>{
  const chat = document.getElementById("chat");

  if (typingEl) typingEl.remove();

  typingEl = document.createElement("div");
  typingEl.classList.add("msg","stranger");
  typingEl.style.opacity = "0.6";
  typingEl.innerText = "typing...";

  chat.appendChild(typingEl);
  chat.scrollTop = chat.scrollHeight;

  setTimeout(()=>{
    if (typingEl) typingEl.remove();
  },1000);
});

socket.on("endChat",()=>{
  stopTimer();
  addMsg("Stranger left","system");

  setTimeout(()=>{
    document.getElementById("chat").innerHTML="";
    setStatus("Finding someone...");
    socket.emit("nextUser");
  },800);
});

socket.on("continueApproved",()=>{
  document.getElementById("popup").style.display="none";
  stopTimer();
  addMsg("🔓 Connection unlocked","system");
  setStatus("Unlocked — keep talking");
});

function send(){
  const input = document.getElementById("msg");
  const m = input.value;

  if(!m) return;

  socket.emit("message",m);
  addMsg(m,"you");
  input.value="";
}

function typing(){
  socket.emit("typing");
}

function next(){
  stopTimer();
  document.getElementById("chat").innerHTML="";
  setStatus("Finding someone...");
  socket.emit("nextUser");
}

function continueChat(){
  socket.emit("continueChat");
}