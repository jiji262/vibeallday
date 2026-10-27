package com.vibeallday.mobile.profiles

import kotlinx.coroutines.CancellationException

internal enum class VibeAllDayServerRemovalOutcome {
    COMPLETE,
    NEEDS_FORGET_ANYWAY,
    NEEDS_LOCAL_CLEANUP,
}

/** Coordinates server revocation before destructive phone-local cleanup. */
internal class VibeAllDayServerRemovalCoordinator(
    private val forget: suspend (String) -> Unit,
) {
    suspend fun remove(
        profile: VibeAllDayPairedServerProfile,
        unregister: (suspend (clientId: String) -> Unit)?,
    ): VibeAllDayServerRemovalOutcome {
        val clientId = profile.securityClient
            ?.takeIf { !it.revoked && !it.capabilityMissing }
            ?.clientId
        if (clientId == null) {
            return forgetLocally(profile.id, serverWasUnregistered = false)
        }
        if (unregister == null) return VibeAllDayServerRemovalOutcome.NEEDS_FORGET_ANYWAY
        try {
            unregister(clientId)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Throwable) {
            return VibeAllDayServerRemovalOutcome.NEEDS_FORGET_ANYWAY
        }
        return forgetLocally(profile.id, serverWasUnregistered = true)
    }

    suspend fun forgetAnyway(profileId: String): VibeAllDayServerRemovalOutcome {
        return forgetLocally(profileId, serverWasUnregistered = false)
    }

    private suspend fun forgetLocally(
        profileId: String,
        serverWasUnregistered: Boolean,
    ): VibeAllDayServerRemovalOutcome {
        return try {
            forget(profileId)
            VibeAllDayServerRemovalOutcome.COMPLETE
        } catch (error: CancellationException) {
            throw error
        } catch (_: Throwable) {
            if (serverWasUnregistered) {
                VibeAllDayServerRemovalOutcome.NEEDS_LOCAL_CLEANUP
            } else {
                VibeAllDayServerRemovalOutcome.NEEDS_FORGET_ANYWAY
            }
        }
    }
}
