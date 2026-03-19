const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const cors       = require("cors");

const app    = express();
const server = http.createServer(app);

app.use(cors());
app.get("/ping", (_, res) => res.send("pong"));

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// roomId → Map<socketId, username>
const roomUsers = new Map();

// roomId → { msgId → { emoji → Set<username> } }
const roomReactions = new Map();

function getRoomNames(roomId) {
  const room = roomUsers.get(roomId);
  if (!room) return [];
  return [...room.values()];
}

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // ── JOIN ROOM ──────────────────────────────────────────────
  socket.on("join_room", (roomId, callback) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
    if (typeof callback === "function") callback();
  });

  // ── CHECK ROOM ─────────────────────────────────────────────
  socket.on("check_room", (roomId, callback) => {
    const exists = roomUsers.has(roomId) && roomUsers.get(roomId).size > 0;
    if (typeof callback === "function") callback(exists);
  });

  // ── SET USERNAME ───────────────────────────────────────────
  socket.on("set_username", ({ roomId, username }) => {
    socket.data.username = username;
    socket.data.roomId   = roomId;
    if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
    roomUsers.get(roomId).set(socket.id, username);
    socket.to(roomId).emit("user_joined", { username });
    io.to(roomId).emit("room_users", { names: getRoomNames(roomId) });
  });

  // ── SEND MESSAGE ───────────────────────────────────────────
  socket.on("send_message", (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    // Broadcast to others only (sender already adds locally)
    socket.to(roomId).emit("receive_message", data);
  });

  // ── TYPING ─────────────────────────────────────────────────
  socket.on("typing_start", () => {
    const { roomId, username } = socket.data;
    if (!roomId || !username) return;
    socket.to(roomId).emit("user_typing", { username });
  });

  socket.on("typing_stop", () => {
    const { roomId, username } = socket.data;
    if (!roomId || !username) return;
    socket.to(roomId).emit("user_stop_typing", { username });
  });

  // ── RECORDING ──────────────────────────────────────────────
  socket.on("recording_start", () => {
    const { roomId, username } = socket.data;
    if (!roomId || !username) return;
    socket.to(roomId).emit("user_recording", { username });
  });

  socket.on("recording_stop", () => {
    const { roomId, username } = socket.data;
    if (!roomId || !username) return;
    socket.to(roomId).emit("user_stop_recording", { username });
  });

  // ── UPLOADING ──────────────────────────────────────────────
  socket.on("uploading_start", () => {
    const { roomId, username } = socket.data;
    if (!roomId || !username) return;
    socket.to(roomId).emit("user_uploading", { username });
  });

  socket.on("uploading_stop", () => {
    const { roomId, username } = socket.data;
    if (!roomId || !username) return;
    socket.to(roomId).emit("user_stop_uploading", { username });
  });

  // ── REACTIONS (toggle-aware, multi-user) ───────────────────
  socket.on("add_reaction", ({ msgId, emoji, username }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !msgId || !emoji || !username) return;

    if (!roomReactions.has(roomId)) roomReactions.set(roomId, {});
    const roomData = roomReactions.get(roomId);
    if (!roomData[msgId]) roomData[msgId] = {};
    if (!roomData[msgId][emoji]) roomData[msgId][emoji] = new Set();

    const users = roomData[msgId][emoji];
    if (users.has(username)) users.delete(username);
    else users.add(username);

    // Serialize Sets → Arrays for socket emit
    const serialized = {};
    Object.entries(roomData[msgId]).forEach(([em, usersSet]) => {
      const arr = [...usersSet];
      if (arr.length > 0) serialized[em] = arr;
    });

    io.to(roomId).emit("reaction_update", { msgId, reactions: serialized });
  });

  // ── LEAVE ROOM ─────────────────────────────────────────────
  socket.on("leave_room", (roomId) => {
    const username = socket.data.username;
    socket.leave(roomId);
    if (roomId && roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.id);
      if (roomUsers.get(roomId).size === 0) {
        roomUsers.delete(roomId);
        roomReactions.delete(roomId);
      } else {
        io.to(roomId).emit("room_users", { names: getRoomNames(roomId) });
      }
    }
    if (roomId && username) {
      socket.to(roomId).emit("user_stop_typing",    { username });
      socket.to(roomId).emit("user_stop_recording", { username });
      socket.to(roomId).emit("user_stop_uploading", { username });
    }
  });

  // ── DISCONNECT ─────────────────────────────────────────────
  socket.on("disconnect", () => {
    const { roomId, username } = socket.data;
    if (roomId && roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.id);
      if (roomUsers.get(roomId).size === 0) {
        roomUsers.delete(roomId);
        roomReactions.delete(roomId);
      } else {
        io.to(roomId).emit("room_users", { names: getRoomNames(roomId) });
      }
    }
    if (roomId && username) {
      socket.to(roomId).emit("user_stop_typing",    { username });
      socket.to(roomId).emit("user_stop_recording", { username });
      socket.to(roomId).emit("user_stop_uploading", { username });
    }
    console.log("disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
