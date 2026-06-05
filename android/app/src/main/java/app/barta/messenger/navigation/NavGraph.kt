package app.barta.messenger.navigation

import android.app.Application
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
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
import app.barta.messenger.ui.screens.chat.ChatScreen
import app.barta.messenger.ui.screens.home.HomeScreen
import app.barta.messenger.ui.screens.profile.ProfileScreen
import app.barta.messenger.viewmodel.AuthViewModel
import app.barta.messenger.viewmodel.ChatViewModel
import app.barta.messenger.viewmodel.ChatViewModelFactory
import app.barta.messenger.viewmodel.HomeViewModel

sealed class Screen(val route: String) {
    object Splash       : Screen("splash")
    object Login        : Screen("login")
    object Signup       : Screen("signup")
    object Verify       : Screen("verify/{email}") {
        fun createRoute(email: String) = "verify/$email"
    }
    object Home         : Screen("home")
    object Chat         : Screen("chat/{peerId}/{peerName}/{peerAvatar}/{initiator}") {
        fun createRoute(peer: OnlineUser, initiator: Boolean) =
            "chat/${peer.id}/${peer.username}/${(peer.avatarUrl ?: "null")}/$initiator"
    }
    object Profile      : Screen("profile")
    object IncomingCall : Screen("incoming_call/{callerName}") {
        fun createRoute(name: String) = "incoming_call/$name"
    }
}

@Composable
fun BartaNavGraph(
    navController: NavHostController,
    startDestination: String,
    authViewModel: AuthViewModel
) {
    val homeViewModel: HomeViewModel = viewModel()

    NavHost(navController = navController, startDestination = startDestination) {

        // ── Splash ────────────────────────────────────────────────────────────
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
                onNavigateToChat = { peer, initiator ->
                    navController.navigate(Screen.Chat.createRoute(peer, initiator)) {
                        launchSingleTop = true
                    }
                },
                onNavigateToProfile = { navController.navigate(Screen.Profile.route) }
            )
        }

        // ── Chat ──────────────────────────────────────────────────────────────
        composable(Screen.Chat.route) { back ->
            val app      = LocalContext.current.applicationContext as Application
            val peerId   = back.arguments?.getString("peerId") ?: ""
            val peerName = back.arguments?.getString("peerName") ?: ""
            val avatar   = back.arguments?.getString("peerAvatar")?.takeIf { it != "null" }
            val initiator = back.arguments?.getString("initiator")?.toBoolean() ?: false
            val peer = OnlineUser(id = peerId, username = peerName, status = "connected", avatarUrl = avatar)

            val chatViewModel: ChatViewModel = viewModel(
                factory = ChatViewModelFactory(app, peer, initiator)
            )
            ChatScreen(
                viewModel = chatViewModel,
                onBack = {
                    navController.popBackStack()
                    homeViewModel.disconnectPeer()
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
    }
}
