const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingQueue = []; 
const rooms = {};
let totalUsersOnline = 0;

function findMatch(socket) {
    // SECURITY 5: Ghost Queue Cleanup - Remove anyone who disconnected but stuck in queue
    waitingQueue = waitingQueue.filter(u => u.connected);

    const matchIndex = waitingQueue.findIndex(user => 
        user !== socket && 
        (user.lookingFor === socket.gender || user.lookingFor === 'any') && 
        (socket.lookingFor === user.gender || socket.lookingFor === 'any')  
    );

    if (matchIndex !== -1) {
        const partner = waitingQueue.splice(matchIndex, 1)[0];
        const roomId = 'room_' + Math.random().toString(36).substring(2, 9);
        
        socket.join(roomId);
        partner.join(roomId);
        
        socket.roomId = roomId;
        partner.roomId = roomId;

        rooms[roomId] = { users: [socket.id, partner.id], votes: 0 };

        io.to(roomId).emit('connected');
    } else {
        if (!waitingQueue.includes(socket)) {
            waitingQueue.push(socket);
        }
        socket.emit('waiting');
    }
}

io.on('connection', (socket) => {
    totalUsersOnline++;
    io.emit('user count', totalUsersOnline);

    // Rate Limiting Trackers
    socket.messageCount = 0;
    socket.lastMessageTime = Date.now();

    socket.on('start matching', (prefs) => {
        socket.gender = prefs.myGender;
        socket.lookingFor = prefs.searchGender;
        findMatch(socket);
    });

    socket.on('chat message', (msg) => {
        if (typeof msg !== 'string' || msg.trim().length === 0) return;
        
        // SECURITY 3: Anti-Spam Throttling (Max 4 messages per 2 seconds)
        const now = Date.now();
        if (now - socket.lastMessageTime > 2000) {
            socket.messageCount = 0; 
        }
        socket.lastMessageTime = now;
        socket.messageCount++;

        if (socket.messageCount > 4) return; // Drop spam messages silently

        const safeMsg = msg.substring(0, 500); 
        
        if (socket.roomId) socket.to(socket.roomId).emit('chat message', safeMsg);
    });

    socket.on('typing', () => {
        if (socket.roomId) socket.to(socket.roomId).emit('typing');
    });

    socket.on('mark read', () => {
        if (socket.roomId) socket.to(socket.roomId).emit('message read');
    });

    socket.on('vote continue', () => {
        const room = rooms[socket.roomId];
        if (room) {
            room.votes++;
            if (room.votes === 2) io.to(socket.roomId).emit('unlocked');
        }
    });

    socket.on('leave', () => {
        handleLeave(socket);
        findMatch(socket); 
    });

    socket.on('disconnect', () => {
        totalUsersOnline--;
        io.emit('user count', totalUsersOnline);
        waitingQueue = waitingQueue.filter(u => u !== socket);
        handleLeave(socket);
    });

    function handleLeave(socket) {
        const roomId = socket.roomId;
        if (roomId) {
            socket.to(roomId).emit('stranger left');
            socket.leave(roomId);
            socket.roomId = null;
            if (rooms[roomId]) delete rooms[roomId]; 
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Rizzler running on port ${PORT}`));