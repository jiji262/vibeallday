package com.vibeallday.mobile.connection

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerProfile
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerRepository
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerSnapshot
import com.vibeallday.mobile.profiles.VibeAllDayServerRoute
import com.vibeallday.mobile.profiles.VibeAllDayStoredResumeCredential
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class VibeAllDayDirectSecureSessionInstrumentedTest {
    @Test
    fun negotiatesFullSrpAndResumeWithEncryptedPingPong() {
        val arguments = InstrumentationRegistry.getArguments()
        val wsUrl = arguments.getString("vibeAllDayProbeWsUrl")
        val username = arguments.getString("vibeAllDayProbeUsername")
        val password = arguments.getString("vibeAllDayProbePassword")
        val relayWsUrl = arguments.getString("vibeAllDayProbeRelayWsUrl")
        assumeTrue(
            "Native direct-session probe arguments are intentionally absent in config-free CI",
            wsUrl != null && username != null && password != null,
        )

        val httpClient = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build()
        try {
            val connection = VibeAllDayNativeSecureConnection(httpClient)
            runBlocking {
                val full = withTimeout(15_000) {
                    connection.loginAndProbe(
                        wsUrl = checkNotNull(wsUrl),
                        username = checkNotNull(username),
                        password = checkNotNull(password),
                    )
                }
                assertFalse(full.resumed)
                assertEquals(username, full.credential.username)
                assertTrue(full.credential.sessionId.isNotBlank())
                assertEquals(
                    VibeAllDaySecureTransportCrypto.KEY_BYTES,
                    full.credential.keySize,
                )

                val resumed = withTimeout(15_000) {
                    connection.resumeAndProbe(checkNotNull(wsUrl), full.credential)
                }
                assertTrue(resumed.resumed)
                assertEquals(full.credential, resumed.credential)

                val now = System.currentTimeMillis()
                val route = VibeAllDayServerRoute.direct(checkNotNull(wsUrl))
                val profile = VibeAllDayPairedServerProfile.create(
                    label = "Disposable direct server",
                    username = checkNotNull(username),
                    route = route,
                    nowEpochMs = now,
                )
                val repository = InMemoryPairedServerRepository(
                    VibeAllDayPairedServerSnapshot(
                        profile = profile,
                        resumeCredential = VibeAllDayStoredResumeCredential(
                            credential = resumed.credential,
                            establishedAtEpochMs = now,
                            lastResumedAtEpochMs = null,
                        ),
                    ),
                )
                val manager = VibeAllDayServerConnectionManager(
                    profileId = profile.id,
                    repository = repository,
                    connector = VibeAllDayNativeProfileConnector(connection),
                )
                val firstLease = manager.acquire()
                val sessions = withTimeout(15_000) {
                    firstLease.request("GET", "/sessions")
                }
                assertEquals(200, sessions.status)
                assertTrue(sessions.body != null)
                val activity = withTimeout(15_000) {
                    firstLease.subscribe(channel = "activity")
                }
                val connected = withTimeout(15_000) { activity.events.first() }
                assertEquals("connected", connected.eventType)
                activity.close()
                firstLease.releaseAndAwait()
                assertEquals(VibeAllDayConnectionPhase.IDLE, manager.state.value.phase)

                val restartedLease = manager.acquire()
                val afterRestart = withTimeout(15_000) {
                    restartedLease.request("GET", "/sessions")
                }
                assertEquals(200, afterRestart.status)
                restartedLease.releaseAndAwait()
                manager.shutdownAndAwait()

                if (relayWsUrl != null) {
                    val unavailableDirectRoute = VibeAllDayServerRoute.direct(
                        "ws://127.0.0.1:38903/api/ws",
                    )
                    val relayRoute = VibeAllDayServerRoute.relay(
                        websocketUrl = relayWsUrl,
                        relayTarget = checkNotNull(username),
                    )
                    val relayProfile = VibeAllDayPairedServerProfile.create(
                        label = "Disposable relay server",
                        username = checkNotNull(username),
                        route = unavailableDirectRoute,
                        nowEpochMs = now,
                    ).copy(routes = listOf(unavailableDirectRoute, relayRoute))
                    val relayRepository = InMemoryPairedServerRepository(
                        VibeAllDayPairedServerSnapshot(
                            profile = relayProfile,
                            resumeCredential = VibeAllDayStoredResumeCredential(
                                credential = resumed.credential,
                                establishedAtEpochMs = now,
                                lastResumedAtEpochMs = null,
                            ),
                        ),
                    )
                    val relayManager = VibeAllDayServerConnectionManager(
                        profileId = relayProfile.id,
                        repository = relayRepository,
                        connector = VibeAllDayNativeProfileConnector(connection),
                    )
                    val relayLease = relayManager.acquire()
                    val relaySessions = withTimeout(15_000) {
                        relayLease.request("GET", "/sessions")
                    }
                    assertEquals(200, relaySessions.status)
                    assertEquals(
                        relayRoute.id,
                        relayRepository.snapshot(relayProfile.id)?.profile?.preferredRouteId,
                    )
                    relayLease.releaseAndAwait()
                    assertEquals(VibeAllDayConnectionPhase.IDLE, relayManager.state.value.phase)
                    relayManager.shutdownAndAwait()
                }
            }
        } finally {
            httpClient.connectionPool.evictAll()
            httpClient.dispatcher.executorService.shutdown()
        }
    }

    private class InMemoryPairedServerRepository(
        private var value: VibeAllDayPairedServerSnapshot,
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
}
