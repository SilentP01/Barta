const landingView = document.querySelector("#landingView");
const landingLoginBtn = document.querySelector("#landingLoginBtn");
const landingSignupBtn = document.querySelector("#landingSignupBtn");
const getStartedBtn = document.querySelector("#getStartedBtn");
const backToHomeBtn = document.querySelector("#backToHomeBtn");
const authView = document.querySelector("#authView");
const privacyOverlay = document.querySelector("#privacyOverlay");
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

const profilePasswordOtpForm = document.querySelector("#profilePasswordOtpForm");

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
const muteFsBtn = document.querySelector("#muteFsBtn");
const pauseFsBtn = document.querySelector("#pauseFsBtn");
const callRequestOverlay = document.querySelector("#callRequestOverlay");
const callRequestText = document.querySelector("#callRequestText");
const callRequestIcon = document.querySelector("#callRequestIcon");
const callAcceptBtn = document.querySelector("#callAcceptBtn");
const callRejectBtn = document.querySelector("#callRejectBtn");
const mobileRequestBanner = document.querySelector("#mobileRequestBanner");
const themeToggle = document.querySelector("#themeToggle");
const themeIcon = document.querySelector("#themeIcon");
const refreshBtn = document.querySelector("#refreshBtn");

// ─── Media Viewer refs ──────────────────────────────────
const mediaViewer = document.querySelector("#mediaViewer");
const mvBackdrop  = document.querySelector("#mvBackdrop");
const mvTitle     = document.querySelector("#mvTitle");
const mvSave      = document.querySelector("#mvSave");
const mvClose     = document.querySelector("#mvClose");
const mvBody      = document.querySelector("#mvBody");
const mvZoomBar   = document.querySelector("#mvZoomBar");
const mvZoomIn    = document.querySelector("#mvZoomIn");
const mvZoomOut   = document.querySelector("#mvZoomOut");
const mvZoomFit   = document.querySelector("#mvZoomFit");
const mvZoomPct   = document.querySelector("#mvZoomPct");

const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isNativeBarta = navigator.userAgent.includes("BartaNativeAndroid");

if (isNativeBarta) {
  document.documentElement.classList.add("native-app");
}

