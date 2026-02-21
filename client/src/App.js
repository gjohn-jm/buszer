import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import EmojiPicker from "emoji-picker-react";

import "./App.css";

const socket = io("https://buszer.onrender.com");

// ====== PUT YOUR VALUES HERE ======
const CLOUDINARY_CLOUD_NAME = "daclw4cpg";
const CLOUDINARY_UPLOAD_PRESET = "tiktikboom";
// ================================

function App() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [inRoom, setInRoom] = useState(false);

  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);

  const [hasUsername, setHasUsername] = useState(false);
  const [error, setError] = useState("");

  // Emoji
  const [showEmoji, setShowEmoji] = useState(false);

  // Upload
  const fileRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);

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

  // ---------- Cloudinary upload ----------
  const uploadToCloudinary = async (fileOrBlob) => {
    if (
      !CLOUDINARY_CLOUD_NAME ||
      CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME" ||
      !CLOUDINARY_UPLOAD_PRESET ||
      CLOUDINARY_UPLOAD_PRESET === "YOUR_UNSIGNED_UPLOAD_PRESET"
    ) {
      throw new Error("Set your Cloudinary cloud name and upload preset.");
    }

    const form = new FormData();
    form.append("file", fileOrBlob);
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    // "auto" handles images + videos + audio
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

    const res = await fetch(endpoint, { method: "POST", body: form });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Cloudinary upload failed");
    }
    const data = await res.json();
    return data.secure_url;
  };

  // ---------- Sending helper ----------
  const emitMsg = (payload) => {
    socket.emit("send_message", payload);
    setChat((prev) => [...prev, payload]); // local echo
  };

  // ---------- Text ----------
  const sendText = () => {
    const text = message.trim();
    if (!text) return;

    emitMsg({
      sender: username,
      room: roomId,
      type: "text",
      text,
      createdAt: Date.now(),
    });

    setMessage("");
  };

  // ---------- Emoji ----------
  const onPickEmoji = (emojiData) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  // ---------- Image/Video ----------
  const openFilePicker = () => {
    setShowEmoji(false);
    fileRef.current?.click();
  };

  const handlePickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    // no preview: upload immediately
    setIsUploading(true);
    setError("");

    try {
      const url = await uploadToCloudinary(file);

      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");

      emitMsg({
        sender: username,
        room: roomId,
        type: isVideo ? "video" : isImage ? "image" : "file",
        url,
        mime: file.type,
        name: file.name,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error(err);
      setError("Upload failed. Check Cloudinary cloud name/preset (unsigned).");
    } finally {
      setIsUploading(false);
    }
  };

  // ---------- Voice notes (MediaRecorder) ----------
  const startRecording = async () => {
    if (isRecording) return;

    setError("");
    setShowEmoji(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        try {
          setIsUploading(true);

          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const url = await uploadToCloudinary(blob);

          emitMsg({
            sender: username,
            room: roomId,
            type: "audio",
            url,
            mime: blob.type,
            createdAt: Date.now(),
          });
        } catch (err) {
          console.error(err);
          setError("Voice upload failed.");
        } finally {
          setIsUploading(false);

          // stop mic stream tracks
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((t) => t.stop());
            audioStreamRef.current = null;
          }
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      setError("Mic permission denied or not supported.");
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  // Username Screen
  if (!hasUsername) {
    return (
      <div className="horror-container">
        <div className="mist-overlay">
          <div className="mist-layer-1"></div>
          <div className="mist-layer-2"></div>
          <div className="mist-layer-3"></div>
        </div>

        <div className="floating-ghosts">
          <div className="ghost ghost-1"></div>
          <div className="ghost ghost-2"></div>
          <div className="ghost ghost-3"></div>
          <div className="ghost ghost-4"></div>
        </div>

        <div className="void-cracks"></div>

        <div className="ember-field">
          <div className="ember"></div>
          <div className="ember"></div>
          <div className="ember"></div>
          <div className="ember"></div>
          <div className="ember"></div>
        </div>

        <div className="center-portal">
          <h2 className="horror-title">ENTER NAME</h2>
          <input
            type="text"
            className="abyss-input"
            placeholder="Your name..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            className="summon-btn"
            onClick={() => username.trim() && setHasUsername(true)}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // Room Screen
  if (!inRoom) {
    return (
      <div className="horror-container">
        <div className="mist-overlay">
          <div className="mist-layer-1"></div>
          <div className="mist-layer-2"></div>
          <div className="mist-layer-3"></div>
        </div>

        <div className="floating-ghosts">
          <div className="ghost ghost-1"></div>
          <div className="ghost ghost-2"></div>
          <div className="ghost ghost-3"></div>
          <div className="ghost ghost-4"></div>
        </div>

        <div className="void-cracks"></div>

        <div className="ember-field">
          <div className="ember"></div>
          <div className="ember"></div>
          <div className="ember"></div>
          <div className="ember"></div>
          <div className="ember"></div>
        </div>

        <div className="center-portal">
          <h2 className="horror-title">Welcome {username}</h2>
          <h3 className="abyss-subtitle">Join or create a room</h3>

          <div className="portal-input-group">
            <input
              type="text"
              className="abyss-input"
              placeholder="Room ID..."
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button className="enter-btn" onClick={joinRoom}>
              Join
            </button>
          </div>

          {error && <p className="error-glow">{error}</p>}

          <div className="blood-divider"></div>

          <button className="create-portal-btn" onClick={createRoom}>
            Create room
          </button>

          {roomId && (
            <p className="portal-code">
              ROOM: <span>{roomId}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Chat Screen
  return (
    <div className="horror-chat-container">
      <div className="chat-header">
        <h1 className="chamber-title">ROOM {roomId}</h1>
        <div className="blood-pulse"></div>
      </div>

      <div className="messages-abyss">
        {chat.map((c, i) => {
          const isOwn = c.sender === username;

          return (
            <div
              key={i}
              className={`message-container ${isOwn ? "own-message" : "other-message"}`}
            >
              <div className="blood-message">
                {/* name above every message */}
                <div className={`msg-sender ${isOwn ? "me" : "them"}`}>
                  {isOwn ? "You" : c.sender}
                </div>

                {c.type === "text" && <p>{c.text}</p>}

                {c.type === "image" && (
                  <img
                    className="chat-media"
                    src={c.url}
                    alt={c.name || "image"}
                    loading="lazy"
                  />
                )}

                {c.type === "video" && (
                  <video className="chat-media" src={c.url} controls />
                )}

                {c.type === "audio" && (
                  <audio className="chat-audio" src={c.url} controls />
                )}

                {c.type === "file" && (
                  <a className="chat-file" href={c.url} target="_blank" rel="noreferrer">
                    {c.name || "Open file"}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="void-input">
        {error && <div className="error-glow" style={{ marginBottom: 8 }}>{error}</div>}

        {showEmoji && (
  <div className="emoji-modal" onClick={() => setShowEmoji(false)}>
    <div className="emoji-modal-inner" onClick={(e) => e.stopPropagation()}>
      <EmojiPicker
        onEmojiClick={(emojiData) => setMessage((prev) => prev + emojiData.emoji)}
        theme="dark"
        height={360}
        width={320}
      />
    </div>
  </div>
)}


        <div className="input-group">
          {/* Hidden file picker */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={handlePickFile}
          />

          <button
            className="summon-btn-small"
            type="button"
            onClick={() => setShowEmoji((p) => !p)}
            disabled={isUploading || isRecording}
            title="Emoji"
          >
            🙂
          </button>

          <button
            className="summon-btn-small"
            type="button"
            onClick={openFilePicker}
            disabled={isUploading || isRecording}
            title="Attach"
          >
            ＋
          </button>

          <input
            type="text"
            className="void-input-field"
            placeholder={isUploading ? "Uploading..." : isRecording ? "Recording..." : "Type a message"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
            disabled={isUploading || isRecording}
          />

          {/* Voice button: hold-to-record style (click start/stop) */}
          <button
            className="summon-btn-small"
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isUploading}
            title={isRecording ? "Stop" : "Voice"}
          >
            {isRecording ? "■" : "🎙"}
          </button>

          <button
            className="summon-btn-small"
            type="button"
            onClick={sendText}
            disabled={isUploading || isRecording || message.trim() === ""}
            title="Send"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
