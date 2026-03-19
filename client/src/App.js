import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io("https://buszer.onrender.com");

setInterval(() => {
  fetch("https://buszer.onrender.com/ping").catch(() => {});
}, 10 * 60 * 1000);

const CLOUDINARY_CLOUD_NAME    = "daclw4cpg";
const CLOUDINARY_UPLOAD_PRESET = "tiktikboom";
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── VoiceNotePlayer ──────────────────────────────────────────
function VoiceNotePlayer({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const BARS = 28;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else         { a.play();  setPlaying(true);  }
  };
  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    setProgress(a.currentTime / a.duration);
  };
  const onEnded = () => { setPlaying(false); setProgress(0); };
  const seek = (e) => {
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (audioRef.current) audioRef.current.currentTime = ratio * audioRef.current.duration;
  };
  const fmt = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="voice-player">
      <audio ref={audioRef} src={src}
        onTimeUpdate={onTimeUpdate} onEnded={onEnded}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} />
      <button className="voice-play-btn" onClick={toggle}>{playing ? "⏸" : "▶"}</button>
      <div className="voice-waveform" onClick={seek}>
        {[...Array(BARS)].map((_, i) => {
          const filled = i / BARS < progress;
          const height = 40 + Math.sin(i * 0.8) * 30 + Math.cos(i * 1.3) * 20;
          return (
            <div key={i} className={`voice-bar ${filled ? "filled" : ""}`}
              style={{ height: `${Math.max(18, Math.min(80, height))}%` }} />
          );
        })}
      </div>
      <span className="voice-duration">
        {playing ? fmt(audioRef.current?.currentTime) : fmt(duration)}
      </span>
    </div>
  );
}

// ── FloatingMenu ─────────────────────────────────────────────
function FloatingMenu({ menu, onClose, onReact, onReply, onCopy }) {
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mouseup",  close);
    document.addEventListener("touchend", close);
    return () => {
      document.removeEventListener("mouseup",  close);
      document.removeEventListener("touchend", close);
    };
  }, [onClose]);

  if (!menu) return null;

  const MENU_W = 216, MENU_H = 160;
  const vpW = window.innerWidth, vpH = window.innerHeight;
  let x = menu.isOwn
    ? Math.max(8, menu.rect.right - MENU_W)
    : Math.min(menu.rect.left, vpW - MENU_W - 8);
  const spaceBelow = vpH - menu.rect.bottom;
  let y = spaceBelow < MENU_H + 16
    ? Math.max(8, menu.rect.top - MENU_H - 8)
    : menu.rect.bottom + 8;

  return (
    <div ref={ref}
      style={{ position: "fixed", top: y, left: x, width: MENU_W, zIndex: 9999 }}
      className="context-menu-fixed"
      onMouseDown={(e)  => e.stopPropagation()}
      onMouseUp={(e)    => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e)   => e.stopPropagation()}
    >
      <div className="context-reactions">
        {REACTION_EMOJIS.map((emoji) => (
          <button key={emoji} className="reaction-option"
            onPointerDown={(e) => { e.stopPropagation(); onReact(emoji); }}>
            {emoji}
          </button>
        ))}
      </div>
      <div className="context-divider" />
      <button className="context-action"
        onPointerDown={(e) => { e.stopPropagation(); onReply(); }}>
        ↩&nbsp; Reply
      </button>
      {menu.type === "text" && (
        <button className="context-action"
          onPointerDown={(e) => { e.stopPropagation(); onCopy(); }}>
          ⎘&nbsp; Copy
        </button>
      )}
    </div>
  );
}

