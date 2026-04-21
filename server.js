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

  // 🔗 MATCHING LOGIC
  if (waitingUser && waitingUser !== socket) {
    const room = `room-${waitingUser.id}-${socket.id}`;

    socket.join(room);
    waitingUser.join(room);

    socket.room = room;
    waitingUser.room = room;

    socket.choice = null;
    waitingUser.choice = null;

    io.to(room).emit("startChat");

    console.log("Paired:", waitingUser.id, socket.id);

    waitingUser = null;
  } else {
    waitingUser = socket;
    console.log("Waiting for partner...");
  }

  // 💬 MESSAGE
  socket.on("message", (msg) => {
    if (socket.room) {
      socket.to(socket.room).emit("message", msg);
    }
  });

  // ✍️ TYPING INDICATOR
  socket.on("typing", () => {
    if (socket.room) {
      socket.to(socket.room).emit("typing");
    }
  });

  // 🤝 DECISION (CONTINUE / NEXT)
  socket.on("decision", (choice) => {
    socket.choice = choice;

    const room = socket.room;
    if (!room) return;

    const clients = io.sockets.adapter.rooms.get(room);
    if (!clients) return;

    let bothChosen = true;
    let bothContinue = true;

    clients.forEach((id) => {
      const s = io.sockets.sockets.get(id);

      if (!s.choice) bothChosen = false;
      if (s.choice !== "continue") bothContinue = false;
    });

    if (bothChosen) {
      if (bothContinue) {
        // reset choices
        clients.forEach((id) => {
          const s = io.sockets.sockets.get(id);
          s.choice = null;
        });

        io.to(room).emit("continueChat");
      } else {
        io.to(room).emit("endChat");
      }
    }
  });

  // ❌ DISCONNECT
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    if (waitingUser === socket) {
      waitingUser = null;
    }
  });
});

// 🚀 START SERVER
server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});