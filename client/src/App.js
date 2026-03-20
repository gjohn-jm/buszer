import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io("https://buszer.onrender.com", {
  transports: ["websocket", "polling"],
});
setInterval(() => fetch("https://buszer.onrender.com/ping").catch(() => {}), 10 * 60 * 1000);

const CLOUDINARY_CLOUD_NAME    = "daclw4cpg";
const CLOUDINARY_UPLOAD_PRESET = "tiktikboom";
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Voice Player ──────────────────────────────────────────────────────────────
function VoiceNotePlayer({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const BARS = 28;
  const fmt = (s) => (!s || isNaN(s)) ? "0:00" : `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;
  return (
    <div className="voice-player">
      <audio ref={audioRef} src={src}
        onTimeUpdate={() => { const a=audioRef.current; if(a?.duration) setProgress(a.currentTime/a.duration); }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration||0)} />
      <button className="voice-play-btn" onClick={() => {
        const a=audioRef.current; if(!a) return;
        if(playing){a.pause();setPlaying(false);}else{a.play();setPlaying(true);}
      }}>{playing?"⏸":"▶"}</button>
      <div className="voice-waveform" onClick={(e)=>{
        const r=e.currentTarget.getBoundingClientRect();
        if(audioRef.current?.duration) audioRef.current.currentTime=((e.clientX-r.left)/r.width)*audioRef.current.duration;
      }}>
        {[...Array(BARS)].map((_,i)=>{
          const h=40+Math.sin(i*0.8)*30+Math.cos(i*1.3)*20;
          return <div key={i} className={`voice-bar ${i/BARS<progress?"filled":""}`} style={{height:`${Math.max(18,Math.min(80,h))}%`}}/>;
        })}
      </div>
      <span className="voice-duration">{playing?fmt(audioRef.current?.currentTime):fmt(duration)}</span>
    </div>
  );
}

// ── Floating Context Menu ─────────────────────────────────────────────────────
function FloatingMenu({ menu, onClose, onReact, onReply, onCopy }) {
  const ref = useRef(null);
  useEffect(() => {
    const h=(e)=>{ if(ref.current&&!ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mouseup",h); document.addEventListener("touchend",h);
    return ()=>{ document.removeEventListener("mouseup",h); document.removeEventListener("touchend",h); };
  }, [onClose]);
  if (!menu) return null;
  const W=216,H=160,vpW=window.innerWidth,vpH=window.innerHeight;
  const x=menu.isOwn?Math.max(8,menu.rect.right-W):Math.min(menu.rect.left,vpW-W-8);
  const y=vpH-menu.rect.bottom<H+16?Math.max(8,menu.rect.top-H-8):menu.rect.bottom+8;
  return (
    <div ref={ref} className="context-menu-fixed"
      style={{position:"fixed",top:y,left:x,width:W,zIndex:9999}}
      onMouseDown={(e)=>e.stopPropagation()} onMouseUp={(e)=>e.stopPropagation()}
      onTouchStart={(e)=>e.stopPropagation()} onTouchEnd={(e)=>e.stopPropagation()}>
      <div className="context-reactions">
        {REACTION_EMOJIS.map((e)=>(
          <button key={e} className="reaction-option"
            onPointerDown={(ev)=>{ev.stopPropagation();onReact(e);}}>{e}</button>
        ))}
      </div>
      <div className="context-divider"/>
      <button className="context-action" onPointerDown={(e)=>{e.stopPropagation();onReply();}}>↩&nbsp;Reply</button>
      {menu.type==="text"&&<button className="context-action" onPointerDown={(e)=>{e.stopPropagation();onCopy();}}>⎘&nbsp;Copy</button>}
    </div>
  );
}

// ── Status Indicators ─────────────────────────────────────────────────────────
function StatusIndicator({ typingUsers, recordingUsers, uploadingUsers }) {
  return (
    <>
      {typingUsers.map((u)=>(
        <div key={`t-${u}`} className="wa-typing-row">
          <div className="wa-typing-avatar">{u[0]?.toUpperCase()}</div>
          <div className="wa-typing-bubble">
            <span className="wa-typing-name">{u}</span>
            <div className="wa-dot-row"><div className="wa-dot"/><div className="wa-dot"/><div className="wa-dot"/></div>
          </div>
        </div>
      ))}
      {recordingUsers.map((u)=>(
        <div key={`r-${u}`} className="wa-recording-row">
          <div className="wa-typing-avatar" style={{background:"linear-gradient(135deg,#ff5b7e,#ff54cf)"}}>{u[0]?.toUpperCase()}</div>
          <div className="wa-recording-bubble">
            <div className="wa-recording-bars">{[...Array(5)].map((_,i)=><div key={i} className="wa-rec-bar"/>)}</div>
            <span className="wa-recording-label">{u} is recording…</span>
          </div>
        </div>
      ))}
      {uploadingUsers.map((u)=>(
        <div key={`up-${u}`} className="wa-uploading-row">
          <div className="wa-typing-avatar" style={{background:"linear-gradient(135deg,#ffc857,#ff8c42)"}}>{u[0]?.toUpperCase()}</div>
          <div className="wa-uploading-bubble">
            <div className="wa-upload-ring-wrap">
              <svg className="wa-upload-svg" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="10" fill="none" stroke="rgba(255,200,87,0.2)" strokeWidth="2.5"/>
                <circle cx="14" cy="14" r="10" fill="none" stroke="var(--accent-gold)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="16 47"/>
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

// ── Own Status Row ────────────────────────────────────────────────────────────
function OwnStatusRow({ isRecording, isUploading, fmtSec, recSeconds, stopRecording, cancelRecording }) {
  if (!isRecording && !isUploading) return null;
  return (
    <div className="wa-own-row">
      {isRecording && (
        <div className="wa-own-bubble">
          <div className="wa-recording-bars">{[...Array(5)].map((_,i)=><div key={i} className="wa-rec-bar"/>)}</div>
          <span className="wa-own-rec-label">Recording</span>
          <span className="wa-own-timer">{fmtSec(recSeconds)}</span>
          <button className="wa-send-btn" onPointerDown={(e)=>{e.stopPropagation();stopRecording();}}>✓ Send</button>
          <button className="wa-cancel-btn" onPointerDown={(e)=>{e.stopPropagation();cancelRecording();}}>✕</button>
        </div>
      )}
      {isUploading&&!isRecording&&(
        <div className="wa-own-bubble" style={{borderColor:"rgba(255,200,87,0.28)",background:"rgba(255,200,87,0.06)"}}>
          <div className="wa-upload-ring-wrap">
            <svg className="wa-upload-svg" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="10" fill="none" stroke="rgba(255,200,87,0.2)" strokeWidth="2.5"/>
              <circle cx="14" cy="14" r="10" fill="none" stroke="var(--accent-gold)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="16 47"/>
            </svg>
            <span className="wa-upload-arrow">↑</span>
          </div>
          <span className="wa-own-upload-label">Uploading…</span>
        </div>
      )}
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ c, isOwn, username, reactions, onOpenMenu, setReplyTo, inputRef, addReaction, copiedId, setPreviewImg }) {
  const [swipeX,setSwipeX]=useState(0);
  const [swiping,setSwiping]=useState(false);
  const bubbleRef=useRef(null),touchStartX=useRef(null),touchStartY=useRef(null),lpTimer=useRef(null),hasMoved=useRef(false);
  if(c.type==="system") return <div className="system-message"><div className="system-message-inner">{c.text}</div></div>;
  const openMenu=()=>{ if(!bubbleRef.current) return; onOpenMenu({rect:bubbleRef.current.getBoundingClientRect(),isOwn,msgId:c.id,type:c.type,text:c.text,sender:c.sender}); };
  return (
    <div className={`message-container ${isOwn?"own-message":"other-message"}`}
      style={{transform:swiping?`translateX(${swipeX*0.45}px)`:"translateX(0)",transition:swiping?"none":"transform 0.25s cubic-bezier(0.22,1,0.36,1)"}}
      onTouchStart={(e)=>{ touchStartX.current=e.touches[0].clientX; touchStartY.current=e.touches[0].clientY; hasMoved.current=false; lpTimer.current=setTimeout(()=>{ if(!hasMoved.current) openMenu(); },500); }}
      onTouchMove={(e)=>{ const dx=e.touches[0].clientX-touchStartX.current,dy=Math.abs(e.touches[0].clientY-touchStartY.current); if(Math.abs(dx)>6||dy>6){hasMoved.current=true;clearTimeout(lpTimer.current);} if(dy<30&&dx>0&&dx<100){setSwiping(true);setSwipeX(dx);} }}
      onTouchEnd={()=>{ clearTimeout(lpTimer.current); if(swipeX>55){setReplyTo({sender:c.sender,text:c.text,type:c.type});setTimeout(()=>inputRef.current?.focus(),50);} setSwipeX(0);setSwiping(false); }}
      onContextMenu={(e)=>{e.preventDefault();openMenu();}}>
      {swiping&&swipeX>20&&<div className={`swipe-hint ${swipeX>55?"swipe-ready":""}`}>↩</div>}
      <div className="blood-message" ref={bubbleRef}>
        <div className={`msg-sender ${isOwn?"me":"them"}`}>{isOwn?"You":c.sender}</div>
        {c.replyTo&&<div className="reply-preview"><span className="reply-name">{c.replyTo.sender}</span><span className="reply-text">{c.replyTo.type==="text"?c.replyTo.text:`📎 ${c.replyTo.type}`}</span></div>}
        {c.type==="text"&&<p>{c.text}</p>}
        {c.type==="image"&&<img className="chat-media" src={c.url} alt={c.name||"img"} loading="lazy" style={{cursor:"pointer"}} onClick={()=>setPreviewImg(c.url)}/>}
        {c.type==="video"&&<video className="chat-media" src={c.url} controls/>}
        {c.type==="audio"&&<VoiceNotePlayer src={c.url}/>}
        {c.type==="file"&&<a className="chat-file" href={c.url} target="_blank" rel="noreferrer">📎 {c.name||"Open file"}</a>}
        <div className="msg-time">{formatTime(c.createdAt)}</div>
        {copiedId===c.id&&<div className="copied-toast">Copied!</div>}
      </div>
      {Object.values(reactions[c.id]||{}).some((u)=>Array.isArray(u)&&u.length>0)&&(
        <div className="reaction-bar">
          {Object.entries(reactions[c.id]||{}).map(([emoji,users])=>
            Array.isArray(users)&&users.length>0?(
              <button key={emoji} className={`reaction-chip ${users.includes(username)?"mine":""}`}
                onPointerDown={(e)=>{e.stopPropagation();addReaction(c.id,emoji);}}>
                {emoji} {users.length}
              </button>
            ):null
          )}
        </div>
      )}
    </div>
  );
}

// ── Universal Modal (password input) ─────────────────────────────────────────
function PwModal({ title, subtitle, confirmLabel = "Confirm", onConfirm, onCancel, error }) {
  const [pw, setPw] = useState("");
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header-row">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close-btn" onClick={onCancel}>✕</button>
        </div>
        <p className="modal-subtitle">{subtitle}</p>
        <input
          className="abyss-input"
          type="password"
          placeholder="Letters only…"
          value={pw}
          autoFocus
          onChange={(e) => { if (/^[a-zA-Z]*$/.test(e.target.value)) setPw(e.target.value); }}
          onKeyDown={(e) => e.key === "Enter" && pw.trim() && onConfirm(pw)}
        />
        {error && <p className="error-glow" style={{ marginTop: 8 }}>{error}</p>}
        <div className="modal-actions">
          <button className="enter-btn" onClick={() => pw.trim() && onConfirm(pw)}>{confirmLabel}</button>
          <button className="create-portal-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Active Rooms Modal ────────────────────────────────────────────────────────
function ActiveRoomsModal({ rooms, onJoin, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card active-rooms-card" onClick={(e)=>e.stopPropagation()}>
        <div className="modal-header-row">
          <h3 className="modal-title">Active Rooms</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        {rooms.length===0
          ? <p className="modal-empty">No active rooms right now.</p>
          : <ul className="active-rooms-list">
              {rooms.map((r)=>(
                <li key={r.id} className="active-room-item">
                  <div className="active-room-info">
                    <span className="active-room-id">#{r.id}</span>
                    <span className="active-room-members">
                      <span className="blood-pulse" style={{display:"inline-block",marginRight:6}}/>
                      {r.members} online
                    </span>
                  </div>
                  <button className="active-room-join-btn" onClick={()=>onJoin(r.id)}>Join</button>
                </li>
              ))}
            </ul>
        }
      </div>
    </div>
  );
}

// ── BgDecor ───────────────────────────────────────────────────────────────────
const BgDecor = () => (
  <div className="gradient-background">
    <div className="gradient-sphere sphere-1"/><div className="gradient-sphere sphere-2"/>
    <div className="gradient-sphere sphere-3"/><div className="glow"/>
    <div className="grid-overlay"/><div className="noise-overlay"/>
    <div id="particles-container" className="particles-container"/>
  </div>
);

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [username, setUsername]       = useState("");
  const [roomId, setRoomId]           = useState("");
  const [inRoom, setInRoom]           = useState(false);
  const [message, setMessage]         = useState("");
  const [chat, setChat]               = useState([]);
  const [hasUsername, setHasUsername] = useState(false);
  const [error, setError]             = useState("");
  const fileRef                       = useRef(null);
  const inputRef                      = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef  = useRef(null);
  const audioChunksRef    = useRef([]);
  const audioStreamRef    = useRef(null);
  const cancelRecRef      = useRef(false);
  const [roomUsers, setRoomUsers]         = useState([]);
  const [roomCreator, setRoomCreator]     = useState("");
  const [showUsersList, setShowUsersList] = useState(false);
  const messagesEndRef    = useRef(null);
  const typingTimerRef    = useRef(null);
  const [typingUsers, setTypingUsers]       = useState([]);
  const [recordingUsers, setRecordingUsers] = useState([]);
  const [uploadingUsers, setUploadingUsers] = useState([]);
  const [previewImg, setPreviewImg] = useState(null);
  const [replyTo, setReplyTo]       = useState(null);
  const [reactions, setReactions]   = useState({});
  const [copiedId, setCopiedId]     = useState(null);
  const [floatingMenu, setFloatingMenu] = useState(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const recTimerRef     = useRef(null);
  const floatingMenuRef = useRef(null);
  const passwordRef     = useRef("");

  // Modal states — single unified modal system
  // type: null | "join-pw" | "create-pw" | "change-pw" | "active-rooms"
  const [modal, setModal]       = useState(null); // { type, roomId? }
  const [modalError, setModalError] = useState("");
  const [activeRooms, setActiveRooms] = useState([]);

  useEffect(() => { floatingMenuRef.current = floatingMenu; }, [floatingMenu]);

  const inRoomRef    = useRef(false);
  const roomIdRef    = useRef("");
  const usernameRef  = useRef("");
  inRoomRef.current  = inRoom;
  roomIdRef.current  = roomId;
  usernameRef.current = username;

  const closeModal = () => { setModal(null); setModalError(""); };

  // ── Particles ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (inRoom) return;
    const container = document.getElementById("particles-container");
    if (!container) return;
    const timers = [];
    function resetP(p) {
      const x=Math.random()*100, y=Math.random()*100;
      p.style.left=`${x}%`; p.style.top=`${y}%`; p.style.opacity="0";
      return {x,y};
    }
    function animP(p) {
      const pos=resetP(p), dur=Math.random()*10+10, del=Math.random()*5;
      const t1=setTimeout(()=>{
        p.style.transition=`all ${dur}s linear`;
        p.style.opacity=String(Math.random()*0.3+0.1);
        p.style.left=`${pos.x+(Math.random()*20-10)}%`;
        p.style.top=`${pos.y-Math.random()*30}%`;
        const t2=setTimeout(()=>{ if(container.contains(p)) animP(p); },dur*1000);
        timers.push(t2);
      },del*1000);
      timers.push(t1);
    }
    for(let i=0;i<80;i++){
      const p=document.createElement("div"); p.className="particle";
      const s=Math.random()*3+1; p.style.width=`${s}px`; p.style.height=`${s}px`;
      container.appendChild(p); animP(p);
    }
    function spawnTrail(xPct,yPct){
      const p=document.createElement("div"); p.className="particle";
      const s=Math.random()*4+2;
      Object.assign(p.style,{width:`${s}px`,height:`${s}px`,left:`${xPct}%`,top:`${yPct}%`,
        opacity:"0.75",background:"rgba(52,211,153,0.95)",boxShadow:"0 0 8px rgba(52,211,153,0.9)",zIndex:"20"});
      container.appendChild(p);
      setTimeout(()=>{
        Object.assign(p.style,{transition:"all 1.6s ease-out",left:`${xPct+(Math.random()*8-4)}%`,
          top:`${yPct-Math.random()*8}%`,opacity:"0",transform:"scale(0.3)"});
        setTimeout(()=>p.remove(),1600);
      },10);
    }
    function moveSpheres(rx,ry){
      document.querySelectorAll(".gradient-sphere").forEach((s)=>{
        s.style.transition="transform 0.4s ease-out";
        s.style.transform=`translate(${(rx-0.5)*8}px,${(ry-0.5)*8}px)`;
      });
    }
    const resetSpheres=()=>document.querySelectorAll(".gradient-sphere").forEach((s)=>{
      s.style.transition="transform 1.2s ease-out"; s.style.transform="translate(0,0)";
    });
    const onMM=(e)=>{spawnTrail((e.clientX/innerWidth)*100,(e.clientY/innerHeight)*100);moveSpheres(e.clientX/innerWidth,e.clientY/innerHeight);};
    let lastT=0;
    const onTM=(e)=>{ const n=Date.now(); if(n-lastT<40)return; lastT=n; const t=e.touches[0]; spawnTrail((t.clientX/innerWidth)*100,(t.clientY/innerHeight)*100); moveSpheres(t.clientX/innerWidth,t.clientY/innerHeight); };
    const onTS=(e)=>{ const t=e.touches[0]; const x=(t.clientX/innerWidth)*100,y=(t.clientY/innerHeight)*100; for(let i=0;i<6;i++) setTimeout(()=>spawnTrail(x+(Math.random()*6-3),y+(Math.random()*6-3)),i*30); };
    document.addEventListener("mousemove",onMM,{passive:true});
    document.addEventListener("touchmove",onTM,{passive:true});
    document.addEventListener("touchstart",onTS,{passive:true});
    document.addEventListener("mouseup",resetSpheres);
    document.addEventListener("touchend",resetSpheres,{passive:true});
    return ()=>{
      document.removeEventListener("mousemove",onMM);
      document.removeEventListener("touchmove",onTM);
      document.removeEventListener("touchstart",onTS);
      document.removeEventListener("mouseup",resetSpheres);
      document.removeEventListener("touchend",resetSpheres);
      timers.forEach(clearTimeout);
      if(container) container.innerHTML="";
    };
  }, [inRoom]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({behavior:"smooth"}); },
    [chat, typingUsers, recordingUsers, uploadingUsers, isUploading, isRecording]);

  // ── Socket listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const onMsg    = (d) => setChat((p)=>p.some((m)=>m.id===d.id)?p:[...p,{...d,id:d.id||`${Date.now()}-${Math.random()}`}]);
    const onUsers  = (d) => { setRoomUsers(d?.names??[]); if(d?.creator) setRoomCreator(d.creator); };
    const onARooms = (l) => setActiveRooms(l);
    const onRecon  = () => {
      if(inRoomRef.current&&roomIdRef.current&&usernameRef.current)
        socket.emit("join_room",{roomId:roomIdRef.current,password:passwordRef.current,username:usernameRef.current},()=>{});
    };
    const onTyping        = ({username:u})=>setTypingUsers((p)=>u&&!p.includes(u)?[...p,u]:p);
    const onStopTyping    = ({username:u})=>setTypingUsers((p)=>p.filter((x)=>x!==u));
    const onRecording     = ({username:u})=>setRecordingUsers((p)=>u&&!p.includes(u)?[...p,u]:p);
    const onStopRecording = ({username:u})=>setRecordingUsers((p)=>p.filter((x)=>x!==u));
    const onUploading     = ({username:u})=>setUploadingUsers((p)=>u&&!p.includes(u)?[...p,u]:p);
    const onStopUploading = ({username:u})=>setUploadingUsers((p)=>p.filter((x)=>x!==u));
    const onReaction      = ({msgId,reactions:r})=>{ if(!msgId||!r)return; setReactions((p)=>({...p,[msgId]:r})); };
    const onJoined        = ({username:u})=>setChat((p)=>[...p,{id:`sys-${Date.now()}-${Math.random()}`,type:"system",text:`${u} joined the room`}]);

    socket.on("receive_message",     onMsg);
    socket.on("room_users",          onUsers);
    socket.on("active_rooms_update", onARooms);
    socket.on("connect",             onRecon);
    socket.on("user_typing",         onTyping);
    socket.on("user_stop_typing",    onStopTyping);
    socket.on("user_recording",      onRecording);
    socket.on("user_stop_recording", onStopRecording);
    socket.on("user_uploading",      onUploading);
    socket.on("user_stop_uploading", onStopUploading);
    socket.on("reaction_update",     onReaction);
    socket.on("user_joined",         onJoined);
    return ()=>{
      socket.off("receive_message",     onMsg);
      socket.off("room_users",          onUsers);
      socket.off("active_rooms_update", onARooms);
      socket.off("connect",             onRecon);
      socket.off("user_typing",         onTyping);
      socket.off("user_stop_typing",    onStopTyping);
      socket.off("user_recording",      onRecording);
      socket.off("user_stop_recording", onStopRecording);
      socket.off("user_uploading",      onUploading);
      socket.off("user_stop_uploading", onStopUploading);
      socket.off("reaction_update",     onReaction);
      socket.off("user_joined",         onJoined);
    };
  }, []);

  useEffect(() => {
    if (!inRoom && hasUsername) socket.emit("get_active_rooms",(l)=>setActiveRooms(l));
  }, [inRoom, hasUsername]);

  // ── Room actions ────────────────────────────────────────────────────────
  const enterRoom = (rid, pw, creator, uname) => {
    passwordRef.current  = pw;
    roomIdRef.current    = rid;
    usernameRef.current  = uname || username.trim();
    setRoomId(rid);
    setRoomCreator(creator || "");
    setInRoom(true);
    setError("");
    closeModal();
  };

const handleCreateConfirm = (pw) => {
  const uname = username.trim();
  console.log("socket connected:", socket.connected);

  // Timeout to detect if server never responds
  const timeout = setTimeout(() => {
    console.error("SERVER NEVER RESPONDED — old server still running!");
    setModalError("Server not updated yet. Please wait and retry.");
  }, 5000);

  socket.emit("create_and_join", { password: pw.trim(), username: uname }, (res) => {
    clearTimeout(timeout);
    console.log("=== SERVER RESPONSE ===", res);
    if (!res || !res.ok) { setModalError(res?.error || "Failed."); return; }
    passwordRef.current = pw.trim();
    roomIdRef.current   = res.roomId;
    usernameRef.current = uname;
    setRoomId(res.roomId);
    setRoomCreator(res.creator);
    setInRoom(true);
    setModal(null);
    setModalError("");
  });
};



const handleJoinConfirm = (pw) => {
  const rid   = modal.roomId;
  const uname = username.trim();
  if (!uname) { setModalError("No username set."); return; }
  if (!pw.trim()) { setModalError("Password cannot be empty."); return; }

  socket.emit("join_room", { roomId: rid, password: pw.trim(), username: uname }, (res) => {
    if (!res || !res.ok) {
      setModalError(res?.error || "Wrong password or room not found.");
      return;
    }
    // Success — enter the room
    passwordRef.current  = pw.trim();
    roomIdRef.current    = rid;
    usernameRef.current  = uname;
    setRoomId(rid);
    setRoomCreator(res.creator);
    setInRoom(true);
    setError("");
    setModal(null);
    setModalError("");
  });
};




  const handleChangePwConfirm = (pw) => {
    socket.emit("change_password", { roomId: roomIdRef.current, newPassword: pw }, (res) => {
      if (!res.ok) { setModalError(res.error); return; }
      passwordRef.current = pw;
      closeModal();
    });
  };

  const joinRoom = () => {
    const rid = roomId.trim();
    if (!rid) { setError("Enter a Room ID."); return; }
    if (!/^\d+$/.test(rid)) { setError("Room ID must be numbers only."); return; }
    socket.emit("check_room", rid, (exists) => {
      if (!exists) { setError("Room does not exist."); return; }
      setError(""); setModalError("");
      setModal({ type: "join-pw", roomId: rid });
    });
  };

  const leaveRoom = () => {
    socket.emit("typing_stop"); socket.emit("recording_stop"); socket.emit("uploading_stop");
    socket.emit("leave_room", roomIdRef.current);
    clearInterval(recTimerRef.current); clearTimeout(typingTimerRef.current);
    setRecSeconds(0); setInRoom(false); setRoomId(""); setChat([]);
    setRoomUsers([]); setRoomCreator(""); setShowUsersList(false);
    setMessage(""); setError(""); setTypingUsers([]); setRecordingUsers([]); setUploadingUsers([]);
    setReplyTo(null); setReactions({}); setFloatingMenu(null);
    setPreviewImg(null); setIsUploading(false); setIsRecording(false);
    passwordRef.current = "";
  };

  // ── Upload / messaging ──────────────────────────────────────────────────
  const uploadToCloudinary = async (blob) => {
    const form = new FormData();
    form.append("file", blob); form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,{method:"POST",body:form});
    if (!res.ok) throw new Error("Upload failed");
    return (await res.json()).secure_url;
  };

  const emitMsg = (payload) => {
    const msg={...payload,id:`${Date.now()}-${Math.random()}`};
    setChat((p)=>[...p,msg]); socket.emit("send_message",msg);
  };

  const handleMessageInput = (e) => {
    setMessage(e.target.value); socket.emit("typing_start");
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current=setTimeout(()=>socket.emit("typing_stop"),1500);
  };

  const sendText = () => {
    const text=message.trim(); if(!text||isUploading||isRecording) return;
    socket.emit("typing_stop"); clearTimeout(typingTimerRef.current);
    emitMsg({sender:usernameRef.current,room:roomIdRef.current,type:"text",text,createdAt:Date.now(),replyTo:replyTo||null});
    setMessage(""); setReplyTo(null); setTimeout(()=>inputRef.current?.focus(),0);
  };

  const handlePickFile = async (e) => {
    const file=e.target.files?.[0]; e.target.value=""; if(!file) return;
    setIsUploading(true); setError(""); socket.emit("uploading_start");
    try {
      const url=await uploadToCloudinary(file);
      const type=file.type.startsWith("video/")?"video":file.type.startsWith("image/")?"image":file.type.startsWith("audio/")?"audio":"file";
      emitMsg({sender:usernameRef.current,room:roomIdRef.current,type,url,mime:file.type,name:file.name,createdAt:Date.now(),replyTo:replyTo||null});
      setReplyTo(null);
    } catch { setError("Upload failed."); }
    finally { setIsUploading(false); socket.emit("uploading_stop"); }
  };

  const startRecording = async () => {
    if(isRecording) return; setError(""); cancelRecRef.current=false;
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      audioStreamRef.current=stream; audioChunksRef.current=[];
      const rec=new MediaRecorder(stream); mediaRecorderRef.current=rec;
      rec.ondataavailable=(ev)=>{ if(ev.data?.size>0) audioChunksRef.current.push(ev.data); };
      rec.onstop=async()=>{
        clearInterval(recTimerRef.current); setRecSeconds(0); socket.emit("recording_stop");
        if(cancelRecRef.current){ audioStreamRef.current?.getTracks().forEach((t)=>t.stop()); audioStreamRef.current=null; cancelRecRef.current=false; return; }
        try {
          setIsUploading(true); socket.emit("uploading_start");
          const blob=new Blob(audioChunksRef.current,{type:rec.mimeType||"audio/webm"});
          const url=await uploadToCloudinary(blob);
          emitMsg({sender:usernameRef.current,room:roomIdRef.current,type:"audio",url,mime:blob.type,createdAt:Date.now(),replyTo:replyTo||null});
          setReplyTo(null);
        } catch { setError("Voice upload failed."); }
        finally { setIsUploading(false); socket.emit("uploading_stop"); audioStreamRef.current?.getTracks().forEach((t)=>t.stop()); audioStreamRef.current=null; }
      };
      rec.start(); setIsRecording(true); setRecSeconds(0); socket.emit("recording_start");
      recTimerRef.current=setInterval(()=>setRecSeconds((s)=>s+1),1000);
    } catch { setError("Mic permission denied."); }
  };

  const stopRecording = () => {
    if(!isRecording) return; setIsRecording(false); clearInterval(recTimerRef.current);
    cancelRecRef.current=false;
    const r=mediaRecorderRef.current; if(r&&r.state!=="inactive") r.stop();
  };

  const cancelRecording = () => {
    if(!isRecording) return; setIsRecording(false); clearInterval(recTimerRef.current); setRecSeconds(0);
    cancelRecRef.current=true;
    const r=mediaRecorderRef.current; if(r&&r.state!=="inactive") r.stop();
    socket.emit("recording_stop");
  };

  const addReaction = (msgId,emoji) => {
    if(!msgId||!emoji) return;
    socket.emit("add_reaction",{msgId,emoji,username:usernameRef.current}); setFloatingMenu(null);
  };

  const fmtSec = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
  const isCreator = username.trim() === roomCreator;

  // ── Render modal ────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!modal) return null;
    if (modal.type === "active-rooms") {
      return <ActiveRoomsModal rooms={activeRooms}
        onJoin={(rid)=>{ setModalError(""); setModal({type:"join-pw",roomId:rid}); }}
        onClose={closeModal}/>;
    }
    const configs = {
      "join-pw":   { title:`Join Room #${modal.roomId}`,    subtitle:"Enter the room password (letters only)",           label:"Enter Room",      onConfirm: handleJoinConfirm },
      "create-pw": { title:"Set Room Password",              subtitle:"Choose a password for your new room (letters only)",label:"Create & Enter",  onConfirm: handleCreateConfirm },
      "change-pw": { title:"Change Room Password",           subtitle:"New password for your room (letters only)",        label:"Update Password", onConfirm: handleChangePwConfirm },
    };
    const cfg = configs[modal.type];
    return <PwModal title={cfg.title} subtitle={cfg.subtitle} confirmLabel={cfg.label}
      onConfirm={cfg.onConfirm} onCancel={closeModal} error={modalError}/>;
  };

  // ── Page: Enter name ────────────────────────────────────────────────────
  if (!hasUsername) {
    return (
      <div className="horror-container">
        <BgDecor/>
        <div className="center-portal">
          <h2 className="horror-title">ENTER NAME</h2>
          <p className="abyss-subtitle">What should we call you?</p>
          <div className="portal-input-group">
            <input type="text" className="abyss-input" placeholder="Your name..."
              value={username} onChange={(e)=>setUsername(e.target.value)}
              onKeyDown={(e)=>e.key==="Enter"&&username.trim()&&setHasUsername(true)}/>
            <button className="summon-btn" onClick={()=>username.trim()&&setHasUsername(true)}>Continue →</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Page: Join / Create ─────────────────────────────────────────────────
  if (!inRoom) {
    return (
      <div className="horror-container">
        <BgDecor/>
        {renderModal()}
        <div className="center-portal">
          <h2 className="horror-title">Welcome, {username}</h2>
          <p className="abyss-subtitle">Join or create a room</p>
          <div className="portal-input-group">
            <input type="text" className="abyss-input" placeholder="Room ID (numbers only)..."
              value={roomId}
              onChange={(e)=>{ setRoomId(e.target.value); setError(""); }}
              onKeyDown={(e)=>e.key==="Enter"&&joinRoom()}/>
            <button className="enter-btn" onClick={joinRoom}>Join</button>
          </div>
          {error && <p className="error-glow" style={{marginTop:10}}>{error}</p>}
          <div className="blood-divider"/>
          <div className="bottom-btn-row">
            <button className="create-portal-btn"
              onClick={()=>{ setModalError(""); setModal({type:"create-pw"}); }}>
              Create room
            </button>
            <button className="active-rooms-btn"
              onClick={()=>{ socket.emit("get_active_rooms",(l)=>setActiveRooms(l)); setModal({type:"active-rooms"}); }}>
              Active rooms
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Page: Chat room ─────────────────────────────────────────────────────
  return (
    <div className="horror-chat-container"
      onClick={()=>{ setFloatingMenu(null); setShowUsersList(false); }}>

      {renderModal()}

      <FloatingMenu menu={floatingMenu} onClose={()=>setFloatingMenu(null)}
        onReact={(emoji)=>{ const m=floatingMenuRef.current; if(m?.msgId) addReaction(m.msgId,emoji); }}
        onReply={()=>{ const m=floatingMenuRef.current; if(!m) return; setReplyTo({sender:m.sender,text:m.text,type:m.type}); setFloatingMenu(null); setTimeout(()=>inputRef.current?.focus(),50); }}
        onCopy={()=>{ const m=floatingMenuRef.current; if(!m) return; navigator.clipboard?.writeText(m.text).catch(()=>{}); setCopiedId(m.msgId); setTimeout(()=>setCopiedId(null),1500); setFloatingMenu(null); }}
      />

      {previewImg && (
        <div className="img-preview-overlay" onClick={()=>setPreviewImg(null)}>
          <div className="img-preview-modal" onClick={(e)=>e.stopPropagation()}>
            <button className="img-preview-close" onClick={()=>setPreviewImg(null)}>✕</button>
            <img src={previewImg} alt="preview"/>
          </div>
        </div>
      )}

      <div className="chat-header" onClick={(e)=>e.stopPropagation()}>
        <div className="chat-header-left">
          <h1 className="chamber-title">ROOM {roomId}</h1>
          <button className="online-badge" type="button" onClick={()=>setShowUsersList((p)=>!p)}>
            <span className="blood-pulse"/><span>{roomUsers.length} online</span>
          </button>
        </div>
        <div className="chat-header-right">
          {isCreator && (
            <button className="change-pw-btn" type="button" title="Change password"
              onClick={()=>{ setModalError(""); setModal({type:"change-pw"}); }}>🔒</button>
          )}
          <button className="leave-btn" type="button" onClick={leaveRoom}>Exit</button>
        </div>
      </div>

      {showUsersList && (
        <div className="users-popup" onClick={(e)=>e.stopPropagation()}>
          <h3>People in this room</h3>
          {roomUsers.length===0 ? <p>No one online</p>
            : <ul>{roomUsers.map((n,i)=>(
                <li key={`${n}-${i}`}>
                  <span>{n}</span>
                  {n===roomCreator && <span className="admin-badge">👑 admin</span>}
                </li>
              ))}</ul>
          }
        </div>
      )}

      <div className="messages-abyss">
        {chat.length===0&&!isUploading&&!isRecording&&(
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <p>No messages yet</p><span>Say hello!</span>
          </div>
        )}
        {chat.map((c,i)=>(
          <MessageBubble key={c.id||i} c={c} isOwn={c.sender===username}
            username={username} reactions={reactions}
            onOpenMenu={setFloatingMenu} setReplyTo={setReplyTo}
            inputRef={inputRef} addReaction={addReaction}
            copiedId={copiedId} setPreviewImg={setPreviewImg}/>
        ))}
        <StatusIndicator
          typingUsers={typingUsers.filter((u)=>u!==username)}
          recordingUsers={recordingUsers.filter((u)=>u!==username)}
          uploadingUsers={uploadingUsers.filter((u)=>u!==username)}/>
        <OwnStatusRow isRecording={isRecording} isUploading={isUploading}
          fmtSec={fmtSec} recSeconds={recSeconds}
          stopRecording={stopRecording} cancelRecording={cancelRecording}/>
        <div ref={messagesEndRef}/>
      </div>

      <div className="void-input">
        {error&&<div className="error-glow" style={{marginBottom:8}}>{error}</div>}
        {replyTo&&(
          <div className="reply-banner">
            <div className="reply-banner-content">
              <span className="reply-banner-name">{replyTo.sender}</span>
              <span className="reply-banner-text">{replyTo.type==="text"?replyTo.text:`📎 ${replyTo.type}`}</span>
            </div>
            <button className="reply-banner-close" onClick={()=>setReplyTo(null)}>✕</button>
          </div>
        )}
        <div className="input-group">
          <input ref={fileRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip" hidden onChange={handlePickFile}/>
          <button className="summon-btn-small" type="button" onClick={()=>fileRef.current?.click()}
            onMouseDown={(e)=>e.preventDefault()} disabled={isUploading||isRecording} title="Attach">＋</button>
          <input ref={inputRef} type="text" className="void-input-field"
            placeholder={isUploading?"⏳ Uploading…":isRecording?`🔴 ${fmtSec(recSeconds)}`:"Type a message"}
            value={message} onChange={handleMessageInput}
            onKeyDown={(e)=>e.key==="Enter"&&sendText()}
            disabled={isUploading||isRecording}/>
          <button className="summon-btn-small" type="button"
            onClick={isRecording?stopRecording:startRecording}
            onMouseDown={(e)=>e.preventDefault()}
            disabled={isUploading} title={isRecording?"Stop":"Voice"}>
            {isRecording?"■":"🎙"}
          </button>
          <button className="summon-btn-small" type="button" onClick={sendText}
            onMouseDown={(e)=>e.preventDefault()}
            disabled={isUploading||isRecording||!message.trim()} title="Send">➤</button>
        </div>
      </div>
    </div>
  );
}

export default App;
