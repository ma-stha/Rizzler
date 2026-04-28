const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingUser = null;
const rooms = {};
let totalUsersOnline = 0; // NEW: Track online users

function findMatch(socket) {
    if (waitingUser === socket) return;
    
    if (waitingUser) {
        const roomId = 'room_' + Math.random().toString(36).substring(2, 9);
        
        socket.join(roomId);
        waitingUser.join(roomId);
        
        socket.roomId = roomId;
        waitingUser.roomId = roomId;

        rooms[roomId] = { users: [socket.id, waitingUser.id], votes: 0 };

        io.to(roomId).emit('connected');
        waitingUser = null; 
    } else {
        waitingUser = socket;
        socket.emit('waiting');
    }
}

io.on('connection', (socket) => {
    // NEW: Update everyone when a new user joins
    totalUsersOnline++;
    io.emit('user count', totalUsersOnline);

    findMatch(socket);

    socket.on('chat message', (msg) => {
        if (socket.roomId) socket.to(socket.roomId).emit('chat message', msg);
    });

    socket.on('typing', () => {
        if (socket.roomId) socket.to(socket.roomId).emit('typing');
    });

    // NEW: Pass read receipts to the stranger
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

    socket.on('request match', () => {
        findMatch(socket);
    });

    socket.on('disconnect', () => {
        totalUsersOnline--; // NEW: Remove user from count
        io.emit('user count', totalUsersOnline);

        if (waitingUser === socket) waitingUser = null;
        else handleLeave(socket);
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