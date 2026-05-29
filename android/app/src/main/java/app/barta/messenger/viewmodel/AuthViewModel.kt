package app.barta.messenger.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.barta.messenger.data.model.Result
import app.barta.messenger.data.model.User
import app.barta.messenger.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    data class Success(val user: User) : AuthUiState()
    data class NeedsVerify(val email: String) : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

class AuthViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = AuthRepository(app.applicationContext)

    private val _state = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val state: StateFlow<AuthUiState> = _state

    var pendingEmail: String = ""; private set

    fun login(username: String, password: String) {
        _state.value = AuthUiState.Loading
        viewModelScope.launch {
            _state.value = when (val r = repo.login(username, password)) {
                is Result.Success -> AuthUiState.Success(r.data)
                is Result.Error   -> AuthUiState.Error(r.message)
                else -> AuthUiState.Idle
            }
        }
    }

    fun signup(username: String, email: String, password: String, passwordConfirm: String) {
        _state.value = AuthUiState.Loading
        viewModelScope.launch {
            when (val r = repo.signup(username, email, password, passwordConfirm)) {
                is Result.Success -> { pendingEmail = r.data; _state.value = AuthUiState.NeedsVerify(r.data) }
                is Result.Error   -> _state.value = AuthUiState.Error(r.message)
                else -> {}
            }
        }
    }

    fun verify(code: String) {
        _state.value = AuthUiState.Loading
        viewModelScope.launch {
            _state.value = when (val r = repo.verifyEmail(pendingEmail, code)) {
                is Result.Success -> AuthUiState.Success(r.data)
                is Result.Error   -> AuthUiState.Error(r.message)
                else -> AuthUiState.Idle
            }
        }
    }

    fun resetState() { _state.value = AuthUiState.Idle }

    fun logout() { repo.logout() }
}
