package app.barta.messenger.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
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
fun LoginScreen(
    viewModel: AuthViewModel,
    onSuccess: () -> Unit,
    onNavigateToSignup: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
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
            .background(Brush.verticalGradient(listOf(Navy900, Color(0xFF0D1F2D))))
    ) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(Modifier.height(64.dp))
            Text("Barta", style = MaterialTheme.typography.displayMedium.copy(
                fontWeight = FontWeight.ExtraBold,
                brush = Brush.linearGradient(listOf(Teal500, Color(0xFF06B6D4)))
            ))
            Text("Barta - Communication, Reimagined.", color = Color.White.copy(alpha = 0.55f),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 8.dp, bottom = 36.dp))

            ErrorBanner(errorMsg, modifier = Modifier.padding(bottom = 16.dp))

            BartaTextField(value = username, onValueChange = { username = it; errorMsg = "" },
                label = "Username", leadingIcon = { Icon(Icons.Outlined.Person, null, tint = Teal500) })
            Spacer(Modifier.height(14.dp))
            BartaTextField(value = password, onValueChange = { password = it; errorMsg = "" },
                label = "Password", isPassword = true, imeAction = ImeAction.Done,
                onDone = { if (username.isNotBlank() && password.isNotBlank()) viewModel.login(username, password) })
            Spacer(Modifier.height(14.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = { /* TODO: Magic Link route */ }) {
                    Text("Forgot Password?", color = Teal500, style = MaterialTheme.typography.bodySmall)
                }
            }
            Spacer(Modifier.height(8.dp))
            BartaButton("Sign In", onClick = { viewModel.login(username, password) },
                modifier = Modifier.fillMaxWidth(),
                enabled = username.isNotBlank() && password.isNotBlank(), isLoading = isLoading)
            Spacer(Modifier.height(24.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Don't have an account? ", color = Color.White.copy(alpha = 0.55f),
                    style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = onNavigateToSignup) {
                    Text("Sign Up", color = Teal500, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(48.dp))
        }
    }
}
