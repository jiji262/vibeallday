package com.vibeallday.mobile.ui

import com.vibeallday.mobile.connection.VibeAllDayConnectionPhase
import com.vibeallday.mobile.connection.VibeAllDayConnectionState
import com.vibeallday.mobile.connection.VibeAllDayResumeCredential
import com.vibeallday.mobile.profiles.*
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.UUID

class VibeAllDayHostConnectionStateTest {
    private val profile = VibeAllDayPairedServerProfile.create("Fixture", "fixture-owner", VibeAllDayServerRoute.direct("wss://fixture.invalid/api/ws"), 1)
    private val credential = VibeAllDayStoredResumeCredential(VibeAllDayResumeCredential(profile.username, "fixture-session", ByteArray(32), 3), 1, null)
    private val saved = VibeAllDayPairedServerSnapshot(profile, credential)
    private fun phase(snapshot: VibeAllDayPairedServerSnapshot, phase: VibeAllDayConnectionPhase, now: Long = 2) =
        savedHostConnection(snapshot, VibeAllDayConnectionState(phase), now).phase

    @Test fun resumeAndCancellationReconcileSavedCredentialAvailability() {
        val pending = saved.copy(resumeCredential = null)
        for (active in listOf(VibeAllDayConnectionPhase.CONNECTING, VibeAllDayConnectionPhase.RETRYING, VibeAllDayConnectionPhase.CONNECTED)) {
            assertEquals(active, phase(pending, active))
        }
        assertEquals(VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED, phase(pending, VibeAllDayConnectionPhase.IDLE))
        assertEquals(VibeAllDayConnectionPhase.IDLE, phase(saved, VibeAllDayConnectionPhase.IDLE))
        assertEquals(VibeAllDayConnectionPhase.IDLE, phase(saved, VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED))
    }
    @Test fun realExpiryMissingCredentialAndRevocationStillRequireRecovery() {
        assertEquals(VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED, phase(saved, VibeAllDayConnectionPhase.IDLE, VibeAllDayStoredResumeCredential.IDLE_TIMEOUT_MS + 2))
        assertEquals(VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED, phase(saved.copy(resumeCredential = null), VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED))
        assertEquals(VibeAllDayConnectionPhase.REVOKED, phase(saved, VibeAllDayConnectionPhase.REVOKED))
        val revoked = saved.copy(profile = profile.copy(securityClient = VibeAllDaySecurityClientBinding.revoked(UUID.randomUUID().toString())))
        assertEquals(VibeAllDayConnectionPhase.REVOKED, phase(revoked, VibeAllDayConnectionPhase.CONNECTED))
        assertEquals(VibeAllDayConnectionPhase.REVOKED, phase(revoked, VibeAllDayConnectionPhase.IDLE))
    }
    @Test fun preservesNetworkFailureAndLiveConnectionDetails() {
        val retry = VibeAllDayConnectionState(VibeAllDayConnectionPhase.RETRYING, retryAttempt = 2, errorMessage = "Network unavailable")
        assertEquals(retry, savedHostConnection(saved.copy(resumeCredential = null), retry, 2))
        assertEquals(VibeAllDayConnectionPhase.FAILED, phase(saved, VibeAllDayConnectionPhase.FAILED))
    }
}
