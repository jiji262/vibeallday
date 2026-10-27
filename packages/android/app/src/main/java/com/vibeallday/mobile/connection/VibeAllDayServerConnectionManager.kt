package com.vibeallday.mobile.connection

import com.vibeallday.mobile.profiles.VibeAllDayPairedServerRepository
import com.vibeallday.mobile.profiles.VibeAllDayStoredResumeCredential
import com.vibeallday.mobile.security.VibeAllDaySecurityClientLifecycle
import com.vibeallday.mobile.security.VibeAllDaySecurityClientRevokedException
import com.vibeallday.mobile.experimental.CONVERSATION_API_REVISION
import com.vibeallday.mobile.experimental.ConversationQuery
import com.vibeallday.mobile.experimental.SimpleClientContract
import java.io.Closeable
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout
import org.json.JSONObject

enum class VibeAllDayConnectionPhase {
    IDLE,
    CONNECTING,
    CONNECTED,
    RETRYING,
    REAUTHENTICATION_REQUIRED,
    REVOKED,
    FAILED,
}

data class VibeAllDayConnectionState(
    val phase: VibeAllDayConnectionPhase,
    val routeId: String? = null,
    val retryAttempt: Int = 0,
    val errorMessage: String? = null,
    val recoverable: Boolean = false,
    val connectionEpoch: Long = 0,
)

data class VibeAllDayApiResponse(
    val status: Int,
    val headers: Map<String, String>,
    val body: Any?,
)

class VibeAllDayApiException(val response: VibeAllDayApiResponse) :
    IllegalStateException("VIBEALLDAY API returned status ${response.status}")

class VibeAllDayConnectionUnavailableException(message: String, cause: Throwable? = null) :
    IllegalStateException(message, cause)

internal enum class VibeAllDayNativeOperationFailure(val description: String) {
    CONNECTION_UNAVAILABLE("Native connection unavailable"),
    TIMEOUT("Native request timed out"),
    OVERFLOW("Native request limit exceeded"),
    INVALID_MESSAGE("Invalid or unauthenticated native message"),
    REAUTHENTICATION_REQUIRED("Native sign-in required"),
}

internal class VibeAllDayNativeOperationException(val failure: VibeAllDayNativeOperationFailure) :
    IllegalStateException(failure.description)

class VibeAllDaySubscriptionOverflowException :
    IllegalStateException("Native subscription consumer fell behind")

data class VibeAllDaySubscriptionEvent(
    val eventType: String,
    val eventId: String?,
    val data: Any?,
)

class VibeAllDaySubscription internal constructor(
    val events: Flow<VibeAllDaySubscriptionEvent>,
    private val release: () -> Unit,
) : Closeable {
    private val closed = AtomicBoolean(false)

    override fun close() {
        if (closed.compareAndSet(false, true)) release()
    }
}

class VibeAllDayConnectionLease internal constructor(
    private val manager: VibeAllDayServerConnectionManager,
    internal val id: String,
) : Closeable {
    private val released = AtomicBoolean(false)

    suspend fun reconnect() {
        check(!released.get()) { "Connection lease is released" }
        manager.reconnect(id)
    }
    suspend fun state(): VibeAllDayConnectionState {
        check(!released.get()) { "Connection lease is released" }
        return manager.stateForLease(id)
    }

    suspend fun request(
        method: String,
        path: String,
        body: Any? = null,
        headers: Map<String, String> = emptyMap(),
    ): VibeAllDayApiResponse {
        check(!released.get()) { "Connection lease is released" }
        return manager.request(id, method, path, body, headers)
    }

    suspend fun fetchResponse(path: String, headers: Map<String, String>): VibeAllDayResponseBody {
        check(!released.get()) { "Connection lease is released" }
        return manager.fetchResponse(id, path, headers)
    }

    suspend fun subscribe(
        channel: String,
        sessionId: String? = null,
        projectId: String? = null,
        provider: String? = null,
        lastEventId: String? = null,
        wantsLiveDeltas: Boolean? = null,
        coverage: JSONObject? = null,
    ): VibeAllDaySubscription {
        check(!released.get()) { "Connection lease is released" }
        return manager.subscribe(
            leaseId = id,
            channel = channel,
            sessionId = sessionId,
            projectId = projectId,
            provider = provider,
            lastEventId = lastEventId,
            wantsLiveDeltas = wantsLiveDeltas,
            coverage = coverage,
        )
    }

    suspend fun startUpload(params: JSONObject): VibeAllDayNativeUpload {
        check(!released.get())
        return manager.startUpload(id, params)
    }

    suspend fun sendUploadChunk(uploadId: String, offset: Long, chunk: ByteArray) {
        check(!released.get())
        manager.sendUploadChunk(id, uploadId, offset, chunk)
    }

    suspend fun endUpload(uploadId: String) = manager.endUpload(id, uploadId)
    suspend fun cancelUpload(uploadId: String) = manager.cancelUpload(id, uploadId)

    suspend fun releaseAndAwait() {
        if (released.compareAndSet(false, true)) manager.releaseLease(id)
    }

    suspend fun subscribeConversation(subscriptionId: String, query: ConversationQuery): VibeAllDaySubscription {
        check(!released.get()) { "Connection lease is released" }
        SimpleClientContract.decodeId(subscriptionId)
        return manager.subscribe(
            leaseId = id,
            channel = "/api/experimental/conversation/subscribe",
            sessionId = null,
            projectId = null,
            provider = null,
            lastEventId = null,
            wantsLiveDeltas = null,
            conversation = query,
            bindingId = subscriptionId,
        )
    }

    override fun close() {
        if (released.compareAndSet(false, true)) manager.releaseLeaseAsync(id)
    }
}

