package app.barta.messenger.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable

private val DarkColors = darkColorScheme(
    primary          = Teal500,
    onPrimary        = White,
    primaryContainer = Teal700,
    secondary        = Violet500,
    onSecondary      = White,
    background       = Navy900,
    onBackground     = White,
    surface          = Navy800,
    onSurface        = White,
    surfaceVariant   = Navy700,
    onSurfaceVariant = Grey400,
    outline          = Navy600,
    error            = Red400,
    onError          = White,
)

private val LightColors = lightColorScheme(
    primary          = Teal600,
    onPrimary        = White,
    primaryContainer = Teal100,
    secondary        = Violet500,
    onSecondary      = White,
    background       = Grey100,
    onBackground     = Grey900,
    surface          = White,
    onSurface        = Grey900,
    surfaceVariant   = Grey200,
    onSurfaceVariant = Grey600,
    outline          = Grey200,
    error            = Red400,
    onError          = White,
)

@Composable
fun BartaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography  = BartaTypography,
        content     = content
    )
}
