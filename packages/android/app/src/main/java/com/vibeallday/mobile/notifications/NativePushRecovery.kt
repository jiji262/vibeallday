package com.vibeallday.mobile.notifications

import com.vibeallday.mobile.connection.VibeAllDayConnectionState
import com.vibeallday.mobile.connection.VibeAllDayConnectionPhase
import com.vibeallday.mobile.connection.VibeAllDayConnectionUnavailableException
import com.vibeallday.mobile.connection.VibeAllDayNativeOperationException
import com.vibeallday.mobile.connection.VibeAllDayNativeOperationFailure
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.transformLatest

/** Observe the existing foreground recovery owner; never start a retry timer here. */
@OptIn(ExperimentalCoroutinesApi::class)
internal suspend fun <T : Any> resolveNativePushWhenReady(
    states: StateFlow<VibeAllDayConnectionState>,
    resolve: suspend () -> T?,
): T? = states.transformLatest { state ->
    when {
        state.phase == VibeAllDayConnectionPhase.CONNECTED -> {
            try {
                emit(resolve())
            } catch (error: CancellationException) {
                throw error
            } catch (_: VibeAllDayConnectionUnavailableException) {
                // A ready connection can disappear during the authenticated lookup.
            } catch (error: VibeAllDayNativeOperationException) {
                if (error.failure != VibeAllDayNativeOperationFailure.CONNECTION_UNAVAILABLE) emit(null)
            } catch (_: Exception) {
                // A server rejection or invalid destination is not connectivity churn.
                emit(null)
            }
        }
        state.phase in setOf(VibeAllDayConnectionPhase.REVOKED, VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED) ||
            (state.phase == VibeAllDayConnectionPhase.FAILED && !state.recoverable) -> emit(null)
    }
}.first()
