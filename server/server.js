const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const path = require("path");

app.use(express.static(path.join(__dirname, "../client/build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});



const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Track active rooms
const activeRooms = new Set();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Check if room exists
  socket.on("check_room", (roomId, callback) => {
    callback(activeRooms.has(roomId));
  });

  // Join room
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    activeRooms.add(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Handle message
  socket.on("send_message", (data) => {
    socket.to(data.room).emit("receive_message", data);
  });

  // Remove empty rooms if everyone leaves
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        const clients = io.sockets.adapter.rooms.get(room);
        if (!clients || clients.size === 0) {
          activeRooms.delete(room);
          console.log(`Room ${room} deleted (empty).`);
        }
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