data class VibeAllDayNativeUpload(val id: String, val events: Flow<JSONObject>)

class VibeAllDayServerConnectionManager(
    private val profileId: String,
    private val repository: VibeAllDayPairedServerRepository,
    private val connector: VibeAllDayProfileConnector,
    private val securityClients: VibeAllDaySecurityClientLifecycle? = null,
    dispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val nowEpochMs: () -> Long = System::currentTimeMillis,
    private val retryDelaysMs: List<Long> = listOf(250, 1_000, 3_000),
) : Closeable {
    private val scope = CoroutineScope(SupervisorJob() + dispatcher)
    private val mutex = Mutex()
    private val leases = mutableMapOf<String, MutableSet<String>>()
    private val pendingRequests = mutableMapOf<String, CompletableDeferred<VibeAllDayApiResponse>>()
    private val subscriptions = mutableMapOf<String, SubscriptionRecord>()
    private val uploads = mutableMapOf<String, UploadRecord>()
    private var connection: VibeAllDayRoutedTransport? = null
    private var connectionJob: Job? = null
    private var connectionGeneration = 0L
    private var connectionReady = CompletableDeferred<Unit>()
    private var connectedEpoch = 0L
    private val mutableState = MutableStateFlow(VibeAllDayConnectionState(VibeAllDayConnectionPhase.IDLE))

    val state: StateFlow<VibeAllDayConnectionState> = mutableState.asStateFlow()
    private val responseBodies = ConcurrentHashMap<String, OwnedResponseBody>()

    private inner class OwnedResponseBody(val leaseId: String, val id: String, val body: VibeAllDayResponseBody) : VibeAllDayResponseBody {
        private val closed = AtomicBoolean(false)
        override val metadata get() = body.metadata
        override suspend fun nextChunk(): ByteArray? {
            check(!closed.get()) { "Native response closed" }
            return body.nextChunk()
        }
        override fun close() {
            if (closed.compareAndSet(false, true)) { responseBodies.remove(id, this); body.close() }
        }
    }

    internal suspend fun fetchResponse(leaseId: String, path: String, headers: Map<String, String>): VibeAllDayResponseBody {
        require(path.startsWith("/") && !path.startsWith("//"))
        require(headers.keys.none { it.equals("Authorization", ignoreCase = true) })
        val transport = ensureConnected(leaseId)
        val params = JSONObject().put("method", "GET")
            .put("path", if (path.startsWith("/api/")) path else "/api$path")
            .put("headers", JSONObject(headers.filterKeys { it.lowercase() !in MANAGED_REQUEST_HEADERS } +
                mapOf("Content-Type" to "application/json", "X-VibeAllDay" to "true")))
        val body = transport.fetchResponse(params) ?: error("Native response streaming unavailable")
        try {
            return mutex.withLock {
                check(leases.containsKey(leaseId) && connection?.transport === transport) { "Native response owner changed" }
                // Rust owns source-wide admission. Consumed EOF can return its
                // slot before Kotlin retires the finished wrapper; a second cap
                // here would reject a legitimate queued range in that interval.
                val id = UUID.randomUUID().toString()
                OwnedResponseBody(leaseId, id, body).also { responseBodies[id] = it }
            }
        } catch (error: Throwable) { body.close(); throw error }
    }
    internal suspend fun stateForLease(leaseId: String): VibeAllDayConnectionState = mutex.withLock {
        check(leases.containsKey(leaseId)) { "Connection lease is released" }
        mutableState.value
    }

    init {
        require(retryDelaysMs.all { it >= 0 })
    }

    suspend fun acquire(): VibeAllDayConnectionLease {
        val leaseId = UUID.randomUUID().toString()
        mutex.withLock {
            leases[leaseId] = mutableSetOf()
            startConnectionIfNeededLocked()
        }
        return VibeAllDayConnectionLease(this, leaseId)
    }

    internal suspend fun request(
        leaseId: String,
        method: String,
        path: String,
        body: Any?,
        headers: Map<String, String>,
    ): VibeAllDayApiResponse {
        require(method in SUPPORTED_METHODS) { "Unsupported VIBEALLDAY API method" }
        require(path.startsWith("/") && !path.startsWith("//")) {
            "VIBEALLDAY API path must be origin-relative"
        }
        require(headers.keys.none { it.equals("Authorization", ignoreCase = true) }) {
            "Native secure requests do not accept an Authorization header"
        }
        val transport = ensureConnected(leaseId)
        val requestId = UUID.randomUUID().toString()
        val deferred = CompletableDeferred<VibeAllDayApiResponse>()
        val requestHeaders = headers.filterKeys { supplied ->
            supplied.lowercase() !in MANAGED_REQUEST_HEADERS
        } + mapOf("Content-Type" to "application/json", "X-VibeAllDay" to "true")
        val message = JSONObject()
            .put("type", "request")
            .put("id", requestId)
            .put("method", method)
            .put("path", if (path.startsWith("/api")) path else "/api$path")
            .put(
                "headers",
                JSONObject(requestHeaders),
            )
        if (body != null) message.put("body", JSONObject.wrap(body))

        mutex.withLock {
            check(leases.containsKey(leaseId)) { "Connection lease is released" }
            check(connection?.transport === transport) { "Native connection changed before request send" }
            pendingRequests[requestId] = deferred
            try {
                transport.send(message)
            } catch (error: Throwable) {
                pendingRequests.remove(requestId)
                throw error
            }
        }

        return try {
            val response = withTimeout(REQUEST_TIMEOUT_MS) { deferred.await() }
            if (response.status >= 400) throw VibeAllDayApiException(response)
            response
        } finally {
            transport.cancelRequest(requestId)
            mutex.withLock { pendingRequests.remove(requestId) }
        }
    }

    internal suspend fun subscribe(
        leaseId: String,
        channel: String,
        sessionId: String?,
        projectId: String?,
        provider: String?,
        lastEventId: String?,
        wantsLiveDeltas: Boolean?,
        conversation: ConversationQuery? = null,
        bindingId: String? = null,
        coverage: JSONObject? = null,
    ): VibeAllDaySubscription {
        require(channel in SUPPORTED_SUBSCRIPTION_CHANNELS ||
            (channel == "/api/experimental/conversation/subscribe" && conversation != null && bindingId != null))
        if (conversation != null) SimpleClientContract.decodeConversationQuery(conversation.toJson())
        require(channel !in setOf("glossary", "worktree") || !projectId.isNullOrBlank())
        require(channel != "worktree" || coverage != null)
        require(channel != "session" || !sessionId.isNullOrBlank())
        require(channel != "session-watch" || (!sessionId.isNullOrBlank() && !projectId.isNullOrBlank()))
        val transport = ensureConnected(leaseId)
        val subscriptionId = bindingId ?: UUID.randomUUID().toString()
        val eventChannel = Channel<VibeAllDaySubscriptionEvent>(SUBSCRIPTION_BUFFER_SIZE)
        val record = SubscriptionRecord(
            id = subscriptionId,
            leaseId = leaseId,
            channel = channel,
            sessionId = sessionId,
            projectId = projectId,
            provider = provider,
            lastEventId = lastEventId,
            wantsLiveDeltas = wantsLiveDeltas,
            events = eventChannel,
            conversation = conversation,
            coverage = coverage,
        )
        mutex.withLock {
            val owned = checkNotNull(leases[leaseId]) { "Connection lease is released" }
            check(subscriptionId !in subscriptions) { "Subscription identity already in use" }
            check(connection?.transport === transport) {
                "Native connection changed before subscription send"
            }
            subscriptions[subscriptionId] = record
            owned += subscriptionId
            try {
                transport.send(record.subscribeMessage())
            } catch (error: Throwable) {
                subscriptions.remove(subscriptionId)
                owned -= subscriptionId
                eventChannel.close(error)
                throw error
            }
        }
        return VibeAllDaySubscription(eventChannel.receiveAsFlow()) {
            scope.launch { closeSubscription(subscriptionId) }
        }
    }

    internal suspend fun startUpload(leaseId: String, params: JSONObject): VibeAllDayNativeUpload {
        val size = params.getLong("size")
        require(size in 0..(100L * 1024 * 1024))
        require(params.getString("filename").length in 1..1024)
        val kind = params.getString("type")
        require(kind == "upload_start" || kind == "staged_upload_start")
        if (kind == "upload_start") {
            require(params.getString("projectId").isNotBlank() && params.getString("sessionId").isNotBlank())
        }
        val transport = ensureConnected(leaseId)
        val id = UUID.randomUUID().toString()
        val events = Channel<JSONObject>(64)
        val record = UploadRecord(id, leaseId, size, transport, events)
        val message = JSONObject().put("type", kind).put("uploadId", id)
        listOf("projectId", "sessionId", "filename", "size", "mimeType", "width", "height", "batchId")
            .forEach { key -> if (params.has(key)) message.put(key, params.get(key)) }
        mutex.withLock {
            check(leases.containsKey(leaseId) && connection?.transport === transport)
            require(uploads.values.count { it.leaseId == leaseId } < 4) { "Too many native uploads" }
            uploads[id] = record
            try { transport.send(message) } catch (error: Throwable) { uploads.remove(id); throw error }
        }
        return VibeAllDayNativeUpload(id, events.receiveAsFlow())
    }

    internal suspend fun sendUploadChunk(leaseId: String, uploadId: String, offset: Long, chunk: ByteArray) {
        val record = mutex.withLock {
            checkNotNull(uploads[uploadId]) { "Upload is no longer active" }.also {
                require(it.leaseId == leaseId && connection?.transport === it.transport)
            }
        }
        record.writes.withLock {
            require(chunk.size in 1..65536 && offset == record.offset && offset <= record.size - chunk.size)
            record.transport.sendUploadChunk(uploadId, offset, chunk)
            record.offset += chunk.size
        }
    }

    internal suspend fun endUpload(leaseId: String, uploadId: String) {
        val record = mutex.withLock {
            checkNotNull(uploads[uploadId]).also { require(it.leaseId == leaseId) }
        }
        record.writes.withLock {
            require(record.offset == record.size) { "Upload is incomplete" }
            record.transport.send(JSONObject().put("type", "upload_end").put("uploadId", uploadId))
        }
    }

    internal suspend fun cancelUpload(leaseId: String, uploadId: String) {
        val record = mutex.withLock {
            val record = uploads[uploadId] ?: return
            require(record.leaseId == leaseId)
            uploads.remove(uploadId)
            record
        }
        // The established protocol has no cancel frame. End always closes its
        // server state: incomplete files fail size validation; a file whose
        // bytes already arrived may complete (staged expiry still applies).
        record.writes.withLock {
            runCatching {
                record.transport.cancelUpload(uploadId)
            }
        }
        record.events.close(CancellationException("Upload consumer released"))
    }

    internal fun releaseLeaseAsync(leaseId: String) {
        scope.launch { releaseLease(leaseId) }
    }

    internal suspend fun releaseLease(leaseId: String) {
        val subscriptionsToClose = mutex.withLock {
            leases.remove(leaseId)?.toList().orEmpty()
        }
        responseBodies.values.filter { it.leaseId == leaseId }.forEach { it.close() }
        subscriptionsToClose.forEach { closeSubscription(it) }
        val ownedUploads = mutex.withLock { uploads.values.filter { it.leaseId == leaseId }.map { it.id } }
        ownedUploads.forEach { cancelUpload(leaseId, it) }

        var job: Job? = null
        var transport: VibeAllDayMessageTransport? = null
        mutex.withLock {
            if (leases.isEmpty()) {
                connectionGeneration += 1
                job = connectionJob
                connectionJob = null
                transport = connection?.transport
                connection = null
                failPendingLocked(VibeAllDayConnectionUnavailableException("No native connection owner"))
                connectionReady.completeExceptionally(
                    VibeAllDayConnectionUnavailableException("No native connection owner"),
                )
                mutableState.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.IDLE)
            }
        }
        job?.cancel()
        transport?.cancel()
        job?.join()
    }

    suspend fun shutdownAndAwait() {
        val leaseIds = mutex.withLock { leases.keys.toList() }
        leaseIds.forEach { releaseLease(it) }
        scope.cancel()
    }

    override fun close() {
        scope.launch { shutdownAndAwait() }
    }

    private suspend fun ensureConnected(leaseId: String): VibeAllDayMessageTransport {
        while (true) {
            val waitForConnection = mutex.withLock {
                check(leases.containsKey(leaseId)) { "Connection lease is released" }
                connection?.transport?.let { return it }
                val state = mutableState.value
                if (state.phase in setOf(VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED, VibeAllDayConnectionPhase.REVOKED) ||
                    (state.phase == VibeAllDayConnectionPhase.FAILED && !state.recoverable)) {
                    throw VibeAllDayConnectionUnavailableException(state.errorMessage ?: "Native connection ended")
                }
                startConnectionIfNeededLocked()
                connectionReady
            }
            waitForConnection.await()
        }
    }

    /** A foreground recovery signal replaces a stale socket, never its owners. */
    internal suspend fun reconnect(leaseId: String) {
        val ready = mutex.withLock {
            check(leases.containsKey(leaseId)) { "Connection lease is released" }
            check(mutableState.value.phase !in setOf(VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED, VibeAllDayConnectionPhase.REVOKED)) {
                "This server requires authentication"
            }
            check(mutableState.value.phase != VibeAllDayConnectionPhase.FAILED || mutableState.value.recoverable) {
                "Native connection failed verification"
            }
            // Join an existing acquisition/retry instead of multiplying cycles.
            if (connectionJob != null && mutableState.value.phase in setOf(VibeAllDayConnectionPhase.CONNECTING, VibeAllDayConnectionPhase.RETRYING)) {
                return@withLock connectionReady
            }
            connectionGeneration += 1
            connectionJob?.cancel()
            connection?.transport?.cancel()
            connection = null
            connectionJob = null
            val error = VibeAllDayConnectionUnavailableException("Connection reconnecting")
            failPendingLocked(error)
            uploads.values.forEach { it.events.close(error) }
            uploads.clear()
            failConversationsLocked(error)
            connectionReady.completeExceptionally(error)
            mutableState.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.CONNECTING)
            startConnectionIfNeededLocked()
            connectionReady
        }
        ready.await()
        val settled = withTimeout(REQUEST_TIMEOUT_MS) {
            state.first { it.phase !in setOf(VibeAllDayConnectionPhase.CONNECTING, VibeAllDayConnectionPhase.RETRYING) }
        }
        check(settled.phase == VibeAllDayConnectionPhase.CONNECTED) { "Native connection is unavailable" }
    }

    private fun startConnectionIfNeededLocked() {
        if (leases.isEmpty() || connection != null || connectionJob != null) return
        if (mutableState.value.phase in setOf(VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED, VibeAllDayConnectionPhase.REVOKED) ||
            (mutableState.value.phase == VibeAllDayConnectionPhase.FAILED && !mutableState.value.recoverable)) return
        connectionGeneration += 1
        val generation = connectionGeneration
        connectionReady = CompletableDeferred()
        connectionJob = scope.launch { runConnectionLoop(generation, connectionReady) }
    }

    private suspend fun runConnectionLoop(
        generation: Long,
        ready: CompletableDeferred<Unit>,
    ) {
        var failureCount = 0
        try {
            while (currentCoroutineContext().isActive && hasDemand(generation)) {
                setState(
                    generation,
                    VibeAllDayConnectionState(
                        phase = if (failureCount == 0) {
                            VibeAllDayConnectionPhase.CONNECTING
                        } else {
                            VibeAllDayConnectionPhase.RETRYING
                        },
                        retryAttempt = failureCount,
                    ),
                )
                var routed: VibeAllDayRoutedTransport? = null
                try {
                    connector.awaitCredentialSettled(profileId)
                    val snapshot = repository.snapshot(profileId)
                        ?: throw VibeAllDayConnectionUnavailableException("Paired server profile was removed")
                    val stored = snapshot.resumeCredential
                    if (stored == null || !stored.isEligibleAt(nowEpochMs())) {
                        if (stored != null) repository.clearCredential(profileId)
                        throw ReauthenticationRequired()
                    }
                    routed = connector.resume(snapshot.profile, stored.credential)
                    securityClients?.ensure(snapshot.profile, routed.transport)
                    val connectedAt = maxOf(nowEpochMs(), stored.establishedAtEpochMs)
                    repository.recordSuccessfulAuthentication(
                        profileId = profileId,
                        routeId = routed.route.id,
                        resumeCredential = stored.copy(credential = routed.transport.credential, lastResumedAtEpochMs = connectedAt),
                        connectedAtEpochMs = connectedAt,
                    )
                    installConnection(generation, routed)
                    ready.complete(Unit)
                    receiveMessages(generation, routed)
                    throw VibeAllDayConnectionUnavailableException("Native secure connection ended")
                } catch (error: CancellationException) {
                    throw error
                } catch (error: ReauthenticationRequired) {
                    failTerminal(
                        generation,
                        ready,
                        VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED,
                        "Sign in again to resume this server",
                        error,
                    )
                    return
                } catch (error: VibeAllDayRustTerminalException) {
                    if (error.phase == VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED) repository.clearCredential(profileId)
                    failTerminal(generation, ready, error.phase, "Native connection ended", error, error.recoverable)
                    return
                } catch (error: uniffi.vibeallday_mobile_core.CoreException.InvalidMessage) {
                    failTerminal(generation, ready, VibeAllDayConnectionPhase.FAILED, "Native connection verification failed", error)
                    return
                } catch (error: VibeAllDayAllRoutesRejectedException) {
                    repository.clearCredential(profileId)
                    failTerminal(
                        generation,
                        ready,
                        VibeAllDayConnectionPhase.REAUTHENTICATION_REQUIRED,
                        "The saved session was rejected; sign in again",
                        error,
                    )
                    return
                } catch (error: VibeAllDaySecurityClientRevokedException) {
                    failTerminal(
                        generation,
                        ready,
                        VibeAllDayConnectionPhase.REVOKED,
                        "This Android device was revoked; pair it again explicitly",
                        error,
                    )
                    return
                } catch (error: Throwable) {
                    clearConnection(generation, routed?.transport, error)
                    if (!hasDemand(generation)) return
                    if (failureCount >= retryDelaysMs.size) {
                        failTerminal(
                            generation,
                            ready,
                            VibeAllDayConnectionPhase.FAILED,
                            "Could not connect to the paired server",
                            error,
                            recoverable = true,
                        )
                        return
                    }
                    val delayMs = retryDelaysMs[failureCount]
                    failureCount += 1
                    setState(
                        generation,
                        VibeAllDayConnectionState(
                            phase = VibeAllDayConnectionPhase.RETRYING,
                            retryAttempt = failureCount,
                            errorMessage = "Connection lost; retrying",
                        ),
                    )
                    delay(delayMs)
                } finally {
                    routed?.transport?.cancel()
                }
            }
        } finally {
            mutex.withLock {
                if (connectionGeneration == generation) {
                    connection = null
                    connectionJob = null
                    if (leases.isEmpty()) {
                        mutableState.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.IDLE)
                    }
                }
            }
        }
    }

    private suspend fun installConnection(generation: Long, routed: VibeAllDayRoutedTransport) {
        mutex.withLock {
            check(connectionGeneration == generation && leases.isNotEmpty()) {
                "Native connection no longer has an owner"
            }
            // Replay and publication share one lock. A new subscriber cannot
            // dispatch in the gap and then be replayed a second time.
            subscriptions.values.forEach { routed.transport.send(it.subscribeMessage()) }
            connection = routed
            mutableState.value = VibeAllDayConnectionState(
                phase = VibeAllDayConnectionPhase.CONNECTED,
                routeId = routed.route.id,
                connectionEpoch = ++connectedEpoch,
            )
        }
    }

    private suspend fun receiveMessages(generation: Long, routed: VibeAllDayRoutedTransport) = coroutineScope {
        var bookkeeping: Job? = null
        try {
            while (currentCoroutineContext().isActive) {
                val message = routed.transport.receive()
                if (message.optString("type") == "state") {
                    // Security check-in can await network/storage. Keep draining
                    // bounded native queues, but cancel an obsolete check before
                    // handling the next socket epoch.
                    bookkeeping?.cancelAndJoin()
                    bookkeeping = null
                    if (message.optString("phase") == "CONNECTED") {
                        bookkeeping = launch { handleMessage(generation, routed.transport, message) }
                        continue
                    }
                }
                handleMessage(generation, routed.transport, message)
            }
        } finally { bookkeeping?.cancelAndJoin() }
    }

    private suspend fun handleMessage(
        generation: Long,
        transport: VibeAllDayMessageTransport,
        message: JSONObject,
    ) {
        val type = message.optString("type")
        when (type) {
            "state" -> {
                when (message.optString("phase")) {
                    "RETRYING" -> {
                        mutex.withLock {
                            if (connectionGeneration != generation || connection?.transport !== transport) return
                            failPendingLocked(VibeAllDayConnectionUnavailableException("Native connection was lost"))
                            uploads.values.forEach { it.events.close(VibeAllDayConnectionUnavailableException("Upload connection was lost")) }
                            uploads.clear()
                            failConversationsLocked(VibeAllDayConnectionUnavailableException("Conversation connection was lost"))
                            mutableState.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.RETRYING)
                        }
                    }
                    "CONNECTED" -> {
                        val current = mutex.withLock { connectionGeneration == generation && connection?.transport === transport }
                        if (!current) return
                        val snapshot = checkNotNull(repository.snapshot(profileId))
                        securityClients?.ensure(snapshot.profile, transport)
                        currentCoroutineContext().ensureActive()
                        mutex.withLock {
                            if (connectionGeneration != generation || connection?.transport !== transport) return
                            val route = snapshot.profile.routes.firstOrNull { it.id == transport.routeId }
                                ?: connection?.route ?: error("Native route is unavailable")
                            // A newer native retry may have opened its persistence
                            // window before its state event is consumed. It must
                            // publish its own ready edge after verification.
                            val stored = repository.snapshot(profileId)?.resumeCredential ?: return
                            val connectedAt = maxOf(nowEpochMs(), stored.establishedAtEpochMs)
                            repository.recordSuccessfulAuthentication(profileId, route.id, stored.copy(credential = transport.credential, lastResumedAtEpochMs = connectedAt), connectedAt)
                            connection = VibeAllDayRoutedTransport(route, transport)
                            mutableState.value = VibeAllDayConnectionState(VibeAllDayConnectionPhase.CONNECTED, routeId = route.id, connectionEpoch = ++connectedEpoch)
                        }
                    }
                    "FAILED", "REAUTHENTICATION_REQUIRED" -> throw VibeAllDayRustTerminalException(VibeAllDayConnectionPhase.valueOf(message.getString("phase")), message.optBoolean("recoverable"))
                }
            }
            "subscriptionError" -> {
                val valid = mutex.withLock { connectionGeneration == generation && connection?.transport === transport }
                if (!valid) return
                val code = message.optNullableString("errorCode")
                val error = if (code != null) VibeAllDayNativeOperationException(VibeAllDayNativeOperationFailure.valueOf(code))
                    else IllegalStateException(message.optString("error", "Native subscription failed"))
                closeSubscription(message.getString("subscriptionId"), error)
            }
            "requestError" -> {
                val id = message.getString("id")
                val failure = VibeAllDayNativeOperationFailure.valueOf(message.getString("code"))
                mutex.withLock {
                    if (connectionGeneration != generation || connection?.transport !== transport) return
                    pendingRequests.remove(id)?.completeExceptionally(VibeAllDayNativeOperationException(failure))
                }
            }
            "response" -> {
                val id = message.getString("id")
                val response = message.toApiResponse()
                mutex.withLock {
                    if (connectionGeneration != generation || connection?.transport !== transport) return
                    val pending = pendingRequests.remove(id)
                    if (pending != null) {
                        pending.complete(response)
                    } else if (response.status >= 400) {
                        val subscription = subscriptions.remove(id)
                        if (subscription != null) {
                            leases[subscription.leaseId]?.remove(id)
                            subscription.events.close(VibeAllDayApiException(response))
                        }
                    }
                    Unit
                }
            }

            "upload_progress", "upload_complete", "upload_error" -> {
                mutex.withLock {
                    if (connectionGeneration != generation || connection?.transport !== transport) return
                    val id = message.getString("uploadId")
                    val record = uploads[id] ?: return
                    if (record.events.trySend(message).isFailure) {
                        uploads.remove(id)
                        record.events.close(VibeAllDaySubscriptionOverflowException())
                    } else if (type != "upload_progress") {
                        uploads.remove(id)
                        record.events.close()
                    }
                    Unit
                }
            }

            "event" -> {
                val id = message.getString("subscriptionId")
                val overflowed = mutex.withLock {
                    if (connectionGeneration != generation || connection?.transport !== transport) return
                    val subscription = subscriptions[id] ?: return
                    val eventId = message.optNullableString("eventId")
                    if (eventId != null) subscription.lastEventId = eventId
                    subscription.events.trySend(
                        VibeAllDaySubscriptionEvent(
                            eventType = message.getString("eventType"),
                            eventId = eventId,
                            data = message.optNullable("data"),
                        ),
                    ).isFailure
                }
                if (overflowed) closeSubscription(id, VibeAllDaySubscriptionOverflowException())
            }
        }
    }

    private suspend fun clearConnection(
        generation: Long,
        transport: VibeAllDayMessageTransport?,
        error: Throwable,
    ) {
        mutex.withLock {
            if (connectionGeneration != generation) return
            if (transport == null || connection?.transport === transport) connection = null
            failPendingLocked(VibeAllDayConnectionUnavailableException("Native connection was lost", error))
            uploads.values.forEach { it.events.close(VibeAllDayConnectionUnavailableException("Upload connection was lost", error)) }
            uploads.clear()
            failConversationsLocked(error)
        }
    }

    private suspend fun failTerminal(
        generation: Long,
        ready: CompletableDeferred<Unit>,
        phase: VibeAllDayConnectionPhase,
        message: String,
        error: Throwable,
        recoverable: Boolean = false,
    ) {
        mutex.withLock {
            if (connectionGeneration != generation) return
            connection = null
            mutableState.value = VibeAllDayConnectionState(phase = phase, errorMessage = message, recoverable = recoverable)
            failPendingLocked(VibeAllDayConnectionUnavailableException(message, error))
            failConversationsLocked(error)
            ready.completeExceptionally(VibeAllDayConnectionUnavailableException(message, error))
        }
    }

    private suspend fun closeSubscription(
        subscriptionId: String,
        error: Throwable? = null,
    ) {
        val removed = mutex.withLock {
            val record = subscriptions.remove(subscriptionId) ?: return
            leases[record.leaseId]?.remove(subscriptionId)
            val active = connection?.transport
            if (active != null) {
                runCatching {
                    active.send(
                        JSONObject()
                            .put("type", "unsubscribe")
                            .put("subscriptionId", subscriptionId),
                    )
                }
            }
            record
        }
        removed.events.close(error)
    }

    private suspend fun hasDemand(generation: Long): Boolean {
        return mutex.withLock { connectionGeneration == generation && leases.isNotEmpty() }
    }

    private suspend fun setState(generation: Long, state: VibeAllDayConnectionState) {
        mutex.withLock {
            if (connectionGeneration == generation) mutableState.value = state
        }
    }

    private fun failPendingLocked(error: Throwable) {
        responseBodies.values.toList().forEach { it.close() }
        pendingRequests.values.forEach { it.completeExceptionally(error) }
        pendingRequests.clear()
    }

    /** Conversations restart at sequence zero; never replay their old binding. */
    private fun failConversationsLocked(error: Throwable) {
        subscriptions.values.filter { it.conversation != null }.forEach { record ->
            subscriptions.remove(record.id)
            leases[record.leaseId]?.remove(record.id)
            record.events.close(VibeAllDayConnectionUnavailableException("Conversation disconnected", error))
        }
    }

    private data class SubscriptionRecord(
        val id: String,
        val leaseId: String,
        val channel: String,
        val sessionId: String?,
        val projectId: String?,
        val provider: String?,
        var lastEventId: String?,
        val wantsLiveDeltas: Boolean?,
        val events: Channel<VibeAllDaySubscriptionEvent>,
        val conversation: ConversationQuery? = null,
        val coverage: JSONObject? = null,
    ) {
        fun subscribeMessage(): JSONObject {
            conversation?.let {
                return JSONObject().put("type", "subscribe").put("subscriptionId", id)
                    .put("channel", channel).put("apiRevision", CONVERSATION_API_REVISION)
                    .put("query", it.toJson())
            }
            return JSONObject()
                .put("type", "subscribe")
                .put("subscriptionId", id)
                .put("channel", channel)
                .putOptional("sessionId", sessionId)
                .putOptional("projectId", projectId)
                .putOptional("provider", provider)
                .putOptional("lastEventId", lastEventId)
                .putOptional("wantsLiveDeltas", wantsLiveDeltas)
                .putOptional("coverage", coverage)
        }
    }

    private class UploadRecord(
        val id: String,
        val leaseId: String,
        val size: Long,
        val transport: VibeAllDayMessageTransport,
        val events: Channel<JSONObject>,
        var offset: Long = 0,
        val writes: Mutex = Mutex(),
    )

    private class ReauthenticationRequired : IllegalStateException()

    companion object {
        private val SUPPORTED_METHODS = setOf("GET", "POST", "PUT", "DELETE", "PATCH")
        private val SUPPORTED_SUBSCRIPTION_CHANNELS = setOf("session", "activity", "session-watch", "glossary", "worktree")
        private val MANAGED_REQUEST_HEADERS = setOf("content-type", "x-vibeallday")
        private const val REQUEST_TIMEOUT_MS = 30_000L
        private const val SUBSCRIPTION_BUFFER_SIZE = 64
    }
}

private fun ConversationQuery.toJson(): JSONObject = JSONObject()
    .put("sessionId", sessionId).put("maxMessages", maxMessages)
    .put("anchorMessageId", anchorMessageId ?: JSONObject.NULL)

private fun JSONObject.toApiResponse(): VibeAllDayApiResponse {
    val headersObject = optJSONObject("headers")
    val headers = if (headersObject == null) {
        emptyMap()
    } else {
        buildMap {
            headersObject.keys().forEach { key -> put(key, headersObject.getString(key)) }
        }
    }
    return VibeAllDayApiResponse(
        status = getInt("status"),
        headers = headers,
        body = optNullable("body"),
    )
}

private fun JSONObject.optNullable(name: String): Any? {
    return if (!has(name) || isNull(name)) null else get(name)
}

private fun JSONObject.optNullableString(name: String): String? {
    return if (!has(name) || isNull(name)) null else getString(name)
}

private fun JSONObject.putOptional(name: String, value: Any?): JSONObject {
    if (value != null) put(name, value)
    return this
}
