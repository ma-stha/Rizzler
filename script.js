const socket = io();

let time = 120;
let interval;
let started = false;

function startApp() {
  document.getElementById("landing").style.display = "none";
}

function setStatus(t){
  document.getElementById("status").innerText = t;
}

function addMsg(t,type){
  const d = document.createElement("div");
  d.classList.add("msg");

  if(type==="you") d.classList.add("you");
  else if(type==="system") d.classList.add("system");
  else d.classList.add("stranger");

  d.innerText = t;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

function stopTimer(){
  clearInterval(interval);
  timer.innerText = "";
}

function startTimer(){
  stopTimer();
  time = 120;

  interval = setInterval(()=>{
    time--;

    timer.innerText = `${Math.floor(time/60)}:${(time%60).toString().padStart(2,"0")}`;

    if(time <= 10) timer.classList.add("red");

    if(time <= 0){
      stopTimer();
      popup.style.display = "block";
    }
  },1000);
}

socket.on("startChat",()=>{
  chat.innerHTML = "";
  setStatus("Connected. Make it count.");
  popup.style.display = "none";
  timer.classList.remove("red");
  startTimer();
});

socket.on("message",(m)=>addMsg(m,"stranger"));

socket.on("typing",()=>{
  setStatus("typing...");
  setTimeout(()=>setStatus("Connected. Make it count."),800);
});

socket.on("endChat",()=>{
  stopTimer();
  addMsg("Stranger left...","system");

  setTimeout(()=>{
    chat.innerHTML = "";
    setStatus("Finding someone...");
    socket.emit("nextUser");
  },1200);
});

socket.on("continueApproved",()=>{
  popup.style.display = "none";
  stopTimer();
  addMsg("🔓 Connection unlocked","system");
  setStatus("Unlocked — keep talking");
});

function send(){
  const m = msg.value.trim();
  if(!m) return;

  socket.emit("message", m);
  addMsg(m,"you");
  msg.value = "";
}

function typing(){
  socket.emit("typing");
}

function next(){
  stopTimer();
  chat.innerHTML = "";
  setStatus("Finding someone...");
  socket.emit("nextUser");
}

function continueChat(){
  socket.emit("continueChat");
}