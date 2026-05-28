package app.barta.messenger.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.barta.messenger.data.model.ChatMessage
import app.barta.messenger.data.model.ConnectionState
import app.barta.messenger.data.model.OnlineUser
import app.barta.messenger.data.model.WsMessage
import app.barta.messenger.data.network.socketClient
import app.barta.messenger.data.local.SecurePrefs
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

class HomeViewModel(app: Application) : AndroidViewModel(app) {

    private val _users       = MutableStateFlow<List<OnlineUser>>(emptyList())
    val users: StateFlow<List<OnlineUser>> = _users

    private val _connState   = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connState: StateFlow<ConnectionState> = _connState

    private val _socketReady = MutableStateFlow(false)
    val socketReady: StateFlow<Boolean> = _socketReady

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery

    val myId = SecurePrefs.getUserId(app)
    val myUsername = SecurePrefs.getUsername(app)

    init {
        // Observe connection status
        socketClient.connected.onEach { connected ->
            _socketReady.value = connected
            if (!connected && _connState.value is ConnectionState.Online) {
                _connState.value = ConnectionState.Disconnected
            }
        }.launchIn(viewModelScope)

        // Observe messages
        socketClient.messages.onEach { msg -> handleMessage(msg) }.launchIn(viewModelScope)

        // Connect
        socketClient.connect()
    }

    private fun handleMessage(msg: WsMessage) {
        when (msg.type) {
            "presence" -> {
                val list = msg.users ?: emptyList()
                _users.value = list.filter { it.id != myId }
                // Once presence is received we are properly online
                if (_connState.value !is ConnectionState.Connected) {
                    _connState.value = ConnectionState.Online
                }
            }
            "incoming-request" -> {
                val from = msg.from ?: return
                _connState.value = ConnectionState.PeerRequesting(from)
            }
            "request-sent" -> {
                // to field missing from server — we already set RequestSent before calling send
            }
            "request-accepted", "connected" -> {
                val peer = msg.peer ?: return
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
        socketClient.sendRaw("respond-request", mapOf("accept" to true))
    }

    fun rejectRequest() {
        _connState.value = ConnectionState.Online
        socketClient.sendRaw("respond-request", mapOf("accept" to false))
    }

    fun disconnectPeer() {
        _connState.value = ConnectionState.Online
        socketClient.sendRaw("disconnect-peer")
    }

    fun setSearchQuery(q: String) { _searchQuery.value = q }

    fun filteredUsers(): List<OnlineUser> {
        val q = _searchQuery.value.trim().lowercase()
        return if (q.isEmpty()) _users.value
        else _users.value.filter { it.username.lowercase().contains(q) }
    }

    override fun onCleared() {
        super.onCleared()
        // Don't disconnect on screen rotation — socket lives in singleton
    }
}
