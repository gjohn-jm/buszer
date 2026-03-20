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

// rooms: { [roomId]: { password, creator, users: { [socketId]: username } } }
const rooms = {};

function getRoomList() {
  return Object.entries(rooms).map(([id, room]) => ({
    id,
    members: Object.values(room.users).length,
  }));
}

function getSocketRoom(socketId) {
  for (const [roomId, room] of Object.entries(rooms)) {
    if (room.users[socketId]) return { roomId, username: room.users[socketId] };
  }
  return { roomId: null, username: null };
}

function doLeave(socket, roomId) {
  const room = rooms[roomId];
  if (!room || !room.users[socket.id]) return;
  const username = room.users[socket.id];
  delete room.users[socket.id];
  socket.leave(roomId);
  if (Object.keys(room.users).length === 0) {
    delete rooms[roomId];
  } else {
    if (room.creator === username) {
      room.creator = Object.values(room.users)[0];
    }
    io.to(roomId).emit("room_users", {
      names: Object.values(room.users),
      creator: room.creator,
    });
    io.to(roomId).emit("receive_message", {
      id: `sys-${Date.now()}`,
      type: "system",
      text: `${username} left the room`,
    });
  }
  io.emit("active_rooms_update", getRoomList());
}

io.on("connection", (socket) => {

  socket.on("get_active_rooms", (cb) => cb(getRoomList()));

  socket.on("check_room", (roomId, cb) => cb(!!rooms[roomId]));

  // CREATE + JOIN in one shot
socket.on("create_and_join", ({ password, username }, cb) => {
  const roomId = Math.floor(10000 + Math.random() * 90000).toString();
  rooms[roomId] = { password, creator: username, users: {} };

  socket.join(roomId, () => {
    rooms[roomId].users[socket.id] = username;
    io.emit("active_rooms_update", getRoomList());
    console.log(`Room created: ${roomId} by ${username}`);
    cb({ ok: true, roomId, creator: username });
  });
});

  // JOIN existing room
socket.on("join_room", ({ roomId, password, username }, cb) => {
  const room = rooms[roomId];
  if (!room) return cb({ ok: false, error: "Room not found." });
  if (room.password !== password) return cb({ ok: false, error: "Wrong password." });

  socket.join(roomId, () => {
    room.users[socket.id] = username;
    io.to(roomId).emit("room_users", {
      names: Object.values(room.users),
      creator: room.creator,
    });
    socket.to(roomId).emit("user_joined", { username });
    io.emit("active_rooms_update", getRoomList());
    console.log(`${username} joined room ${roomId}`);
    cb({ ok: true, creator: room.creator });
  });
});

  // CHANGE PASSWORD (creator only)
  socket.on("change_password", ({ roomId, newPassword }, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ ok: false, error: "Room not found." });
    if (room.users[socket.id] !== room.creator)
      return cb({ ok: false, error: "Only the creator can change the password." });
    room.password = newPassword;
    io.to(roomId).emit("receive_message", {
      id: `sys-${Date.now()}`,
      type: "system",
      text: `🔒 Password changed by ${room.creator}`,
    });
    cb({ ok: true });
  });

  socket.on("leave_room",      (roomId) => doLeave(socket, roomId));
  socket.on("send_message",    (data)   => socket.to(data.room).emit("receive_message", data));

  socket.on("typing_start",        () => { const {roomId,username}=getSocketRoom(socket.id); if(roomId) socket.to(roomId).emit("user_typing",{username}); });
  socket.on("typing_stop",         () => { const {roomId,username}=getSocketRoom(socket.id); if(roomId) socket.to(roomId).emit("user_stop_typing",{username}); });
  socket.on("recording_start",     () => { const {roomId,username}=getSocketRoom(socket.id); if(roomId) socket.to(roomId).emit("user_recording",{username}); });
  socket.on("recording_stop",      () => { const {roomId,username}=getSocketRoom(socket.id); if(roomId) socket.to(roomId).emit("user_stop_recording",{username}); });
  socket.on("uploading_start",     () => { const {roomId,username}=getSocketRoom(socket.id); if(roomId) socket.to(roomId).emit("user_uploading",{username}); });
  socket.on("uploading_stop",      () => { const {roomId,username}=getSocketRoom(socket.id); if(roomId) socket.to(roomId).emit("user_stop_uploading",{username}); });

  socket.on("add_reaction", ({ msgId, emoji, username }) => {
    const { roomId } = getSocketRoom(socket.id);
    if (!roomId) return;
    io.to(roomId).emit("reaction_update", { msgId, reactions: { [emoji]: [username] } });
  });

  socket.on("disconnect", () => {
    Object.keys(rooms).forEach((rid) => doLeave(socket, rid));
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
