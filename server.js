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
let continueVotes = {}; // room -> Set()

io.on("connection", (socket) => {

  function matchUser() {
    if (waitingUser && waitingUser.id !== socket.id) {
      const room = socket.id + "#" + waitingUser.id;

      socket.join(room);
      waitingUser.join(room);

      rooms[socket.id] = room;
      rooms[waitingUser.id] = room;

      continueVotes[room] = new Set(); // ✅ FIX

      socket.emit("startChat");
      waitingUser.emit("startChat");

      waitingUser = null;
    } else {
      waitingUser = socket;
    }
  }

  matchUser();

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
    matchUser();
  });

  socket.on("continueChat", () => {
    const room = rooms[socket.id];
    if (!room) return;

    // ✅ FIX: prevent duplicate vote
    continueVotes[room].add(socket.id);

    if (continueVotes[room].size === 2) {
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