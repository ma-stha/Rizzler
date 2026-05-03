const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json()); // Required to read the tracker data

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
// --- TRACKING & ADMIN SYSTEM --- //
const uniqueUsers = new Set();
const ADMIN_PASSWORD = "boss"; // Change this to your secret password!

// Endpoint to receive new users
app.post('/track-user', (req, res) => {
    const { userId } = req.body;
    if (userId) {
        uniqueUsers.add(userId); // Sets automatically prevent duplicates
    }
    res.sendStatus(200);
});

// Admin Dashboard Route
app.get('/admin', (req, res) => {
    const { key } = req.query;
    
    // Security check
    if (key !== ADMIN_PASSWORD) {
        return res.status(401).send('Unauthorized. Nice try.');
    }

    // The Dashboard UI
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Rizzler Command Center</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { background-color: #0b0615; color: #fff; font-family: 'Inter', sans-serif; padding: 40px; text-align: center; }
                .card { background: #160e24; border: 1px solid #7b4bff; border-radius: 20px; padding: 40px; display: inline-block; box-shadow: 0 0 30px rgba(123, 75, 255, 0.2); }
                h1 { margin-top: 0; color: #7b4bff; }
                .metric { font-size: 60px; font-weight: 800; margin: 10px 0; }
                .label { color: #887a9e; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Rizzler Admin</h1>
                <div class="label">Total Unique Users</div>
                <div class="metric">${uniqueUsers.size}</div>
                <br>
                <div class="label">Currently Online</div>
                <div class="metric" style="color: #00ff88; font-size: 40px;">${totalUsersOnline}</div>
            </div>
        </body>
        </html>
    `);
});
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