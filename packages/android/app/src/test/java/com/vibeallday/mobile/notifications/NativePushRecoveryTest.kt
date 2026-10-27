package com.vibeallday.mobile.notifications

import com.vibeallday.mobile.connection.VibeAllDayApiException
import com.vibeallday.mobile.connection.VibeAllDayApiResponse
import com.vibeallday.mobile.connection.VibeAllDayConnectionPhase
import com.vibeallday.mobile.connection.VibeAllDayConnectionState
import com.vibeallday.mobile.connection.VibeAllDayConnectionUnavailableException
import com.vibeallday.mobile.connection.VibeAllDayNativeOperationException
import com.vibeallday.mobile.connection.VibeAllDayNativeOperationFailure
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NativePushRecoveryTest {
    @Test
    fun anOfflineTapWaitsThroughExhaustionForTheExistingOwnerToRecover() = runBlocking {
        val states = MutableStateFlow(VibeAllDayConnectionState(VibeAllDayConnectionPhase.RETRYING))
        var lookups = 0
        val result = async(Dispatchers.Unconfined) {
            resolveNativePushWhenReady(states) { lookups++; "/projects/p/sessions/s" }
        }
        try {
            assertTrue(result.isActive)
            assertEquals(0, lookups)
            states.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.FAILED, recoverable = true)
            assertTrue(result.isActive)
            assertEquals(0, lookups)
            states.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.CONNECTED)
            assertEquals("/projects/p/sessions/s", result.await())
            assertEquals(1, lookups)
        } finally { result.cancelAndJoin() }
        assertEquals(0, states.subscriptionCount.value)
    }

    @Test
    fun disconnectCancelsAnOldLookupBeforeTheNextReadyGeneration() = runBlocking {
        val states = MutableStateFlow(VibeAllDayConnectionState(VibeAllDayConnectionPhase.CONNECTED))
        val pending = CompletableDeferred<String>()
        var cancelled = false
        var lookups = 0
        val result = async(Dispatchers.Unconfined) {
            resolveNativePushWhenReady(states) {
                if (++lookups == 1) try { pending.await() } finally { cancelled = true }
                else "new destination"
            }
        }
        try {
            states.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.RETRYING)
            assertTrue(cancelled)
            assertTrue(result.isActive)
            states.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.CONNECTED)
            assertEquals("new destination", result.await())
            assertEquals(2, lookups)
        } finally { result.cancelAndJoin() }
    }

    @Test
    fun typedConnectionFailuresKeepTheTapPendingWithoutSpinning() = runBlocking {
        for (failure in listOf(
            VibeAllDayConnectionUnavailableException("connection lost"),
            VibeAllDayNativeOperationException(VibeAllDayNativeOperationFailure.CONNECTION_UNAVAILABLE),
        )) {
            val states = MutableStateFlow(VibeAllDayConnectionState(VibeAllDayConnectionPhase.CONNECTED))
            var lookups = 0
            val result = async(Dispatchers.Unconfined) {
                resolveNativePushWhenReady(states) { if (++lookups == 1) throw failure else "destination" }
            }
            try {
                assertTrue(result.isActive)
                assertEquals(1, lookups)
                states.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.RETRYING)
                states.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.CONNECTED)
                assertEquals("destination", result.await())
                assertEquals(2, lookups)
            } finally { result.cancelAndJoin() }
        }
    }

    @Test
    fun terminalAuthenticationAndVerificationFailuresDoNotOpenADestination() = runBlocking {
        for (phase in listOf(VibeAllDayConnectionPhase.REVOKED, VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED, VibeAllDayConnectionPhase.FAILED)) {
            val states = MutableStateFlow(VibeAllDayConnectionState(phase))
            var lookups = 0
            assertNull(resolveNativePushWhenReady(states) { lookups++; "forbidden" })
            assertEquals(0, lookups)
        }
    }

    @Test
    fun revocationCancelsAnInFlightDestinationLookup() = runBlocking {
        val states = MutableStateFlow(VibeAllDayConnectionState(VibeAllDayConnectionPhase.CONNECTED))
        var cancelled = false
        val pending = CompletableDeferred<String>()
        val result = async(Dispatchers.Unconfined) {
            resolveNativePushWhenReady(states) { try { pending.await() } finally { cancelled = true } }
        }
        try {
            states.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.REVOKED)
            assertNull(result.await())
            assertTrue(cancelled)
            pending.complete("late forbidden path")
            assertEquals(0, states.subscriptionCount.value)
        } finally { result.cancelAndJoin() }
    }

    @Test
    fun aServerRejectionOrRetiredBindingEndsTheAction() = runBlocking {
        val states = MutableStateFlow(VibeAllDayConnectionState(VibeAllDayConnectionPhase.CONNECTED))
        assertNull(resolveNativePushWhenReady(states) { throw VibeAllDayApiException(VibeAllDayApiResponse(403, emptyMap(), null)) })
        assertNull(resolveNativePushWhenReady<String>(states) { null })
    }

    @Test
    fun backgroundOrSupersedingTapCancellationReleasesTheObserver() = runBlocking {
        val states = MutableStateFlow(VibeAllDayConnectionState(VibeAllDayConnectionPhase.RETRYING))
        var opened = false
        val result = async(Dispatchers.Unconfined) {
            resolveNativePushWhenReady(states) { opened = true; "destination" }
        }
        result.cancelAndJoin()
        states.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.CONNECTED)
        assertFalse(opened)
        assertEquals(0, states.subscriptionCount.value)
    }
}
