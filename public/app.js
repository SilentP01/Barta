const authView = document.querySelector("#authView");
const dashboard = document.querySelector("#dashboard");
const loginTab = document.querySelector("#loginTab");
const signupTab = document.querySelector("#signupTab");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const verifyForm = document.querySelector("#verifyForm");
const forgotForm = document.querySelector("#forgotForm");
const resetForm = document.querySelector("#resetForm");
const authNotice = document.querySelector("#authNotice");
const currentUser = document.querySelector("#currentUser");
const logoutBtn = document.querySelector("#logoutBtn");
const profileBtn = document.querySelector("#profileBtn");
const closeProfileBtn = document.querySelector("#closeProfileBtn");
const profilePanel = document.querySelector("#profilePanel");
const profileEmail = document.querySelector("#profileEmail");
const profileNotice = document.querySelector("#profileNotice");
const profileEmailForm = document.querySelector("#profileEmailForm");
const profileEmailVerifyForm = document.querySelector("#profileEmailVerifyForm");
const profilePasswordOtpForm = document.querySelector("#profilePasswordOtpForm");
const profilePasswordForm = document.querySelector("#profilePasswordForm");
const forgotPasswordBtn = document.querySelector("#forgotPasswordBtn");
const backToLoginBtn = document.querySelector("#backToLoginBtn");
const resendVerifyBtn = document.querySelector("#resendVerifyBtn");
const verifyBackBtn = document.querySelector("#verifyBackBtn");
const searchForm = document.querySelector("#searchForm");
const searchResult = document.querySelector("#searchResult");
const userList = document.querySelector("#userList");
const requests = document.querySelector("#requests");
const emptyState = document.querySelector("#emptyState");
const peerView = document.querySelector("#peerView");
const peerName = document.querySelector("#peerName");
const disconnectBtn = document.querySelector("#disconnectBtn");
const messages = document.querySelector("#messages");
const messageForm = document.querySelector("#messageForm");
const messageInput = document.querySelector("#messageInput");
const fileInput = document.querySelector("#fileInput");
const fileBtn = document.querySelector("#fileBtn");
const sendBtn = document.querySelector("#sendBtn");
const peerStatus = document.querySelector("#peerStatus");
const passwordToggles = document.querySelectorAll("[data-toggle-password]");
const startCallBtn = document.querySelector("#startCallBtn");
const startAudioBtn = document.querySelector("#startAudioBtn");
const endCallBtn = document.querySelector("#endCallBtn");
const videoCall = document.querySelector("#videoCall");
const localVideo = document.querySelector("#localVideo");
const remoteVideo = document.querySelector("#remoteVideo");
// New elements
const sidebar = document.querySelector("#sidebar");
const workspace = document.querySelector("#workspace");
const backBtn = document.querySelector("#backBtn");
const fullscreenBtn = document.querySelector("#fullscreenBtn");
const videoFullscreen = document.querySelector("#videoFullscreen");
const remoteVideoFull = document.querySelector("#remoteVideoFull");
const localVideoFull = document.querySelector("#localVideoFull");
const pipCloseBtn = document.querySelector("#pipCloseBtn");
const exitFullscreenBtn = document.querySelector("#exitFullscreenBtn");
const endCallFsBtn = document.querySelector("#endCallFsBtn");
const mobileRequestBanner = document.querySelector("#mobileRequestBanner");

let me = null;
let socket;
let peer;
let channel;
let currentPeer;
let incomingFiles = new Map();
let pendingSignals = [];
let pendingIceCandidates = [];
let verificationEmail = "";
let resetEmail = "";
let pendingProfileEmail = "";
let localStream;
let remoteStream;
let activeObjectUrls = [];

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:global.stun.twilio.com:3478" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

function setNotice(text = "") {
  authNotice.textContent = text;
}

function setProfileNotice(text = "") {
  profileNotice.textContent = text;
}

function postJson(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  });
}

