package app.barta.messenger.data.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

// ── WebRTC signal envelope ────────────────────────────────────────────────────
@Serializable
data class RtcSignal(
    val type: String,             // "offer" | "answer" | "candidate"
    val sdp: String? = null,      // for offer / answer
    val candidate: String? = null,// for candidate
    val sdpMid: String? = null,
    val sdpMLineIndex: Int? = null
)

@Serializable
data class WsMessage(
    val type: String,
    // presence
    val users: List<OnlineUser>? = null,
    // request / accept / reject
    val from: OnlineUser? = null,
    val to: String? = null,
    val peer: OnlineUser? = null,
    val initiator: Boolean? = null,
    val by: OnlineUser? = null,
    val accept: Boolean? = null,
    // signalling
    val signal: kotlinx.serialization.json.JsonElement? = null,
    // generic
    val error: String? = null,
    val message: String? = null
)

// ── Chat state ────────────────────────────────────────────────────────────────
sealed class ConnectionState {
    object Disconnected : ConnectionState()
    object Connecting   : ConnectionState()
    object Online       : ConnectionState()        // WebSocket connected, no peer
    data class PeerRequesting(val from: OnlineUser) : ConnectionState()
    data class RequestSent(val to: OnlineUser)      : ConnectionState()
    data class Connected(val peer: OnlineUser, val initiator: Boolean) : ConnectionState()
}

// ── Chat messages ─────────────────────────────────────────────────────────────
sealed class ChatMessage {
    data class Text(val text: String, val fromMe: Boolean, val timestamp: Long = java.lang.System.currentTimeMillis()) : ChatMessage()
    data class File(val name: String, val size: Long, val mimeType: String, val fromMe: Boolean, val timestamp: Long = java.lang.System.currentTimeMillis()) : ChatMessage()
    data class System(val text: String, val timestamp: Long = java.lang.System.currentTimeMillis()) : ChatMessage()
}
