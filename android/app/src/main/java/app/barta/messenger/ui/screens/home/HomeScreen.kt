package app.barta.messenger.ui.screens.home

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.barta.messenger.data.model.ConnectionState
import app.barta.messenger.data.model.OnlineUser
import app.barta.messenger.ui.components.AvatarView
import app.barta.messenger.ui.theme.*
import app.barta.messenger.viewmodel.HomeViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.decodeFromJsonElement
import app.barta.messenger.data.network.ApiClient
import app.barta.messenger.data.network.json

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel = viewModel(),
    onNavigateToChat: (OnlineUser, Boolean) -> Unit,
    onNavigateToProfile: () -> Unit,
    onLogout: () -> Unit
) {
    val contacts   by viewModel.contacts.collectAsStateWithLifecycle()
    val connState  by viewModel.connState.collectAsStateWithLifecycle()
    val socketReady by viewModel.socketReady.collectAsStateWithLifecycle()
    val query      by viewModel.searchQuery.collectAsStateWithLifecycle()
    val filtered   = remember(contacts, query) { viewModel.filteredContacts() }
    var showSearchDialog by remember { mutableStateOf(false) }

    // Incoming request dialog
    if (connState is ConnectionState.PeerRequesting) {
        val from = (connState as ConnectionState.PeerRequesting).from
        IncomingRequestDialog(
            callerName = from.username,
            onAccept = {
                viewModel.acceptRequest()
                onNavigateToChat(from, false) // receiver = not initiator
            },
            onReject = viewModel::rejectRequest
        )
    }

    // Navigate to chat once connected (initiator path)
    LaunchedEffect(connState) {
        if (connState is ConnectionState.Connected) {
            val state = connState as ConnectionState.Connected
            onNavigateToChat(state.peer, state.initiator)
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        "Barta",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.ExtraBold,
                            brush = Brush.linearGradient(listOf(Teal500, Color(0xFF06B6D4)))
                        )
                    )
                },
                actions = {
                    IconButton(onClick = onNavigateToProfile) {
                        Icon(Icons.Outlined.Person, "Profile", tint = Teal500)
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showSearchDialog = true },
                containerColor = Teal500
            ) {
                Icon(Icons.Filled.Search, "Add Contact", tint = Color.White)
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        if (showSearchDialog) {
            SearchUserDialog(
                onDismiss = { showSearchDialog = false },
                onAdd = { user ->
                    viewModel.sendFriendRequest(user.id)
                    showSearchDialog = false
                }
            )
        }

        Column(modifier = Modifier.fillMaxSize().padding(padding)) {

            // Connection status bar
            AnimatedVisibility(!socketReady) {
                Surface(color = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(Icons.Outlined.WifiOff, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Connecting…", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error)
                    }
                }
            }

            // Search bar
            OutlinedTextField(
                value = query,
                onValueChange = viewModel::setSearchQuery,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                placeholder = { Text("Search users…", color = MaterialTheme.colorScheme.onSurfaceVariant) },
                leadingIcon = { Icon(Icons.Filled.Search, null, tint = Teal500) },
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Teal500,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline
                )
            )

            val requests = filtered.filter { it.friendship_status == "pending" && it.is_incoming }
            val accepted = filtered.filter { it.friendship_status == "accepted" }
            if (contacts.isEmpty()) {
                // Empty state
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("👋", fontSize = 48.sp)
                        Spacer(Modifier.height(12.dp))
                        Text("No friends yet\nTap the search button to find friends", style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
                    }
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)) {
                    if (requests.isNotEmpty()) {
                        item {
                            Text("Friend Requests", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(vertical = 8.dp))
                        }
                        items(requests, key = { "req_${it.id}" }) { user ->
                            Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                AvatarView(user.username, user.avatarUrl, 48.dp)
                                Spacer(Modifier.width(14.dp))
                                Text(user.username, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                                TextButton(onClick = { viewModel.acceptFriendRequest(user.id) }) { Text("Accept", color = Teal500) }
                                TextButton(onClick = { viewModel.removeFriend(user.id) }) { Text("Decline", color = MaterialTheme.colorScheme.error) }
                            }
                        }
                        item { Spacer(Modifier.height(16.dp)) }
                    }
                    if (accepted.isNotEmpty()) {
                        item {
                            Text("Friends", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(vertical = 8.dp))
                        }
                    }
                    items(accepted, key = { it.id }) { user ->
                        val isCurrentPeer = (connState as? ConnectionState.Connected)?.peer?.id == user.id
                        UserRow(
                            user = user,
                            isBusy = user.status == "connected" && !isCurrentPeer,
                            isCurrentPeer = isCurrentPeer,
                            onTap = {
                                if (user.status == "online") {
                                    viewModel.sendRequest(user)
                                } else if (isCurrentPeer) {
                                    val state = connState as ConnectionState.Connected
                                    onNavigateToChat(user, state.initiator)
                                }
                            },
                            onRemove = { viewModel.removeFriend(user.id) },
                            onBlock = { viewModel.blockUser(user.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun UserRow(
    user: OnlineUser, 
    isBusy: Boolean, 
    isCurrentPeer: Boolean = false, 
    onTap: () -> Unit,
    onRemove: (() -> Unit)? = null,
    onBlock: (() -> Unit)? = null
) {
    var menuExpanded by remember { mutableStateOf(false) }
    
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(enabled = !isBusy, onClick = onTap),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar with status dot
            Box {
                AvatarView(username = user.username, avatarUrl = user.avatarUrl, size = 48.dp)
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(if (isBusy) Yellow400 else Green400)
                        .align(Alignment.BottomEnd)
                )
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(user.username, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    if (isBusy) "In a conversation" else if (user.status == "offline") "Offline" else "Online",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (isBusy) Yellow400 else if (user.status == "offline") Grey400 else Green400
                )
            }
            if (!isBusy && user.status != "offline") {
                Surface(
                    color = Teal500.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(if (isCurrentPeer) "Return" else "Connect", modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        color = Teal500, style = MaterialTheme.typography.labelLarge)
                }
            }
            
            if (onRemove != null && onBlock != null) {
                Box {
                    IconButton(onClick = { menuExpanded = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "More options")
                    }
                    DropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Remove Friend") },
                            onClick = { menuExpanded = false; onRemove() }
                        )
                        DropdownMenuItem(
                            text = { Text("Block User", color = MaterialTheme.colorScheme.error) },
                            onClick = { menuExpanded = false; onBlock() }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun IncomingRequestDialog(callerName: String, onAccept: () -> Unit, onReject: () -> Unit) {
    AlertDialog(
        onDismissRequest = onReject,
        icon = { Text("📞", fontSize = 36.sp) },
        title = { Text("Incoming Request", fontWeight = FontWeight.Bold) },
        text = { Text("@$callerName wants to connect with you.") },
        confirmButton = {
            Button(
                onClick = onAccept,
                colors = ButtonDefaults.buttonColors(containerColor = Teal500)
            ) { Text("Accept") }
        },
        dismissButton = {
            OutlinedButton(onClick = onReject) { Text("Decline") }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchUserDialog(onDismiss: () -> Unit, onAdd: (OnlineUser) -> Unit) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf(emptyList<OnlineUser>()) }
    var isLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Contact") },
        text = {
            Column {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text("Username or email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        if (query.isBlank()) return@Button
                        isLoading = true
                        error = ""
                        scope.launch {
                            try {
                                val req = okhttp3.Request.Builder().url("${ApiClient.BASE_URL}/api/search?q=${query.trim()}").build()
                                val response = withContext(Dispatchers.IO) { ApiClient.http.newCall(req).execute() }
                                val body = response.body?.string() ?: ""
                                if (response.isSuccessful) {
                                    val obj = json.parseToJsonElement(body).jsonObject
                                    val usersArray = obj["users"]?.jsonArray ?: kotlinx.serialization.json.JsonArray(emptyList())
                                    val parsed = usersArray.map { json.decodeFromJsonElement(OnlineUser.serializer(), it) }
                                    results = parsed
                                } else {
                                    error = "Search failed"
                                }
                            } catch (e: Exception) {
                                error = e.message ?: "Network error"
                            } finally {
                                isLoading = false
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Teal500)
                ) {
                    Text("Search")
                }

                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally).padding(16.dp))
                }
                if (error.isNotEmpty()) {
                    Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
                }

                LazyColumn(modifier = Modifier.heightIn(max = 200.dp)) {
                    items(results) { user ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            AvatarView(user.username, user.avatarUrl, 40.dp)
                            Spacer(Modifier.width(12.dp))
                            Text(user.username, modifier = Modifier.weight(1f))
                            if (user.friendship_status == "none") {
                                TextButton(onClick = { onAdd(user) }) {
                                    Text("Add Friend", color = Teal500)
                                }
                            } else if (user.friendship_status == "accepted") {
                                Text("Friends", color = Teal500, style = MaterialTheme.typography.labelMedium)
                            } else if (user.is_incoming) {
                                Text("Wants to connect", color = Teal500, style = MaterialTheme.typography.labelMedium)
                            } else {
                                Text("Pending", color = Teal500, style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Close") }
        }
    )
}

