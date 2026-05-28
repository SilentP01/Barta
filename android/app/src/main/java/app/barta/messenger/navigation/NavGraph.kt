package app.barta.messenger.navigation

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import app.barta.messenger.data.model.OnlineUser
import app.barta.messenger.data.network.socketClient
import app.barta.messenger.ui.screens.SplashScreen
import app.barta.messenger.ui.screens.auth.LoginScreen
import app.barta.messenger.ui.screens.auth.SignupScreen
import app.barta.messenger.ui.screens.auth.VerifyEmailScreen
import app.barta.messenger.ui.screens.home.HomeScreen
import app.barta.messenger.ui.screens.profile.ProfileScreen
import app.barta.messenger.viewmodel.AuthViewModel
import app.barta.messenger.viewmodel.HomeViewModel

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
    // Shared HomeViewModel scoped to the nav graph so it survives Home ↔ Profile navigation
    val homeViewModel: HomeViewModel = viewModel()

    NavHost(navController = navController, startDestination = startDestination) {

        composable(Screen.Splash.route) { SplashScreen() }

        // ── Auth ──────────────────────────────────────────────────────────────
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

        // ── Home ──────────────────────────────────────────────────────────────
        composable(Screen.Home.route) {
            HomeScreen(
                viewModel = homeViewModel,
                onNavigateToChat = { peer ->
                    navController.navigate(Screen.Chat.createRoute(peer.id, peer.username))
                },
                onNavigateToProfile = { navController.navigate(Screen.Profile.route) },
                onLogout = {
                    authViewModel.logout()
                    socketClient.disconnect()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                }
            )
        }

        // ── Profile ───────────────────────────────────────────────────────────
        composable(Screen.Profile.route) {
            ProfileScreen(
                onBack = { navController.popBackStack() },
                onLogout = {
                    authViewModel.logout()
                    socketClient.disconnect()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        // ── Chat — Phase 3 placeholder ────────────────────────────────────────
        composable(Screen.Chat.route) { back ->
            val peerId   = back.arguments?.getString("peerId")?.toIntOrNull() ?: -1
            val peerName = back.arguments?.getString("peerName") ?: "Unknown"
            // TODO Phase 3: ChatScreen(peerId, peerName, homeViewModel)
            SplashScreen()
        }
    }
}
