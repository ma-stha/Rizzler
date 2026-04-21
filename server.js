const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // MATCH USERS
  if (waitingUser && waitingUser.id !== socket.id) {
    const room = waitingUser.id + "-" + socket.id;

    socket.join(room);
    waitingUser.join(room);

    socket.room = room;
    waitingUser.room = room;

    socket.emit("startChat");
    waitingUser.emit("startChat");

    waitingUser = null;
  } else {
    waitingUser = socket;
  }

  // SEND MESSAGE
  socket.on("message", (msg) => {
    if (socket.room) {
      socket.to(socket.room).emit("message", msg);
    }
  });

  // NEXT USER
  socket.on("nextUser", () => {
    socket.leave(socket.room);
    socket.room = null;

    if (waitingUser && waitingUser.id !== socket.id) {
      const room = waitingUser.id + "-" + socket.id;

      socket.join(room);
      waitingUser.join(room);

      socket.emit("startChat");
      waitingUser.emit("startChat");

      waitingUser = null;
    } else {
      waitingUser = socket;
    }
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    if (waitingUser === socket) waitingUser = null;

    if (socket.room) {
      socket.to(socket.room).emit("endChat");
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running...");
});