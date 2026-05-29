package app.barta.messenger.service

import android.app.Service
import android.content.Intent
import android.os.IBinder
import app.barta.messenger.util.NotificationHelper

/**
 * Foreground service that runs during active calls.
 * Prevents Android from killing the process (and thus the WebRTC connection)
 * when the screen turns off or the user switches apps.
 */
class CallForegroundService : Service() {

    companion object {
        const val ACTION_START = "ACTION_START_CALL"
        const val ACTION_STOP  = "ACTION_STOP_CALL"
        const val EXTRA_PEER   = "peer_name"
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val peerName = intent.getStringExtra(EXTRA_PEER) ?: "Peer"
                val notif = NotificationHelper.buildActiveCallNotification(this, peerName)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    startForeground(
                        NotificationHelper.NOTIF_ACTIVE_CALL,
                        notif,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                    )
                } else {
                    startForeground(NotificationHelper.NOTIF_ACTIVE_CALL, notif)
                }
            }
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_NOT_STICKY  // Don't restart if killed
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
