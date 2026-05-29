package app.barta.messenger.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import app.barta.messenger.MainActivity
import app.barta.messenger.R

object NotificationHelper {

    const val CHANNEL_CALLS    = "barta_calls"
    const val CHANNEL_MESSAGES = "barta_messages"
    const val CHANNEL_SERVICE  = "barta_service"

    const val NOTIF_INCOMING_CALL = 1001
    const val NOTIF_ACTIVE_CALL   = 1002
    const val NOTIF_MESSAGE       = 1003

    /** Create all notification channels (call once in Application.onCreate) */
    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(NotificationManager::class.java)

        // High-priority channel for incoming calls (heads-up + full-screen)
        val ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        val audioAttr = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_CALLS, "Calls", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Incoming connection requests and calls"
                setSound(ringtone, audioAttr)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 250, 500)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
        )

        // Default channel for messages
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_MESSAGES, "Messages", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Chat messages"
            }
        )

        // Silent channel for persistent foreground service notification
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_SERVICE, "Barta Service", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Background service indicator"
                setSound(null, null)
                enableVibration(false)
            }
        )
    }

    /** Full-screen incoming call notification (shows on locked screen) */
    fun showIncomingCallNotification(context: Context, callerName: String, callerId: String) {
        // Intent that opens MainActivity with incoming call action
        val intent = Intent(context, MainActivity::class.java).apply {
            action = "ACTION_INCOMING_REQUEST"
            putExtra("caller_name", callerName)
            putExtra("caller_id", callerId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val fullScreenPi = PendingIntent.getActivity(
            context, NOTIF_INCOMING_CALL, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Accept action
        val acceptIntent = Intent(context, MainActivity::class.java).apply {
            action = "ACTION_ACCEPT_REQUEST"
            putExtra("caller_name", callerName)
            putExtra("caller_id", callerId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val acceptPi = PendingIntent.getActivity(
            context, NOTIF_INCOMING_CALL + 1, acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Decline action
        val declineIntent = Intent(context, MainActivity::class.java).apply {
            action = "ACTION_DECLINE_REQUEST"
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val declinePi = PendingIntent.getActivity(
            context, NOTIF_INCOMING_CALL + 2, declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notif = NotificationCompat.Builder(context, CHANNEL_CALLS)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("Incoming Request")
            .setContentText("$callerName wants to connect with you")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(fullScreenPi, true)
            .setContentIntent(fullScreenPi)
            .addAction(android.R.drawable.ic_menu_call, "Accept", acceptPi)
            .addAction(android.R.drawable.ic_delete, "Decline", declinePi)
            .setAutoCancel(true)
            .setOngoing(true)
            .setVibrate(longArrayOf(0, 500, 250, 500))
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
            .build()

        try {
            NotificationManagerCompat.from(context).notify(NOTIF_INCOMING_CALL, notif)
        } catch (_: SecurityException) { /* No POST_NOTIFICATIONS permission yet */ }
    }

    fun cancelIncomingCallNotification(context: Context) {
        NotificationManagerCompat.from(context).cancel(NOTIF_INCOMING_CALL)
    }

    /** Persistent notification during an active call */
    fun buildActiveCallNotification(context: Context, peerName: String): android.app.Notification {
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pi = PendingIntent.getActivity(
            context, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(context, CHANNEL_SERVICE)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("In a call with $peerName")
            .setContentText("Tap to return to Barta")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(pi)
            .build()
    }
}
