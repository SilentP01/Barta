package app.barta.messenger.data.network

import app.barta.messenger.data.model.WsMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

class SocketClient {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _messages = MutableSharedFlow<WsMessage>(extraBufferCapacity = 64)
    val messages: SharedFlow<WsMessage> = _messages

    private val _connected = MutableSharedFlow<Boolean>(replay = 1)
    val connected: SharedFlow<Boolean> = _connected

    private var ws: WebSocket? = null
    private var alive = false
    private var retryCount = 0

    private val client = OkHttpClient.Builder()
        .cookieJar(ApiClient.cookieJar)
        .pingInterval(25, TimeUnit.SECONDS)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS) // no timeout for persistent connection
        .build()

    fun connect() {
        if (alive) return
        alive = true
        retryCount = 0
        doConnect()
    }

    fun disconnect() {
        alive = false
        ws?.close(1000, "User disconnected")
        ws = null
        scope.launch { _connected.emit(false) }
    }

    fun send(message: WsMessage) {
        val text = json.encodeToString(WsMessage.serializer(), message)
        ws?.send(text)
    }

    fun sendRaw(type: String, extra: Map<String, Any> = emptyMap()) {
        val pairs = (mapOf("type" to type) + extra).entries.joinToString(",") { (k, v) ->
            when (v) {
                is String  -> "\"$k\":\"${v.replace("\"", "\\\"")}\""
                is Boolean -> "\"$k\":$v"
                is Number  -> "\"$k\":$v"
                is List<*> -> "\"$k\":[${v.joinToString(",") { "\"$it\"" }}]"
                else       -> "\"$k\":\"$v\""
            }
        }
        ws?.send("{$pairs}")
    }

    /** Send a signal (SDP offer/answer or ICE candidate) through the WebSocket. */
    fun sendSignal(signalJson: String) {
        ws?.send("""{"type":"signal","signal":$signalJson}""")
    }

    /** Send any raw JSON string directly. */
    fun sendJson(json: String) {
        ws?.send(json)
    }

    private fun doConnect() {
        val request = Request.Builder()
            .url("${ApiClient.BASE_URL.replace("https://", "wss://")}/ws")
            .build()

        ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                retryCount = 0
                scope.launch { _connected.emit(true) }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = json.decodeFromString<WsMessage>(text)
                    scope.launch { _messages.emit(msg) }
                } catch (e: Exception) {
                    // Ignore malformed messages
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                scope.launch { _connected.emit(false) }
                scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                scope.launch { _connected.emit(false) }
                scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        if (!alive) return
        scope.launch {
            val delayMs = minOf(1000L * (1 shl retryCount.coerceAtMost(5)), 30_000L)
            retryCount++
            delay(delayMs)
            if (alive) doConnect()
        }
    }
}

// Singleton instance shared across the app
val socketClient = SocketClient()
