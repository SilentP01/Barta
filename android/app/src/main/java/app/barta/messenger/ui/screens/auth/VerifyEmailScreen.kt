package app.barta.messenger.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.MarkEmailRead
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.barta.messenger.ui.components.BartaButton
import app.barta.messenger.ui.components.BartaTextField
import app.barta.messenger.ui.components.ErrorBanner
import app.barta.messenger.ui.theme.Navy900
import app.barta.messenger.ui.theme.Teal500
import app.barta.messenger.viewmodel.AuthUiState
import app.barta.messenger.viewmodel.AuthViewModel

@Composable
fun VerifyEmailScreen(
    viewModel: AuthViewModel,
    email: String,
    onSuccess: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var code     by remember { mutableStateOf("") }
    var errorMsg by remember { mutableStateOf("") }
    val isLoading = state is AuthUiState.Loading

    LaunchedEffect(state) {
        when (val s = state) {
            is AuthUiState.Success -> onSuccess()
            is AuthUiState.Error   -> { errorMsg = s.message; viewModel.resetState() }
            else -> {}
        }
    }

    Box(
        modifier = Modifier.fillMaxSize()
            .background(Brush.verticalGradient(listOf(Navy900, Color(0xFF0D1F2D)))),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(Icons.Outlined.MarkEmailRead, null, tint = Teal500, modifier = Modifier.size(72.dp))
            Spacer(Modifier.height(20.dp))
            Text("Check Your Email", style = MaterialTheme.typography.titleLarge,
                color = Color.White, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            Text("We sent a 6-digit code to\n$email",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.6f), textAlign = TextAlign.Center)
            Spacer(Modifier.height(32.dp))
            ErrorBanner(errorMsg, modifier = Modifier.padding(bottom = 16.dp))
            BartaTextField(
                value = code,
                onValueChange = { if (it.length <= 6 && it.all(Char::isDigit)) { code = it; errorMsg = "" } },
                label = "6-digit code",
                keyboardType = KeyboardType.NumberPassword,
                onDone = { if (code.length == 6) viewModel.verify(code) }
            )
            Spacer(Modifier.height(24.dp))
            BartaButton("Verify & Continue", onClick = { viewModel.verify(code) },
                modifier = Modifier.fillMaxWidth(), enabled = code.length == 6, isLoading = isLoading)
        }
    }
}
