package com.vibeallday.mobile.connection

import com.vibeallday.mobile.profiles.VibeAllDayPairedServerProfile
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerRepository
import com.vibeallday.mobile.profiles.VibeAllDayServerRoute
import com.vibeallday.mobile.profiles.VibeAllDayStoredResumeCredential
import com.vibeallday.mobile.profiles.VibeAllDaySecurityClientBinding
import com.vibeallday.mobile.security.VibeAllDaySecurityClientLifecycle
import com.vibeallday.mobile.security.VibeAllDaySecurityClientProtocol
import com.vibeallday.mobile.security.VibeAllDaySecurityClientRevokedException

class VibeAllDayPairingCoordinator(
    private val repository: VibeAllDayPairedServerRepository,
    private val connector: VibeAllDayProfileConnector,
    private val securityClients: VibeAllDaySecurityClientLifecycle? = null,
    private val nowEpochMs: () -> Long = System::currentTimeMillis,
) {
    suspend fun pair(
        label: String,
        username: String,
        password: String,
        route: VibeAllDayServerRoute,
    ): VibeAllDayPairedServerProfile {
        val establishedAt = nowEpochMs()
        var profile = VibeAllDayPairedServerProfile.create(label, username, route, establishedAt)
            .copy(lastConnectedAtEpochMs = establishedAt)
        if (securityClients != null) {
            profile = profile.copy(securityClient = VibeAllDaySecurityClientBinding.pending(
                VibeAllDaySecurityClientProtocol.keyAlias(profile.id)))
        }
        val transport = connector.loginProfile(profile, route, password)
        try {
            repository.upsert(
                profile = profile,
                resumeCredential = VibeAllDayStoredResumeCredential(
                    credential = transport.credential,
                    establishedAtEpochMs = establishedAt,
                    lastResumedAtEpochMs = null,
                ),
                select = true,
            )
            if (securityClients != null) {
                profile = securityClients.ensure(profile, transport)
            }
            return profile
        } finally {
            transport.closeAndAwait()
        }
    }

    suspend fun reauthenticate(
        profileId: String,
        password: String,
        routeId: String? = null,
    ) {
        val snapshot = checkNotNull(repository.snapshot(profileId)) {
            "Cannot authenticate a removed paired server"
        }
        snapshot.profile.securityClient?.takeIf { it.revoked }?.let {
            throw VibeAllDaySecurityClientRevokedException(checkNotNull(it.clientId))
        }
        val route = if (routeId == null) {
            snapshot.profile.routes.firstOrNull {
                it.id == snapshot.profile.preferredRouteId
            } ?: snapshot.profile.routes.first()
        } else {
            snapshot.profile.routes.firstOrNull { it.id == routeId }
                ?: error("Cannot authenticate through an unknown route")
        }
        val transport = connector.loginProfile(
            profile = snapshot.profile,
            route = route,
            password = password,
        )
        try {
            securityClients?.ensure(snapshot.profile, transport)
            val establishedAt = nowEpochMs()
            repository.recordSuccessfulAuthentication(
                profileId = profileId,
                routeId = route.id,
                resumeCredential = VibeAllDayStoredResumeCredential(
                    credential = transport.credential,
                    establishedAtEpochMs = establishedAt,
                    lastResumedAtEpochMs = null,
                ),
                connectedAtEpochMs = establishedAt,
            )
        } finally {
            transport.closeAndAwait()
        }
    }
}
