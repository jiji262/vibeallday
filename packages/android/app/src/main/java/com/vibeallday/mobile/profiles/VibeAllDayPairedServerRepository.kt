package com.vibeallday.mobile.profiles

interface VibeAllDayPairedServerRepository {
    suspend fun snapshot(profileId: String): VibeAllDayPairedServerSnapshot?

    suspend fun upsert(
        profile: VibeAllDayPairedServerProfile,
        resumeCredential: VibeAllDayStoredResumeCredential? = null,
        select: Boolean = false,
    )

    /** Production storage overrides this with one protected-state mutation. */
    suspend fun updateCredential(profileId: String, resumeCredential: VibeAllDayStoredResumeCredential) {
        val current = checkNotNull(snapshot(profileId)) { "Cannot store a credential for an unknown profile" }
        check(current.profile.securityClient?.revoked != true)
        upsert(current.profile, resumeCredential)
    }

    suspend fun clearCredential(profileId: String)

    suspend fun updateSecurityClientBinding(
        profileId: String,
        binding: VibeAllDaySecurityClientBinding,
    ) {
        val current = checkNotNull(snapshot(profileId)) {
            "Cannot update an unknown profile"
        }
        upsert(
            profile = current.profile.copy(securityClient = binding),
            resumeCredential = current.resumeCredential,
        )
    }

    suspend fun markSecurityClientRevoked(profileId: String, clientId: String) {
        updateSecurityClientBinding(profileId, VibeAllDaySecurityClientBinding.revoked(clientId))
        clearCredential(profileId)
    }

    suspend fun recordSuccessfulAuthentication(
        profileId: String,
        routeId: String,
        resumeCredential: VibeAllDayStoredResumeCredential,
        connectedAtEpochMs: Long,
    )
}
