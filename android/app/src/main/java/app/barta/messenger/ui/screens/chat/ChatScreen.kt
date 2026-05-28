package app.barta.messenger.ui.screens.chat

import android.view.ViewGroup
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.barta.messenger.data.model.ChatMessage
import app.barta.messenger.data.network.CallKind
import app.barta.messenger.ui.components.AvatarView
import app.barta.messenger.ui.theme.*
import app.barta.messenger.viewmodel.CallState
import app.barta.messenger.viewmodel.ChatViewModel
import org.webrtc.SurfaceViewRenderer
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: ChatViewModel,
    onBack: () -> Unit
) {
    val messages   by viewModel.messages.collectAsStateWithLifecycle()
    val callState  by viewModel.callState.collectAsStateWithLifecycle()
    val rtcConnected by viewModel.webRTC.connected.collectAsStateWithLifecycle()
    val peerLeft   by viewModel.peerLeft.collectAsStateWithLifecycle()
    val listState  = rememberLazyListState()

    var messageText by remember { mutableStateOf("") }

    // Scroll to bottom on new message
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    // When peer disconnects, show snackbar and enable back
    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(peerLeft) {
        if (peerLeft) {
            snackbarHostState.showSnackbar("${viewModel.peer.username} disconnected")
        }
    }

    // If a call is active, overlay the call screen
    if (callState is CallState.Active) {
        ActiveCallScreen(
            viewModel = viewModel,
            callState = callState as CallState.Active
        )
        return
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = {
                        if (!peerLeft) viewModel.disconnect()
                        onBack()
                    }) { Icon(Icons.Outlined.ArrowBack, "Back") }
                },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AvatarView(username = viewModel.peer.username, size = 36.dp)
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(viewModel.peer.username, style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold)
                            Text(
                                if (rtcConnected) "Connected" else "Connecting…",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (rtcConnected) Green400 else Yellow400
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::startAudioCall) {
                        Icon(Icons.Filled.Call, "Audio call", tint = Teal500)
                    }
                    IconButton(onClick = viewModel::startVideoCall) {
                        Icon(Icons.Filled.Videocam, "Video call", tint = Teal500)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {

            // Message list
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                if (messages.isEmpty()) {
                    item {
                        Box(Modifier.fillParentMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("🔒", fontSize = 40.sp)
                                Spacer(Modifier.height(8.dp))
                                Text("End-to-end encrypted", style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
                                Text("Say hello!", style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
                items(messages, key = { it.hashCode() }) { msg ->
                    MessageBubble(msg)
                }
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))

            // Composer
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .imePadding()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = messageText,
                    onValueChange = { messageText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Message…") },
                    shape = RoundedCornerShape(24.dp),
                    singleLine = false,
                    maxLines = 4,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Teal500,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline
                    )
                )
                Spacer(Modifier.width(8.dp))
                FilledIconButton(
                    onClick = {
                        if (messageText.isNotBlank()) {
                            viewModel.sendMessage(messageText.trim())
                            messageText = ""
                        }
                    },
                    enabled = messageText.isNotBlank() && rtcConnected,
                    colors = IconButtonDefaults.filledIconButtonColors(containerColor = Teal500)
                ) {
                    Icon(Icons.Filled.Send, "Send", tint = Color.White)
                }
            }
        }
    }
}

// ── Message bubble ────────────────────────────────────────────────────────────

@Composable
fun MessageBubble(msg: ChatMessage) {
    when (msg) {
        is ChatMessage.Text -> {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = if (msg.fromMe) Arrangement.End else Arrangement.Start
            ) {
                Surface(
                    shape = RoundedCornerShape(
                        topStart = 18.dp, topEnd = 18.dp,
                        bottomStart = if (msg.fromMe) 18.dp else 4.dp,
                        bottomEnd   = if (msg.fromMe) 4.dp  else 18.dp
                    ),
                    color = if (msg.fromMe) Teal500 else MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier.widthIn(max = 280.dp)
                ) {
                    Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
                        Text(
                            msg.text,
                            color = if (msg.fromMe) Color.White else MaterialTheme.colorScheme.onSurface,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Text(
                            formatTime(msg.timestamp),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (msg.fromMe) Color.White.copy(0.6f) else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.align(Alignment.End).padding(top = 2.dp)
                        )
                    }
                }
            }
        }
        is ChatMessage.System -> {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text(
                    msg.text, style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(0.5f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
        }
        else -> {}
    }
}

private fun formatTime(ms: Long): String =
    SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ms))

