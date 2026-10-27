package com.vibeallday.mobile.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.vibeallday.mobile.connection.VibeAllDayMessageTransport
import com.vibeallday.mobile.connection.VibeAllDayRustProfileConnector
import com.vibeallday.mobile.connection.VibeAllDayRustTls
import com.vibeallday.mobile.connection.VibeAllDayPairingCoordinator
import com.vibeallday.mobile.connection.VibeAllDayServerConnectionManager
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerProfile
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerRepository
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerSnapshot
import com.vibeallday.mobile.profiles.VibeAllDaySecurityClientBinding
import com.vibeallday.mobile.profiles.VibeAllDayServerRoute
import com.vibeallday.mobile.profiles.VibeAllDayStoredResumeCredential
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class VibeAllDaySecurityClientE2eInstrumentedTest {
    @Test
    fun pairsChecksInRecoversUnknownAndRecognizesRevocation() {
        val arguments = InstrumentationRegistry.getArguments()
        val wsUrl = arguments.getString("vibeAllDayProbeWsUrl")
        val username = arguments.getString("vibeAllDayProbeUsername")
        val password = arguments.getString("vibeAllDayProbePassword")
        assumeTrue(
            "Security-client E2E arguments are intentionally absent in config-free CI",
            wsUrl != null && username != null && password != null,
        )

        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val httpClient = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build()
        val keys = AndroidKeystoreSecurityClientKeyStore()
        var keyAlias: String? = null
        val repository = InMemoryPairedServerRepository()
        VibeAllDayRustTls.ensure(context)
        val connector = VibeAllDayRustProfileConnector(repository)
        try {
            val route = VibeAllDayServerRoute.direct(checkNotNull(wsUrl))
            val securityClients = VibeAllDaySecurityClientCoordinator(
                repository = repository,
                keys = keys,
                descriptors = VibeAllDayAndroidSecurityClientDescriptorProvider(context),
            )
            val pairing = VibeAllDayPairingCoordinator(
                repository = repository,
                connector = connector,
                securityClients = securityClients,
            )

            runBlocking {
                val paired = withTimeout(STEP_TIMEOUT_MS) {
                    pairing.pair(
                        label = "Pixel security checkpoint",
                        username = checkNotNull(username),
                        password = checkNotNull(password),
                        route = route,
                    )
                }
                val firstBinding = checkNotNull(paired.securityClient)
                val firstClientId = checkNotNull(firstBinding.clientId)
                keyAlias = checkNotNull(firstBinding.keyAlias)
                val expectedFingerprint = VibeAllDaySecurityClientProtocol.fingerprint(
                    keys.publicKeySpki(checkNotNull(keyAlias)),
                )

                val saved = checkNotNull(repository.snapshot(paired.id))
                val resumedFromMain = withContext(Dispatchers.Main) {
                    connector.resume(paired, checkNotNull(saved.resumeCredential).credential)
                }
                resumedFromMain.transport.closeAndAwait()

                val manager = VibeAllDayServerConnectionManager(
                    profileId = paired.id,
                    repository = repository,
                    connector = connector,
                    securityClients = securityClients,
                    retryDelaysMs = emptyList(),
                )
                val lease = manager.acquire()
                val checkedIn = withTimeout(STEP_TIMEOUT_MS) {
                    lease.request("GET", "/security/clients/$firstClientId")
                }
                val checkedInClient = (checkedIn.body as JSONObject).getJSONObject("client")
                assertEquals("srp-resume", checkedInClient.getString("lastAuthenticationMethod"))
                assertEquals(expectedFingerprint, continuityFingerprint(checkedInClient))
                lease.releaseAndAwait()
                manager.shutdownAndAwait()

                val unknownClientId = UUID.randomUUID().toString()
                repository.updateSecurityClientBinding(
                    paired.id,
                    VibeAllDaySecurityClientBinding.registered(checkNotNull(keyAlias), unknownClientId),
                )
                val fullForUnknown = withContext(Dispatchers.Main) {
                    connector.login(route, checkNotNull(username), checkNotNull(password))
                }
                val recovered = try {
                    withTimeout(STEP_TIMEOUT_MS) {
                        securityClients.ensure(
                            checkNotNull(repository.snapshot(paired.id)).profile,
                            fullForUnknown,
                        )
                    }
                } finally {
                    fullForUnknown.closeAndAwait()
                }
                val recoveredClientId = checkNotNull(recovered.securityClient?.clientId)
                assertNotEquals(unknownClientId, recoveredClientId)
                assertEquals(checkNotNull(keyAlias), recovered.securityClient?.keyAlias)

                val fullForRevocation = connector.login(
                    route,
                    checkNotNull(username),
                    checkNotNull(password),
                )
                try {
                    securityClients.ensure(
                        checkNotNull(repository.snapshot(paired.id)).profile,
                        fullForRevocation,
                    )
                    val response = muxRequest(
                        fullForRevocation,
                        method = "DELETE",
                        path = "/api/security/clients/$recoveredClientId",
                    )
                    assertEquals(200, response.getInt("status"))
                } finally {
                    runCatching { fullForRevocation.closeAndAwait() }
                }

                val fullAfterRevocation = connector.login(
                    route,
                    checkNotNull(username),
                    checkNotNull(password),
                )
                try {
                    assertThrows(VibeAllDaySecurityClientRevokedException::class.java) {
                        runBlocking {
                            securityClients.ensure(
                                checkNotNull(repository.snapshot(paired.id)).profile,
                                fullAfterRevocation,
                            )
                        }
                    }
                } finally {
                    fullAfterRevocation.closeAndAwait()
                }
                val revoked = checkNotNull(repository.snapshot(paired.id))
                assertTrue(checkNotNull(revoked.profile.securityClient).revoked)
                assertEquals(recoveredClientId, revoked.profile.securityClient?.clientId)
                assertNull(revoked.resumeCredential)
            }
        } finally {
            connector.close()
            keyAlias?.let { runCatching { keys.delete(it) } }
            httpClient.connectionPool.evictAll()
            httpClient.dispatcher.executorService.shutdown()
        }
    }

    private suspend fun muxRequest(
        transport: VibeAllDayMessageTransport,
        method: String,
        path: String,
    ): JSONObject {
        val id = UUID.randomUUID().toString()
        transport.send(
            JSONObject()
                .put("type", "request")
                .put("id", id)
                .put("method", method)
                .put("path", path)
                .put("headers", JSONObject().put("X-VibeAllDay", "true")),
        )
        return withTimeout(STEP_TIMEOUT_MS) {
            repeat(32) {
                val message = transport.receive()
                if (message.optString("type") == "response" && message.optString("id") == id) {
                    return@withTimeout message
                }
            }
            error("Bounded mux response was not received")
        }
    }

    private fun continuityFingerprint(client: JSONObject): String {
        val proofs = client.getJSONArray("proofs")
        return (0 until proofs.length())
            .map { proofs.getJSONObject(it) }
            .first { it.getString("type") == "continuity-key" }
            .getString("keyFingerprint")
    }

    private class InMemoryPairedServerRepository : VibeAllDayPairedServerRepository {
        private var value: VibeAllDayPairedServerSnapshot? = null

        override suspend fun snapshot(profileId: String): VibeAllDayPairedServerSnapshot? =
            value?.takeIf { it.profile.id == profileId }

        override suspend fun upsert(
            profile: VibeAllDayPairedServerProfile,
            resumeCredential: VibeAllDayStoredResumeCredential?,
            select: Boolean,
        ) {
            value = VibeAllDayPairedServerSnapshot(profile, resumeCredential)
        }

        override suspend fun clearCredential(profileId: String) {
            value = checkNotNull(value).copy(resumeCredential = null)
        }

        override suspend fun recordSuccessfulAuthentication(
            profileId: String,
            routeId: String,
            resumeCredential: VibeAllDayStoredResumeCredential,
            connectedAtEpochMs: Long,
        ) {
            val current = checkNotNull(value)
            value = current.copy(
                profile = current.profile.copy(
                    preferredRouteId = routeId,
                    lastConnectedAtEpochMs = connectedAtEpochMs,
                ),
                resumeCredential = resumeCredential,
            )
        }
    }

    companion object {
        private const val STEP_TIMEOUT_MS = 30_000L
    }
}
