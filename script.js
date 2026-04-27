const socket = io();

let timerInt;
let time = 120;
let isConnected = false;

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
  isConnected = true;
  chat.innerHTML="";
  setStatus("Connected. Make it count.");
  popup.style.display="none";
  startTimer();
});

socket.on("message",(m)=>{
  if(isConnected) addMsg(m,"stranger");
});

socket.on("typing",()=>{
  if(!isConnected) return;

  setStatus("typing...");
  setTimeout(()=>{
    if(isConnected){
      setStatus("Connected. Make it count.");
    }
  },600);
});

socket.on("endChat",()=>{
  isConnected = false;
  stopTimer();
  addMsg("Stranger left","system");

  setTimeout(()=>{
    chat.innerHTML="";
    setStatus("Finding someone...");
  },800);
});

socket.on("continueApproved",()=>{
  popup.style.display="none";
  stopTimer();
  setStatus("Unlocked — keep talking");
});

function send(){
  if(!msg.value || !isConnected) return;
  socket.emit("message",msg.value);
  addMsg(msg.value,"you");
  msg.value="";
}

function typing(){
  if(isConnected){
    socket.emit("typing");
  }
}

function next(){
  isConnected = false;
  stopTimer();
  chat.innerHTML="";
  setStatus("Finding someone...");
  socket.emit("nextUser");
}

function continueChat(){
  socket.emit("continueChat");
}