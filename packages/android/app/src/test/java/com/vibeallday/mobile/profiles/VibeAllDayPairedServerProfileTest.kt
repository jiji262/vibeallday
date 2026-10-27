package com.vibeallday.mobile.profiles

import com.vibeallday.mobile.connection.VibeAllDayResumeCredential
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class VibeAllDayPairedServerProfileTest {
    @Test
    fun profileMetadataRoundTripsWithoutCredentialMaterial() {
        val direct = VibeAllDayServerRoute(
            id = UUID.randomUUID().toString(),
            kind = VibeAllDayServerRouteKind.DIRECT,
            websocketUrl = "wss://desktop.example.test/api/ws",
        )
        val relay = VibeAllDayServerRoute(
            id = UUID.randomUUID().toString(),
            kind = VibeAllDayServerRouteKind.RELAY,
            websocketUrl = "wss://relay.example.test/ws",
            relayTarget = "my-server",
        )
        val profile = VibeAllDayPairedServerProfile(
            id = UUID.randomUUID().toString(),
            label = "Studio",
            username = "remote-user",
            routes = listOf(direct, relay),
            preferredRouteId = relay.id,
            createdAtEpochMs = 1_800_000_000_000,
            lastConnectedAtEpochMs = null,
            securityClient = VibeAllDaySecurityClientBinding.pending(
                keyAlias = "vibeallday_security_client_p256_v1_test",
                requestId = "11111111-1111-4111-8111-111111111111",
            ),
        )

        val encoded = VibeAllDayPairedServerCodec.encodeProfiles(listOf(profile))
        assertEquals(listOf(profile), VibeAllDayPairedServerCodec.decodeProfiles(encoded))
        assertNull(VibeAllDayPairedServerCodec.decodeProfiles(encoded).single().lastConnectedAtEpochMs)
    }

    @Test
    fun rejectsTheDisposableDevelopmentV1ProfileSchema() {
        val v1 = """
            {"version":1,"profiles":[]}
        """.trimIndent()

        assertThrows(IllegalStateException::class.java) {
            VibeAllDayPairedServerCodec.decodeProfiles(v1)
        }
    }

    @Test
    fun securityClientBindingDistinguishesPendingRegisteredAndRevoked() {
        val pending = VibeAllDaySecurityClientBinding.pending(
            keyAlias = "vibeallday_security_client_p256_v1_test",
            requestId = "11111111-1111-4111-8111-111111111111",
        )
        val registered = VibeAllDaySecurityClientBinding.registered(
            keyAlias = checkNotNull(pending.keyAlias),
            clientId = "22222222-2222-4222-8222-222222222222",
        )
        val revoked = VibeAllDaySecurityClientBinding.revoked(checkNotNull(registered.clientId))

        assertNull(pending.clientId)
        assertNull(registered.pendingRequestId)
        assertTrue(revoked.revoked)
        assertNull(revoked.keyAlias)
    }

    @Test
    fun rejectsInvalidRouteAndProfileRelationships() {
        val route = VibeAllDayServerRoute.direct("wss://desktop.example.test/api/ws")

        assertThrows(IllegalArgumentException::class.java) {
            VibeAllDayServerRoute.direct("https://desktop.example.test/api/ws")
        }
        assertThrows(IllegalArgumentException::class.java) {
            VibeAllDayServerRoute(
                id = UUID.randomUUID().toString(),
                kind = VibeAllDayServerRouteKind.RELAY,
                websocketUrl = "wss://relay.example.test/ws",
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            VibeAllDayPairedServerProfile(
                id = UUID.randomUUID().toString(),
                label = "Studio",
                username = "remote-user",
                routes = listOf(route),
                preferredRouteId = UUID.randomUUID().toString(),
                createdAtEpochMs = 0,
                lastConnectedAtEpochMs = null,
            )
        }
    }

    @Test
    fun treatsTheServerResumeLimitsAsAConservativeLocalExpiry() {
        val establishedAt = 1_800_000_000_000
        val credential = VibeAllDayStoredResumeCredential(
            credential = VibeAllDayResumeCredential(
                username = "remote-user",
                sessionId = "session-id",
                baseKey = ByteArray(32),
                resumeProtocolVersion = 3,
            ),
            establishedAtEpochMs = establishedAt,
            lastResumedAtEpochMs = establishedAt + 6L * 24 * 60 * 60 * 1000,
        )

        assertTrue(credential.isEligibleAt(establishedAt + 13L * 24 * 60 * 60 * 1000))
        assertFalse(credential.isEligibleAt(establishedAt + 13L * 24 * 60 * 60 * 1000 + 1))

        val activeAtAbsoluteLimit = credential.copy(
            lastResumedAtEpochMs = establishedAt + 29L * 24 * 60 * 60 * 1000,
        )
        assertTrue(activeAtAbsoluteLimit.isEligibleAt(establishedAt + 30L * 24 * 60 * 60 * 1000))
        assertFalse(
            activeAtAbsoluteLimit.isEligibleAt(
                establishedAt + 30L * 24 * 60 * 60 * 1000 + 1,
            ),
        )
    }
}
