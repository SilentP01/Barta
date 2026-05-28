package app.barta.messenger

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.rememberNavController
import app.barta.messenger.data.model.Result
import app.barta.messenger.data.repository.AuthRepository
import app.barta.messenger.navigation.BartaNavGraph
import app.barta.messenger.navigation.Screen
import app.barta.messenger.ui.theme.BartaTheme
import app.barta.messenger.viewmodel.AuthViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)

        // Block screenshots and screen recording for privacy
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)

        enableEdgeToEdge()
        WindowCompat.setDecorFitsSystemWindows(window, false)

        setContent {
            BartaTheme {
                val navController  = rememberNavController()
                val authViewModel: AuthViewModel = viewModel()
                var startDest by remember { mutableStateOf(Screen.Splash.route) }
                var ready     by remember { mutableStateOf(false) }

                // Hold splash until session check completes
                splashScreen.setKeepOnScreenCondition { !ready }

                LaunchedEffect(Unit) {
                    val result = AuthRepository(applicationContext).checkSession()
                    startDest = if (result is Result.Success) Screen.Home.route else Screen.Login.route
                    ready = true
                }

                if (ready) {
                    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                        BartaNavGraph(
                            navController    = navController,
                            startDestination = startDest,
                            authViewModel    = authViewModel
                        )
                    }
                }
            }
        }
    }
}
