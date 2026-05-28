package app.barta.messenger.ui.screens.profile

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.ExitToApp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.barta.messenger.data.local.SecurePrefs
import app.barta.messenger.data.repository.CloudinaryRepo
import app.barta.messenger.ui.components.AvatarView
import app.barta.messenger.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit
) {
    val context  = LocalContext.current
    val scope    = rememberCoroutineScope()
    var username by remember { mutableStateOf(SecurePrefs.getUsername(context)) }
    var email    by remember { mutableStateOf(SecurePrefs.getEmail(context)) }
    var avatar   by remember { mutableStateOf(SecurePrefs.getAvatarUrl(context)) }
    var uploading by remember { mutableStateOf(false) }
    var uploadErr by remember { mutableStateOf("") }
    var showLogoutDialog by remember { mutableStateOf(false) }

    // Photo picker launcher
    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        uploading = true; uploadErr = ""
        scope.launch {
            val result = CloudinaryRepo.uploadAvatar(context, uri)
            uploading = false
            result.fold(
                onSuccess = { url -> avatar = url },
                onFailure = { uploadErr = it.message ?: "Upload failed." }
            )
        }
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            icon = { Icon(Icons.Outlined.ExitToApp, null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Sign Out") },
            text = { Text("Are you sure you want to sign out of Barta?") },
            confirmButton = {
                Button(onClick = onLogout,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text("Sign Out") }
            },
            dismissButton = {
                OutlinedButton(onClick = { showLogoutDialog = false }) { Text("Cancel") }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Profile") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowBack, "Back") }
                },
                actions = {
                    IconButton(onClick = { showLogoutDialog = true }) {
                        Icon(Icons.Outlined.ExitToApp, "Sign out", tint = MaterialTheme.colorScheme.error)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(24.dp))

            // Avatar with upload button
            Box(contentAlignment = Alignment.BottomEnd) {
                Box(
                    modifier = Modifier.size(96.dp),
                    contentAlignment = Alignment.Center
                ) {
                    AvatarView(
                        username = username,
                        avatarUrl = avatar,
                        size = 96.dp,
                        modifier = Modifier
                            .border(3.dp, Brush.linearGradient(listOf(Teal500, Color(0xFF06B6D4))), CircleShape)
                    )
                    if (uploading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(32.dp),
                            color = Teal500,
                            strokeWidth = 3.dp
                        )
                    }
                }
                Surface(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .clickable(enabled = !uploading) { photoPicker.launch("image/*") },
                    color = Teal500,
                    shape = CircleShape
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.CameraAlt, "Change photo",
                            tint = Color.White, modifier = Modifier.size(16.dp))
                    }
                }
            }

            if (uploadErr.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text(uploadErr, color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelSmall)
            }

            Spacer(Modifier.height(16.dp))
            Text("@$username", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(email, style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp))

            Spacer(Modifier.height(32.dp))
            InfoCard(label = "Username", value = username)
            Spacer(Modifier.height(12.dp))
            InfoCard(label = "Email",    value = email)
            Spacer(Modifier.height(12.dp))
            InfoCard(label = "Profile Photo",
                value = if (avatar != null) "✓ Custom photo" else "Tap the camera icon above to add a photo")

            Spacer(Modifier.height(32.dp))
            OutlinedButton(
                onClick = { showLogoutDialog = true },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f))
            ) {
                Icon(Icons.Outlined.ExitToApp, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Sign Out", fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
fun InfoCard(label: String, value: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
        }
    }
}
