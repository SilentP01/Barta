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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel = viewModel(),
    onNavigateToChat: (OnlineUser, Boolean) -> Unit,
    onNavigateToProfile: () -> Unit,
    onLogout: () -> Unit
) {
    val users      by viewModel.users.collectAsStateWithLifecycle()
    val connState  by viewModel.connState.collectAsStateWithLifecycle()
    val socketReady by viewModel.socketReady.collectAsStateWithLifecycle()
    val query      by viewModel.searchQuery.collectAsStateWithLifecycle()
    val filtered   = viewModel.filteredUsers()

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
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
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

            // Online count label
            Text(
                "${filtered.size} online",
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 2.dp),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (filtered.isEmpty() && socketReady) {
                // Empty state
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🕊️", fontSize = 48.sp)
                        Spacer(Modifier.height(12.dp))
                        Text("No one online right now", style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
                    }
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)) {
                    items(filtered, key = { it.id }) { user ->
                        UserRow(
                            user = user,
                            isBusy = user.status == "connected",
                            onTap = {
                                if (user.status == "online") viewModel.sendRequest(user)
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun UserRow(user: OnlineUser, isBusy: Boolean, onTap: () -> Unit) {
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
                    if (isBusy) "In a conversation" else "Available to chat",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (isBusy) Yellow400 else Green400
                )
            }
            if (!isBusy) {
                Surface(
                    color = Teal500.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text("Connect", modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        color = Teal500, style = MaterialTheme.typography.labelLarge)
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