function setFormLoading(form, isLoading, loadingText) {
  const button = form.querySelector('button[type="submit"]');
  for (const element of form.elements) element.disabled = isLoading;
  if (button) button.textContent = isLoading ? loadingText : button.dataset.defaultText;
}

function sendSocket(type, payload = {}) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, ...payload }));
}

function showApp() {
  authView.classList.add("hidden");
  dashboard.classList.remove("hidden");
  currentUser.textContent = `@${me.username}`;
  showSidebar();
  connectSocket();
}

function showSidebar() {
  sidebar.classList.remove("slide-out");
  workspace.classList.remove("slide-in");
}

function showWorkspace() {
  sidebar.classList.add("slide-out");
  workspace.classList.add("slide-in");
}

function showAuth() {
  authView.classList.remove("hidden");
  dashboard.classList.add("hidden");
}

function switchAuth(mode) {
  const login = mode === "login";
  loginTab.classList.toggle("active", login);
  signupTab.classList.toggle("active", mode === "signup");
  loginForm.classList.toggle("hidden", mode !== "login");
  signupForm.classList.toggle("hidden", mode !== "signup");
  verifyForm.classList.toggle("hidden", mode !== "verify");
  forgotForm.classList.toggle("hidden", mode !== "forgot");
  resetForm.classList.toggle("hidden", mode !== "reset");
  setNotice();
}

function renderUsers(users = []) {
  userList.innerHTML = "";
  const visibleUsers = users.filter((user) => user.id !== me.id);

  if (!visibleUsers.length) {
    userList.innerHTML = '<p class="muted">No users online</p>';
    return;
  }

  for (const user of visibleUsers) {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <div>
        <strong>@${escapeHtml(user.username)}</strong>
        <div class="status ${user.status}">${user.status}</div>
      </div>
    `;
    const button = document.createElement("button");
    button.className = "secondary";
    button.textContent = "Request";
    button.disabled = user.status !== "online" || Boolean(currentPeer);
    button.addEventListener("click", () => sendSocket("request", { to: user.id }));
    row.appendChild(button);
    userList.appendChild(row);
  }
}

function renderRequest(from) {
  requests.innerHTML = "";
  const row = document.createElement("div");
  row.className = "request-row";
  row.innerHTML = `<strong>@${escapeHtml(from.username)}</strong>`;

  const actions = document.createElement("div");
  actions.className = "request-actions";

  const reject = document.createElement("button");
  reject.className = "ghost";
  reject.textContent = "Reject";
  reject.addEventListener("click", () => {
    sendSocket("respond-request", { accept: false });
    requests.innerHTML = "";
    mobileRequestBanner.classList.add("hidden");
  });

  const accept = document.createElement("button");
  accept.className = "primary";
  accept.textContent = "Accept";
  accept.addEventListener("click", () => {
    sendSocket("respond-request", { accept: true });
    requests.innerHTML = "";
    mobileRequestBanner.classList.add("hidden");
  });

  actions.append(reject, accept);
  row.appendChild(actions);
  requests.appendChild(row);

  // On mobile: show a banner in the sidebar so user knows a request came
  if (window.innerWidth <= 768) {
    mobileRequestBanner.textContent = `📲 @${escapeHtml(from.username)} wants to connect!`;
    mobileRequestBanner.classList.remove("hidden");
    showWorkspace(); // slide to workspace to accept/reject
  }
}

function showPeer(peerUser) {
  currentPeer = peerUser;
  peerName.textContent = `@${peerUser.username}`;
  setComposerReady(false);
  emptyState.classList.add("hidden");
  requests.innerHTML = "";
  searchResult.textContent = "";
  peerView.classList.remove("hidden");
  messages.innerHTML = "";
  addSystemMessage("Connecting securely");
  showWorkspace(); // slide to chat on mobile
}

function resetPeer(note = "Disconnected") {
  stopVideoCall(false);
  if (channel) channel.close();
  if (peer) peer.close();
  channel = null;
  peer = null;
  currentPeer = null;
  pendingSignals = [];
  pendingIceCandidates = [];
  incomingFiles.clear();
  for (const url of activeObjectUrls) URL.revokeObjectURL(url);
  activeObjectUrls = [];
  if (messages) messages.innerHTML = "";
  setComposerReady(false);
  peerView.classList.add("hidden");
  emptyState.classList.remove("hidden");
  addSystemMessage(note);
  showSidebar(); // on mobile, slide back to user list
}

function setComposerReady(isReady) {
  messageInput.disabled = !isReady;
  fileBtn.disabled = !isReady;
  sendBtn.disabled = !isReady;
  startCallBtn.disabled = !isReady;
  startAudioBtn.disabled = !isReady;
  messageInput.placeholder = isReady ? "Message" : "Waiting for peer connection";
  peerStatus.textContent = isReady ? "Connected with" : "Connecting";
}

function connectSocket() {
  if (socket) socket.close();

  socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`);

  socket.addEventListener("message", async (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "presence") renderUsers(message.users);
    if (message.type === "incoming-request") renderRequest(message.from);
    if (message.type === "request-sent") searchResult.textContent = `Request sent to @${message.to.username}`;
    if (message.type === "request-rejected") searchResult.textContent = `@${message.by.username} rejected the request`;
    if (message.type === "error-message") searchResult.textContent = message.error;

    if (message.type === "request-accepted" || message.type === "connected") {
      showPeer(message.peer);
      await startPeer(Boolean(message.initiator));
    }

    if (message.type === "signal") handleSignal(message.signal);
    if (message.type === "peer-disconnected") resetPeer();
  });

  socket.addEventListener("close", () => {
    renderUsers([]);
    if (currentPeer) resetPeer("Connection closed");
  });
}

