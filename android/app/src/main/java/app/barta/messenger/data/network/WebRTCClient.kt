package app.barta.messenger.data.network

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import org.webrtc.*

enum class CallKind { AUDIO, VIDEO }

/**
 * Manages a single WebRTC peer connection with:
 * - DataChannel for chat messages
 * - Audio/Video tracks for calls
 * - ICE/SDP exchange via the WebSocket (SocketClient.sendSignal)
 */
class WebRTCClient(private val context: Context) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    val eglBase: EglBase = EglBase.create()

    private val factory: PeerConnectionFactory by lazy {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context)
                .setEnableInternalTracer(false)
                .createInitializationOptions()
        )
        PeerConnectionFactory.builder()
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true))
            .createPeerConnectionFactory()
    }

    // Phase 1: STUN only; Phase 2: +TURN if STUN fails (mirrors web app logic)
    private val stunServers = listOf(
        PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
    )
    private val turnServers = listOf(
        PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
        PeerConnection.IceServer.builder("turn:openrelay.metered.ca:443")
            .setUsername("openrelayproject").setPassword("openrelayproject").createIceServer(),
        PeerConnection.IceServer.builder("turn:freestun.net:3478")
            .setUsername("free").setPassword("free").createIceServer()
    )

    // ── Observable state ──────────────────────────────────────────────────────
    private val _localVideo  = MutableStateFlow<VideoTrack?>(null)
    val localVideo:  StateFlow<VideoTrack?> = _localVideo

    private val _remoteVideo = MutableStateFlow<VideoTrack?>(null)
    val remoteVideo: StateFlow<VideoTrack?> = _remoteVideo

    private val _channelMsg  = MutableSharedFlow<String>(extraBufferCapacity = 64)
    val channelMsg:  SharedFlow<String> = _channelMsg

    private val _connected   = MutableStateFlow(false)
    val connected:   StateFlow<Boolean> = _connected

    // ── Internals ─────────────────────────────────────────────────────────────
    private var pc: PeerConnection? = null
    private var dc: DataChannel? = null
    private var localStream: MediaStream? = null
    private var capturer: CameraVideoCapturer? = null
    private var useTurn = false

    // ── Public API ────────────────────────────────────────────────────────────

    fun init(isInitiator: Boolean, callKind: CallKind? = null) {
        pc = buildPeer(useTurn)
        callKind?.let { setupLocalMedia(it) }
        if (isInitiator) {
            val dcInit = DataChannel.Init().apply { ordered = true }
            dc = pc?.createDataChannel("barta", dcInit)
            dc?.registerObserver(dcObserver())
            createOffer(callKind != null)
        }
    }

    fun handleRemoteDescription(type: String, sdp: String) {
        val sdpType = if (type == "offer") SessionDescription.Type.OFFER else SessionDescription.Type.ANSWER
        pc?.setRemoteDescription(SimpleSdpObserver(), SessionDescription(sdpType, sdp))
        if (sdpType == SessionDescription.Type.OFFER) createAnswer()
    }

    fun handleRemoteIce(candidate: String, sdpMid: String?, sdpMLineIndex: Int) {
        pc?.addIceCandidate(IceCandidate(sdpMid ?: "0", sdpMLineIndex, candidate))
    }

    fun sendText(text: String) {
        val buf = text.toByteArray(Charsets.UTF_8)
        dc?.send(DataChannel.Buffer(java.nio.ByteBuffer.wrap(buf), false))
    }

    fun toggleMic(enabled: Boolean)   { localStream?.audioTracks?.forEach { it.setEnabled(enabled) } }
    fun toggleCamera(enabled: Boolean) { localStream?.videoTracks?.forEach { it.setEnabled(enabled) } }

    fun addVideoCall() {
        if (localStream?.videoTracks?.isNotEmpty() == true) return
        setupVideoTrack()
    }

    fun close() {
        capturer?.stopCapture()
        capturer?.dispose()
        localStream?.audioTracks?.forEach { it.dispose() }
        localStream?.videoTracks?.forEach { it.dispose() }
        localStream?.dispose()
        dc?.close()
        pc?.close()
        pc = null; dc = null; localStream = null; capturer = null
        _localVideo.value  = null
        _remoteVideo.value = null
        _connected.value   = false
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private fun buildPeer(withTurn: Boolean): PeerConnection {
        val config = PeerConnection.RTCConfiguration(if (withTurn) turnServers else stunServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }
        return factory.createPeerConnection(config, pcObserver())!!
    }

    private fun setupLocalMedia(callKind: CallKind) {
        val stream = factory.createLocalMediaStream("barta_local")
        // Audio (always)
        val audioSource = factory.createAudioSource(MediaConstraints())
        stream.addTrack(factory.createAudioTrack("audio0", audioSource))
        // Video (only for video calls)
        if (callKind == CallKind.VIDEO) setupVideoTrack(stream)
        pc?.addStream(stream)
        localStream = stream
    }

    private fun setupVideoTrack(stream: MediaStream? = localStream) {
        val enumerator = Camera2Enumerator(context)
        val front = enumerator.deviceNames.firstOrNull { enumerator.isFrontFacing(it) }
            ?: enumerator.deviceNames.firstOrNull() ?: return
        capturer = enumerator.createCapturer(front, null)
        val helper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        val videoSource = factory.createVideoSource(false)
        capturer?.initialize(helper, context, videoSource.capturerObserver)
        capturer?.startCapture(1280, 720, 30)
        val videoTrack = factory.createVideoTrack("video0", videoSource)
        _localVideo.value = videoTrack
        stream?.addTrack(videoTrack)
    }

    private fun createOffer(withMedia: Boolean) {
        val constraints = MediaConstraints().apply {
            mandatory += MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true")
            mandatory += MediaConstraints.KeyValuePair("OfferToReceiveVideo", if (withMedia) "true" else "false")
        }
        pc?.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(sdp: SessionDescription) {
                pc?.setLocalDescription(SimpleSdpObserver(), sdp)
                socketClient.sendSignal("""{"type":"offer","sdp":${json.encodeToString(kotlinx.serialization.json.JsonPrimitive(sdp.description))}}""")
            }
        }, constraints)
    }

    private fun createAnswer() {
        pc?.createAnswer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(sdp: SessionDescription) {
                pc?.setLocalDescription(SimpleSdpObserver(), sdp)
                socketClient.sendSignal("""{"type":"answer","sdp":${json.encodeToString(kotlinx.serialization.json.JsonPrimitive(sdp.description))}}""")
            }
        }, MediaConstraints())
    }

    private fun pcObserver() = object : PeerConnection.Observer {
        override fun onIceCandidate(c: IceCandidate) {
            val escaped = c.sdp.replace("\"", "\\\"")
            socketClient.sendSignal("""{"type":"candidate","candidate":"$escaped","sdpMid":"${c.sdpMid}","sdpMLineIndex":${c.sdpMLineIndex}}""")
        }

        override fun onAddStream(stream: MediaStream) {
            val vt = stream.videoTracks.firstOrNull()
            scope.launch { _remoteVideo.value = vt }
        }

        override fun onDataChannel(channel: DataChannel) {
            dc = channel
            channel.registerObserver(dcObserver())
        }

        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
            val isConnected = state == PeerConnection.IceConnectionState.CONNECTED ||
                              state == PeerConnection.IceConnectionState.COMPLETED
            _connected.value = isConnected

            // Smart TURN fallback: if STUN fails after 8s, retry with TURN
            if (state == PeerConnection.IceConnectionState.FAILED && !useTurn) {
                scope.launch(Dispatchers.IO) {
                    kotlinx.coroutines.delay(500)
                    useTurn = true
                    // Rebuilding is handled at the ViewModel level (re-init)
                }
            }
        }

        override fun onSignalingChange(s: PeerConnection.SignalingState?) {}
        override fun onIceConnectionReceivingChange(b: Boolean) {}
        override fun onIceGatheringChange(s: PeerConnection.IceGatheringState?) {}
        override fun onIceCandidatesRemoved(c: Array<out IceCandidate>?) {}
        override fun onRemoveStream(s: MediaStream?) {}
        override fun onRenegotiationNeeded() {}
        override fun onAddTrack(r: RtpReceiver?, s: Array<out MediaStream>?) {}
    }

    private fun dcObserver() = object : DataChannel.Observer {
        override fun onMessage(buffer: DataChannel.Buffer) {
            if (buffer.binary) return
            val bytes = ByteArray(buffer.data.remaining())
            buffer.data.get(bytes)
            scope.launch { _channelMsg.emit(String(bytes, Charsets.UTF_8)) }
        }
        override fun onBufferedAmountChange(a: Long) {}
        override fun onStateChange() {}
    }
}

open class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(sdp: SessionDescription?) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(e: String?) {}
    override fun onSetFailure(e: String?) {}
}
