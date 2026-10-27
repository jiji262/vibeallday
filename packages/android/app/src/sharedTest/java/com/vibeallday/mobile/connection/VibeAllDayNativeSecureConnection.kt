package com.vibeallday.mobile.connection

import java.io.Closeable
import java.util.UUID
import java.nio.ByteBuffer
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.OkHttpClient
import okio.ByteString
import okio.ByteString.Companion.toByteString
import org.json.JSONArray
import org.json.JSONObject

data class VibeAllDaySecureProbeResult(
    val credential: VibeAllDayResumeCredential,
    val resumed: Boolean,
)


class VibeAllDayNativeSecureSession internal constructor(
    private val listener: SecureSessionListener,
    override val credential: VibeAllDayResumeCredential,
    override val resumed: Boolean,
    override val securityBinding: VibeAllDaySrpTransportBinding,
) : VibeAllDayMessageTransport, Closeable {
    override fun send(message: JSONObject) {
        listener.sendEncrypted(message)
    }

    override suspend fun sendUploadChunk(uploadId: String, offset: Long, chunk: ByteArray) {
        listener.sendUploadChunk(uploadId, offset, chunk)
    }

    override suspend fun receive(): JSONObject = listener.receive()

    override suspend fun awaitClosed() {
        listener.awaitClosed()
    }

    override suspend fun closeAndAwait() {
        listener.requestClose()
        val closedInTime = withTimeoutOrNull(CLOSE_TIMEOUT_MS) {
            runCatching { listener.awaitClosed() }
            true
        } == true
        if (!closedInTime) {
            listener.abort()
        }
    }

    override fun close() {
        listener.requestClose()
    }

    override fun cancel() {
        listener.abort()
    }

    companion object {
        private const val CLOSE_TIMEOUT_MS = 2_000L
    }
}

/**
 * Opens one authenticated VIBEALLDAY secure WebSocket. Connection lifetime, request
 * correlation, subscriptions, route fallback, and retries belong to the
 * higher-level leased connection manager.
 */
class VibeAllDayNativeSecureConnection(
    httpClient: OkHttpClient,
    private val secretBoxFactory: () -> VibeAllDaySecretBox = ::LazySodiumSecretBox,
    private val socketConnector: VibeAllDayClientSocketConnector =
        VibeAllDayOkHttpClientSocketConnector(httpClient),
) : VibeAllDaySecureSessionOpener {
    override suspend fun login(
        wsUrl: String,
        username: String,
        password: String,
        relayTarget: String?,
    ): VibeAllDayNativeSecureSession {
        require(username.isNotBlank())
        require(password.isNotEmpty())
        return open(
            wsUrl = wsUrl,
            relayTarget = relayTarget,
            authentication = FullLoginAuthentication(username, password),
        )
    }

    override suspend fun resume(
        wsUrl: String,
        credential: VibeAllDayResumeCredential,
        relayTarget: String?,
    ): VibeAllDayNativeSecureSession {
        return open(
            wsUrl = wsUrl,
            relayTarget = relayTarget,
            authentication = ResumeAuthentication(credential),
        )
    }

    suspend fun loginAndProbe(
        wsUrl: String,
        username: String,
        password: String,
    ): VibeAllDaySecureProbeResult {
        return probe(login(wsUrl, username, password))
    }

    suspend fun resumeAndProbe(
        wsUrl: String,
        credential: VibeAllDayResumeCredential,
    ): VibeAllDaySecureProbeResult {
        return probe(resume(wsUrl, credential))
    }

    private suspend fun open(
        wsUrl: String,
        relayTarget: String?,
        authentication: Authentication,
    ): VibeAllDayNativeSecureSession {
        val listener = SecureSessionListener(
            authentication = authentication,
            relayTarget = relayTarget,
            secretBox = secretBoxFactory(),
        )
        val socket = socketConnector.open(wsUrl, relayTarget, listener)
        listener.attach(socket)
        return try {
            listener.awaitAuthenticated()
        } catch (error: Throwable) {
            listener.abort()
            throw error
        }
    }

    private suspend fun probe(session: VibeAllDayNativeSecureSession): VibeAllDaySecureProbeResult {
        try {
            val pongId = "android-native-${UUID.randomUUID()}"
            session.send(JSONObject().put("type", "ping").put("id", pongId))
            val response = session.receive()
            check(
                response.getString("type") == "pong" &&
                    response.getString("id") == pongId,
            ) { "Native secure probe received an unexpected message" }
            return VibeAllDaySecureProbeResult(session.credential, session.resumed)
        } finally {
            session.closeAndAwait()
        }
    }
}

