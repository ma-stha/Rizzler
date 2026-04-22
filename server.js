const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let waitingUser = null;

io.on("connection", (socket) => {

  if (waitingUser && waitingUser.id !== socket.id) {
    const room = waitingUser.id + "-" + socket.id;

    socket.join(room);
    waitingUser.join(room);

    socket.room = room;
    waitingUser.room = room;

    socket.continue = false;
    waitingUser.continue = false;

    io.to(room).emit("startChat");

    waitingUser = null;
  } else {
    waitingUser = socket;
  }

  socket.on("typing", () => {
    if (socket.room) socket.to(socket.room).emit("typing");
  });

  socket.on("message", (msg) => {
    if (socket.room) {
      socket.to(socket.room).emit("message", msg);
    }
  });

  socket.on("continueChat", () => {
    socket.continue = true;

    const room = socket.room;
    if (!room) return;

    const clients = io.sockets.adapter.rooms.get(room);
    if (!clients) return;

    let bothReady = true;

    clients.forEach(id => {
      const s = io.sockets.sockets.get(id);
      if (!s.continue) bothReady = false;
    });

    if (bothReady) {
      io.to(room).emit("continueApproved");
    }
  });

  socket.on("nextUser", () => {
    if (socket.room) {
      socket.to(socket.room).emit("endChat");
      socket.leave(socket.room);
    }

    socket.room = null;
    socket.continue = false;

    if (waitingUser && waitingUser.id !== socket.id) {
      const room = waitingUser.id + "-" + socket.id;

      socket.join(room);
      waitingUser.join(room);

      socket.room = room;
      waitingUser.room = room;

      socket.continue = false;
      waitingUser.continue = false;

      io.to(room).emit("startChat");

      waitingUser = null;
    } else {
      waitingUser = socket;
    }
  });

  socket.on("disconnect", () => {
    if (waitingUser === socket) waitingUser = null;

    if (socket.room) {
      socket.to(socket.room).emit("endChat");
    }
  });

});

server.listen(process.env.PORT || 3000);