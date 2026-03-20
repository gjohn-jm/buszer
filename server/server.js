const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.get("/ping", (_, res) => res.send("pong"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = {};
// rooms[roomId] = { password, creator, users: { socketId: username } }

function getRoomList() {
  return Object.entries(rooms).map(([id, r]) => ({
    id,
    members: Object.keys(r.users).length,
  }));
}

function getSocketRoom(sid) {
  for (const [roomId, r] of Object.entries(rooms)) {
    if (r.users[sid]) return { roomId, username: r.users[sid] };
  }
  return { roomId: null, username: null };
}

function removeFromRoom(socket, roomId) {
  const r = rooms[roomId];
  if (!r || !r.users[socket.id]) return;
  const name = r.users[socket.id];
  delete r.users[socket.id];
  socket.leave(roomId);
  if (Object.keys(r.users).length === 0) {
    delete rooms[roomId];
  } else {
    if (r.creator === name) r.creator = Object.values(r.users)[0];
    io.to(roomId).emit("room_users", { names: Object.values(r.users), creator: r.creator });
    io.to(roomId).emit("receive_message", { id: `sys-${Date.now()}`, type: "system", text: `${name} left the room` });
  }
  io.emit("active_rooms_update", getRoomList());
}

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.on("get_active_rooms", (cb) => {
    if (typeof cb === "function") cb(getRoomList());
  });

  socket.on("check_room", (roomId, cb) => {
    if (typeof cb === "function") cb(!!rooms[roomId]);
  });

  // ── CREATE room and instantly enter ──────────────────────────────────────
  socket.on("create_and_join", ({ password, username }, cb) => {
    if (typeof cb !== "function") return;
    if (!password || !username) return cb({ ok: false, error: "Missing fields." });

    // Generate unique room ID
    let roomId;
    do { roomId = Math.floor(10000 + Math.random() * 90000).toString(); }
    while (rooms[roomId]);

    // Register room synchronously
    rooms[roomId] = { password, creator: username, users: { [socket.id]: username } };

    // Join the socket room (fire and forget, room data already set)
    socket.join(roomId);

    io.emit("active_rooms_update", getRoomList());
    console.log(`Room ${roomId} created by ${username}`);

    // Send success immediately — no waiting on socket.join callback
    cb({ ok: true, roomId, creator: username });
  });

  // ── JOIN existing room ────────────────────────────────────────────────────
  socket.on("join_room", ({ roomId, password, username }, cb) => {
    if (typeof cb !== "function") return;
    if (!roomId || !username) return cb({ ok: false, error: "Missing fields." });

    const r = rooms[roomId];
    if (!r) return cb({ ok: false, error: "Room not found." });
    if (r.password !== password) return cb({ ok: false, error: "Wrong password." });

    // Add user synchronously
    r.users[socket.id] = username;
    socket.join(roomId);

    io.to(roomId).emit("room_users", { names: Object.values(r.users), creator: r.creator });
    socket.to(roomId).emit("user_joined", { username });
    io.emit("active_rooms_update", getRoomList());
    console.log(`${username} joined room ${roomId}`);

    cb({ ok: true, creator: r.creator });
  });

  // ── Change password (creator only) ───────────────────────────────────────
  socket.on("change_password", ({ roomId, newPassword }, cb) => {
    if (typeof cb !== "function") return;
    const r = rooms[roomId];
    if (!r) return cb({ ok: false, error: "Room not found." });
    if (r.users[socket.id] !== r.creator) return cb({ ok: false, error: "Only the creator can do this." });
    r.password = newPassword;
    io.to(roomId).emit("receive_message", { id: `sys-${Date.now()}`, type: "system", text: `🔒 Room password changed by ${r.creator}` });
    cb({ ok: true });
  });

  // ── Messaging ────────────────────────────────────────────────────────────
  socket.on("send_message", (data) => {
    if (data?.room) socket.to(data.room).emit("receive_message", data);
  });

  // ── Reactions ────────────────────────────────────────────────────────────
  socket.on("add_reaction", ({ msgId, emoji, username }) => {
    const { roomId } = getSocketRoom(socket.id);
    if (roomId) io.to(roomId).emit("reaction_update", { msgId, reactions: { [emoji]: [username] } });
  });

  // ── Typing / recording / uploading ───────────────────────────────────────
  socket.on("typing_start",        () => { const { roomId, username } = getSocketRoom(socket.id); if (roomId) socket.to(roomId).emit("user_typing",         { username }); });
  socket.on("typing_stop",         () => { const { roomId, username } = getSocketRoom(socket.id); if (roomId) socket.to(roomId).emit("user_stop_typing",    { username }); });
  socket.on("recording_start",     () => { const { roomId, username } = getSocketRoom(socket.id); if (roomId) socket.to(roomId).emit("user_recording",       { username }); });
  socket.on("recording_stop",      () => { const { roomId, username } = getSocketRoom(socket.id); if (roomId) socket.to(roomId).emit("user_stop_recording",  { username }); });
  socket.on("uploading_start",     () => { const { roomId, username } = getSocketRoom(socket.id); if (roomId) socket.to(roomId).emit("user_uploading",        { username }); });
  socket.on("uploading_stop",      () => { const { roomId, username } = getSocketRoom(socket.id); if (roomId) socket.to(roomId).emit("user_stop_uploading",   { username }); });

  // ── Leave / disconnect ───────────────────────────────────────────────────
  socket.on("leave_room", (roomId) => removeFromRoom(socket, roomId));

  socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
    Object.keys(rooms).forEach((rid) => removeFromRoom(socket, rid));
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