internal class SecureSessionListener(
    private val authentication: Authentication,
    private val relayTarget: String?,
    private val secretBox: VibeAllDaySecretBox,
) : VibeAllDayClientSocketListener {
    private val authenticated = CompletableDeferred<VibeAllDayNativeSecureSession>()
    private val closed = CompletableDeferred<Unit>()
    private val incoming = Channel<JSONObject>(INCOMING_BUFFER_SIZE)
    private val terminated = AtomicBoolean(false)
    private val sendLock = Any()
    private var socket: VibeAllDayClientSocket? = null
    private var transportKey: ByteArray? = null
    private var nextOutboundSequence = 0L
    private var lastInboundSequence = -1L
    private var relayPaired = relayTarget == null
    private var closeRequested = false

    fun attach(webSocket: VibeAllDayClientSocket) {
        socket = webSocket
    }

    suspend fun awaitAuthenticated(): VibeAllDayNativeSecureSession = authenticated.await()

    suspend fun receive(): JSONObject = incoming.receive()

    suspend fun awaitClosed() {
        closed.await()
    }

    override fun onOpen(socket: VibeAllDayClientSocket, relayPaired: Boolean) {
        if (terminated.get()) {
            socket.cancel()
            return
        }
        this.socket = socket
        this.relayPaired = relayPaired
        runCatching {
            val target = relayTarget
            if (relayPaired || target == null) {
                authentication.start(this)
            } else {
                sendPlaintext(
                    JSONObject()
                        .put("type", "client_connect")
                        .put("username", target),
                )
            }
        }.onFailure(::fail)
    }

    override fun onText(socket: VibeAllDayClientSocket, text: String) {
        runCatching {
            check(transportKey == null) {
                "Plaintext message received after secure transport establishment"
            }
            val message = JSONObject(text)
            if (!relayPaired) {
                when (message.getString("type")) {
                    "client_connected" -> {
                        relayPaired = true
                        authentication.start(this)
                    }

                    "client_error" -> error(
                        "Relay connection failed: ${message.optString("reason", "unknown")}",
                    )

                    else -> error("Relay returned an unexpected pairing response")
                }
            } else {
                authentication.handle(this, message)
            }
        }.onFailure(::fail)
    }

    override fun onBytes(socket: VibeAllDayClientSocket, bytes: ByteString) {
        runCatching {
            val key = checkNotNull(transportKey) {
                "Binary message received before secure transport establishment"
            }
            val plaintext = checkNotNull(
                VibeAllDaySecureTransportCrypto.decryptBinaryJson(
                    bytes.toByteArray(),
                    key,
                    secretBox,
                ),
            ) { "Encrypted response authentication failed" }
            val payload = JSONObject(plaintext)
            check(payload.length() == 2 && payload.has("seq") && payload.has("msg")) {
                "Encrypted response has an invalid sequence wrapper"
            }
            val sequence = payload.getLong("seq")
            check(sequence > lastInboundSequence) { "Encrypted response sequence replayed" }
            lastInboundSequence = sequence
            check(incoming.trySend(payload.getJSONObject("msg")).isSuccess) {
                "Native secure session is no longer accepting messages"
            }
        }.onFailure(::fail)
    }

    override fun onClosing(socket: VibeAllDayClientSocket, code: Int, reason: String) {
        socket.close(code, reason)
    }

    override fun onClosed(socket: VibeAllDayClientSocket, code: Int, reason: String) {
        val normalOwnerClose = closeRequested && code == NORMAL_CLOSE_CODE
        terminate(
            if (normalOwnerClose) {
                null
            } else {
                IllegalStateException("VIBEALLDAY WebSocket closed ($code): $reason")
            },
        )
    }

    override fun onFailure(socket: VibeAllDayClientSocket, error: Throwable) {
        terminate(if (closeRequested) null else error)
    }

    fun sendPlaintext(message: JSONObject) {
        check(!terminated.get()) { "Native secure session is closed" }
        check(transportKey == null)
        check(socket?.send(message.toString()) == true) {
            "WebSocket rejected plaintext authentication message"
        }
    }

    fun encryptProof(plaintext: String, key: ByteArray): String {
        return VibeAllDaySecureTransportCrypto.encryptJsonEnvelope(plaintext, key, secretBox)
    }

    fun decryptProof(envelope: String, key: ByteArray): JSONObject {
        val plaintext = checkNotNull(
            VibeAllDaySecureTransportCrypto.decryptJsonEnvelope(envelope, key, secretBox),
        ) { "VIBEALLDAY server proof authentication failed" }
        return JSONObject(plaintext)
    }

    fun establish(
        credential: VibeAllDayResumeCredential,
        resumed: Boolean,
        transportNonce: String,
        key: ByteArray,
    ) {
        check(transportKey == null)
        transportKey = key
        nextOutboundSequence = 0
        lastInboundSequence = -1
        authentication.clearSecrets()
        sendEncrypted(
            JSONObject()
                .put("type", "client_capabilities")
                .put("formats", JSONArray().put(VibeAllDaySecureTransportCrypto.JSON_FORMAT)),
        )
        authenticated.complete(
            VibeAllDayNativeSecureSession(
                listener = this,
                credential = credential,
                resumed = resumed,
                securityBinding = VibeAllDaySrpTransportBinding(
                    sessionId = credential.sessionId,
                    transportNonce = transportNonce,
                    authenticationMethod = if (resumed) {
                        VibeAllDaySrpAuthenticationMethod.RESUME
                    } else {
                        VibeAllDaySrpAuthenticationMethod.FULL
                    },
                ),
            ),
        )
    }

    fun sendEncrypted(message: JSONObject) {
        synchronized(sendLock) {
            check(!terminated.get()) { "Native secure session is closed" }
            val key = checkNotNull(transportKey) { "Native secure session is not authenticated" }
            val plaintext = JSONObject()
                .put("seq", nextOutboundSequence++)
                .put("msg", message)
                .toString()
            val envelope = VibeAllDaySecureTransportCrypto.encryptBinaryJson(
                plaintext,
                key,
                secretBox,
            )
            check(socket?.send(envelope.toByteString()) == true) {
                "WebSocket rejected encrypted message"
            }
        }
    }

    suspend fun sendUploadChunk(uploadId: String, offset: Long, chunk: ByteArray) {
        require(offset >= 0 && chunk.size in 1..65536)
        // The mux broker exposes its bounded per-circuit queue through this API.
        withTimeout(30_000) {
            while ((socket?.queueSize() ?: error("Socket closed")) > 512 * 1024) delay(10)
        }
        val id = UUID.fromString(uploadId)
        val payload = ByteBuffer.allocate(24 + chunk.size)
            .putLong(id.mostSignificantBits).putLong(id.leastSignificantBits).putLong(offset)
            .put(chunk).array()
        synchronized(sendLock) {
            check(!terminated.get())
            val key = checkNotNull(transportKey)
            check(socket?.send(VibeAllDaySecureTransportCrypto.encryptBinaryPayload(
                2, payload, key, secretBox,
            ).toByteString()) == true) { "Socket rejected upload chunk" }
        }
    }

    fun requestClose() {
        if (terminated.get()) return
        closeRequested = true
        if (socket?.close(NORMAL_CLOSE_CODE, NORMAL_CLOSE_REASON) != true) {
            abort()
        }
    }

    fun abort() {
        closeRequested = true
        socket?.cancel()
        terminate(null)
    }

    private fun fail(error: Throwable) {
        socket?.cancel()
        terminate(error)
    }

    private fun terminate(error: Throwable?) {
        if (!terminated.compareAndSet(false, true)) return
        authentication.clearSecrets()
        transportKey?.fill(0)
        transportKey = null
        socket = null
        if (!authenticated.isCompleted) {
            if (error == null) {
                authenticated.completeExceptionally(
                    IllegalStateException("Native secure session closed during authentication"),
                )
            } else {
                authenticated.completeExceptionally(error)
            }
        }
        incoming.close(error)
        if (error == null) {
            closed.complete(Unit)
        } else {
            closed.completeExceptionally(error)
        }
    }

    companion object {
        private const val NORMAL_CLOSE_CODE = 1000
        private const val NORMAL_CLOSE_REASON = "Native owner released"
        private const val INCOMING_BUFFER_SIZE = 256
    }
}