async function startPeer(isInitiator) {
  const queuedBeforeStart = pendingSignals;
  pendingSignals = [];
  peer = new RTCPeerConnection(rtcConfig);

  peer.onicecandidate = (event) => {
    if (event.candidate) sendSocket("signal", { signal: { candidate: event.candidate } });
  };

  peer.ontrack = (event) => {
    if (!remoteStream) {
      remoteStream = new MediaStream();
      remoteVideo.srcObject = remoteStream;
    }
    remoteStream.addTrack(event.track);
    // Only show video UI if there is actually a video track
    const hasVideo = remoteStream.getVideoTracks().length > 0;
    if (hasVideo) videoCall.classList.remove("hidden");
    event.track.addEventListener("ended", () => {
      if (remoteStream) {
        remoteStream.removeTrack(event.track);
        const stillHasVideo = remoteStream.getVideoTracks().length > 0;
        if (!stillHasVideo && !localStream) videoCall.classList.add("hidden");
      }
    });
  };

  peer.onconnectionstatechange = () => {
    if (["failed", "closed", "disconnected"].includes(peer.connectionState) && currentPeer) {
      sendSocket("disconnect-peer");
      resetPeer();
    }
  };

  try {
    if (isInitiator) {
      channel = peer.createDataChannel("private-share", { ordered: true });
      setupChannel();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSocket("signal", { signal: { description: peer.localDescription } });
    } else {
      peer.ondatachannel = (event) => {
        channel = event.channel;
        setupChannel();
      };
    }
  } catch (err) {
    addSystemMessage("WebRTC Error: " + err.message);
  }

  const queued = queuedBeforeStart.concat(pendingSignals);
  pendingSignals = [];
  for (const signal of queued) await handleSignal(signal);
}

