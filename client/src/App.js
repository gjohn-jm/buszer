import React, { useState, useEffect } from "react";
import io from "socket.io-client";

const socket = io(window.location.origin);

function App() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [hasUsername, setHasUsername] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    socket.on("receive_message", (data) => {
      setChat((prev) => [...prev, data]);
    });
    return () => socket.off("receive_message");
  }, []);

  const joinRoom = () => {
    if (username.trim() === "") {
      setError("Please enter a username first.");
      return;
    }
    if (!/^\d+$/.test(roomId)) {
      setError("Room ID must be numbers only.");
      return;
    }

    // Ask server if room exists
    socket.emit("check_room", roomId, (exists) => {
      if (exists) {
        socket.emit("join_room", roomId);
        setInRoom(true);
        setError("");
      } else {
        setError("Room does not exist.");
      }
    });
  };

  const createRoom = () => {
    if (username.trim() === "") {
      setError("Please enter a username first.");
      return;
    }
    const newRoom = Math.floor(10000 + Math.random() * 90000).toString();
    setRoomId(newRoom);
    socket.emit("join_room", newRoom);
    setInRoom(true);
    setError("");
  };

  const sendMessage = () => {
    if (message.trim() !== "") {
      const msgData = { sender: username, message, room: roomId };
      socket.emit("send_message", msgData);
      setChat((prev) => [...prev, msgData]);
      setMessage("");
    }
  };

  // Username Screen
  if (!hasUsername) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white p-6 rounded-xl shadow-lg w-80 text-center">
          <h2 className="text-xl font-bold mb-4">Enter your username</h2>
          <input
            type="text"
            className="border p-2 w-full rounded mb-3"
            placeholder="Your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            className="bg-green-500 text-white px-4 py-2 rounded w-full"
            onClick={() => username.trim() && setHasUsername(true)}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Room Selection Screen
  if (!inRoom) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white p-6 rounded-xl shadow-lg w-96 text-center">
          <h2 className="text-xl font-bold mb-2">Welcome, {username} 👋</h2>
          <h3 className="text-md mb-4 text-gray-600">Join or Create a Room</h3>

          <div className="flex mb-3">
            <input
              type="text"
              className="border rounded-l-lg p-2 flex-1"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button
              className="bg-green-500 text-white px-4 rounded-r-lg"
              onClick={joinRoom}
            >
              Join
            </button>
          </div>

          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

          <hr className="my-3" />

          <button
            className="bg-blue-500 text-white px-4 py-2 rounded w-full"
            onClick={createRoom}
          >
            Create New Room
          </button>

          {roomId && inRoom && (
            <p className="text-gray-600 mt-2">
              Your Room ID: <b>{roomId}</b> (share this!)
            </p>
          )}
        </div>
      </div>
    );
  }

  // Chat Screen
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="bg-green-500 text-white p-4 text-center font-bold">
        Room: {roomId}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chat.map((c, i) => (
          <div
            key={i}
            className={`flex ${
              c.sender === username ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`p-2 rounded-lg max-w-xs ${
                c.sender === username
                  ? "bg-green-500 text-white rounded-br-none"
                  : "bg-white shadow rounded-bl-none"
              }`}
            >
              <p className="text-sm font-semibold">{c.sender}</p>
              <p>{c.message}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 flex border-t bg-white">
        <input
          type="text"
          className="border p-2 flex-1 rounded-l-lg"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          className="bg-green-500 text-white px-4 rounded-r-lg"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