internal interface Authentication {
    fun start(listener: SecureSessionListener)
    fun handle(listener: SecureSessionListener, message: JSONObject)
    fun clearSecrets()
}

private class FullLoginAuthentication(
    private val username: String,
    password: String,
) : Authentication {
    private var srpSession: VibeAllDaySrpClientSession? = VibeAllDaySrpClientSession(username, password)
    private var phase = Phase.CHALLENGE

    override fun start(listener: SecureSessionListener) {
        listener.sendPlaintext(
            JSONObject()
                .put("type", "srp_hello")
                .put("identity", username),
        )
    }

    override fun handle(listener: SecureSessionListener, message: JSONObject) {
        rejectSrpError(message)
        when (phase) {
            Phase.CHALLENGE -> {
                check(message.getString("type") == "srp_challenge")
                val proof = checkNotNull(srpSession).processChallenge(
                    message.getString("salt"),
                    message.getString("B"),
                )
                listener.sendPlaintext(
                    JSONObject()
                        .put("type", "srp_proof")
                        .put("A", proof.publicValueHex)
                        .put("M1", proof.evidenceHex),
                )
                phase = Phase.VERIFY
            }

            Phase.VERIFY -> {
                check(message.getString("type") == "srp_verify")
                val rawSessionKey = checkNotNull(srpSession).verifyServer(message.getString("M2"))
                srpSession = null
                val baseKey = VibeAllDaySecureTransportCrypto.deriveBaseKey(rawSessionKey)
                rawSessionKey.fill(0)
                val sessionId = message.getString("sessionId")
                val transportNonceValue = message.getString("transportNonce")
                val serverInfo = listener.decryptProof(
                    message.getString("serverInfoProof"),
                    baseKey,
                )
                check(serverInfo.getString("type") == "srp_verify_server_info")
                check(serverInfo.getString("sessionId") == sessionId)
                check(serverInfo.getString("transportNonce") == transportNonceValue)
                val protocolVersion = serverInfo.getInt("resumeProtocolVersion")
                check(protocolVersion >= VibeAllDaySecureTransportCrypto.RESUME_PROTOCOL_VERSION)
                val transportNonce = VibeAllDaySecureTransportCrypto.decodeBase64(transportNonceValue)
                check(transportNonce.size == VibeAllDaySecureTransportCrypto.NONCE_BYTES)
                val credential = VibeAllDayResumeCredential(
                    username = username,
                    sessionId = sessionId,
                    baseKey = baseKey,
                    resumeProtocolVersion = protocolVersion,
                )
                phase = Phase.AUTHENTICATED
                try {
                    listener.establish(
                        credential = credential,
                        resumed = false,
                        transportNonce = transportNonceValue,
                        key = VibeAllDaySecureTransportCrypto.deriveTransportKey(baseKey, transportNonce),
                    )
                } finally {
                    baseKey.fill(0)
                    transportNonce.fill(0)
                }
            }

            Phase.AUTHENTICATED -> error("Unexpected plaintext after SRP authentication")
        }
    }

    override fun clearSecrets() {
        srpSession = null
    }

    private enum class Phase { CHALLENGE, VERIFY, AUTHENTICATED }
}

