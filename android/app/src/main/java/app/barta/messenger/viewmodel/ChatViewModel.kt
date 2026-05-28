package app.barta.messenger.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import app.barta.messenger.data.model.ChatMessage
import app.barta.messenger.data.model.OnlineUser
import app.barta.messenger.data.network.CallKind
import app.barta.messenger.data.network.WebRTCClient
import app.barta.messenger.data.network.socketClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.intOrNull

sealed class CallState {
    object Idle    : CallState()
    object Calling : CallState()          // outgoing — waiting for answer
    data class Active(val kind: CallKind, val micOn: Boolean = true, val camOn: Boolean = true) : CallState()
}

class ChatViewModel(
    app: Application,
    val peer: OnlineUser,
    private val isInitiator: Boolean
) : AndroidViewModel(app) {

    val webRTC = WebRTCClient(app.applicationContext)

    private val _messages   = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages

    private val _callState  = MutableStateFlow<CallState>(CallState.Idle)
    val callState: StateFlow<CallState> = _callState

    private val _peerLeft   = MutableStateFlow(false)
    val peerLeft: StateFlow<Boolean> = _peerLeft

    init {
        // Init WebRTC data channel (text-only to start)
        webRTC.init(isInitiator, callKind = null)

        // Observe incoming DataChannel messages
        webRTC.channelMsg.onEach { raw -> handleDataMessage(raw) }.launchIn(viewModelScope)

        // Observe WebSocket for signals + peer-disconnected
        socketClient.messages.onEach { msg ->
            when (msg.type) {
                "signal" -> {
                    val sig = msg.signal?.jsonObject ?: return@onEach
                    val type = sig["type"]?.jsonPrimitive?.content ?: return@onEach
                    when (type) {
                        "offer", "answer" -> {
                            val sdp = sig["sdp"]?.jsonPrimitive?.content ?: return@onEach
                            webRTC.handleRemoteDescription(type, sdp)
                        }
                        "candidate" -> {
                            val cand = sig["candidate"]?.jsonPrimitive?.content ?: return@onEach
                            val mid  = sig["sdpMid"]?.jsonPrimitive?.content
                            val idx  = sig["sdpMLineIndex"]?.jsonPrimitive?.intOrNull ?: 0
                            webRTC.handleRemoteIce(cand, mid, idx)
                        }
                    }
                }
                "peer-disconnected" -> _peerLeft.value = true
            }
        }.launchIn(viewModelScope)
    }

    // ── Text chat ─────────────────────────────────────────────────────────────

    fun sendMessage(text: String) {
        val payload = """{"kind":"message","text":${kotlinx.serialization.json.Json.encodeToString(kotlinx.serialization.json.JsonPrimitive(text))}"""+"}"
        webRTC.sendText(payload)
        addMessage(ChatMessage.Text(text, fromMe = true))
    }

    private fun handleDataMessage(raw: String) {
        try {
            val obj = kotlinx.serialization.json.Json.parseToJsonElement(raw).jsonObject
            when (obj["kind"]?.jsonPrimitive?.content) {
                "message" -> {
                    val text = obj["text"]?.jsonPrimitive?.content ?: return
                    addMessage(ChatMessage.Text(text, fromMe = false))
                }
                "call-request" -> {
                    val kind = if (obj["video"]?.jsonPrimitive?.content == "true") CallKind.VIDEO else CallKind.AUDIO
                    // For Phase 4 (FCM notifications), we'll add incoming call UI here
                }
                "call-end" -> {
                    endCall()
                }
            }
        } catch (_: Exception) {}
    }

    private fun addMessage(msg: ChatMessage) {
        _messages.value = _messages.value + msg
    }

    // ── Calls ─────────────────────────────────────────────────────────────────

    fun startAudioCall() {
        _callState.value = CallState.Calling
        webRTC.addVideoCall()
        // Notify peer via DataChannel
        webRTC.sendText("""{"kind":"call-request","video":"false"}""")
        _callState.value = CallState.Active(CallKind.AUDIO)
    }

    fun startVideoCall() {
        _callState.value = CallState.Calling
        webRTC.addVideoCall()
        webRTC.sendText("""{"kind":"call-request","video":"true"}""")
        _callState.value = CallState.Active(CallKind.VIDEO)
    }

    fun endCall() {
        webRTC.sendText("""{"kind":"call-end"}""")
        webRTC.toggleCamera(false)
        webRTC.toggleMic(false)
        _callState.value = CallState.Idle
    }

    fun toggleMic() {
        val cur = _callState.value as? CallState.Active ?: return
        val next = !cur.micOn
        webRTC.toggleMic(next)
        _callState.value = cur.copy(micOn = next)
    }

    fun toggleCamera() {
        val cur = _callState.value as? CallState.Active ?: return
        val next = !cur.camOn
        webRTC.toggleCamera(next)
        _callState.value = cur.copy(camOn = next)
    }

    fun disconnect() {
        socketClient.sendRaw("disconnect-peer")
        _peerLeft.value = true
    }

    override fun onCleared() {
        super.onCleared()
        webRTC.close()
    }
}

class ChatViewModelFactory(
    private val app: Application,
    private val peer: OnlineUser,
    private val isInitiator: Boolean
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        ChatViewModel(app, peer, isInitiator) as T
}