function showPrivacyWarningToast() {
  const existing = document.querySelector(".privacy-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "privacy-toast";
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">⚠️</span>
      <div class="toast-body">
        <strong>Privacy Warning</strong>
        <p>Standard mobile browsers allow screenshot and screen recording capture. To ensure complete privacy and secure screenshot blocking, please install our secure Android App.</p>
      </div>
    </div>
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

window.onPipModeChanged = function(isInPip) {
  if (isInPip) {
    document.documentElement.classList.add("pip-active");
  } else {
    document.documentElement.classList.remove("pip-active");
  }
};

let pendingCallKind = null; // 'video-request' | 'audio-request' — set on receiver side

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
let makingOffer = false;
let ignoreOffer = false;
let isPolite = false;

const rtcConfig = {
  iceServers: [
    // Google STUN — 5 servers for redundancy
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    // Google STUN by IP — bypasses DNS, faster on slow networks
    { urls: "stun:74.125.143.127:19302" },
    { urls: "stun:108.177.15.127:19302" },
    // Cloudflare STUN
    { urls: "stun:stun.cloudflare.com:3478" },
    // Twilio STUN
    { urls: "stun:global.stun.twilio.com:3478" },
    // Additional STUN fallbacks
    { urls: "stun:stun.ekiga.net" },
    { urls: "stun:stun.freeswitch.org" },
    // TURN (openrelay — free shared relay, primary)
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443"
      ],
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    // TURN (freestun — backup free relay)
    {
      urls: [
        "turn:freestun.net:3478",
        "turn:freestun.net:3479"
      ],
      username: "free",
      credential: "free"
    },
    {
      urls: "turns:freestun.net:5349",
      username: "free",
      credential: "free"
    }
  ],
  // Pre-gathers ICE candidates before connection starts = faster handshake
  // NOTE: bundlePolicy and rtcpMuxPolicy intentionally omitted — defaults are
  // more universally compatible across browsers and network configurations
  iceCandidatePoolSize: 10
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
  landingView.classList.add("hidden");
  authView.classList.add("hidden");
  dashboard.classList.remove("hidden");
  currentUser.textContent = `@${me.username}`;
  showSidebar();
  connectSocket();
  if (location.pathname !== "/") history.pushState({}, "", "/");
}

function showLanding() {
  if (isNativeBarta) {
    showAuth();
    switchAuth("login");
    return;
  }
  landingView.classList.remove("hidden");
  authView.classList.add("hidden");
  dashboard.classList.add("hidden");
  if (location.pathname !== "/home") history.pushState({}, "", "/home");
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
  landingView.classList.add("hidden");
  authView.classList.remove("hidden");
  dashboard.classList.add("hidden");
  if (location.pathname !== "/check-in") history.pushState({}, "", "/check-in");
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
    if (user.status === "online" && !currentPeer) {
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = "Request";
      button.addEventListener("click", () => {
        if (isMobileDevice && !isNativeBarta) {
          showPrivacyWarningToast();
        }
        sendSocket("request", { to: user.id });
      });
      row.appendChild(button);
    }
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
    if (isMobileDevice && !isNativeBarta) {
      showPrivacyWarningToast();
    }
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
  if (localStream || remoteStream) _cleanupCallUI();
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
  makingOffer = false;
  ignoreOffer = false;
  isPolite = false;
  pendingCallKind = null;
  hideCallRequestPopup();
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
  peerStatus.textContent = isReady ? "CONNECTED WITH" : "CONNECTING";
}

function connectSocket() {
  if (socket) socket.close();

  socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`);

  socket.addEventListener("open", () => {
    sendSocket("refresh-presence");
  });

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
  isPolite = !isInitiator;
  const queuedBeforeStart = pendingSignals;
  pendingSignals = [];
  peer = new RTCPeerConnection(rtcConfig);

  peer.onicecandidate = (event) => {
    if (event.candidate) sendSocket("signal", { signal: { candidate: event.candidate } });
  };

  peer.onnegotiationneeded = async () => {
    try {
      if (peer.signalingState !== "stable") return; // avoid collision before even creating offer
      makingOffer = true;
      const offer = await peer.createOffer();
      if (peer.signalingState !== "stable") return; // re-check after async createOffer
      await peer.setLocalDescription(offer);
      sendSocket("signal", { signal: { description: peer.localDescription } });
    } catch (err) {
      console.error(err);
    } finally {
      makingOffer = false;
    }
  };

  peer.ontrack = (event) => {
    if (!remoteStream) {
      remoteStream = new MediaStream();
      remoteVideo.srcObject = remoteStream;
    }
    remoteStream.addTrack(event.track);
    remoteVideo.play().catch(() => {});
    if (remoteVideoFull) remoteVideoFull.play().catch(() => {});
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

  let disconnectTimer = null;
  let iceRestartTimer = null;
  let wasConnected   = false; // true only after first successful "connected" state
  let isRecovering   = false; // prevents duplicate recovery attempts + messages

  peer.onconnectionstatechange = () => {
    const state = peer.connectionState;

    if (state === "connected") {
      wasConnected = true;
      isRecovering = false;
      // Clear all recovery timers — connection is healthy
      if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
      if (iceRestartTimer) { clearTimeout(iceRestartTimer); iceRestartTimer = null; }
      // Show "restored" message only if we were recovering
      const lastMsg = messages?.lastElementChild;
      if (lastMsg?.textContent?.includes("reconnecting") || lastMsg?.textContent?.includes("recovery")) {
        addSystemMessage("✅ Connection restored");
      }

    } else if (state === "disconnected") {
      // Only attempt recovery if this peer was ever successfully connected
      // (avoids triggering recovery during the initial handshake)
      if (!wasConnected || isRecovering) return;

      // Wait 5 seconds — then try ICE restart (renegotiate network path)
      disconnectTimer = setTimeout(async () => {
        if (!peer || !currentPeer) return;
        if (peer.connectionState === "connected") return; // recovered on its own
        if (isRecovering) return;
        isRecovering = true;
        try {
          addSystemMessage("⚠️ Weak connection — reconnecting…");
          peer.restartIce();
          // Give 30 more seconds to recover — total ~35 seconds from disconnect
          iceRestartTimer = setTimeout(() => {
            if (peer && currentPeer &&
                (peer.connectionState === "disconnected" || peer.connectionState === "failed")) {
              sendSocket("disconnect-peer");
              resetPeer("Connection lost");
            }
          }, 30000);
        } catch (e) {
          sendSocket("disconnect-peer");
          resetPeer("Connection lost");
        }
      }, 5000);

    } else if (state === "failed") {
      if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }

      if (!wasConnected) {
        // Initial handshake failed — ICE restart is pointless here, just reset cleanly
        if (currentPeer) { sendSocket("disconnect-peer"); resetPeer("Failed to connect"); }
        return;
      }

      // Already handling recovery (e.g. from "disconnected" path) — don't double up
      if (isRecovering) return;
      isRecovering = true;

      try {
        addSystemMessage("⚠️ Connection lost — attempting recovery…");
        peer.restartIce();
        // 30 seconds to recover before giving up
        iceRestartTimer = setTimeout(() => {
          if (peer && peer.connectionState === "failed" && currentPeer) {
            sendSocket("disconnect-peer");
            resetPeer("Connection failed");
          }
        }, 30000);
      } catch (e) {
        if (currentPeer) { sendSocket("disconnect-peer"); resetPeer("Connection failed"); }
      }

    } else if (state === "closed") {
      if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
      if (iceRestartTimer) { clearTimeout(iceRestartTimer); iceRestartTimer = null; }
      wasConnected = false;
      isRecovering = false;
    }
  };

  try {
    if (isInitiator) {
      channel = peer.createDataChannel("private-share", { ordered: true });
      setupChannel();
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

  try {
    if (signal.description) {
      const offerCollision = signal.description.type === "offer" &&
                             (makingOffer || peer.signalingState !== "stable");
      ignoreOffer = !isPolite && offerCollision;
      if (ignoreOffer) return;

      await peer.setRemoteDescription(signal.description);
      if (signal.description.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        sendSocket("signal", { signal: { description: peer.localDescription } });
      }
      
      const candidates = pendingIceCandidates;
      pendingIceCandidates = [];
      for (const candidate of candidates) {
        await peer.addIceCandidate(candidate).catch(() => {});
      }
    }

    if (signal.candidate) {
      try {
        if (!peer.remoteDescription) {
          pendingIceCandidates.push(signal.candidate);
        } else {
          await peer.addIceCandidate(signal.candidate);
        }
      } catch (err) {
        if (!ignoreOffer) console.error(err);
      }
    }
  } catch (err) {
    console.error("Signal error", err);
  }
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
  if (isMobileDevice && !isNativeBarta) {
    showPrivacyWarningToast();
  }

  if (!peer || !currentPeer || localStream) return;
  // Send a call request to peer — they must accept before media starts
  const kind = withVideo ? "video-request" : "audio-request";
  if (!sendData(JSON.stringify({ kind }))) return;
  addSystemMessage(withVideo ? "📹 Calling…" : "🎙️ Calling…");
  // Disable call buttons until accepted/rejected
  startCallBtn.disabled = true;
  startAudioBtn.disabled = true;
}

async function _actuallyStartCall(withVideo = true) {
  if (!peer || !currentPeer || localStream) return;
  try {
    // Solution 2: Constrain video quality for slow internet (640x480, 15fps ideal)
    // Solution 5: Enhanced audio settings
    localStream = await navigator.mediaDevices.getUserMedia(
      withVideo
        ? {
            video: {
              width:  { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 },
              frameRate: { ideal: 15, max: 30 }
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          }
        : {
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          }
    );
    if (window.BartaBridge) {
      window.BartaBridge.setCallActive(true);
    }
    if (withVideo) {
      localVideo.srcObject = localStream;
      remoteVideo.srcObject = remoteStream || null;
      localVideo.play().catch(() => {});
      if (remoteStream) remoteVideo.play().catch(() => {});
      videoCall.classList.remove("hidden");
      fullscreenBtn.classList.remove("hidden");
      makePipDraggable();
    }
    // For audio-only calls: no PiP, no fullscreen button
    startCallBtn.classList.add("hidden");
    startAudioBtn.classList.add("hidden");
    endCallBtn.classList.remove("hidden");
    // Solution 4 + 5: Add tracks with bitrate cap and network priority
    for (const track of localStream.getTracks()) {
      const sender = peer.addTrack(track, localStream);
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        if (track.kind === "video") {
          params.encodings[0].maxBitrate = 800_000; // 800 Kbps cap — works on slow connections
          params.encodings[0].priority = "medium";
          params.encodings[0].networkPriority = "low";
        } else if (track.kind === "audio") {
          params.encodings[0].priority = "high";        // audio always wins bandwidth
          params.encodings[0].networkPriority = "high";
        }
        await sender.setParameters(params);
      } catch (e) { /* setParameters before negotiation is not supported on all browsers — safe to ignore */ }
    }
    const notifyKind = withVideo ? "video-start" : "audio-start";
    if (channel?.readyState === "open") sendData(JSON.stringify({ kind: notifyKind }));
  } catch (error) {
    addSystemMessage("Permission denied: " + error.message);
    startCallBtn.disabled = false;
    startAudioBtn.disabled = false;
  }
}

const MIC_ON_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
const MIC_OFF_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
const CAM_ON_SVG  = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
const CAM_OFF_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34"/><path d="M16 11.37A4 4 0 1 1 12.63 8"/></svg>`;

function toggleAudio() {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  const isMuted = !audioTrack.enabled;
  muteFsBtn.classList.toggle("active-opt", isMuted);
  muteFsBtn.innerHTML = isMuted ? MIC_OFF_SVG : MIC_ON_SVG;
  muteFsBtn.title = isMuted ? "Unmute" : "Mute";
}

function toggleVideo() {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;
  videoTrack.enabled = !videoTrack.enabled;
  const isPaused = !videoTrack.enabled;
  pauseFsBtn.classList.toggle("active-opt", isPaused);
  pauseFsBtn.innerHTML = isPaused ? CAM_OFF_SVG : CAM_ON_SVG;
  pauseFsBtn.title = isPaused ? "Resume Video" : "Pause Video";
}

function startVideoCall() { return startCall(true); }
function startAudioCall() { return startCall(false); }

// Shared local teardown used by both sides when a call ends
function _cleanupCallUI() {
  if (window.BartaBridge) {
    window.BartaBridge.setCallActive(false);
  }
  exitFullscreen();
  videoCall.classList.add("hidden");
  if (localStream) {
    for (const track of localStream.getTracks()) {
      const sender = peer?.getSenders().find((s) => s.track === track);
      if (sender) peer.removeTrack(sender);
      track.stop();
    }
    localStream = null;
    localVideo.srcObject = null;
    localVideoFull.srcObject = null;
  }
  if (remoteStream) {
    for (const track of remoteStream.getTracks()) track.stop();
    remoteStream = null;
    remoteVideo.srcObject = null;
    remoteVideoFull.srcObject = null;
  }
  startCallBtn.classList.remove("hidden");
  startAudioBtn.classList.remove("hidden");
  endCallBtn.classList.add("hidden");
  fullscreenBtn.classList.add("hidden");
  startCallBtn.disabled = false;
  startAudioBtn.disabled = false;
  muteFsBtn.innerHTML = MIC_ON_SVG;
  muteFsBtn.classList.remove("active-opt");
  pauseFsBtn.innerHTML = CAM_ON_SVG;
  pauseFsBtn.classList.remove("active-opt");
}

async function stopVideoCall() {
  if (!localStream && !remoteStream) return;
  if (channel?.readyState === "open") sendData(JSON.stringify({ kind: "call-ended" }));
  _cleanupCallUI();
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
  // Only restore PiP if there is an active video track
  const hasVideo = localStream?.getVideoTracks().length || remoteStream?.getVideoTracks().length;
  if (hasVideo) videoCall.classList.remove("hidden");
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
    // ── Image: thumbnail → tap to open lightbox
    const img = document.createElement("img");
    img.src = url;
    img.alt = file.name;
    img.className = "media-thumb";
    img.addEventListener("click", () => openMediaViewer(url, "image", file.name));
    item.appendChild(img);

  } else if (file.type.startsWith("video/")) {
    // ── Video: preview with play button → tap to open fullscreen player
    const wrap = document.createElement("div");
    wrap.className = "video-thumb-wrap";
    wrap.title = "Tap to play";
    const vid = document.createElement("video");
    vid.src = url;
    vid.preload = "metadata";
    const overlay = document.createElement("div");
    overlay.className = "video-play-overlay";
    const circle = document.createElement("div");
    circle.className = "video-play-circle";
    circle.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="#222"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    overlay.appendChild(circle);
    wrap.append(vid, overlay);
    wrap.addEventListener("click", () => openMediaViewer(url, "video", file.name));
    item.appendChild(wrap);

  } else if (file.type.startsWith("audio/")) {
    // ── Audio: inline Telegram-style player
    item.appendChild(buildAudioPlayer(url, file.name));

  } else {
    // ── Other file: styled file card
    item.appendChild(buildFileCard(file, url));
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

/* ─── Media Viewer ────────────────────────────────────────── */

let _mvScale = 1;
const MV_SCALE_STEP = 0.25;
const MV_SCALE_MAX  = 3;
const MV_SCALE_MIN  = 0.5;

function openMediaViewer(url, type, name) {
  mvBody.innerHTML = "";
  mvTitle.textContent = name;
  mvSave.href = url;
  mvSave.download = name;
  _mvScale = 1;

  if (type === "image") {
    const img = document.createElement("img");
    img.src = url;
    img.alt = name;
    img.draggable = false;
    // Double-tap / double-click to zoom in
    img.addEventListener("dblclick", () => {
      if (_mvScale === 1) _mvScaleStep(1); else { _mvScale = 1; _mvApplyZoom(); }
    });
    mvBody.appendChild(img);
    mvZoomBar.classList.remove("hidden");
    _mvUpdateZoomUI();
    _mvSetupPinchZoom(img);

  } else if (type === "video") {
    const vid = document.createElement("video");
    vid.src = url;
    vid.controls = true;
    vid.autoplay = true;
    vid.playsInline = true;
    vid.className = "mv-video";
    mvBody.appendChild(vid);
    mvZoomBar.classList.add("hidden");
  }

  mediaViewer.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeMediaViewer() {
  const vid = mvBody.querySelector("video");
  if (vid) { vid.pause(); vid.src = ""; }
  mvBody.innerHTML = "";
  mediaViewer.classList.add("hidden");
  document.body.style.overflow = "";
  _mvScale = 1;
}

function _mvScaleStep(dir) {
  _mvScale = Math.max(MV_SCALE_MIN, Math.min(MV_SCALE_MAX, _mvScale + dir * MV_SCALE_STEP));
  _mvApplyZoom();
}

function _mvApplyZoom() {
  const img = mvBody.querySelector("img");
  if (!img) return;
  img.style.transform = `scale(${_mvScale})`;
  img.style.cursor = _mvScale > 1 ? "grab" : "zoom-in";
  _mvUpdateZoomUI();
}

function _mvUpdateZoomUI() {
  if (mvZoomPct) mvZoomPct.textContent = `${Math.round(_mvScale * 100)}%`;
}

function _mvSetupPinchZoom(el) {
  let startDist = 0, startScale = 1;
  el.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      startDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      startScale = _mvScale;
    }
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      _mvScale = Math.max(MV_SCALE_MIN, Math.min(MV_SCALE_MAX, startScale * (dist / startDist)));
      _mvApplyZoom();
    }
  }, { passive: true });
}

