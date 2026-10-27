package com.vibeallday.mobile.connection

import com.vibeallday.mobile.profiles.VibeAllDayPairedServerProfile
import com.vibeallday.mobile.profiles.VibeAllDayServerRoute
import com.vibeallday.mobile.profiles.VibeAllDayServerRouteKind
import kotlinx.coroutines.CancellationException
import org.json.JSONObject
import java.io.Closeable

interface VibeAllDayResponseBody : Closeable {
    val metadata: JSONObject
    suspend fun nextChunk(): ByteArray?
}

interface VibeAllDayMessageTransport {
    val credential: VibeAllDayResumeCredential
    val resumed: Boolean
    val routeId: String? get() = null
    fun cancelRequest(id: String) {}
    suspend fun directRequest(method: String, path: String, body: JSONObject?): VibeAllDayApiResponse? = null
    suspend fun fetchResponse(params: JSONObject): VibeAllDayResponseBody? = null
    val securityBinding: VibeAllDaySrpTransportBinding?
        get() = null

    fun send(message: JSONObject)
    suspend fun sendUploadChunk(uploadId: String, offset: Long, chunk: ByteArray) {
        error("Binary uploads are unavailable on this transport")
    }
    suspend fun cancelUpload(uploadId: String) { send(JSONObject().put("type", "upload_end").put("uploadId", uploadId)) }
    suspend fun receive(): JSONObject
    suspend fun awaitClosed()
    suspend fun closeAndAwait()
    fun cancel()
}

enum class VibeAllDaySrpAuthenticationMethod {
    FULL,
    RESUME,
}

data class VibeAllDaySrpTransportBinding(
    val sessionId: String,
    val transportNonce: String,
    val authenticationMethod: VibeAllDaySrpAuthenticationMethod,
) {
    init {
        require(sessionId.isNotBlank())
        require(transportNonce.isNotBlank())
    }
}

interface VibeAllDaySecureSessionOpener {
    suspend fun login(
        wsUrl: String,
        username: String,
        password: String,
        relayTarget: String? = null,
    ): VibeAllDayMessageTransport

    suspend fun resume(
        wsUrl: String,
        credential: VibeAllDayResumeCredential,
        relayTarget: String? = null,
    ): VibeAllDayMessageTransport
}

data class VibeAllDayRoutedTransport(
    val route: VibeAllDayServerRoute,
    val transport: VibeAllDayMessageTransport,
)

interface VibeAllDayProfileConnector {
    suspend fun awaitCredentialSettled(profileId: String) {}
    suspend fun resume(
        profile: VibeAllDayPairedServerProfile,
        credential: VibeAllDayResumeCredential,
    ): VibeAllDayRoutedTransport

    suspend fun loginProfile(profile: VibeAllDayPairedServerProfile, route: VibeAllDayServerRoute, password: String): VibeAllDayMessageTransport = login(route, profile.username, password)

    suspend fun login(
        route: VibeAllDayServerRoute,
        username: String,
        password: String,
    ): VibeAllDayMessageTransport
}

class VibeAllDayAllRoutesRejectedException :
    IllegalStateException("Every reachable route rejected the resume credential")

class VibeAllDayNoRouteConnectedException(causes: List<Throwable>) :
    IllegalStateException(
        "Could not connect through any saved server route",
        causes.firstOrNull(),
    )

class VibeAllDayNativeProfileConnector(
    private val connection: VibeAllDaySecureSessionOpener,
) : VibeAllDayProfileConnector {
    override suspend fun resume(
        profile: VibeAllDayPairedServerProfile,
        credential: VibeAllDayResumeCredential,
    ): VibeAllDayRoutedTransport {
        val routes = profile.routes.sortedWith(
            compareByDescending<VibeAllDayServerRoute> { it.id == profile.preferredRouteId }
                .thenBy { it.kind != VibeAllDayServerRouteKind.DIRECT },
        )
        val failures = mutableListOf<Throwable>()
        var rejectedRoutes = 0
        for (route in routes) {
            try {
                return VibeAllDayRoutedTransport(
                    route = route,
                    transport = connection.resume(
                        wsUrl = route.websocketUrl,
                        credential = credential,
                        relayTarget = route.relayTarget,
                    ),
                )
            } catch (error: VibeAllDayResumeRejectedException) {
                rejectedRoutes += 1
                failures += error
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                failures += error
            }
        }
        if (rejectedRoutes == routes.size) throw VibeAllDayAllRoutesRejectedException()
        throw VibeAllDayNoRouteConnectedException(failures)
    }

    override suspend fun login(
        route: VibeAllDayServerRoute,
        username: String,
        password: String,
    ): VibeAllDayMessageTransport {
        return connection.login(
            wsUrl = route.websocketUrl,
            username = username,
            password = password,
            relayTarget = route.relayTarget,
        )
    }
}
