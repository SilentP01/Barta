package app.barta.messenger

import android.app.Application
import app.barta.messenger.util.NotificationHelper
import com.google.firebase.FirebaseApp

class BartaApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize Firebase
        FirebaseApp.initializeApp(this)
        // Initialize API Client cookies
        app.barta.messenger.data.network.ApiClient.init(this)
        // Create notification channels (must be done before any notification is shown)
        NotificationHelper.createChannels(this)
    }
}