// ── Active call screen ────────────────────────────────────────────────────────

@Composable
fun ActiveCallScreen(
    viewModel: ChatViewModel,
    callState: CallState.Active
) {
    val context = LocalContext.current
    val remoteVideo by viewModel.webRTC.remoteVideo.collectAsStateWithLifecycle()
    val localVideo  by viewModel.webRTC.localVideo.collectAsStateWithLifecycle()

    Box(
        modifier = Modifier.fillMaxSize()
            .background(Color(0xFF0F1117))
    ) {
        // Remote video (full screen)
        if (callState.kind == CallKind.VIDEO && remoteVideo != null) {
            AndroidView(
                factory = { ctx ->
                    SurfaceViewRenderer(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        init(viewModel.webRTC.eglBase.eglBaseContext, null)
                        setMirror(false)
                        remoteVideo?.addSink(this)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        } else {
            // Audio call / no video — avatar
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    AvatarView(username = viewModel.peer.username, size = 96.dp)
                    Spacer(Modifier.height(16.dp))
                    Text(viewModel.peer.username, color = Color.White,
                        style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Text("In call…", color = Color.White.copy(alpha = 0.6f),
                        style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        // Local video (PiP corner)
        if (callState.kind == CallKind.VIDEO && localVideo != null && callState.camOn) {
            AndroidView(
                factory = { ctx ->
                    SurfaceViewRenderer(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(120.dp.value.toInt(), 160.dp.value.toInt())
                        init(viewModel.webRTC.eglBase.eglBaseContext, null)
                        setMirror(true)
                        localVideo?.addSink(this)
                    }
                },
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(16.dp)
                    .size(width = 100.dp, height = 140.dp)
                    .clip(RoundedCornerShape(12.dp))
            )
        }

        // Call controls bar (bottom)
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(bottom = 32.dp, start = 24.dp, end = 24.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Mute mic
            CallControlBtn(
                icon  = if (callState.micOn) Icons.Filled.Mic else Icons.Filled.MicOff,
                label = if (callState.micOn) "Mute" else "Unmute",
                color = if (callState.micOn) Color.White.copy(0.15f) else Yellow400.copy(0.25f),
                onClick = viewModel::toggleMic
            )

            // End call
            FilledIconButton(
                onClick = viewModel::endCall,
                modifier = Modifier.size(68.dp),
                colors = IconButtonDefaults.filledIconButtonColors(containerColor = Red400)
            ) {
                Icon(Icons.Filled.CallEnd, "End call", tint = Color.White, modifier = Modifier.size(30.dp))
            }

            // Toggle camera (only in video calls)
            if (callState.kind == CallKind.VIDEO) {
                CallControlBtn(
                    icon  = if (callState.camOn) Icons.Filled.Videocam else Icons.Filled.VideocamOff,
                    label = if (callState.camOn) "Camera" else "No cam",
                    color = if (callState.camOn) Color.White.copy(0.15f) else Yellow400.copy(0.25f),
                    onClick = viewModel::toggleCamera
                )
            } else {
                Spacer(Modifier.size(64.dp))
            }
        }
    }
}

@Composable
fun CallControlBtn(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    color: Color,
    onClick: () -> Unit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        FilledIconButton(
            onClick = onClick,
            modifier = Modifier.size(56.dp),
            colors = IconButtonDefaults.filledIconButtonColors(containerColor = color)
        ) {
            Icon(icon, label, tint = Color.White, modifier = Modifier.size(24.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(0.7f))
    }
}
