package com.vibeallday.mobile.profiles

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class VibeAllDayServerRemovalCoordinatorTest {
    @Test
    fun `registered online device unregisters before local forget`() =
        kotlinx.coroutines.runBlocking {
            val events = mutableListOf<String>()
            val profile = profile(registered = true)
            val coordinator = VibeAllDayServerRemovalCoordinator { events += "forget:$it" }

            val outcome = coordinator.remove(profile) { clientId ->
                events += "unregister:$clientId"
            }

            assertEquals(VibeAllDayServerRemovalOutcome.COMPLETE, outcome)
            assertEquals(
                listOf(
                    "unregister:${profile.securityClient?.clientId}",
                    "forget:${profile.id}",
                ),
                events,
            )
        }

    @Test
    fun `registered offline device requires explicit forget anyway`() =
        kotlinx.coroutines.runBlocking {
            var forgot = false
            val coordinator = VibeAllDayServerRemovalCoordinator { forgot = true }

            val outcome = coordinator.remove(profile(registered = true), unregister = null)

            assertEquals(VibeAllDayServerRemovalOutcome.NEEDS_FORGET_ANYWAY, outcome)
            assertTrue(!forgot)
        }

    @Test
    fun `unregister failure preserves local state`() = kotlinx.coroutines.runBlocking {
        var forgot = false
        val coordinator = VibeAllDayServerRemovalCoordinator { forgot = true }

        val outcome = coordinator.remove(profile(registered = true)) {
            error("server unavailable")
        }

        assertEquals(VibeAllDayServerRemovalOutcome.NEEDS_FORGET_ANYWAY, outcome)
        assertTrue(!forgot)
    }

    @Test
    fun `legacy profile performs honest local-only forget`() = kotlinx.coroutines.runBlocking {
        var forgot = false
        val coordinator = VibeAllDayServerRemovalCoordinator { forgot = true }

        val outcome = coordinator.remove(profile(registered = false)) {
            error("must not unregister")
        }

        assertEquals(VibeAllDayServerRemovalOutcome.COMPLETE, outcome)
        assertTrue(forgot)
    }

    @Test
    fun `successful unregister distinguishes a local cleanup failure`() =
        kotlinx.coroutines.runBlocking {
            val coordinator = VibeAllDayServerRemovalCoordinator { error("storage failed") }

            val outcome = coordinator.remove(profile(registered = true)) { }

            assertEquals(VibeAllDayServerRemovalOutcome.NEEDS_LOCAL_CLEANUP, outcome)
        }

    private fun profile(registered: Boolean): VibeAllDayPairedServerProfile {
        val profile = VibeAllDayPairedServerProfile.create(
            label = "alpha",
            username = "alpha",
            route = VibeAllDayServerRoute.relay("wss://relay.example/ws", "alpha-server"),
            nowEpochMs = 1_000,
        )
        return if (registered) {
            profile.copy(
                securityClient = VibeAllDaySecurityClientBinding.registered(
                    keyAlias = "vibeallday_security_client_p256_v1_alpha",
                    clientId = "22222222-2222-4222-8222-222222222222",
                ),
            )
        } else {
            profile
        }
    }
}
