const socket = io();

let timerInt;
let time = 120;
let isTyping = false;

function setStatus(t){
  status.innerText = t;
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

function startTimer(){
  clearInterval(timerInt);
  time = 120;

  timerInt = setInterval(()=>{
    time--;
    timer.innerText = time + "s";

    if(time <= 20) timer.style.color = "red";

    if(time <= 0){
      clearInterval(timerInt);
      popup.style.display = "block";
    }
  },1000);
}

function stopTimer(){
  clearInterval(timerInt);
  timer.innerText = "";
}

socket.on("startChat",()=>{
  chat.innerHTML="";
  setStatus("Connected. Make it count.");
  popup.style.display="none";
  startTimer();
});

socket.on("message",(m)=>addMsg(m,"stranger"));

socket.on("typing",()=>{
  if(isTyping) return;

  isTyping = true;
  setStatus("typing...");

  setTimeout(()=>{
    setStatus("Connected. Make it count.");
    isTyping = false;
  },800);
});

socket.on("endChat",()=>{
  stopTimer();
  addMsg("Stranger left","system");

  setTimeout(()=>{
    chat.innerHTML="";
    setStatus("Finding someone...");
    // ❌ NO AUTO nextUser (fixes loop)
  },800);
});

socket.on("continueApproved",()=>{
  popup.style.display="none";
  stopTimer();
  addMsg("🔓 Connection unlocked","system");
  setStatus("Unlocked — keep talking");
});

function send(){
  if(!msg.value) return;
  socket.emit("message",msg.value);
  addMsg(msg.value,"you");
  msg.value="";
}

function typing(){
  socket.emit("typing");
}

function next(){
  stopTimer();
  chat.innerHTML="";
  setStatus("Finding someone...");
  socket.emit("nextUser");
}

function continueChat(){
  socket.emit("continueChat");
}