// ── StatusIndicator — WhatsApp style, recipients see this ────
function StatusIndicator({ typingUsers, recordingUsers, uploadingUsers }) {
  return (
    <>
      {typingUsers.map((u) => (
        <div key={`t-${u}`} className="wa-typing-row">
          <div className="wa-typing-avatar">{u[0].toUpperCase()}</div>
          <div className="wa-typing-bubble">
            <span className="wa-typing-name">{u}</span>
            <div className="wa-dot-row">
              <div className="wa-dot" />
              <div className="wa-dot" />
              <div className="wa-dot" />
            </div>
          </div>
        </div>
      ))}

      {recordingUsers.map((u) => (
        <div key={`r-${u}`} className="wa-recording-row">
          <div className="wa-typing-avatar"
            style={{ background: "linear-gradient(135deg,#ff5b7e,#ff54cf)" }}>
            {u[0].toUpperCase()}
          </div>
          <div className="wa-recording-bubble">
            <div className="wa-recording-bars">
              <div className="wa-rec-bar" /><div className="wa-rec-bar" />
              <div className="wa-rec-bar" /><div className="wa-rec-bar" />
              <div className="wa-rec-bar" />
            </div>
            <span className="wa-recording-label">{u} is recording…</span>
          </div>
        </div>
      ))}

      {uploadingUsers.map((u) => (
        <div key={`up-${u}`} className="wa-uploading-row">
          <div className="wa-typing-avatar"
            style={{ background: "linear-gradient(135deg,#ffc857,#ff8c42)" }}>
            {u[0].toUpperCase()}
          </div>
          <div className="wa-uploading-bubble">
            <div className="wa-upload-ring-wrap">
              <svg className="wa-upload-svg" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="10" fill="none"
                  stroke="rgba(255,200,87,0.2)" strokeWidth="2.5" />
                <circle cx="14" cy="14" r="10" fill="none"
                  stroke="var(--accent-gold)" strokeWidth="2.5"
                  strokeLinecap="round" strokeDasharray="16 47" />
              </svg>
              <span className="wa-upload-arrow">↑</span>
            </div>
            <span className="wa-uploading-label">{u} is uploading…</span>
          </div>
        </div>
      ))}
    </>
  );
}

