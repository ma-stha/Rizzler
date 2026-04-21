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

  // 🔗 MATCHING
  if (waitingUser && waitingUser !== socket) {
    pairUsers(waitingUser, socket);
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

  // ✍️ TYPING
  socket.on("typing", () => {
    if (socket.room) {
      socket.to(socket.room).emit("typing");
    }
  });

  // 🤝 DECISION
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

  // 🔄 NEXT USER (NEW FEATURE)
  socket.on("nextUser", () => {
    socket.leave(socket.room);
    socket.room = null;
    socket.choice = null;

    if (waitingUser && waitingUser !== socket) {
      pairUsers(waitingUser, socket);
      waitingUser = null;
    } else {
      waitingUser = socket;
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

// 🔗 HELPER FUNCTION
function pairUsers(user1, user2) {
  const room = `room-${user1.id}-${user2.id}`;

  user1.join(room);
  user2.join(room);

  user1.room = room;
  user2.room = room;

  user1.choice = null;
  user2.choice = null;

  io.to(room).emit("startChat");

  console.log("Paired:", user1.id, user2.id);
}

// 🚀 START
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});