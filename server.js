const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// We upgraded from a single waiting user to a queue!
let waitingQueue = []; 
const rooms = {};
let totalUsersOnline = 0;

function findMatch(socket) {
    // 1. Look through the queue for a match
    const matchIndex = waitingQueue.findIndex(user => 
        user !== socket && // Don't match with yourself
        (user.lookingFor === socket.gender || user.lookingFor === 'any') && // They want what you are
        (socket.lookingFor === user.gender || socket.lookingFor === 'any')  // You want what they are
    );

    if (matchIndex !== -1) {
        // MATCH FOUND! Pull them out of the queue
        const partner = waitingQueue.splice(matchIndex, 1)[0];
        
        const roomId = 'room_' + Math.random().toString(36).substring(2, 9);
        
        socket.join(roomId);
        partner.join(roomId);
        
        socket.roomId = roomId;
        partner.roomId = roomId;

        rooms[roomId] = { users: [socket.id, partner.id], votes: 0 };

        io.to(roomId).emit('connected');
    } else {
        // NO MATCH FOUND. Add to queue.
        if (!waitingQueue.includes(socket)) {
            waitingQueue.push(socket);
        }
        socket.emit('waiting');
    }
}

io.on('connection', (socket) => {
    totalUsersOnline++;
    io.emit('user count', totalUsersOnline);

    // NEW: Wait for the user to submit their Lobby preferences
    socket.on('start matching', (prefs) => {
        socket.gender = prefs.myGender;
        socket.lookingFor = prefs.searchGender;
        findMatch(socket);
    });

    socket.on('chat message', (msg) => {
        if (socket.roomId) socket.to(socket.roomId).emit('chat message', msg);
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

        // Remove from queue if they leave before matching
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