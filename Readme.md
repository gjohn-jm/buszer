# Buzer (Buszer) — Real‑time Room Chat

Buzer is a real-time, room-based chat app with a horror-themed UI, built with a React client and a Node/Express + Socket.IO server.

Users can create a 5‑digit room code or join an existing room, then send text, emojis, images/videos, and voice notes.

## Features

- Create a room (generates a 5‑digit code) or join an existing room (numbers only)
- Real-time messaging with Socket.IO rooms (join/leave rooms; broadcast to a room) [web:41]
- Emoji picker
- Media attachments: image/video upload to Cloudinary, then shared as a chat message
- Voice notes: mic recording via MediaRecorder → upload → send as audio
- Leave room (client clears local chat state)

## Tech Stack

**Client**
- React
- socket.io-client (configured to use WebSocket transport)
- emoji-picker-react

**Server**
- Node.js + Express (serves the production React build)
- Socket.IO server (rooms + events) [web:41]

**Media**
- Cloudinary unsigned uploads (Upload Preset)

## Realtime Events (Socket.IO)

Server listens for:
- `check_room(roomId, callback)` → returns whether room exists
- `join_room(roomId)` → socket joins room; room is tracked as active
- `leave_room(roomId)` → socket leaves room
- `send_message(data, [ack])` → server broadcasts to everyone else in the room (`socket.to(room).emit(...)` does not send to the sender) [web:42]

Server emits:
- `receive_message(data)` → delivered to other clients in the room

Note: Socket.IO supports acknowledgements by passing a callback as the last argument to `emit()` and calling it on the other side. [web:55]

## Project Setup

> Assumes a structure like:
>
> - `client/` (React app)
> - `server/` (Express + Socket.IO)

### 1) Install dependencies

Client:
```bash
cd client
npm install
```
Server:

```bash
cd ../server
npm install
```
### 2) Environment variables (recommended)
Create a .env in client/:

```text
REACT_APP_SOCKET_SERVER_URL=https://buszer.onrender.com
REACT_APP_CLOUDINARY_CLOUD_NAME=your_cloud_name
REACT_APP_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```
Then update App.js to read from process.env.REACT_APP_....

### 3) Run in development
Terminal 1 (server):

bash
cd server
node server.js
Terminal 2 (client):

```bash
cd client
npm start
```
### 4) Production (server serves client build)
Build client:

```bash
cd client
npm run build
Then start server (it serves client/build):

bash
cd ../server
node server.js
```
### Notes / Known Issues
Your server.js currently registers send_message multiple times; keep only one handler to avoid confusion.

activeRooms is only added on join_room; consider removing from activeRooms on leave_room when room becomes empty.

### License
Choose one:

MIT, or

### Proprietary / All rights reserved

### Author
rAIDENxr

GitHub: https://github.com/gjohn-jm
