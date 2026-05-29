package app.barta.messenger.service

import android.content.Intent
import app.barta.messenger.data.local.SecurePrefs
import app.barta.messenger.data.network.ApiClient
import app.barta.messenger.data.network.JSON_MEDIA
import app.barta.messenger.util.NotificationHelper
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class BartaFirebaseMessagingService : FirebaseMessagingService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * Called when Firebase generates a new FCM token.
     * Save locally and send to server if user is logged in.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        SecurePrefs.saveFcmToken(applicationContext, token)
        if (SecurePrefs.isLoggedIn(applicationContext)) {
            sendTokenToServer(token)
        }
    }

    /**
     * Called when app is in foreground OR when a data-only message arrives in background.
     * For notification messages in background, the system shows them automatically.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val type = message.data["type"] ?: return

        when (type) {
            "incoming-request" -> {
                val callerName = message.data["fromUsername"] ?: "Someone"
                val callerId   = message.data["fromId"] ?: ""

                // Show full-screen incoming call notification
                NotificationHelper.showIncomingCallNotification(
                    context      = applicationContext,
                    callerName   = callerName,
                    callerId     = callerId
                )
            }
        }
    }

    private fun sendTokenToServer(token: String) {
        scope.launch {
            try {
                val body = """{"token":"$token"}""".toRequestBody(JSON_MEDIA)
                val req  = Request.Builder().url("${ApiClient.BASE_URL}/api/fcm-token").post(body).build()
                ApiClient.http.newCall(req).execute().close()
            } catch (_: Exception) { /* Retry on next launch */ }
        }
    }
}