// Viewer button wiring
mvClose?.addEventListener("click", closeMediaViewer);
mvBackdrop?.addEventListener("click", closeMediaViewer);
mvZoomIn?.addEventListener("click", () => _mvScaleStep(1));
mvZoomOut?.addEventListener("click", () => _mvScaleStep(-1));
mvZoomFit?.addEventListener("click", () => { _mvScale = 1; _mvApplyZoom(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mediaViewer && !mediaViewer.classList.contains("hidden")) {
    closeMediaViewer();
  }
});

/* ─── Inline Audio Player (Telegram-style) ─────────────── */

function buildAudioPlayer(url, name) {
  const wrap = document.createElement("div");
  wrap.className = "audio-player";

  const btn = document.createElement("button");
  btn.className = "audio-play-btn";
  btn.setAttribute("aria-label", "Play/Pause");
  btn.innerHTML = _mvPlayIcon();

  const info = document.createElement("div");
  info.className = "audio-info";

  const nameEl = document.createElement("div");
  nameEl.className = "audio-name";
  nameEl.textContent = name;

  const row = document.createElement("div");
  row.className = "audio-progress-row";

  const track = document.createElement("div");
  track.className = "audio-progress";
  const fill = document.createElement("div");
  fill.className = "audio-progress-fill";
  track.appendChild(fill);

  const timeEl = document.createElement("span");
  timeEl.className = "audio-time";
  timeEl.textContent = "0:00";

  row.append(track, timeEl);
  info.append(nameEl, row);

  const audio = new Audio(url);
  audio.preload = "metadata";

  let playing = false;

  btn.addEventListener("click", () => {
    if (playing) {
      audio.pause();
    } else {
      // Pause all other audio players on the page
      document.querySelectorAll(".audio-player-el").forEach(a => { if (a !== audio) a.pause(); });
      audio.play().catch(() => {});
    }
  });

  audio.className = "audio-player-el";

  audio.addEventListener("play",  () => { playing = true;  btn.innerHTML = _mvPauseIcon(); });
  audio.addEventListener("pause", () => { playing = false; btn.innerHTML = _mvPlayIcon();  });
  audio.addEventListener("ended", () => {
    playing = false;
    btn.innerHTML = _mvPlayIcon();
    fill.style.width = "0%";
    timeEl.textContent = "0:00";
  });
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    fill.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
    timeEl.textContent = `${_fmtTime(audio.currentTime)} / ${_fmtTime(audio.duration)}`;
  });
  audio.addEventListener("loadedmetadata", () => {
    timeEl.textContent = `0:00 / ${_fmtTime(audio.duration)}`;
  });
  track.addEventListener("click", (e) => {
    if (!audio.duration) return;
    const r = track.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });

  wrap.append(btn, info);
  wrap.appendChild(audio); // attach to DOM so it persists
  audio.style.display = "none";
  return wrap;
}