async function handleSignal(signal) {
  if (!peer) {
    pendingSignals.push(signal);
    return;
  }

  if (signal.description) {
    await peer.setRemoteDescription(signal.description);
    if (signal.description.type === "offer") {
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendSocket("signal", { signal: { description: peer.localDescription } });
    }
    const candidates = pendingIceCandidates;
    pendingIceCandidates = [];
    for (const candidate of candidates) await peer.addIceCandidate(candidate).catch(() => {});
  }

  if (signal.candidate) {
    if (!peer.remoteDescription) {
      pendingIceCandidates.push(signal.candidate);
      return;
    }
    await peer.addIceCandidate(signal.candidate).catch(() => {});
  }
}

async function renegotiatePeer() {
  if (!peer || peer.signalingState !== "stable") return;
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  sendSocket("signal", { signal: { description: peer.localDescription } });
}

function setupChannel() {
  channel.binaryType = "arraybuffer";
  channel.onopen = () => {
    setComposerReady(true);
    addSystemMessage("Ready");
  };
  channel.onmessage = (event) => receiveData(event.data);
  channel.onclose = () => {
    setComposerReady(false);
    if (currentPeer) resetPeer();
  };
}

async function startCall(withVideo = true) {
  if (!peer || !currentPeer || localStream) return;
  try {
    localStream = await navigator.mediaDevices.getUserMedia(
      withVideo ? { video: true, audio: true } : { video: false, audio: true }
    );
    if (withVideo) {
      localVideo.srcObject = localStream;
      remoteVideo.srcObject = remoteStream || null;
      videoCall.classList.remove("hidden");
      fullscreenBtn.classList.remove("hidden");
      makePipDraggable();
    }
    startCallBtn.classList.add("hidden");
    startAudioBtn.classList.add("hidden");
    endCallBtn.classList.remove("hidden");
    for (const track of localStream.getTracks()) peer.addTrack(track, localStream);
    const kind = withVideo ? "video-start" : "audio-start";
    if (channel?.readyState === "open") sendData(JSON.stringify({ kind }));
    await renegotiatePeer();
  } catch (error) {
    addSystemMessage("Permission denied: " + error.message);
  }
}

function startVideoCall() { return startCall(true); }
function startAudioCall() { return startCall(false); }

async function stopVideoCall(renegotiate = true) {
  if (!localStream && !remoteStream) return;

  exitFullscreen();

  if (localStream) {
    for (const track of localStream.getTracks()) {
      const sender = peer?.getSenders().find((item) => item.track === track);
      if (sender) peer.removeTrack(sender);
      track.stop();
    }
  }

  localStream = null;
  localVideo.srcObject = null;
  localVideoFull.srcObject = null;
  if (!renegotiate && remoteStream) {
    for (const track of remoteStream.getTracks()) track.stop();
    remoteStream = null;
    remoteVideo.srcObject = null;
    remoteVideoFull.srcObject = null;
  }
  startCallBtn.classList.remove("hidden");
  startAudioBtn.classList.remove("hidden");
  endCallBtn.classList.add("hidden");
  fullscreenBtn.classList.add("hidden");

  if (!remoteStream?.getVideoTracks().length) videoCall.classList.add("hidden");
  if (channel?.readyState === "open") sendData(JSON.stringify({ kind: "call-ended" }));
  if (renegotiate) await renegotiatePeer();
}

function enterFullscreen() {
  // mirror streams into fullscreen overlay
  remoteVideoFull.srcObject = remoteStream || null;
  localVideoFull.srcObject = localStream || null;
  videoCall.classList.add("hidden");
  videoFullscreen.classList.remove("hidden");
}

function exitFullscreen() {
  videoFullscreen.classList.add("hidden");
  remoteVideoFull.srcObject = null;
  localVideoFull.srcObject = null;
  if (localStream || remoteStream) videoCall.classList.remove("hidden");
}

