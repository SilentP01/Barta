package app.barta.messenger.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.barta.messenger.data.local.SecurePrefs
import app.barta.messenger.data.model.ConnectionState
import app.barta.messenger.data.model.OnlineUser
import app.barta.messenger.data.model.WsMessage
import app.barta.messenger.data.network.ApiClient
import app.barta.messenger.data.network.JSON_MEDIA
import app.barta.messenger.data.network.socketClient
import app.barta.messenger.util.NotificationHelper
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class HomeViewModel(app: Application) : AndroidViewModel(app) {

    private val _contacts    = MutableStateFlow<List<OnlineUser>>(emptyList())
    val contacts: StateFlow<List<OnlineUser>> = _contacts

    private val _connState   = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connState: StateFlow<ConnectionState> = _connState

    private val _socketReady = MutableStateFlow(false)
    val socketReady: StateFlow<Boolean> = _socketReady

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery

    val myId       = SecurePrefs.getUserId(app)
    val myUsername = SecurePrefs.getUsername(app)

    init {
        _contacts.value = SecurePrefs.getContacts(app)

        // Observe connection status
        socketClient.connected.onEach { connected ->
            _socketReady.value = connected
            if (connected) {
                // Subscribe to online status for all contacts
                val ids = _contacts.value.map { it.id }
                if (ids.isNotEmpty()) {
                    socketClient.sendRaw("subscribe", mapOf("ids" to ids))
                }
            } else if (_connState.value is ConnectionState.Online) {
                _connState.value = ConnectionState.Disconnected
            }
        }.launchIn(viewModelScope)

        // Observe WebSocket messages
        socketClient.messages.onEach { msg -> handleMessage(msg) }.launchIn(viewModelScope)

        // Connect WebSocket
        socketClient.connect()

        // Register FCM token with server
        registerFcmToken()
    }

    private fun handleMessage(msg: WsMessage) {
        when (msg.type) {
            "presence" -> {
                // Backend sends the updated presence for subscribed users
                val updatedUsers = msg.users ?: emptyList()
                _contacts.value = _contacts.value.map { contact ->
                    val update = updatedUsers.find { it.id == contact.id }
                    update ?: contact // Fallback to last known if not in update (shouldn't happen, but safe)
                }
                if (_connState.value !is ConnectionState.Connected)
                    _connState.value = ConnectionState.Online
            }
            "incoming-request" -> {
                val from = msg.from ?: return
                _connState.value = ConnectionState.PeerRequesting(from)
                // Show full-screen notification (handles locked screen / backgrounded app)
                NotificationHelper.showIncomingCallNotification(
                    context    = getApplication(),
                    callerName = from.username,
                    callerId   = from.id.toString()
                )
            }
            "request-sent"     -> { /* initiator side — state already set in sendRequest */ }
            "request-accepted", "connected" -> {
                NotificationHelper.cancelIncomingCallNotification(getApplication())
                val peer      = msg.peer ?: return
                val initiator = msg.initiator ?: false
                _connState.value = ConnectionState.Connected(peer, initiator)
            }
            "request-rejected" -> {
                _connState.value = ConnectionState.Online
            }
            "peer-disconnected" -> {
                _connState.value = ConnectionState.Online
            }
        }
    }

    fun sendRequest(target: OnlineUser) {
        _connState.value = ConnectionState.RequestSent(target)
        socketClient.sendRaw("request", mapOf("to" to target.id))
    }

    fun acceptRequest() {
        NotificationHelper.cancelIncomingCallNotification(getApplication())
        socketClient.sendRaw("respond-request", mapOf("accept" to true))
    }

    fun rejectRequest() {
        NotificationHelper.cancelIncomingCallNotification(getApplication())
        _connState.value = ConnectionState.Online
        socketClient.sendRaw("respond-request", mapOf("accept" to false))
    }

    fun disconnectPeer() {
        _connState.value = ConnectionState.Online
        socketClient.sendRaw("disconnect-peer")
    }

    fun setSearchQuery(q: String) { _searchQuery.value = q }

    fun filteredContacts(): List<OnlineUser> {
        val q = _searchQuery.value.trim().lowercase()
        return if (q.isEmpty()) _contacts.value
        else _contacts.value.filter { it.username.lowercase().contains(q) }
    }

    fun addContact(user: OnlineUser) {
        SecurePrefs.addContact(getApplication(), user)
        _contacts.value = SecurePrefs.getContacts(getApplication())
        // Resubscribe
        socketClient.sendRaw("subscribe", mapOf("ids" to _contacts.value.map { it.id }))
    }

    private fun registerFcmToken() {
        viewModelScope.launch {
            try {
                val token = FirebaseMessaging.getInstance().token.await()
                SecurePrefs.saveFcmToken(getApplication(), token)
                // Send to server
                val body = """{"token":"$token"}""".toRequestBody(JSON_MEDIA)
                val req  = Request.Builder().url("${ApiClient.BASE_URL}/api/fcm-token").post(body).build()
                ApiClient.http.newCall(req).execute().close()
            } catch (_: Exception) { /* Non-fatal; retry next login */ }
        }
    }
}