function _mvPlayIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
}
function _mvPauseIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
}
function _fmtTime(s) {
  const sec = Math.floor(s);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/* ─── File Card (non-media files) ──────────────────────── */

function buildFileCard(file, url) {
  const ext  = (file.name.split(".").pop() || "").toLowerCase();
  const icon = _fileIcon(ext);
  const size = _fmtBytes(file.size);

  const card = document.createElement("div");
  card.className = "file-card";
  card.title = "Click to download";

  const iconEl = document.createElement("div");
  iconEl.className = "file-card-icon";
  iconEl.textContent = icon;

  const details = document.createElement("div");
  details.className = "file-card-details";

  const nameEl = document.createElement("div");
  nameEl.className = "file-card-name";
  nameEl.textContent = file.name;

  const meta = document.createElement("div");
  meta.className = "file-card-meta";
  const extBadge = document.createElement("span");
  extBadge.className = "file-card-ext";
  extBadge.textContent = ext || "file";
  const sizeSpan = document.createElement("span");
  sizeSpan.textContent = size;
  meta.append(extBadge, sizeSpan);

  details.append(nameEl, meta);
  card.append(iconEl, details);

  card.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
  });

  return card;
}

function _fileIcon(ext) {
  const m = {
    pdf: "📄",
    doc: "📝", docx: "📝",
    xls: "📊", xlsx: "📊", csv: "📊",
    ppt: "📑", pptx: "📑",
    zip: "🗜️", rar: "🗜️", "7z": "🗜️", gz: "🗜️", tar: "🗜️",
    txt: "📃", md: "📃",
    apk: "📱",
    exe: "⚙️", msi: "⚙️",
    js:  "💻", ts: "💻", py: "💻", html: "💻", css: "💻",
    json: "📋", xml: "📋",
  };
  return m[ext] || "📎";
}