function makePipDraggable() {
  let startX, startY, origLeft, origBottom;
  function onPointerDown(e) {
    if (e.target === pipCloseBtn) return;
    startX = e.clientX; startY = e.clientY;
    const rect = videoCall.getBoundingClientRect();
    origLeft = rect.left;
    origBottom = window.innerHeight - rect.bottom;
    videoCall.style.cursor = "grabbing";
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }
  function onPointerMove(e) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newLeft = Math.max(0, Math.min(window.innerWidth - videoCall.offsetWidth, origLeft + dx));
    const newBottom = Math.max(0, Math.min(window.innerHeight - videoCall.offsetHeight, origBottom - dy));
    videoCall.style.left = newLeft + "px";
    videoCall.style.right = "auto";
    videoCall.style.bottom = newBottom + "px";
  }
  function onPointerUp() {
    videoCall.style.cursor = "grab";
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  }
  videoCall.addEventListener("pointerdown", onPointerDown);
}

function sendData(data) {
  if (!channel || channel.readyState !== "open") {
    addSystemMessage("Peer connection is not ready");
    return false;
  }
  channel.send(data);
  return true;
}

function addMessage(text, mine = false) {
  const item = document.createElement("div");
  item.className = `message ${mine ? "mine" : ""}`;
  item.textContent = text;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function addSystemMessage(text) {
  if (!messages) return;
  const item = document.createElement("div");
  item.className = "message system";
  item.textContent = text;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function addFileMessage(file, url, mine = false) {
  const item = document.createElement("div");
  item.className = `message ${mine ? "mine" : ""}`;

  if (file.type.startsWith("image/")) {
    const image = document.createElement("img");
    image.src = url;
    image.alt = file.name;
    item.appendChild(image);
  }

  if (file.type.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    item.appendChild(video);
  }

  const name = document.createElement("div");
  name.className = "file-name";
  name.textContent = file.name;

  const save = document.createElement("a");
  save.className = "secondary save-link";
  save.href = url;
  save.download = file.name;
  save.textContent = "Save";

  item.append(name, save);
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function receiveData(data) {
  if (typeof data === "string") {
    const packet = JSON.parse(data);
    if (packet.kind === "message") addMessage(packet.text);
    if (packet.kind === "video-start") addSystemMessage("📹 Video call started");
    if (packet.kind === "audio-start") addSystemMessage("🎙️ Voice call started");
    if (packet.kind === "call-ended" || packet.kind === "video-ended") addSystemMessage("Call ended");
    if (packet.kind === "file-start") incomingFiles.set(packet.id, { meta: packet, chunks: [] });
    if (packet.kind === "file-end") {
      const file = incomingFiles.get(packet.id);
      if (!file) return;
      const blob = new Blob(file.chunks, { type: file.meta.type });
      const url = URL.createObjectURL(blob);
      activeObjectUrls.push(url);
      addFileMessage({ name: file.meta.name, type: file.meta.type }, url);
      incomingFiles.delete(packet.id);
    }
    return;
  }

  const idLength = new DataView(data, 0, 2).getUint16(0);
  const id = new TextDecoder().decode(data.slice(2, 2 + idLength));
  const file = incomingFiles.get(id);
  if (file) file.chunks.push(data.slice(2 + idLength));
}

async function sendFile(file) {
  const id = crypto.randomUUID();
  const chunkSize = 16 * 1024;
  const idBytes = new TextEncoder().encode(id);

  if (!sendData(JSON.stringify({ kind: "file-start", id, name: file.name, type: file.type || "application/octet-stream", size: file.size }))) return;

  for (let offset = 0; offset < file.size; offset += chunkSize) {
    while (channel.bufferedAmount > 1024 * 1024) await new Promise((resolve) => setTimeout(resolve, 40));
    const chunk = await file.slice(offset, offset + chunkSize).arrayBuffer();
    const packet = new Uint8Array(2 + idBytes.length + chunk.byteLength);
    new DataView(packet.buffer).setUint16(0, idBytes.length);
    packet.set(idBytes, 2);
    packet.set(new Uint8Array(chunk), 2 + idBytes.length);
    sendData(packet.buffer);
  }

  sendData(JSON.stringify({ kind: "file-end", id }));
  const url = URL.createObjectURL(file);
  activeObjectUrls.push(url);
  addFileMessage(file, url, true);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

loginTab.addEventListener("click", () => switchAuth("login"));
signupTab.addEventListener("click", () => switchAuth("signup"));

for (const toggle of passwordToggles) {
  toggle.addEventListener("click", () => {
    const input = toggle.closest(".password-field").querySelector("input");
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    toggle.textContent = isPassword ? "Hide" : "Show";
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setNotice();
  const form = new FormData(loginForm);
  setFormLoading(loginForm, true, "Signing in...");
  try {
    const data = await postJson("/api/login", {
      identifier: form.get("identifier"),
      password: form.get("password")
    });
    me = data.user;
    showApp();
  } catch (error) {
    setNotice(error.message);
  } finally {
    setFormLoading(loginForm, false);
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setNotice();
  const form = new FormData(signupForm);
  setFormLoading(signupForm, true, "Creating account...");
  try {
    const data = await postJson("/api/signup", {
      email: form.get("email"),
      username: form.get("username"),
      password: form.get("password"),
      passwordConfirm: form.get("passwordConfirm")
    });
    verificationEmail = String(form.get("email"));
    verifyForm.elements.email.value = verificationEmail;
    switchAuth("verify");
    setNotice("Verification link sent to your email.");
  } catch (error) {
    setNotice(error.message);
  } finally {
    setFormLoading(signupForm, false);
  }
});

verifyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
});

resendVerifyBtn.addEventListener("click", async () => {
  const email = verifyForm.elements.email.value || verificationEmail;
  setNotice();
  try {
    await postJson("/api/resend-verification-link", { email });
    setNotice("Magic link sent again.");
  } catch (error) {
    setNotice(error.message);
  }
});

forgotPasswordBtn.addEventListener("click", () => switchAuth("forgot"));
backToLoginBtn.addEventListener("click", () => switchAuth("login"));
verifyBackBtn.addEventListener("click", () => switchAuth("login"));

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setNotice();
  const form = new FormData(forgotForm);
  resetEmail = String(form.get("email"));
  setFormLoading(forgotForm, true, "Sending link...");
  try {
    await postJson("/api/forgot-password/send-link", { email: resetEmail });
    switchAuth("login");
    setNotice("Password reset link sent to your email.");
  } catch (error) {
    setNotice(error.message);
  } finally {
    setFormLoading(forgotForm, false);
  }
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setNotice();
  const form = new FormData(resetForm);
  setFormLoading(resetForm, true, "Resetting...");
  try {
    await postJson("/api/forgot-password/reset", {
      token: form.get("token"),
      password: form.get("password"),
      passwordConfirm: form.get("passwordConfirm")
    });
    switchAuth("login");
    setNotice("Password updated. Please login.");
  } catch (error) {
    setNotice(error.message);
  } finally {
    setFormLoading(resetForm, false);
  }
});

logoutBtn.addEventListener("click", async () => {
  if (socket) socket.close();
  await postJson("/api/logout", {}).catch(() => {});
  me = null;
  showAuth();
});

profileBtn.addEventListener("click", async () => {
  profilePanel.classList.remove("hidden");
  setProfileNotice();
  try {
    const response = await fetch("/api/profile");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    profileEmail.textContent = data.user.email;
  } catch (error) {
    setProfileNotice(error.message);
  }
});

closeProfileBtn.addEventListener("click", () => profilePanel.classList.add("hidden"));

profileEmailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setProfileNotice();
  const form = new FormData(profileEmailForm);
  pendingProfileEmail = String(form.get("email"));
  setFormLoading(profileEmailForm, true, "Sending link...");
  try {
    await postJson("/api/profile/email/send-link", { email: pendingProfileEmail });
    setProfileNotice("Magic link sent to the new email.");
  } catch (error) {
    setProfileNotice(error.message);
  } finally {
    setFormLoading(profileEmailForm, false);
  }
});

profileEmailVerifyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setProfileNotice();
  const form = new FormData(profileEmailVerifyForm);
  setFormLoading(profileEmailVerifyForm, true, "Verifying...");
  try {
    await postJson("/api/profile/email/verify", {
      email: pendingProfileEmail,
      code: form.get("code")
    });
    profileEmail.textContent = pendingProfileEmail;
    profileEmailForm.reset();
    profileEmailVerifyForm.reset();
    profileEmailVerifyForm.classList.add("hidden");
    setProfileNotice("Email updated.");
  } catch (error) {
    setProfileNotice(error.message);
  } finally {
    setFormLoading(profileEmailVerifyForm, false);
  }
});

profilePasswordOtpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setProfileNotice();
  setFormLoading(profilePasswordOtpForm, true, "Sending link...");
  try {
    await postJson("/api/profile/password/send-link", {});
    setProfileNotice("Password reset link sent to your email.");
  } catch (error) {
    setProfileNotice(error.message);
  } finally {
    setFormLoading(profilePasswordOtpForm, false);
  }
});

profilePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setProfileNotice();
  const form = new FormData(profilePasswordForm);
  setFormLoading(profilePasswordForm, true, "Updating...");
  try {
    await postJson("/api/profile/password", {
      code: form.get("code"),
      password: form.get("password"),
      passwordConfirm: form.get("passwordConfirm")
    });
    profilePasswordForm.reset();
    profilePasswordForm.classList.add("hidden");
    setProfileNotice("Password updated.");
  } catch (error) {
    setProfileNotice(error.message);
  } finally {
    setFormLoading(profilePasswordForm, false);
  }
});

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = new FormData(searchForm).get("username");
  searchResult.textContent = "";
  try {
    const response = await fetch(`/api/search?username=${encodeURIComponent(username)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const user = data.user;
    searchResult.innerHTML = `<div class="user-row"><div><strong>@${escapeHtml(user.username)}</strong><div class="status ${user.status}">${user.status}</div></div></div>`;
    if (user.id !== me.id && user.status === "online" && !currentPeer) {
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = "Request";
      button.addEventListener("click", () => sendSocket("request", { to: user.id }));
      searchResult.querySelector(".user-row").appendChild(button);
    }
  } catch (error) {
    searchResult.textContent = error.message;
  }
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  if (sendData(JSON.stringify({ kind: "message", text }))) {
    addMessage(text, true);
    messageInput.value = "";
  }
});

fileBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) sendFile(file);
  fileInput.value = "";
});

disconnectBtn.addEventListener("click", () => {
  sendSocket("disconnect-peer");
  resetPeer();
});

startCallBtn.addEventListener("click", startVideoCall);
startAudioBtn.addEventListener("click", startAudioCall);
endCallBtn.addEventListener("click", () => stopVideoCall(true));
fullscreenBtn.addEventListener("click", enterFullscreen);
exitFullscreenBtn.addEventListener("click", exitFullscreen);
endCallFsBtn.addEventListener("click", () => { exitFullscreen(); stopVideoCall(true); });
pipCloseBtn.addEventListener("click", () => stopVideoCall(true));

// Back button: return to sidebar on mobile
backBtn.addEventListener("click", showSidebar);

const params = new URLSearchParams(location.search);

if (params.get("reset") === "1" && params.get("token")) {
  showAuth();
  resetForm.elements.token.value = params.get("token");
  switchAuth("reset");
  setNotice("Create a new password.");
  history.replaceState({}, "", "/");
} else {
  fetch("/api/session")
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Not authenticated.");
      me = data.user;
      showApp();
      if (params.get("verified") === "1") setNotice("Email verified. You are signed in.");
      if (params.get("profile") === "email-updated") setProfileNotice("Email updated.");
      if (params.toString()) history.replaceState({}, "", "/");
    })
    .catch(() => {
      showAuth();
      if (params.toString()) history.replaceState({}, "", "/");
    });
}
