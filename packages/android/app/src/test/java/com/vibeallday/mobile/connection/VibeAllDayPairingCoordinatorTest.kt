package com.vibeallday.mobile.connection

import com.vibeallday.mobile.profiles.VibeAllDayPairedServerProfile
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerRepository
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerSnapshot
import com.vibeallday.mobile.profiles.VibeAllDayServerRoute
import com.vibeallday.mobile.profiles.VibeAllDayStoredResumeCredential
import com.vibeallday.mobile.profiles.VibeAllDaySecurityClientBinding
import com.vibeallday.mobile.security.VibeAllDaySecurityClientLifecycle
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VibeAllDayPairingCoordinatorTest {
    @Test
    fun registersTheSecurityClientBeforeThePairingTransportCloses() = runBlocking {
        val route = VibeAllDayServerRoute.direct("wss://computer.example.test/api/ws")
        val placeholder = VibeAllDayPairedServerProfile.create(
            label = "Placeholder",
            username = "remote-user",
            route = route,
            nowEpochMs = 1_000,
        )
        val repository = FakeRepository(VibeAllDayPairedServerSnapshot(placeholder, null))
        val transport = FakeTransport(
            VibeAllDayResumeCredential(
                username = "remote-user",
                sessionId = "new-session",
                baseKey = ByteArray(VibeAllDaySecureTransportCrypto.KEY_BYTES),
                resumeProtocolVersion = VibeAllDaySecureTransportCrypto.RESUME_PROTOCOL_VERSION,
            ),
        )
        val securityClients = VibeAllDaySecurityClientLifecycle { profile, activeTransport ->
            assertTrue(activeTransport === transport)
            assertFalse(transport.closed)
            val persisted = checkNotNull(repository.snapshot(profile.id))
            assertEquals(profile.securityClient, persisted.profile.securityClient)
            assertEquals("new-session", persisted.resumeCredential?.credential?.sessionId)
            val registered = VibeAllDaySecurityClientBinding.registered(
                keyAlias = checkNotNull(profile.securityClient?.keyAlias),
                clientId = "44444444-4444-4444-8444-444444444444",
            )
            repository.updateSecurityClientBinding(profile.id, registered)
            profile.copy(securityClient = registered)
        }
        val coordinator = VibeAllDayPairingCoordinator(
            repository = repository,
            connector = FakeConnector(transport),
            securityClients = securityClients,
            nowEpochMs = { 2_000 },
        )

        val paired = coordinator.pair(
            label = "Pixel",
            username = "remote-user",
            password = "one-time-password",
            route = route,
        )

        assertTrue(transport.closed)
        assertEquals(
            "44444444-4444-4444-8444-444444444444",
            paired.securityClient?.clientId,
        )
        assertEquals(paired.securityClient, repository.value.profile.securityClient)
    }

    @Test
    fun reauthenticatesThroughThePreferredRouteAndReplacesTheCredential() = runBlocking {
        val direct = VibeAllDayServerRoute.direct("wss://computer.example.test/api/ws")
        val relay = VibeAllDayServerRoute.relay(
            websocketUrl = "wss://relay.example.test/ws",
            relayTarget = "remote-target",
        )
        val profile = VibeAllDayPairedServerProfile.create(
            label = "Studio",
            username = "remote-user",
            route = direct,
            nowEpochMs = 1_000,
        ).copy(
            routes = listOf(direct, relay),
            preferredRouteId = relay.id,
        )
        val repository = FakeRepository(VibeAllDayPairedServerSnapshot(profile, null))
        val transport = FakeTransport(
            VibeAllDayResumeCredential(
                username = profile.username,
                sessionId = "new-session",
                baseKey = ByteArray(VibeAllDaySecureTransportCrypto.KEY_BYTES) { it.toByte() },
                resumeProtocolVersion = VibeAllDaySecureTransportCrypto.RESUME_PROTOCOL_VERSION,
            ),
        )
        val connector = FakeConnector(transport)
        val coordinator = VibeAllDayPairingCoordinator(
            repository = repository,
            connector = connector,
            nowEpochMs = { 2_000 },
        )

        coordinator.reauthenticate(profile.id, "one-time-password")

        assertEquals(relay, connector.loginRoute)
        assertEquals(profile.username, connector.loginUsername)
        assertEquals("one-time-password", connector.loginPassword)
        assertTrue(transport.closed)
        val stored = checkNotNull(repository.value.resumeCredential)
        assertEquals("new-session", stored.credential.sessionId)
        assertEquals(2_000L, stored.establishedAtEpochMs)
        assertNull(stored.lastResumedAtEpochMs)
        assertEquals(relay.id, repository.value.profile.preferredRouteId)
        assertEquals(2_000L, repository.value.profile.lastConnectedAtEpochMs)
    }

    private class FakeRepository(
        var value: VibeAllDayPairedServerSnapshot,
    ) : VibeAllDayPairedServerRepository {
        override suspend fun snapshot(profileId: String): VibeAllDayPairedServerSnapshot? {
            return value.takeIf { it.profile.id == profileId }
        }

        override suspend fun upsert(
            profile: VibeAllDayPairedServerProfile,
            resumeCredential: VibeAllDayStoredResumeCredential?,
            select: Boolean,
        ) {
            value = VibeAllDayPairedServerSnapshot(profile, resumeCredential)
        }

        override suspend fun clearCredential(profileId: String) {
            value = value.copy(resumeCredential = null)
        }

        override suspend fun recordSuccessfulAuthentication(
            profileId: String,
            routeId: String,
            resumeCredential: VibeAllDayStoredResumeCredential,
            connectedAtEpochMs: Long,
        ) {
            value = value.copy(
                profile = value.profile.copy(
                    preferredRouteId = routeId,
                    lastConnectedAtEpochMs = connectedAtEpochMs,
                ),
                resumeCredential = resumeCredential,
            )
        }
    }

    private class FakeConnector(
        private val transport: VibeAllDayMessageTransport,
    ) : VibeAllDayProfileConnector {
        var loginRoute: VibeAllDayServerRoute? = null
        var loginUsername: String? = null
        var loginPassword: String? = null

        override suspend fun resume(
            profile: VibeAllDayPairedServerProfile,
            credential: VibeAllDayResumeCredential,
        ): VibeAllDayRoutedTransport = error("Not used")

        override suspend fun login(
            route: VibeAllDayServerRoute,
            username: String,
            password: String,
        ): VibeAllDayMessageTransport {
            loginRoute = route
            loginUsername = username
            loginPassword = password
            return transport
        }
    }

    private class FakeTransport(
        override val credential: VibeAllDayResumeCredential,
    ) : VibeAllDayMessageTransport {
        var closed = false
        override val resumed = false

        override fun send(message: JSONObject) = error("Not used")
        override suspend fun receive(): JSONObject = error("Not used")
        override suspend fun awaitClosed() = Unit

        override suspend fun closeAndAwait() {
            closed = true
        }

        override fun cancel() {
            closed = true
        }
    }
}
