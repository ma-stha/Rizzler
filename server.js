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

  // MATCHING
  if (waitingUser && waitingUser !== socket) {
    const room = `room-${waitingUser.id}-${socket.id}`;

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

  // MESSAGE
  socket.on("message", (msg) => {
    if (socket.room) {
      socket.to(socket.room).emit("message", msg);
    }
  });

  // TYPING
  socket.on("typing", () => {
    if (socket.room) {
      socket.to(socket.room).emit("typing");
    }
  });

  // DECISION
  socket.on("decision", (choice) => {
    if (!socket.room) return;

    socket.choice = choice;

    const roomSockets = Array.from(io.sockets.adapter.rooms.get(socket.room) || []);
    const otherId = roomSockets.find(id => id !== socket.id);
    const other = io.sockets.sockets.get(otherId);

    if (other && other.choice) {
      if (socket.choice === "continue" && other.choice === "continue") {
        socket.emit("continueChat");
        other.emit("continueChat");
      } else {
        socket.emit("endChat");
        other.emit("endChat");
      }

      socket.choice = null;
      other.choice = null;
    }
  });

  // NEXT USER
  socket.on("nextUser", () => {
    socket.leave(socket.room);
    socket.room = null;

    if (waitingUser && waitingUser !== socket) {
      const room = `room-${waitingUser.id}-${socket.id}`;

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
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    if (waitingUser === socket) {
      waitingUser = null;
    }

    if (socket.room) {
      socket.to(socket.room).emit("endChat");
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running...");
});