private class ResumeAuthentication(
    private val credential: VibeAllDayResumeCredential,
) : Authentication {
    private val baseKey = credential.copyBaseKey()
    private val clientNonce = VibeAllDaySecureTransportCrypto.encodeBase64(
        VibeAllDaySecureTransportCrypto.randomNonce(),
    )
    private var serverNonce: String? = null
    private var phase = Phase.CHALLENGE

    override fun start(listener: SecureSessionListener) {
        listener.sendPlaintext(
            JSONObject()
                .put("type", "srp_resume_init")
                .put("identity", credential.username)
                .put("sessionId", credential.sessionId)
                .put("clientNonce", clientNonce),
        )
    }

    override fun handle(listener: SecureSessionListener, message: JSONObject) {
        rejectSrpError(message)
        if (message.optString("type") == "srp_invalid") {
            throw VibeAllDayResumeRejectedException(message.optString("reason", "unknown"))
        }
        when (phase) {
            Phase.CHALLENGE -> {
                check(message.getString("type") == "srp_resume_challenge")
                check(message.getString("sessionId") == credential.sessionId)
                val nonce = message.getString("nonce")
                check(
                    VibeAllDaySecureTransportCrypto.decodeBase64(nonce).size ==
                        VibeAllDaySecureTransportCrypto.NONCE_BYTES,
                )
                serverNonce = nonce
                val proof = listener.encryptProof(
                    JSONObject()
                        .put("timestamp", System.currentTimeMillis())
                        .put("challenge", nonce)
                        .put("sessionId", credential.sessionId)
                        .toString(),
                    baseKey,
                )
                listener.sendPlaintext(
                    JSONObject()
                        .put("type", "srp_resume")
                        .put("identity", credential.username)
                        .put("sessionId", credential.sessionId)
                        .put("proof", proof),
                )
                phase = Phase.VERIFY
            }

            Phase.VERIFY -> {
                check(message.getString("type") == "srp_resumed")
                check(message.getString("sessionId") == credential.sessionId)
                val transportNonceValue = message.getString("transportNonce")
                check(transportNonceValue == serverNonce)
                val serverProof = listener.decryptProof(
                    message.getString("serverProof"),
                    baseKey,
                )
                check(serverProof.getString("type") == "srp_resume_server_proof")
                check(serverProof.getString("sessionId") == credential.sessionId)
                check(serverProof.getString("serverNonce") == serverNonce)
                check(serverProof.getString("clientNonce") == clientNonce)
                val protocolVersion = serverProof.getInt("resumeProtocolVersion")
                check(protocolVersion >= credential.resumeProtocolVersion)
                val transportNonce = VibeAllDaySecureTransportCrypto.decodeBase64(transportNonceValue)
                phase = Phase.AUTHENTICATED
                try {
                    listener.establish(
                        credential = credential,
                        resumed = true,
                        transportNonce = transportNonceValue,
                        key = VibeAllDaySecureTransportCrypto.deriveTransportKey(baseKey, transportNonce),
                    )
                } finally {
                    transportNonce.fill(0)
                }
            }

            Phase.AUTHENTICATED -> error("Unexpected plaintext after SRP resume")
        }
    }

    override fun clearSecrets() {
        baseKey.fill(0)
    }

    private enum class Phase { CHALLENGE, VERIFY, AUTHENTICATED }
}

private fun rejectSrpError(message: JSONObject) {
    if (message.optString("type") == "srp_error") {
        error("VIBEALLDAY server rejected native SRP authentication: ${message.optString("code")}")
    }
}
