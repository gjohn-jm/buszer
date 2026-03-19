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

  // ── SET USERNAME ───────────────────────────────────────────
  socket.on("set_username", ({ roomId, username }) => {
    socket.data.username = username;
    socket.data.roomId   = roomId;

    if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
    roomUsers.get(roomId).set(socket.id, username);

    // tell everyone in room this user joined
    socket.to(roomId).emit("user_joined", { username });

    // broadcast updated user list to ALL in room
    io.to(roomId).emit("room_users", { names: getRoomNames(roomId) });
  });

  // ── SEND MESSAGE ───────────────────────────────────────────
  socket.on("send_message", (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    io.to(roomId).emit("receive_message", data);
  });

  // ── TYPING ────────────────────────────────────────────────
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

  // ── RECORDING ─────────────────────────────────────────────
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

  // ── UPLOADING ─────────────────────────────────────────────
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

  // ── REACTIONS ─────────────────────────────────────────────
  socket.on("add_reaction", ({ msgId, emoji, username }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    io.to(roomId).emit("reaction_update", { msgId, reactions: { [emoji]: [username] } });
  });

  // ── DISCONNECT ────────────────────────────────────────────
  socket.on("disconnect", () => {
    const { roomId, username } = socket.data;
    if (roomId && roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.id);
      if (roomUsers.get(roomId).size === 0) roomUsers.delete(roomId);
      else io.to(roomId).emit("room_users", { names: getRoomNames(roomId) });
    }

    // clean up any stuck statuses
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