function _fmtBytes(b) {
  if (!b) return "";
  if (b < 1024)           return `${b} B`;
  if (b < 1024 * 1024)   return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function showCallRequestPopup(kind) {
  pendingCallKind = kind;
  const isVideo = kind === "video-request";
  callRequestText.textContent = isVideo
    ? `📹 @${currentPeer?.username} wants to start a video call`
    : `🎙️ @${currentPeer?.username} wants to start a voice call`;
  callRequestIcon.innerHTML = isVideo
    ? `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`
    : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 11 19.79 19.79 0 0 1 1.67 2.37 2 2 0 0 1 3.64.36h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.16 6.16l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
  callRequestOverlay.classList.remove("hidden");
}

function hideCallRequestPopup() {
  callRequestOverlay.classList.add("hidden");
  pendingCallKind = null;
}

function receiveData(data) {
  if (typeof data === "string") {
    const packet = JSON.parse(data);
    if (packet.kind === "message") addMessage(packet.text);

    // Incoming call requests — show accept/reject popup
    if (packet.kind === "video-request" || packet.kind === "audio-request") {
      if (isMobileDevice && !isNativeBarta) {
        showPrivacyWarningToast();
      }
      showCallRequestPopup(packet.kind);
      return;
    }
    // Caller was told: accepted
    if (packet.kind === "call-accepted") {
      const withVideo = packet.callKind === "video-request";
      _actuallyStartCall(withVideo);
      return;
    }
    // Caller was told: rejected
    if (packet.kind === "call-rejected") {
      addSystemMessage("Call rejected.");
      startCallBtn.disabled = false;
      startAudioBtn.disabled = false;
      return;
    }

    if (packet.kind === "video-start") addSystemMessage("📹 Video call started");
    if (packet.kind === "audio-start") addSystemMessage("🎙️ Voice call started");
    if (packet.kind === "call-ended" || packet.kind === "video-ended") {
      // When one side ends the call, the OTHER side also tears down immediately
      addSystemMessage("Call ended");
      _cleanupCallUI();
    }
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
  loginForm.reset();
  signupForm.reset();
  loginForm.elements.identifier.readOnly = true;
  loginForm.elements.password.readOnly = true;
  showLanding();
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
      button.addEventListener("click", () => {
        if (isMobileDevice && !isNativeBarta) {
          showPrivacyWarningToast();
        }
        sendSocket("request", { to: user.id });
      });
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
muteFsBtn.addEventListener("click", toggleAudio);
pauseFsBtn.addEventListener("click", toggleVideo);
endCallBtn.addEventListener("click", () => stopVideoCall());
fullscreenBtn.addEventListener("click", enterFullscreen);
exitFullscreenBtn.addEventListener("click", exitFullscreen);
endCallFsBtn.addEventListener("click", () => { exitFullscreen(); stopVideoCall(); });
pipCloseBtn.addEventListener("click", () => stopVideoCall());

// Call request: accept
callAcceptBtn.addEventListener("click", () => {
  const kind = pendingCallKind;
  hideCallRequestPopup();
  if (!kind) return;
  // Tell caller we accepted and start media on our side
  sendData(JSON.stringify({ kind: "call-accepted", callKind: kind }));
  _actuallyStartCall(kind === "video-request");
});

// Call request: reject
callRejectBtn.addEventListener("click", () => {
  const kind = pendingCallKind;
  hideCallRequestPopup();
  if (!kind) return;
  sendData(JSON.stringify({ kind: "call-rejected" }));
  addSystemMessage("Call rejected.");
});

// Back button: return to sidebar on mobile
backBtn.addEventListener("click", showSidebar);

// Theme Toggle
themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  themeIcon.textContent = newTheme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("barta-theme", newTheme);
});

// Load saved theme
const savedTheme = localStorage.getItem("barta-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.setAttribute("data-theme", savedTheme);
themeIcon.textContent = savedTheme === "dark" ? "☀️" : "🌙";

// Refresh Users
refreshBtn.addEventListener("click", () => {
  refreshBtn.classList.add("syncing");
  setTimeout(() => refreshBtn.classList.remove("syncing"), 600);

  if (socket?.readyState === WebSocket.OPEN) {
    sendSocket("refresh-presence");
  } else {
    userList.innerHTML = '<p class="muted">Reconnecting...</p>';
    connectSocket();
  }
});

landingLoginBtn.addEventListener("click", () => {
  showAuth();
  switchAuth("login");
});

landingSignupBtn.addEventListener("click", () => {
  showAuth();
  switchAuth("signup");
});

getStartedBtn.addEventListener("click", () => {
  showAuth();
  switchAuth("signup");
});

backToHomeBtn.addEventListener("click", showLanding);


// ─── PRIVACY GUARD ────────────────────────────────────────────────────────────
// Deter screenshots and screen recording by hiding content when tab is inactive.
function togglePrivacy(hide) {
  if (hide) privacyOverlay.classList.remove("hidden");
  else privacyOverlay.classList.add("hidden");
}

document.addEventListener("visibilitychange", () => {
  togglePrivacy(document.visibilityState === "hidden");
});

window.addEventListener("blur", () => togglePrivacy(true));
window.addEventListener("focus", () => togglePrivacy(false));

// Deter PrintScreen key (some browsers support this)
window.addEventListener("keyup", (e) => {
  if (e.key === "PrintScreen" || e.code === "PrintScreen") {
    navigator.clipboard.writeText(""); // Clear clipboard
    togglePrivacy(true); // Force black screen immediately
    setTimeout(() => togglePrivacy(false), 2000);
    alert("Barta: Screen capture is prohibited for security reasons.");
  }
});

// Block right-click context menu globally
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Advanced Deterrent: Detect if user starts a screen share
if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
  // We can't prevent it easily, but we can warn the user.
  // Note: This requires a user gesture to start, so we just stick to the basic deterrents.
}


const params = new URLSearchParams(location.search);

if (params.get("reset") === "1" && params.get("token")) {
  showAuth();
  resetForm.elements.token.value = params.get("token");
  switchAuth("reset");
  setNotice("Create a new password.");
  history.replaceState({}, "", "/check-in");
} else {
  fetch(`/api/session?_=${Date.now()}`)
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Not authenticated.");
      me = data.user;
      
      // If logged in, always go to dashboard
      showApp();

      if (params.get("verified") === "1") setNotice("Email verified. You are signed in.");
      if (params.get("profile") === "email-updated") setProfileNotice("Email updated.");
      if (params.toString()) history.replaceState({}, "", "/");
    })
    .catch(() => {
      // Not logged in: Route based on path
      const path = location.pathname;
      if (path === "/check-in") {
        showAuth();
      } else {
        showLanding();
      }
      if (params.toString()) history.replaceState({}, "", path === "/check-in" ? "/check-in" : "/home");
    });
}

window.addEventListener("popstate", () => {
  const path = location.pathname;
  if (path === "/home") showLanding();
  else if (path === "/check-in") showAuth();
  else if (path === "/" && me) showApp();
  else if (path === "/" && !me) showLanding();
});

// ─── AUTO-UPDATE CHECK ────────────────────────────────────────────────────────
// Poll /api/version every 60 s. If the server hash changes, reload the page.
// Reload is deferred if the user is currently in a live call.
(function autoUpdateCheck() {
  let knownHash = null;
  async function checkVersion() {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const { hash } = await res.json();
      if (!hash) return;
      if (knownHash === null) { knownHash = hash; return; }
      if (hash !== knownHash) {
        if (!currentPeer || !localStream) {
          knownHash = hash;
          window.location.reload();
        }
        // If in a call, leave knownHash as is. The next poll will trigger this again.
      }
    } catch { /* ignore network errors */ }
  }
  setInterval(checkVersion, 60_000);
  checkVersion();
})();
