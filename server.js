const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let waitingUser = null;
let rooms = {};

io.on("connection", (socket) => {

  if (waitingUser) {
    const room = socket.id + "#" + waitingUser.id;

    socket.join(room);
    waitingUser.join(room);

    rooms[socket.id] = room;
    rooms[waitingUser.id] = room;

    socket.emit("startChat");
    waitingUser.emit("startChat");

    waitingUser = null;
  } else {
    waitingUser = socket;
  }

  socket.on("message", (msg) => {
    const room = rooms[socket.id];
    if (room) socket.to(room).emit("message", msg);
  });

  socket.on("typing", () => {
    const room = rooms[socket.id];
    if (room) socket.to(room).emit("typing");
  });

  socket.on("nextUser", () => {
    const room = rooms[socket.id];
    if (room) {
      socket.to(room).emit("endChat");
    }

    delete rooms[socket.id];

    if (!waitingUser) {
      waitingUser = socket;
    } else {
      const room = socket.id + "#" + waitingUser.id;

      socket.join(room);
      waitingUser.join(room);

      rooms[socket.id] = room;
      rooms[waitingUser.id] = room;

      socket.emit("startChat");
      waitingUser.emit("startChat");

      waitingUser = null;
    }
  });

  socket.on("continueChat", () => {
    const room = rooms[socket.id];
    if (!room) return;

    if (!rooms[room]) rooms[room] = [];
    rooms[room].push(socket.id);

    if (rooms[room].length === 2) {
      io.to(room).emit("continueApproved");
      rooms[room] = [];
    }
  });

  socket.on("disconnect", () => {
    const room = rooms[socket.id];
    if (room) socket.to(room).emit("endChat");

    if (waitingUser === socket) waitingUser = null;
    delete rooms[socket.id];
  });

});

server.listen(process.env.PORT || 3000);