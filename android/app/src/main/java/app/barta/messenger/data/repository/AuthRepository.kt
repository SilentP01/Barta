package app.barta.messenger.data.repository

import android.content.Context
import app.barta.messenger.data.local.SecurePrefs
import app.barta.messenger.data.model.ApiError
import app.barta.messenger.data.model.LoginRequest
import app.barta.messenger.data.model.Result
import app.barta.messenger.data.model.SignupRequest
import app.barta.messenger.data.model.User
import app.barta.messenger.data.model.VerifyRequest
import app.barta.messenger.data.network.ApiClient
import app.barta.messenger.data.network.json
import kotlinx.serialization.encodeToString

class AuthRepository(private val context: Context) {

    suspend fun login(username: String, password: String): Result<User> = runCatching {
        val resp = ApiClient.post("/api/login", json.encodeToString(LoginRequest(identifier = username.trim(), password = password)))
        val text = resp.body?.string() ?: ""
        if (resp.isSuccessful) {
            val authResp = json.decodeFromString<app.barta.messenger.data.model.AuthResponse>(text)
            val user = authResp.user
            SecurePrefs.saveSession(context, user.id, user.username, user.email)
            Result.Success(user)
        } else {
            Result.Error(runCatching { json.decodeFromString<ApiError>(text).error }.getOrDefault("Login failed."))
        }
    }.getOrElse { Result.Error(it.message ?: "Network error.") }

    suspend fun signup(username: String, email: String, password: String): Result<String> = runCatching {
        val resp = ApiClient.post("/api/signup", json.encodeToString(SignupRequest(username.trim(), email.trim(), password)))
        val text = resp.body?.string() ?: ""
        if (resp.isSuccessful) Result.Success(email.trim())
        else Result.Error(runCatching { json.decodeFromString<ApiError>(text).error }.getOrDefault("Signup failed."))
    }.getOrElse { Result.Error(it.message ?: "Network error.") }

    suspend fun verifyEmail(email: String, code: String): Result<User> = runCatching {
        val resp = ApiClient.post("/api/verify", json.encodeToString(VerifyRequest(email, code)))
        val text = resp.body?.string() ?: ""
        if (resp.isSuccessful) {
            val authResp = json.decodeFromString<app.barta.messenger.data.model.AuthResponse>(text)
            val user = authResp.user
            SecurePrefs.saveSession(context, user.id, user.username, user.email)
            Result.Success(user)
        } else {
            Result.Error(runCatching { json.decodeFromString<ApiError>(text).error }.getOrDefault("Verification failed."))
        }
    }.getOrElse { Result.Error(it.message ?: "Network error.") }

    suspend fun checkSession(): Result<User> = runCatching {
        val resp = ApiClient.get("/api/me")
        val text = resp.body?.string() ?: ""
        if (resp.isSuccessful) {
            val authResp = json.decodeFromString<app.barta.messenger.data.model.AuthResponse>(text)
            val user = authResp.user
            SecurePrefs.saveSession(context, user.id, user.username, user.email)
            Result.Success(user)
        } else {
            SecurePrefs.clearSession(context)
            ApiClient.cookieJar.clear()
            Result.Error("Session expired.")
        }
    }.getOrElse { Result.Error(it.message ?: "Network error.") }

    fun logout() {
        SecurePrefs.clearSession(context)
        ApiClient.cookieJar.clear()
    }
}
