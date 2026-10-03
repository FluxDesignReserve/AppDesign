package io.github.polarsync.ui

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

// Fixed Polarsync palette for Android 11 and older, which have no Material You.
private val BrandLight = lightColorScheme(
    primary = Color(0xFF3F5AA9),
    onPrimary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFDCE2F9),
    onSecondaryContainer = Color(0xFF141B2C),
    error = Color(0xFFBA1A1A),
    onError = Color(0xFFFFFFFF),
)
private val BrandDark = darkColorScheme(
    primary = Color(0xFFB2C5FF),
    onPrimary = Color(0xFF182E60),
    secondaryContainer = Color(0xFF3C4758),
    onSecondaryContainer = Color(0xFFDCE2F9),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
)

/** Material You colours on Android 12+, a fixed Polarsync palette on older devices. */
@Composable
fun PolarsyncTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current
    val colors = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    } else {
        if (dark) BrandDark else BrandLight
    }
    MaterialTheme(colorScheme = colors, content = content)
}
