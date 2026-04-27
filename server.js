const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

let waitingUser = null;
let rooms = {};
let continueVotes = {};

io.on("connection", (socket) => {

  if (waitingUser) {
    const room = socket.id + "#" + waitingUser.id;

    socket.join(room);
    waitingUser.join(room);

    rooms[socket.id] = room;
    rooms[waitingUser.id] = room;
    continueVotes[room] = [];

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
      delete continueVotes[room];
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
      continueVotes[room] = [];

      socket.emit("startChat");
      waitingUser.emit("startChat");

      waitingUser = null;
    }
  });

  socket.on("continueChat", () => {
    const room = rooms[socket.id];
    if (!room) return;

    continueVotes[room].push(socket.id);

    if (continueVotes[room].length === 2) {
      io.to(room).emit("continueApproved");
      delete continueVotes[room];
    }
  });

  socket.on("disconnect", () => {
    const room = rooms[socket.id];

    if (room) {
      socket.to(room).emit("endChat");
      delete continueVotes[room];
    }

    if (waitingUser === socket) waitingUser = null;
    delete rooms[socket.id];
  });

});

server.listen(process.env.PORT || 3000);