// ── OwnStatusRow — sender sees their own status ───────────────
function OwnStatusRow({ isRecording, isUploading, fmtSec, recSeconds, stopRecording, cancelRecording }) {
  if (!isRecording && !isUploading) return null;
  return (
    <div className="wa-own-row">
      {isRecording && (
        <div className="wa-own-bubble">
          <div className="wa-recording-bars">
            <div className="wa-rec-bar" /><div className="wa-rec-bar" />
            <div className="wa-rec-bar" /><div className="wa-rec-bar" />
            <div className="wa-rec-bar" />
          </div>
          <span className="wa-own-rec-label">Recording</span>
          <span className="wa-own-timer">{fmtSec(recSeconds)}</span>
          <button className="wa-send-btn"
            onPointerDown={(e) => { e.stopPropagation(); stopRecording(); }}>
            ✓ Send
          </button>
          <button className="wa-cancel-btn"
            onPointerDown={(e) => { e.stopPropagation(); cancelRecording(); }}>
            ✕
          </button>
        </div>
      )}
      {isUploading && !isRecording && (
        <div className="wa-own-bubble"
          style={{ borderColor: "rgba(255,200,87,0.28)", background: "rgba(255,200,87,0.06)" }}>
          <div className="wa-upload-ring-wrap">
            <svg className="wa-upload-svg" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="10" fill="none"
                stroke="rgba(255,200,87,0.2)" strokeWidth="2.5" />
              <circle cx="14" cy="14" r="10" fill="none"
                stroke="var(--accent-gold)" strokeWidth="2.5"
                strokeLinecap="round" strokeDasharray="16 47" />
            </svg>
            <span className="wa-upload-arrow">↑</span>
          </div>
          <span className="wa-own-upload-label">Uploading…</span>
        </div>
      )}
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────
function MessageBubble({ c, isOwn, username, reactions, onOpenMenu, setReplyTo, inputRef, addReaction, copiedId }) {
  const [swipeX, setSwipeX]   = useState(0);
  const [swiping, setSwiping] = useState(false);
  const bubbleRef   = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const lpTimer     = useRef(null);
  const hasMoved    = useRef(false);

  if (c.type === "system") {
    return (
      <div className="system-message">
        <div className="system-message-inner">{c.text}</div>
      </div>
    );
  }

  const openMenu = () => {
    if (!bubbleRef.current) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    onOpenMenu({ rect, isOwn, msgId: c.id, type: c.type, text: c.text, sender: c.sender });
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    hasMoved.current = false;
    lpTimer.current = setTimeout(() => { if (!hasMoved.current) openMenu(); }, 500);
  };
  const onTouchMove = (e) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 6 || dy > 6) { hasMoved.current = true; clearTimeout(lpTimer.current); }
    if (dy < 30 && dx > 0 && dx < 100) { setSwiping(true); setSwipeX(dx); }
  };
  const onTouchEnd = () => {
    clearTimeout(lpTimer.current);
    if (swipeX > 55) {
      setReplyTo({ sender: c.sender, text: c.text, type: c.type });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    setSwipeX(0); setSwiping(false);
  };
  const onContextMenu = (e) => { e.preventDefault(); openMenu(); };

  const msgReact = reactions[c.id] || {};
  const hasReact = Object.values(msgReact).some((u) => Array.isArray(u) && u.length > 0);

  return (
    <div
      className={`message-container ${isOwn ? "own-message" : "other-message"}`}
      style={{
        transform: swiping ? `translateX(${swipeX * 0.45}px)` : "translateX(0)",
        transition: swiping ? "none" : "transform 0.25s cubic-bezier(0.22,1,0.36,1)",
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onContextMenu={onContextMenu}
    >
      {swiping && swipeX > 20 && (
        <div className={`swipe-hint ${swipeX > 55 ? "swipe-ready" : ""}`}>↩</div>
      )}
      <div className="blood-message" ref={bubbleRef}>
        <div className={`msg-sender ${isOwn ? "me" : "them"}`}>
          {isOwn ? "You" : c.sender}
        </div>
        {c.replyTo && (
          <div className="reply-preview">
            <span className="reply-name">{c.replyTo.sender}</span>
            <span className="reply-text">
              {c.replyTo.type === "text" ? c.replyTo.text : `📎 ${c.replyTo.type}`}
            </span>
          </div>
        )}
        {c.type === "text"  && <p>{c.text}</p>}
        {c.type === "image" && (
          <img className="chat-media" src={c.url} alt={c.name || "image"}
            loading="lazy" style={{ cursor: "pointer" }} />
        )}
        {c.type === "video" && <video className="chat-media" src={c.url} controls />}
        {c.type === "audio" && <VoiceNotePlayer src={c.url} />}
        {c.type === "file"  && (
          <a className="chat-file" href={c.url} target="_blank" rel="noreferrer">
            📎 {c.name || "Open file"}
          </a>
        )}
        <div className="msg-time">{formatTime(c.createdAt)}</div>
        {copiedId === c.id && <div className="copied-toast">Copied!</div>}
      </div>
      {hasReact && (
        <div className="reaction-bar">
          {Object.entries(msgReact).map(([emoji, users]) =>
            Array.isArray(users) && users.length > 0 ? (
              <button key={emoji}
                className={`reaction-chip ${users.includes(username) ? "mine" : ""}`}
                onPointerDown={(e) => { e.stopPropagation(); addReaction(c.id, emoji); }}>
                {emoji} {users.length}
              </button>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────
function App() {
  const [username, setUsername]             = useState("");
  const [roomId, setRoomId]                 = useState("");
  const [inRoom, setInRoom]                 = useState(false);
  const [message, setMessage]               = useState("");
  const [chat, setChat]                     = useState([]);
  const [hasUsername, setHasUsername]       = useState(false);
  const [error, setError]                   = useState("");
  const fileRef                             = useRef(null);
  const inputRef                            = useRef(null);
  const [isUploading, setIsUploading]       = useState(false);
  const [isRecording, setIsRecording]       = useState(false);
  const mediaRecorderRef                    = useRef(null);
  const audioChunksRef                      = useRef([]);
  const audioStreamRef                      = useRef(null);
  const cancelRecordingRef                  = useRef(false);
  const [roomUsers, setRoomUsers]           = useState([]);
  const [showUsersList, setShowUsersList]   = useState(false);
  const messagesEndRef                      = useRef(null);
  const typingTimerRef                      = useRef(null);
  const [typingUsers, setTypingUsers]       = useState([]);
  const [recordingUsers, setRecordingUsers] = useState([]);
  const [uploadingUsers, setUploadingUsers] = useState([]);
  const [previewImg, setPreviewImg]         = useState(null);
  const [replyTo, setReplyTo]               = useState(null);
  const [reactions, setReactions]           = useState({});
  const [copiedId, setCopiedId]             = useState(null);
  const [floatingMenu, setFloatingMenu]     = useState(null);
  const [recSeconds, setRecSeconds]         = useState(0);
  const recTimerRef                         = useRef(null);
  const floatingMenuRef                     = useRef(null);

  useEffect(() => { floatingMenuRef.current = floatingMenu; }, [floatingMenu]);

  // ✅ Sync on every render — no stale closure ever
  const inRoomRef   = useRef(false);
  const roomIdRef   = useRef("");
  const usernameRef = useRef("");
  inRoomRef.current   = inRoom;
  roomIdRef.current   = roomId;
  usernameRef.current = username;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, typingUsers, recordingUsers, uploadingUsers, isUploading, isRecording]);

  useEffect(() => {
    const onMessage   = (data) =>
      setChat((p) => [...p, { ...data, id: data.id || `${Date.now()}-${Math.random()}` }]);
    const onRoomUsers = (data) => setRoomUsers(data?.names ?? []);
    const onConnect   = () => {
      if (inRoomRef.current && roomIdRef.current) {
        socket.emit("join_room", roomIdRef.current, () =>
          socket.emit("set_username", {
            roomId: roomIdRef.current,
            username: usernameRef.current,
          })
        );
      }
    };

    const onTyping        = ({ username: u }) =>
      setTypingUsers((p) => p.includes(u) ? p : [...p, u]);
    const onStopTyping    = ({ username: u }) =>
      setTypingUsers((p) => p.filter((x) => x !== u));
    const onRecording     = ({ username: u }) =>
      setRecordingUsers((p) => p.includes(u) ? p : [...p, u]);
    const onStopRecording = ({ username: u }) =>
      setRecordingUsers((p) => p.filter((x) => x !== u));
    const onUploading     = ({ username: u }) =>
      setUploadingUsers((p) => p.includes(u) ? p : [...p, u]);
    const onStopUploading = ({ username: u }) =>
      setUploadingUsers((p) => p.filter((x) => x !== u));

    const onReaction = ({ msgId, reactions: r }) => {
      if (!msgId || !r) return;
      setReactions((p) => {
        const merged = { ...(p[msgId] || {}) };
        Object.entries(r).forEach(([emoji, users]) => {
          if (Array.isArray(users) && users.length > 0) merged[emoji] = users;
          else delete merged[emoji];
        });
        return { ...p, [msgId]: merged };
      });
    };

    const onUserJoined = ({ username: u }) =>
      setChat((p) => [...p, {
        id: `sys-${Date.now()}-${Math.random()}`,
        type: "system", text: `${u} joined the room`,
      }]);

    socket.on("receive_message",     onMessage);
    socket.on("room_users",          onRoomUsers);
    socket.on("connect",             onConnect);
    socket.on("user_typing",         onTyping);
    socket.on("user_stop_typing",    onStopTyping);
    socket.on("user_recording",      onRecording);
    socket.on("user_stop_recording", onStopRecording);
    socket.on("user_uploading",      onUploading);
    socket.on("user_stop_uploading", onStopUploading);
    socket.on("reaction_update",     onReaction);
    socket.on("user_joined",         onUserJoined);

    return () => {
      socket.off("receive_message",     onMessage);
      socket.off("room_users",          onRoomUsers);
      socket.off("connect",             onConnect);
      socket.off("user_typing",         onTyping);
      socket.off("user_stop_typing",    onStopTyping);
      socket.off("user_recording",      onRecording);
      socket.off("user_stop_recording", onStopRecording);
      socket.off("user_uploading",      onUploading);
      socket.off("user_stop_uploading", onStopUploading);
      socket.off("reaction_update",     onReaction);
      socket.off("user_joined",         onUserJoined);
    };
  }, []);

  const doJoinRoom = (rid, uname) => {
    socket.emit("join_room", rid, () =>
      socket.emit("set_username", { roomId: rid, username: uname })
    );
  };

  const joinRoom = () => {
    if (!username.trim())      { setError("Please enter a username first."); return; }
    if (!/^\d+$/.test(roomId)) { setError("Room ID must be numbers only.");  return; }
    socket.emit("check_room", roomId, (exists) => {
      if (exists) { doJoinRoom(roomId, username); setInRoom(true); setError(""); }
      else          setError("Room does not exist.");
    });
  };

  const createRoom = () => {
    if (!username.trim()) { setError("Please enter a username first."); return; }
    const newRoom = Math.floor(10000 + Math.random() * 90000).toString();
    roomIdRef.current = newRoom; // ✅ sync immediately
    setRoomId(newRoom);
    doJoinRoom(newRoom, username);
    setInRoom(true);
    setError("");
  };

  const leaveRoom = () => {
    socket.emit("typing_stop",    { roomId: roomIdRef.current, username: usernameRef.current });
    socket.emit("recording_stop", { roomId: roomIdRef.current, username: usernameRef.current });
    socket.emit("uploading_stop", { roomId: roomIdRef.current, username: usernameRef.current });
    socket.emit("leave_room", roomIdRef.current);
    clearInterval(recTimerRef.current);
    setRecSeconds(0);
    setInRoom(false); setRoomId(""); setChat([]); setRoomUsers([]);
    setShowUsersList(false); setMessage(""); setError("");
    setTypingUsers([]); setRecordingUsers([]); setUploadingUsers([]);
    setReplyTo(null); setReactions({}); setFloatingMenu(null);
  };

  const uploadToCloudinary = async (fileOrBlob) => {
    const form = new FormData();
    form.append("file", fileOrBlob);
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
      { method: "POST", body: form }
    );
    if (!res.ok) throw new Error("Upload failed");
    return (await res.json()).secure_url;
  };

  const emitMsg = (payload) => {
    const msg = { ...payload, id: `${Date.now()}-${Math.random()}` };
    socket.emit("send_message", msg);
    setChat((p) => [...p, msg]);
  };

  const handleMessageInput = (e) => {
    setMessage(e.target.value);
    socket.emit("typing_start", { roomId: roomIdRef.current, username: usernameRef.current });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(
      () => socket.emit("typing_stop", { roomId: roomIdRef.current, username: usernameRef.current }),
      1500
    );
  };

  const sendText = () => {
    const text = message.trim();
    if (!text) return;
    socket.emit("typing_stop", { roomId: roomIdRef.current, username: usernameRef.current });
    clearTimeout(typingTimerRef.current);
    emitMsg({
      sender: usernameRef.current,
      room: roomIdRef.current,
      type: "text", text,
      createdAt: Date.now(),
      replyTo: replyTo || null,
    });
    setMessage(""); setReplyTo(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handlePickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsUploading(true);
    setError("");
    socket.emit("uploading_start", { roomId: roomIdRef.current, username: usernameRef.current });
    try {
      const url  = await uploadToCloudinary(file);
      const type = file.type.startsWith("video/") ? "video"
                 : file.type.startsWith("image/") ? "image"
                 : file.type.startsWith("audio/") ? "audio"
                 : "file";
      emitMsg({
        sender: usernameRef.current,
        room: roomIdRef.current,
        type, url, mime: file.type, name: file.name,
        createdAt: Date.now(),
      });
    } catch { setError("Upload failed."); }
    finally {
      setIsUploading(false);
      socket.emit("uploading_stop", { roomId: roomIdRef.current, username: usernameRef.current });
    }
  };

  const startRecording = async () => {
    if (isRecording) return;
    setError("");
    cancelRecordingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data?.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        clearInterval(recTimerRef.current);
        setRecSeconds(0);
        socket.emit("recording_stop", { roomId: roomIdRef.current, username: usernameRef.current });
        if (cancelRecordingRef.current) {
          audioStreamRef.current?.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
          cancelRecordingRef.current = false;
          return;
        }
        try {
          setIsUploading(true);
          socket.emit("uploading_start", { roomId: roomIdRef.current, username: usernameRef.current });
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const url  = await uploadToCloudinary(blob);
          emitMsg({
            sender: usernameRef.current,
            room: roomIdRef.current,
            type: "audio", url, mime: blob.type,
            createdAt: Date.now(),
          });
        } catch { setError("Voice upload failed."); }
        finally {
          setIsUploading(false);
          socket.emit("uploading_stop", { roomId: roomIdRef.current, username: usernameRef.current });
          audioStreamRef.current?.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
      };
      recorder.start();
      setIsRecording(true);
      setRecSeconds(0);
      socket.emit("recording_start", { roomId: roomIdRef.current, username: usernameRef.current });
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch { setError("Mic permission denied."); }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    clearInterval(recTimerRef.current);
    cancelRecordingRef.current = false;
    const r = mediaRecorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  };

  const cancelRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    clearInterval(recTimerRef.current);
    setRecSeconds(0);
    cancelRecordingRef.current = true;
    const r = mediaRecorderRef.current;
    if (r && r.state !== "inactive") r.stop();
    socket.emit("recording_stop", { roomId: roomIdRef.current, username: usernameRef.current });
  };

  const addReaction = (msgId, emoji) => {
    if (!msgId || !emoji) return;
    setReactions((p) => {
      const prev  = { ...(p[msgId] || {}) };
      const users = Array.isArray(prev[emoji]) ? [...prev[emoji]] : [];
      const idx   = users.indexOf(usernameRef.current);
      if (idx === -1) users.push(usernameRef.current);
      else            users.splice(idx, 1);
      if (users.length > 0) prev[emoji] = users;
      else                  delete prev[emoji];
      return { ...p, [msgId]: prev };
    });
    socket.emit("add_reaction", {
      roomId: roomIdRef.current, msgId, emoji,
      username: usernameRef.current,
    });
    setFloatingMenu(null);
  };

  const fmtSec = (s) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const BgDecor = () => (
    <>
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />
      <div className="particles">
        {[...Array(8)].map((_, i) => <div key={i} className="particle" />)}
      </div>
    </>
  );

  if (!hasUsername) {
    return (
      <div className="horror-container">
        <BgDecor />
        <div className="center-portal">
          <h2 className="horror-title">ENTER NAME</h2>
          <input type="text" className="abyss-input" placeholder="Your name..."
            value={username} onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && username.trim() && setHasUsername(true)} />
          <button className="summon-btn"
            onClick={() => username.trim() && setHasUsername(true)}>Continue →</button>
        </div>
      </div>
    );
  }

  if (!inRoom) {
    return (
      <div className="horror-container">
        <BgDecor />
        <div className="center-portal">
          <h2 className="horror-title">Welcome {username}</h2>
          <h3 className="abyss-subtitle">Join or create a room</h3>
          <div className="portal-input-group">
            <input type="text" className="abyss-input" placeholder="Room ID..."
              value={roomId}
              onChange={(e) => { setRoomId(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()} />
            <button className="enter-btn" onClick={joinRoom}>Join</button>
          </div>
          {error && <p className="error-glow">{error}</p>}
          <div className="blood-divider" />
          <button className="create-portal-btn" onClick={createRoom}>Create room</button>
          {roomId && <p className="portal-code">ROOM: <span>{roomId}</span></p>}
        </div>
      </div>
    );
  }

  return (
    <div className="horror-chat-container"
      onClick={() => { setFloatingMenu(null); setShowUsersList(false); }}>

      <FloatingMenu
        menu={floatingMenu}
        onClose={() => setFloatingMenu(null)}
        onReact={(emoji) => {
          const m = floatingMenuRef.current;
          if (m?.msgId) addReaction(m.msgId, emoji);
        }}
        onReply={() => {
          const m = floatingMenuRef.current;
          if (!m) return;
          setReplyTo({ sender: m.sender, text: m.text, type: m.type });
          setFloatingMenu(null);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        onCopy={() => {
          const m = floatingMenuRef.current;
          if (!m) return;
          navigator.clipboard?.writeText(m.text).catch(() => {});
          setCopiedId(m.msgId);
          setTimeout(() => setCopiedId(null), 1500);
          setFloatingMenu(null);
        }}
      />

      {previewImg && (
        <div className="img-preview-overlay" onClick={() => setPreviewImg(null)}>
          <div className="img-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button className="img-preview-close" onClick={() => setPreviewImg(null)}>✕</button>
            <img src={previewImg} alt="preview" />
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="chat-header" onClick={(e) => e.stopPropagation()}>
        <div className="chat-header-left">
          <h1 className="chamber-title">ROOM {roomId}</h1>
          <button className="online-badge" type="button"
            onClick={() => setShowUsersList((p) => !p)}>
            <span className="blood-pulse" />
            <span>{roomUsers.length} online</span>
          </button>
        </div>
        <div className="chat-header-right">
          <button className="leave-btn" type="button" onClick={leaveRoom}>Exit</button>
        </div>
      </div>

      {showUsersList && (
        <div className="users-popup" onClick={(e) => e.stopPropagation()}>
          <h3>People in this room</h3>
          {roomUsers.length === 0
            ? <p>No one online</p>
            : <ul>{roomUsers.map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}</ul>}
        </div>
      )}

      {/* ── Messages ── */}
      <div className="messages-abyss">
        {chat.length === 0 && !isUploading && !isRecording && (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <p>No messages yet</p>
            <span>Say hello!</span>
          </div>
        )}

        {chat.map((c, i) => (
          <MessageBubble
            key={c.id || i}
            c={c}
            isOwn={c.sender === username}
            username={username}
            reactions={reactions}
            onOpenMenu={setFloatingMenu}
            setReplyTo={setReplyTo}
            inputRef={inputRef}
            addReaction={addReaction}
            copiedId={copiedId}
          />
        ))}

        {/* ✅ Recipients see others' status */}
        <StatusIndicator
          typingUsers={typingUsers}
          recordingUsers={recordingUsers}
          uploadingUsers={uploadingUsers}
        />

        {/* ✅ Sender sees own recording/uploading */}
        <OwnStatusRow
          isRecording={isRecording}
          isUploading={isUploading}
          fmtSec={fmtSec}
          recSeconds={recSeconds}
          stopRecording={stopRecording}
          cancelRecording={cancelRecording}
        />

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="void-input">
        {error && <div className="error-glow" style={{ marginBottom: 8 }}>{error}</div>}
        {replyTo && (
          <div className="reply-banner">
            <div className="reply-banner-content">
              <span className="reply-banner-name">{replyTo.sender}</span>
              <span className="reply-banner-text">
                {replyTo.type === "text" ? replyTo.text : `📎 ${replyTo.type}`}
              </span>
            </div>
            <button className="reply-banner-close" onClick={() => setReplyTo(null)}>✕</button>
          </div>
        )}
        <div className="input-group">
          <input ref={fileRef} type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
            hidden onChange={handlePickFile} />
          <button className="summon-btn-small" type="button"
            onClick={() => fileRef.current?.click()}
            onMouseDown={(e) => e.preventDefault()}
            disabled={isUploading || isRecording} title="Attach">＋
          </button>
          <input ref={inputRef} type="text" className="void-input-field"
            placeholder={
              isUploading   ? "⏳ Uploading…"
              : isRecording ? `🔴 ${fmtSec(recSeconds)}`
              : "Type a message"
            }
            value={message} onChange={handleMessageInput}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
            disabled={isUploading || isRecording} />
          <button className="summon-btn-small" type="button"
            onClick={isRecording ? stopRecording : startRecording}
            onMouseDown={(e) => e.preventDefault()}
            disabled={isUploading}
            title={isRecording ? "Stop" : "Voice"}>
            {isRecording ? "■" : "🎙"}
          </button>
          <button className="summon-btn-small" type="button"
            onClick={sendText} onMouseDown={(e) => e.preventDefault()}
            disabled={isUploading || isRecording || !message.trim()} title="Send">➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
