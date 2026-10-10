package com.misync.recorder.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

object MISyncColors {
    val Background = Color(0xFF0A0A0D)
    val Surface = Color(0xFF141419)
    val SurfaceRaised = Color(0xFF1C1C23)
    val Outline = Color(0xFF2A2A33)
    val TextPrimary = Color(0xFFF2F2F5)
    val TextSecondary = Color(0xFF9A9AA6)
    val Accent = Color(0xFFC9B37E) // muted champagne
    val Recording = Color(0xFFFF4D5E)
    val Paused = Color(0xFFFFB547)
    val Secure = Color(0xFF3DDC97)
    val Warning = Color(0xFFFFB547)
    val Error = Color(0xFFFF6B6B)
}

private val colors = darkColorScheme(
    primary = MISyncColors.Accent,
    onPrimary = Color(0xFF1A1508),
    secondary = MISyncColors.Secure,
    background = MISyncColors.Background,
    onBackground = MISyncColors.TextPrimary,
    surface = MISyncColors.Surface,
    onSurface = MISyncColors.TextPrimary,
    surfaceVariant = MISyncColors.SurfaceRaised,
    onSurfaceVariant = MISyncColors.TextSecondary,
    surfaceContainer = MISyncColors.Surface,
    surfaceContainerHigh = MISyncColors.SurfaceRaised,
    outline = MISyncColors.Outline,
    outlineVariant = MISyncColors.Outline,
    error = MISyncColors.Error,
)

private val typography = Typography(
    displayLarge = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Light, fontSize = 64.sp, letterSpacing = (-1).sp),
    headlineSmall = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 22.sp, letterSpacing = 0.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.Medium, fontSize = 16.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.sp, letterSpacing = 0.6.sp),
    labelSmall = TextStyle(fontWeight = FontWeight.Medium, fontSize = 11.sp, letterSpacing = 0.8.sp),
)

@Composable
fun MISyncTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, typography = typography, content = content)
}
