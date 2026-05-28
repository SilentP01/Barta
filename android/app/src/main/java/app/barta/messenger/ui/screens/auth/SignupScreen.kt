package app.barta.messenger.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
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
fun SignupScreen(
    viewModel: AuthViewModel,
    onNeedsVerify: (String) -> Unit,
    onNavigateToLogin: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var username by remember { mutableStateOf("") }
    var email    by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirm  by remember { mutableStateOf("") }
    var errorMsg by remember { mutableStateOf("") }
    val isLoading = state is AuthUiState.Loading

    LaunchedEffect(state) {
        when (val s = state) {
            is AuthUiState.NeedsVerify -> onNeedsVerify(s.email)
            is AuthUiState.Error       -> { errorMsg = s.message; viewModel.resetState() }
            else -> {}
        }
    }

    fun doSignup() {
        errorMsg = ""
        if (username.isBlank() || email.isBlank() || password.isBlank()) { errorMsg = "All fields are required."; return }
        if (password != confirm) { errorMsg = "Passwords don't match."; return }
        viewModel.signup(username, email, password)
    }

    Box(modifier = Modifier.fillMaxSize()
        .background(Brush.verticalGradient(listOf(Navy900, Color(0xFF0D1F2D))))) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(Modifier.height(64.dp))
            Text("Create Account", style = MaterialTheme.typography.displayMedium.copy(fontWeight = FontWeight.ExtraBold), color = Color.White)
            Text("Join Barta today", color = Color.White.copy(alpha = 0.55f),
                style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp, bottom = 32.dp))

            ErrorBanner(errorMsg, modifier = Modifier.padding(bottom = 16.dp))

            BartaTextField(value = username, onValueChange = { username = it; errorMsg = "" }, label = "Username",
                leadingIcon = { Icon(Icons.Outlined.Person, null, tint = Teal500) })
            Spacer(Modifier.height(12.dp))
            BartaTextField(value = email, onValueChange = { email = it; errorMsg = "" }, label = "Email",
                leadingIcon = { Icon(Icons.Outlined.Email, null, tint = Teal500) }, keyboardType = KeyboardType.Email)
            Spacer(Modifier.height(12.dp))
            BartaTextField(value = password, onValueChange = { password = it; errorMsg = "" }, label = "Password", isPassword = true)
            Spacer(Modifier.height(12.dp))
            BartaTextField(value = confirm, onValueChange = { confirm = it; errorMsg = "" }, label = "Confirm Password",
                isPassword = true, imeAction = ImeAction.Done, onDone = ::doSignup)
            Spacer(Modifier.height(24.dp))
            BartaButton("Create Account", onClick = ::doSignup, modifier = Modifier.fillMaxWidth(),
                enabled = username.isNotBlank() && email.isNotBlank() && password.isNotBlank(), isLoading = isLoading)
            Spacer(Modifier.height(20.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Already have an account? ", color = Color.White.copy(alpha = 0.55f), style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = onNavigateToLogin) { Text("Sign In", color = Teal500, fontWeight = FontWeight.Bold) }
            }
            Spacer(Modifier.height(48.dp))
        }
    }
}
