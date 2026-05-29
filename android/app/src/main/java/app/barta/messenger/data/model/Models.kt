package app.barta.messenger.data.model

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val username: String,
    val email: String,
    val status: String = "online",
    val avatarUrl: String? = null
)

@Serializable
data class AuthResponse(val user: User)

@Serializable
data class LoginRequest(val identifier: String, val password: String)

@Serializable
data class SignupRequest(val username: String, val email: String, val password: String, val passwordConfirm: String)

@Serializable
data class VerifyRequest(val email: String, val code: String)

@Serializable
data class ApiError(val error: String = "Something went wrong.")

@Serializable
data class OnlineUser(
    val id: String,
    val username: String,
    val status: String,
    val avatarUrl: String? = null,
    val friendship_status: String = "none",
    val is_incoming: Boolean = false
)

@Serializable
data class FriendsResponse(val friends: List<OnlineUser>)

@Serializable
data class SearchResponse(val users: List<OnlineUser>)

sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
    object Loading : Result<Nothing>()
}
