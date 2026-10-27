package com.vibeallday.mobile.ui

import com.vibeallday.mobile.connection.VibeAllDayConnectionPhase
import com.vibeallday.mobile.connection.VibeAllDayConnectionState
import com.vibeallday.mobile.notifications.NativePushFailure
import com.vibeallday.mobile.notifications.NotificationPermissionState
import com.vibeallday.mobile.notifications.NotificationStatus
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerSnapshot
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerProfile
import com.vibeallday.mobile.profiles.VibeAllDayServerRoute
import java.util.Locale
import uniffi.vibeallday_mobile_core.CoreException

enum class VibeAllDayPairingRouteKind {
    DIRECT,
    RELAY,
}

data class VibeAllDayPairingInput(
    val username: String,
    val password: String,
    val routeKind: VibeAllDayPairingRouteKind = VibeAllDayPairingRouteKind.RELAY,
    val relayWebsocketUrl: String = "",
    val directWebsocketUrl: String = "",
)

// Keep aligned with @vibeallday/shared DEFAULT_RELAY_URL.
internal const val DEFAULT_RELAY_WEBSOCKET_URL = "wss://vibeallday-relay.navs.dpdns.org/ws"

internal fun VibeAllDayPairingInput.normalizedUsername(): String = when (routeKind) {
    VibeAllDayPairingRouteKind.RELAY -> username.trim().lowercase(Locale.ROOT)
    VibeAllDayPairingRouteKind.DIRECT -> username.trim()
}

internal fun VibeAllDayPairingInput.resolveRoute(username: String): VibeAllDayServerRoute = when (routeKind) {
    VibeAllDayPairingRouteKind.RELAY -> VibeAllDayServerRoute.relay(
        websocketUrl = relayWebsocketUrl.trim().ifEmpty { DEFAULT_RELAY_WEBSOCKET_URL },
        relayTarget = username,
    )
    VibeAllDayPairingRouteKind.DIRECT -> VibeAllDayServerRoute.direct(directWebsocketUrl.trim())
}

enum class VibeAllDayNativeUiError {
    INVALID_SERVER_DETAILS,
    AUTHENTICATION_FAILED,
    SERVER_UNAVAILABLE,
    CONNECTION_FAILED,
    PUSH_FAILED,
    SERVER_UPDATE_REQUIRED,
}

enum class VibeAllDayRemovalPromptKind {
    SERVER_RECORD_MAY_REMAIN,
    SERVER_ALREADY_UNREGISTERED,
}

data class VibeAllDayRemovalPrompt(
    val profileId: String,
    val kind: VibeAllDayRemovalPromptKind,
)

data class VibeAllDayHostState(
    val profile: VibeAllDayPairedServerProfile,
    val connection: VibeAllDayConnectionState = VibeAllDayConnectionState(VibeAllDayConnectionPhase.IDLE),
    val pushEnabled: Boolean = false,
)

/** Whether this app installation can show notifications, independent of any server. */
enum class VibeAllDayDeviceNotifications {
    /** This build has no Firebase configuration, so it cannot receive push. */
    UNAVAILABLE,
    READY,
    /** Android will show its permission dialog. */
    CAN_ASK,
    /** Permission was denied, or app or channel notifications are off; only Settings can fix it. */
    BLOCKED,
}

internal fun deviceNotifications(status: NotificationStatus): VibeAllDayDeviceNotifications = when {
    !status.firebaseConfigured -> VibeAllDayDeviceNotifications.UNAVAILABLE
    status.notificationsEnabled -> VibeAllDayDeviceNotifications.READY
    status.permission == NotificationPermissionState.NOT_REQUESTED -> VibeAllDayDeviceNotifications.CAN_ASK
    else -> VibeAllDayDeviceNotifications.BLOCKED
}

data class VibeAllDayHostManagementState(
    val profiles: List<VibeAllDayPairedServerProfile> = emptyList(),
    val servers: Map<String, VibeAllDayHostState> = emptyMap(),
    val actionInProgress: Boolean = false,
    val error: VibeAllDayNativeUiError? = null,
    val removalPrompt: VibeAllDayRemovalPrompt? = null,
    val deviceNotifications: VibeAllDayDeviceNotifications = VibeAllDayDeviceNotifications.UNAVAILABLE,
    /** A newly paired server whose notification offer is pending; it opens once the offer ends. */
    val pushOffer: String? = null,
    val pushOfferAccepted: Boolean = false,
)

/** Authentication availability is derived afresh, never retained from rendered UI.
 * Resume temporarily removes the on-disk credential while proving its protocol
 * pin. An active source owns that transition; cancellation restores the saved
 * credential and releases the source back to idle.
 */
internal fun savedHostConnection(
    snapshot: VibeAllDayPairedServerSnapshot,
    connection: VibeAllDayConnectionState,
    nowEpochMs: Long,
): VibeAllDayConnectionState = when {
    snapshot.profile.securityClient?.revoked == true || connection.phase == VibeAllDayConnectionPhase.REVOKED -> VibeAllDayConnectionState(VibeAllDayConnectionPhase.REVOKED)
    connection.phase in setOf(VibeAllDayConnectionPhase.CONNECTING, VibeAllDayConnectionPhase.CONNECTED, VibeAllDayConnectionPhase.RETRYING) -> connection
    snapshot.resumeCredential?.isEligibleAt(nowEpochMs) != true -> VibeAllDayConnectionState(VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED)
    connection.phase == VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED -> VibeAllDayConnectionState(VibeAllDayConnectionPhase.IDLE)
    else -> connection
}

/** Connection setup failures are not evidence that the password was rejected. */
internal fun nativeHostActionError(error: Throwable): VibeAllDayNativeUiError = when (error) {
    is CoreException.Unavailable, is CoreException.Timeout, is CoreException.Closed ->
        VibeAllDayNativeUiError.SERVER_UNAVAILABLE
    else -> VibeAllDayNativeUiError.AUTHENTICATION_FAILED
}

internal fun nativePushActionError(error: Throwable): VibeAllDayNativeUiError = when {
    (error as? NativePushFailure)?.reason == "server_update_required" -> VibeAllDayNativeUiError.SERVER_UPDATE_REQUIRED
    nativeHostActionError(error) == VibeAllDayNativeUiError.SERVER_UNAVAILABLE -> VibeAllDayNativeUiError.SERVER_UNAVAILABLE
    else -> VibeAllDayNativeUiError.PUSH_FAILED
}
