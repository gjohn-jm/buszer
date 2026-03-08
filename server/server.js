const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());

app.get("/ping", (req, res) => res.send("ok"));

app.use(express.static(path.join(__dirname, "../client/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const activeRooms = new Set();
const roomUsers = new Map();

function getRoomNames(roomId) {
  const users = roomUsers.get(roomId);
  return users ? Array.from(users.values()) : [];
}

function emitRoomUsers(roomId) {
  const names = getRoomNames(roomId);
  io.in(roomId).emit("room_users", { count: names.length, names });
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("check_room", (roomId, callback) => {
    if (typeof callback === "function") callback(activeRooms.has(roomId));
  });

  // ✅ Accepts an acknowledgement callback so client knows join is complete
socket.on("join_room", (roomId, callback) => {
  socket.join(roomId);
  activeRooms.add(roomId);
  socket.data.roomId = roomId;
  console.log(`✅ join_room: ${socket.id} joined ${roomId}`);
  console.log(`✅ Room members now:`, io.sockets.adapter.rooms.get(roomId));
  if (typeof callback === "function") callback({ ok: true });
});

socket.on("set_username", ({ roomId, username }) => {
  if (!roomId || !username) {
    console.log("❌ set_username missing data:", { roomId, username });
    return;
  }
  socket.data.username = username;
  if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
  roomUsers.get(roomId).set(socket.id, username);
  const names = getRoomNames(roomId);
  console.log(`✅ set_username -> room ${roomId}:`, names);
  io.in(roomId).emit("room_users", { count: names.length, names });
  socket.emit("room_users", { count: names.length, names });
});

  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
    if (roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.id);
      if (roomUsers.get(roomId).size === 0) roomUsers.delete(roomId);
    }
    const clients = io.sockets.adapter.rooms.get(roomId);
    if (!clients || clients.size === 0) {
      activeRooms.delete(roomId);
    }
    emitRoomUsers(roomId);
    socket.data.roomId = undefined;
  });

  socket.on("send_message", (data) => {
    if (!data?.room) return;
    socket.to(data.room).emit("receive_message", data);
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room === socket.id) continue;
      if (roomUsers.has(room)) {
        roomUsers.get(room).delete(socket.id);
        if (roomUsers.get(room).size === 0) roomUsers.delete(room);
      }
      const clients = io.sockets.adapter.rooms.get(room);
      if (!clients || clients.size <= 1) {
        activeRooms.delete(room);
      } else {
        emitRoomUsers(room);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
