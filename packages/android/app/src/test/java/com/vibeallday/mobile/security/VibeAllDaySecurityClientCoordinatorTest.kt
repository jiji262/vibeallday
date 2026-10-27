package com.vibeallday.mobile.security

import com.vibeallday.mobile.connection.VibeAllDayMessageTransport
import com.vibeallday.mobile.connection.VibeAllDayResumeCredential
import com.vibeallday.mobile.connection.VibeAllDaySecureTransportCrypto
import com.vibeallday.mobile.connection.VibeAllDaySrpAuthenticationMethod
import com.vibeallday.mobile.connection.VibeAllDaySrpTransportBinding
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerProfile
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerRepository
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerSnapshot
import com.vibeallday.mobile.profiles.VibeAllDaySecurityClientBinding
import com.vibeallday.mobile.profiles.VibeAllDayServerRoute
import com.vibeallday.mobile.profiles.VibeAllDayStoredResumeCredential
import java.util.concurrent.CopyOnWriteArrayList
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class VibeAllDaySecurityClientCoordinatorTest {
    @Test
    fun registersAPendingKeyAndPinsTheReturnedFingerprint() = runBlocking {
        val fixture = Fixture(pendingProfile())
        val transport = fixture.transport { request ->
            when (request.getString("path")) {
                "/api/version" -> response(
                    request,
                    200,
                    JSONObject().put(
                        "capabilities",
                        JSONArray().put(VibeAllDaySecurityClientProtocol.CAPABILITY),
                    ),
                )
                VibeAllDaySecurityClientProtocol.REGISTER_ROUTE -> response(
                    request,
                    201,
                    registeredClient(CLIENT_ID, fixture.fingerprint),
                )
                else -> error("Unexpected request")
            }
        }

        val updated = fixture.coordinator.ensure(fixture.profile, transport)

        assertEquals(CLIENT_ID, updated.securityClient?.clientId)
        assertNull(updated.securityClient?.pendingRequestId)
        assertEquals(CLIENT_ID, fixture.repository.value.profile.securityClient?.clientId)
        assertEquals(
            listOf("/api/version", VibeAllDaySecurityClientProtocol.REGISTER_ROUTE),
            transport.sent.map { it.getString("path") },
        )
        assertTrue(
            transport.sent.last().getJSONObject("body")
                .getJSONObject("key").getString("signature").isNotBlank(),
        )
    }

    @Test
    fun unknownCheckInQuietlyRegistersTheSameKeyAsANewClient() = runBlocking {
        val profile = pendingProfile().copy(
            securityClient = VibeAllDaySecurityClientBinding.registered(KEY_ALIAS, CLIENT_ID),
        )
        val fixture = Fixture(profile)
        val transport = fixture.transport { request ->
            when (request.getString("path")) {
                "/api/version" -> capableVersion(request)
                VibeAllDaySecurityClientProtocol.checkInRoute(CLIENT_ID) -> response(
                    request,
                    404,
                    JSONObject().put("code", "security_client_unknown"),
                )
                VibeAllDaySecurityClientProtocol.REGISTER_ROUTE -> response(
                    request,
                    201,
                    registeredClient(NEW_CLIENT_ID, fixture.fingerprint),
                )
                else -> error("Unexpected request")
            }
        }

        val updated = fixture.coordinator.ensure(profile, transport)

        assertEquals(NEW_CLIENT_ID, updated.securityClient?.clientId)
        assertEquals(KEY_ALIAS, updated.securityClient?.keyAlias)
        assertNotEquals(CLIENT_ID, fixture.repository.value.profile.securityClient?.clientId)
        assertFalse(fixture.keys.deleted)
    }

    @Test
    fun revokedCheckInDeletesTheKeyAndClearsTheResumeCredential() {
        val profile = pendingProfile().copy(
            securityClient = VibeAllDaySecurityClientBinding.registered(KEY_ALIAS, CLIENT_ID),
        )
        val fixture = Fixture(profile, withCredential = true)
        val transport = fixture.transport { request ->
            when (request.getString("path")) {
                "/api/version" -> capableVersion(request)
                VibeAllDaySecurityClientProtocol.checkInRoute(CLIENT_ID) -> response(
                    request,
                    410,
                    JSONObject().put("code", "security_client_revoked"),
                )
                else -> error("Unexpected request")
            }
        }

        assertThrows(VibeAllDaySecurityClientRevokedException::class.java) {
            runBlocking { fixture.coordinator.ensure(profile, transport) }
        }

        assertTrue(fixture.keys.deleted)
        assertTrue(checkNotNull(fixture.repository.value.profile.securityClient).revoked)
        assertNull(fixture.repository.value.resumeCredential)
    }

    @Test
    fun missingCapabilityMakesNoSecurityClientRequest() = runBlocking {
        val fixture = Fixture(pendingProfile())
        val transport = fixture.transport { request ->
            response(request, 200, JSONObject().put("capabilities", JSONArray()))
        }

        val updated = fixture.coordinator.ensure(fixture.profile, transport)

        assertTrue(checkNotNull(updated.securityClient).capabilityMissing)
        assertEquals(listOf("/api/version"), transport.sent.map { it.getString("path") })
    }

    private class Fixture(
        val profile: VibeAllDayPairedServerProfile,
        withCredential: Boolean = false,
    ) {
        val keys = FakeKeys()
        val fingerprint = VibeAllDaySecurityClientProtocol.fingerprint(keys.publicKey)
        val repository = FakeRepository(
            VibeAllDayPairedServerSnapshot(
                profile,
                if (withCredential) storedCredential(profile.username) else null,
            ),
        )
        val coordinator = VibeAllDaySecurityClientCoordinator(
            repository = repository,
            keys = keys,
            descriptors = VibeAllDaySecurityClientDescriptorProvider {
                JSONObject()
                    .put("installationId", profile.id)
                    .put("deviceClass", "phone")
                    .put("appName", "VibeAllDay")
                    .put("appVersion", "0.1.0")
                    .put("osName", "Android")
                    .put("osVersion", "16")
                    .put("osApiLevel", 36)
                    .put("packageName", "com.vibeallday.mobile")
                    .put("supportedProofs", JSONArray().put("continuity-key"))
            },
        )

        fun transport(responder: (JSONObject) -> JSONObject): FakeTransport =
            FakeTransport(responder)
    }

    private class FakeKeys : VibeAllDaySecurityClientKeyStore {
        val publicKey = byteArrayOf(1, 2, 3, 4, 5)
        var deleted = false

        override fun ensureKey(alias: String) {
            check(alias == KEY_ALIAS)
        }

        override fun publicKeySpki(alias: String): ByteArray = publicKey.copyOf()

        override fun sign(alias: String, message: ByteArray): ByteArray {
            check(message.isNotEmpty())
            return byteArrayOf(6, 7, 8)
        }

        override fun delete(alias: String) {
            deleted = true
        }
    }

    private class FakeRepository(
        var value: VibeAllDayPairedServerSnapshot,
    ) : VibeAllDayPairedServerRepository {
        override suspend fun snapshot(profileId: String): VibeAllDayPairedServerSnapshot? =
            value.takeIf { it.profile.id == profileId }

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
            value = value.copy(resumeCredential = resumeCredential)
        }
    }

    private class FakeTransport(
        private val responder: (JSONObject) -> JSONObject,
    ) : VibeAllDayMessageTransport {
        override val credential = credential("remote-user")
        override val resumed = false
        override val securityBinding = VibeAllDaySrpTransportBinding(
            sessionId = credential.sessionId,
            transportNonce = "transport-nonce",
            authenticationMethod = VibeAllDaySrpAuthenticationMethod.FULL,
        )
        val sent = CopyOnWriteArrayList<JSONObject>()
        private val incoming = Channel<JSONObject>(Channel.UNLIMITED)

        override fun send(message: JSONObject) {
            val copy = JSONObject(message.toString())
            sent += copy
            check(incoming.trySend(responder(copy)).isSuccess)
        }

        override suspend fun receive(): JSONObject = incoming.receive()
        override suspend fun awaitClosed() = Unit
        override suspend fun closeAndAwait() = Unit
        override fun cancel() = Unit
    }

    companion object {
        private const val PROFILE_ID = "11111111-1111-4111-8111-111111111111"
        private const val ROUTE_ID = "22222222-2222-4222-8222-222222222222"
        private const val REQUEST_ID = "33333333-3333-4333-8333-333333333333"
        private const val CLIENT_ID = "44444444-4444-4444-8444-444444444444"
        private const val NEW_CLIENT_ID = "55555555-5555-4555-8555-555555555555"
        private const val KEY_ALIAS = "vibeallday_security_client_p256_v1_$PROFILE_ID"

        private fun pendingProfile(): VibeAllDayPairedServerProfile = VibeAllDayPairedServerProfile(
            id = PROFILE_ID,
            label = "Pixel",
            username = "remote-user",
            routes = listOf(
                VibeAllDayServerRoute(
                    id = ROUTE_ID,
                    kind = com.vibeallday.mobile.profiles.VibeAllDayServerRouteKind.DIRECT,
                    websocketUrl = "wss://desktop.example.test/api/ws",
                ),
            ),
            preferredRouteId = ROUTE_ID,
            createdAtEpochMs = 1_000,
            lastConnectedAtEpochMs = null,
            securityClient = VibeAllDaySecurityClientBinding.pending(KEY_ALIAS, REQUEST_ID),
        )

        private fun credential(username: String): VibeAllDayResumeCredential = VibeAllDayResumeCredential(
            username = username,
            sessionId = "resume-session",
            baseKey = ByteArray(VibeAllDaySecureTransportCrypto.KEY_BYTES),
            resumeProtocolVersion = VibeAllDaySecureTransportCrypto.RESUME_PROTOCOL_VERSION,
        )

        private fun storedCredential(username: String): VibeAllDayStoredResumeCredential =
            VibeAllDayStoredResumeCredential(credential(username), 1_000, null)

        private fun capableVersion(request: JSONObject): JSONObject = response(
            request,
            200,
            JSONObject().put(
                "capabilities",
                JSONArray().put(VibeAllDaySecurityClientProtocol.CAPABILITY),
            ),
        )

        private fun registeredClient(
            clientId: String,
            fingerprint: String,
        ): JSONObject = JSONObject().put(
            "client",
            JSONObject()
                .put("clientId", clientId)
                .put(
                    "proofs",
                    JSONArray().put(
                        JSONObject()
                            .put("type", "continuity-key")
                            .put("keyFingerprint", fingerprint),
                    ),
                ),
        )

        private fun response(
            request: JSONObject,
            status: Int,
            body: JSONObject,
        ): JSONObject = JSONObject()
            .put("type", "response")
            .put("id", request.getString("id"))
            .put("status", status)
            .put("body", body)
    }
}
