package app.barta.messenger.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import app.barta.messenger.ui.screens.SplashScreen
import app.barta.messenger.ui.screens.auth.LoginScreen
import app.barta.messenger.ui.screens.auth.SignupScreen
import app.barta.messenger.ui.screens.auth.VerifyEmailScreen
import app.barta.messenger.viewmodel.AuthViewModel

sealed class Screen(val route: String) {
    object Splash       : Screen("splash")
    object Login        : Screen("login")
    object Signup       : Screen("signup")
    object Verify       : Screen("verify/{email}") {
        fun createRoute(email: String) = "verify/$email"
    }
    object Home         : Screen("home")
    object Chat         : Screen("chat/{peerId}/{peerName}") {
        fun createRoute(peerId: Int, peerName: String) = "chat/$peerId/$peerName"
    }
    object Profile      : Screen("profile")
    object IncomingCall : Screen("incoming_call/{callerName}") {
        fun createRoute(name: String) = "incoming_call/$name"
    }
    object ActiveCall   : Screen("active_call")
}

@Composable
fun BartaNavGraph(
    navController: NavHostController,
    startDestination: String,
    authViewModel: AuthViewModel
) {
    NavHost(navController = navController, startDestination = startDestination) {

        composable(Screen.Splash.route) { SplashScreen() }

        composable(Screen.Login.route) {
            LoginScreen(
                viewModel = authViewModel,
                onSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToSignup = { navController.navigate(Screen.Signup.route) }
            )
        }

        composable(Screen.Signup.route) {
            SignupScreen(
                viewModel = authViewModel,
                onNeedsVerify = { email ->
                    navController.navigate(Screen.Verify.createRoute(email))
                },
                onNavigateToLogin = { navController.popBackStack() }
            )
        }

        composable(Screen.Verify.route) { back ->
            val email = back.arguments?.getString("email") ?: ""
            VerifyEmailScreen(
                viewModel = authViewModel,
                email = email,
                onSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Signup.route) { inclusive = true }
                    }
                }
            )
        }

        // ── Phase 2 placeholders ───────────────────────────────────────────
        composable(Screen.Home.route) {
            // TODO Phase 2: HomeScreen
            SplashScreen()
        }
    }
}
