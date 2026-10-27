package com.vibeallday.mobile.profiles

import com.vibeallday.mobile.connection.VibeAllDayResumeCredential
import java.net.URI
import java.util.UUID

enum class VibeAllDayServerRouteKind {
    DIRECT,
    RELAY,
}

data class VibeAllDayServerRoute(
    val id: String,
    val kind: VibeAllDayServerRouteKind,
    val websocketUrl: String,
    val relayTarget: String? = null,
) {
    init {
        requireUuid(id, "route id")
        val uri = URI(websocketUrl)
        require(uri.scheme == "ws" || uri.scheme == "wss") {
            "Server route must use ws or wss"
        }
        require(uri.host != null && uri.userInfo == null && uri.fragment == null) {
            "Server route must have a host and no user information or fragment"
        }
        when (kind) {
            VibeAllDayServerRouteKind.DIRECT -> require(relayTarget == null)
            VibeAllDayServerRouteKind.RELAY -> require(
                relayTarget != null && RELAY_TARGET_PATTERN.matches(relayTarget),
            )
        }
    }

    companion object {
        private val RELAY_TARGET_PATTERN = Regex("^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$")

        fun direct(websocketUrl: String): VibeAllDayServerRoute {
            return VibeAllDayServerRoute(
                id = UUID.randomUUID().toString(),
                kind = VibeAllDayServerRouteKind.DIRECT,
                websocketUrl = websocketUrl,
            )
        }

        fun relay(websocketUrl: String, relayTarget: String): VibeAllDayServerRoute {
            return VibeAllDayServerRoute(
                id = UUID.randomUUID().toString(),
                kind = VibeAllDayServerRouteKind.RELAY,
                websocketUrl = websocketUrl,
                relayTarget = relayTarget,
            )
        }
    }
}

data class VibeAllDayPairedServerProfile(
    val id: String,
    val label: String,
    val username: String,
    val routes: List<VibeAllDayServerRoute>,
    val preferredRouteId: String?,
    val createdAtEpochMs: Long,
    val lastConnectedAtEpochMs: Long?,
    val securityClient: VibeAllDaySecurityClientBinding? = null,
) {
    init {
        requireUuid(id, "profile id")
        require(label.isNotBlank() && label.length <= MAX_LABEL_LENGTH)
        require(username.isNotBlank() && username.length <= MAX_USERNAME_LENGTH)
        require(routes.isNotEmpty())
        require(routes.map(VibeAllDayServerRoute::id).toSet().size == routes.size)
        require(preferredRouteId == null || routes.any { it.id == preferredRouteId })
        require(createdAtEpochMs >= 0)
        require(lastConnectedAtEpochMs == null || lastConnectedAtEpochMs >= 0)
    }

    companion object {
        private const val MAX_LABEL_LENGTH = 80
        private const val MAX_USERNAME_LENGTH = 128

        fun create(
            label: String,
            username: String,
            route: VibeAllDayServerRoute,
            nowEpochMs: Long = System.currentTimeMillis(),
        ): VibeAllDayPairedServerProfile {
            return VibeAllDayPairedServerProfile(
                id = UUID.randomUUID().toString(),
                label = label,
                username = username,
                routes = listOf(route),
                preferredRouteId = route.id,
                createdAtEpochMs = nowEpochMs,
                lastConnectedAtEpochMs = null,
            )
        }
    }
}

data class VibeAllDaySecurityClientBinding(
    val keyAlias: String?,
    val pendingRequestId: String?,
    val clientId: String?,
    val revoked: Boolean,
    val capabilityMissing: Boolean,
) {
    init {
        if (revoked) {
            require(keyAlias == null && pendingRequestId == null && clientId != null) {
                "A revoked security client retains only its server client id"
            }
        } else {
            require(!keyAlias.isNullOrBlank() && KEY_ALIAS_PATTERN.matches(keyAlias)) {
                "An active security client requires a valid Keystore alias"
            }
            require((pendingRequestId == null) != (clientId == null)) {
                "An active security client must be pending or registered"
            }
            if (pendingRequestId != null) requireUuid(pendingRequestId, "registration request id")
            if (clientId != null) requireUuid(clientId, "security client id")
        }
    }

    companion object {
        private val KEY_ALIAS_PATTERN = Regex("^[A-Za-z0-9._-]{1,160}$")

        fun pending(
            keyAlias: String,
            requestId: String = UUID.randomUUID().toString(),
            capabilityMissing: Boolean = false,
        ): VibeAllDaySecurityClientBinding = VibeAllDaySecurityClientBinding(
            keyAlias = keyAlias,
            pendingRequestId = requestId,
            clientId = null,
            revoked = false,
            capabilityMissing = capabilityMissing,
        )

        fun registered(
            keyAlias: String,
            clientId: String,
        ): VibeAllDaySecurityClientBinding = VibeAllDaySecurityClientBinding(
            keyAlias = keyAlias,
            pendingRequestId = null,
            clientId = clientId,
            revoked = false,
            capabilityMissing = false,
        )

        fun revoked(clientId: String): VibeAllDaySecurityClientBinding = VibeAllDaySecurityClientBinding(
            keyAlias = null,
            pendingRequestId = null,
            clientId = clientId,
            revoked = true,
            capabilityMissing = false,
        )
    }
}

data class VibeAllDayStoredResumeCredential(
    val credential: VibeAllDayResumeCredential,
    val establishedAtEpochMs: Long,
    val lastResumedAtEpochMs: Long?,
) {
    init {
        require(establishedAtEpochMs >= 0)
        require(lastResumedAtEpochMs == null || lastResumedAtEpochMs >= establishedAtEpochMs)
    }

    /**
     * Mirrors the server's current conservative resume limits so Android can
     * ask for a password without first attempting a credential known to be
     * stale. The server remains authoritative and may reject sooner.
     */
    fun isEligibleAt(nowEpochMs: Long): Boolean {
        require(nowEpochMs >= 0)
        val lastUsedAtEpochMs = lastResumedAtEpochMs ?: establishedAtEpochMs
        return elapsedSince(establishedAtEpochMs, nowEpochMs) <= MAX_LIFETIME_MS &&
            elapsedSince(lastUsedAtEpochMs, nowEpochMs) <= IDLE_TIMEOUT_MS
    }

    companion object {
        const val IDLE_TIMEOUT_MS = 7L * 24 * 60 * 60 * 1000
        const val MAX_LIFETIME_MS = 30L * 24 * 60 * 60 * 1000

        private fun elapsedSince(earlierEpochMs: Long, nowEpochMs: Long): Long {
            return if (nowEpochMs >= earlierEpochMs) nowEpochMs - earlierEpochMs else 0
        }
    }
}

data class VibeAllDayPairedServerSnapshot(
    val profile: VibeAllDayPairedServerProfile,
    val resumeCredential: VibeAllDayStoredResumeCredential?,
)

internal fun requireUuid(value: String, name: String) {
    require(runCatching { UUID.fromString(value).toString() == value }.getOrDefault(false)) {
        "$name must be a canonical UUID"
    }
}
