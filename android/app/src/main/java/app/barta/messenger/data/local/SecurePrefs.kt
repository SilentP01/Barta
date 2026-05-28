package app.barta.messenger.data.local

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object SecurePrefs {
    private const val PREFS_NAME    = "barta_secure_prefs"
    private const val KEY_USER_ID   = "user_id"
    private const val KEY_USERNAME  = "username"
    private const val KEY_EMAIL     = "email"
    private const val KEY_AVATAR    = "avatar_url"
    private const val KEY_FCM       = "fcm_token"

    private fun prefs(context: Context) = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveSession(context: Context, userId: Int, username: String, email: String) =
        prefs(context).edit().putInt(KEY_USER_ID, userId).putString(KEY_USERNAME, username).putString(KEY_EMAIL, email).apply()

    fun clearSession(context: Context) = prefs(context).edit().clear().apply()

    fun isLoggedIn(context: Context)   = prefs(context).getInt(KEY_USER_ID, -1) != -1
    fun getUserId(context: Context)    = prefs(context).getInt(KEY_USER_ID, -1)
    fun getUsername(context: Context)  = prefs(context).getString(KEY_USERNAME, "") ?: ""
    fun getEmail(context: Context)     = prefs(context).getString(KEY_EMAIL, "") ?: ""
    fun getAvatarUrl(context: Context) = prefs(context).getString(KEY_AVATAR, null)

    fun saveAvatarUrl(context: Context, url: String) = prefs(context).edit().putString(KEY_AVATAR, url).apply()
    fun saveFcmToken(context: Context, token: String) = prefs(context).edit().putString(KEY_FCM, token).apply()
    fun getFcmToken(context: Context) = prefs(context).getString(KEY_FCM, null)
}
