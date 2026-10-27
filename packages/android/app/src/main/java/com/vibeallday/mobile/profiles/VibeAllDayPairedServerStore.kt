package com.vibeallday.mobile.profiles

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStoreFile
import com.vibeallday.mobile.security.VibeAllDaySecurityClientKeyStore
import java.io.Closeable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

class VibeAllDayPairedServerStore internal constructor(
    private val dataStore: DataStore<Preferences>,
    private val cipher: VibeAllDayResumeCredentialCipher,
    private val securityKeys: VibeAllDaySecurityClientKeyStore? = null,
    private val ownedScope: CoroutineScope? = null,
) : VibeAllDayPairedServerRepository, Closeable {
    val profiles: Flow<List<VibeAllDayPairedServerProfile>> = dataStore.data.map { preferences ->
        VibeAllDayPairedServerCodec.decodeProfiles(preferences[PROFILES_KEY])
    }

    val selectedProfileId: Flow<String?> = dataStore.data.map { preferences ->
        preferences[SELECTED_PROFILE_KEY]
    }

    val listState: Flow<VibeAllDayPairedServerListState> = dataStore.data.map(::decodeListState)

    val includedProfileIds: Flow<Set<String>> = listState.map {
        it.includedProfileIds
    }

    suspend fun snapshots(): List<VibeAllDayPairedServerSnapshot> {
        val preferences = dataStore.data.first()
        return VibeAllDayPairedServerCodec.decodeProfiles(preferences[PROFILES_KEY]).map { profile ->
            VibeAllDayPairedServerSnapshot(
                profile = profile,
                resumeCredential = decodeCredential(preferences, profile),
            )
        }
    }

    override suspend fun snapshot(profileId: String): VibeAllDayPairedServerSnapshot? {
        requireUuid(profileId, "profile id")
        return snapshots().firstOrNull { it.profile.id == profileId }
    }

    override suspend fun upsert(
        profile: VibeAllDayPairedServerProfile,
        resumeCredential: VibeAllDayStoredResumeCredential?,
        select: Boolean,
    ) {
        require(resumeCredential == null || resumeCredential.credential.username == profile.username)
        val encryptedCredential = resumeCredential?.let { stored ->
            val plaintext = VibeAllDayPairedServerCodec.encodeCredential(stored)
            try {
                cipher.encrypt(profile.id, plaintext)
            } finally {
                plaintext.fill(0)
            }
        }
        dataStore.edit { preferences ->
            val current = VibeAllDayPairedServerCodec.decodeProfiles(preferences[PROFILES_KEY])
            val previous = current.firstOrNull { it.id == profile.id }
            val updated = current.filterNot { it.id == profile.id } + profile
            preferences[PROFILES_KEY] = VibeAllDayPairedServerCodec.encodeProfiles(updated)
            preferences[INCLUDED_PROFILE_IDS_KEY]?.let { existingPolicy ->
                val currentIds = current.mapTo(mutableSetOf(), VibeAllDayPairedServerProfile::id)
                val included = VibeAllDayIncludedServerPolicy.decode(existingPolicy, currentIds)
                preferences[INCLUDED_PROFILE_IDS_KEY] = VibeAllDayIncludedServerPolicy.encode(
                    if (previous == null) included + profile.id else included,
                )
            }
            if (encryptedCredential != null) {
                preferences[credentialKey(profile.id)] = encryptedCredential
            } else if (previous != null && previous.username != profile.username) {
                preferences.remove(credentialKey(profile.id))
            }
            if (select) preferences[SELECTED_PROFILE_KEY] = profile.id
        }
    }

    override suspend fun updateCredential(
        profileId: String,
        resumeCredential: VibeAllDayStoredResumeCredential,
    ) {
        requireUuid(profileId, "profile id")
        val plaintext = VibeAllDayPairedServerCodec.encodeCredential(resumeCredential)
        val encrypted = try {
            cipher.encrypt(profileId, plaintext)
        } finally {
            plaintext.fill(0)
        }
        dataStore.edit { preferences ->
            val profile = VibeAllDayPairedServerCodec.decodeProfiles(preferences[PROFILES_KEY])
                .firstOrNull { it.id == profileId }
                ?: error("Cannot store a credential for an unknown profile")
            check(profile.securityClient?.revoked != true) { "Cannot store a credential for a revoked profile" }
            require(profile.username == resumeCredential.credential.username)
            preferences[credentialKey(profileId)] = encrypted
        }
    }

    override suspend fun clearCredential(profileId: String) {
        requireUuid(profileId, "profile id")
        dataStore.edit { it.remove(credentialKey(profileId)) }
    }

    override suspend fun updateSecurityClientBinding(
        profileId: String,
        binding: VibeAllDaySecurityClientBinding,
    ) {
        requireUuid(profileId, "profile id")
        dataStore.edit { preferences ->
            val profiles = VibeAllDayPairedServerCodec.decodeProfiles(preferences[PROFILES_KEY])
            check(profiles.any { it.id == profileId }) {
                "Cannot update an unknown profile"
            }
            preferences[PROFILES_KEY] = VibeAllDayPairedServerCodec.encodeProfiles(
                profiles.map {
                    if (it.id == profileId) it.copy(securityClient = binding) else it
                },
            )
        }
    }

    override suspend fun markSecurityClientRevoked(profileId: String, clientId: String) {
        requireUuid(profileId, "profile id")
        requireUuid(clientId, "security client id")
        dataStore.edit { preferences ->
            val profiles = VibeAllDayPairedServerCodec.decodeProfiles(preferences[PROFILES_KEY])
            val profile = profiles.firstOrNull { it.id == profileId }
                ?: error("Cannot revoke an unknown profile")
            check(profile.securityClient?.clientId == clientId) {
                "Cannot revoke a different security client"
            }
            preferences[PROFILES_KEY] = VibeAllDayPairedServerCodec.encodeProfiles(
                profiles.map {
                    if (it.id == profileId) {
                        it.copy(securityClient = VibeAllDaySecurityClientBinding.revoked(clientId))
                    } else {
                        it
                    }
                },
            )
            preferences.remove(credentialKey(profileId))
        }
    }

    suspend fun select(profileId: String?) {
        if (profileId != null) requireUuid(profileId, "profile id")
        dataStore.edit { preferences ->
            if (profileId == null) {
                preferences.remove(SELECTED_PROFILE_KEY)
            } else {
                check(
                    VibeAllDayPairedServerCodec.decodeProfiles(preferences[PROFILES_KEY])
                        .any { it.id == profileId },
                ) { "Cannot select an unknown profile" }
                preferences[SELECTED_PROFILE_KEY] = profileId
            }
        }
    }

    suspend fun setIncluded(profileId: String, included: Boolean) {
        requireUuid(profileId, "profile id")
        dataStore.edit { preferences ->
            val profileIds = VibeAllDayPairedServerCodec.decodeProfiles(preferences[PROFILES_KEY])
                .mapTo(mutableSetOf(), VibeAllDayPairedServerProfile::id)
            check(profileId in profileIds) { "Cannot include an unknown profile" }
            val current = VibeAllDayIncludedServerPolicy.decode(
                preferences[INCLUDED_PROFILE_IDS_KEY],
                profileIds,
            )
            preferences[INCLUDED_PROFILE_IDS_KEY] = VibeAllDayIncludedServerPolicy.encode(
                if (included) current + profileId else current - profileId,
            )
        }
    }

    suspend fun forget(profileId: String) {
        requireUuid(profileId, "profile id")
        var keyAlias: String? = null
        dataStore.edit { preferences ->
            val profiles = VibeAllDayPairedServerCodec.decodeProfiles(preferences[PROFILES_KEY])
            keyAlias = profiles.firstOrNull { it.id == profileId }?.securityClient?.keyAlias
            val updated = profiles
                .filterNot { it.id == profileId }
            preferences[PROFILES_KEY] = VibeAllDayPairedServerCodec.encodeProfiles(updated)
            preferences[INCLUDED_PROFILE_IDS_KEY]?.let { existingPolicy ->
                val currentIds = profiles.mapTo(mutableSetOf(), VibeAllDayPairedServerProfile::id)
                val included = VibeAllDayIncludedServerPolicy.decode(existingPolicy, currentIds)
                preferences[INCLUDED_PROFILE_IDS_KEY] = VibeAllDayIncludedServerPolicy.encode(
                    included - profileId,
                )
            }
            preferences.remove(credentialKey(profileId))
            if (preferences[SELECTED_PROFILE_KEY] == profileId) {
                preferences.remove(SELECTED_PROFILE_KEY)
            }
        }
        keyAlias?.let { securityKeys?.delete(it) }
    }

    override suspend fun recordSuccessfulAuthentication(
        profileId: String,
        routeId: String,
        resumeCredential: VibeAllDayStoredResumeCredential,
        connectedAtEpochMs: Long,
    ) {
        requireUuid(profileId, "profile id")
        requireUuid(routeId, "route id")
        require(connectedAtEpochMs >= 0)
        val plaintext = VibeAllDayPairedServerCodec.encodeCredential(resumeCredential)
        val encrypted = try {
            cipher.encrypt(profileId, plaintext)
        } finally {
            plaintext.fill(0)
        }
        dataStore.edit { preferences ->
            val profiles = VibeAllDayPairedServerCodec.decodeProfiles(preferences[PROFILES_KEY])
            val profile = profiles.firstOrNull { it.id == profileId }
                ?: error("Cannot update an unknown profile")
            check(profile.securityClient?.revoked != true) { "Cannot store a credential for a revoked profile" }
            require(profile.username == resumeCredential.credential.username)
            require(profile.routes.any { it.id == routeId })
            val updated = profile.copy(
                preferredRouteId = routeId,
                lastConnectedAtEpochMs = connectedAtEpochMs,
            )
            preferences[PROFILES_KEY] = VibeAllDayPairedServerCodec.encodeProfiles(
                profiles.map { if (it.id == profileId) updated else it },
            )
            preferences[credentialKey(profileId)] = encrypted
        }
    }

    override fun close() {
        ownedScope?.cancel()
    }

    private fun decodeCredential(
        preferences: Preferences,
        profile: VibeAllDayPairedServerProfile,
    ): VibeAllDayStoredResumeCredential? {
        val envelope = preferences[credentialKey(profile.id)] ?: return null
        val plaintext = cipher.decrypt(profile.id, envelope) ?: return null
        return try {
            runCatching { VibeAllDayPairedServerCodec.decodeCredential(plaintext) }
                .getOrNull()
                ?.takeIf { it.credential.username == profile.username }
        } finally {
            plaintext.fill(0)
        }
    }

    private fun decodeListState(preferences: Preferences): VibeAllDayPairedServerListState {
        val profiles = VibeAllDayPairedServerCodec.decodeProfiles(preferences[PROFILES_KEY])
        val profileIds = profiles.mapTo(mutableSetOf(), VibeAllDayPairedServerProfile::id)
        return VibeAllDayPairedServerListState(
            profiles = profiles,
            includedProfileIds = VibeAllDayIncludedServerPolicy.decode(
                preferences[INCLUDED_PROFILE_IDS_KEY],
                profileIds,
            ),
            selectedProfileId = preferences[SELECTED_PROFILE_KEY]
                ?.takeIf { it in profileIds },
        )
    }

    companion object {
        private val PROFILES_KEY = stringPreferencesKey("profiles_v2")
        private val SELECTED_PROFILE_KEY = stringPreferencesKey("selected_profile_v2")
        private val INCLUDED_PROFILE_IDS_KEY = stringPreferencesKey("included_profile_ids_v1")
        private const val DATA_STORE_FILE_NAME = "vibeallday_paired_servers_v2"

        fun create(
            context: Context,
            fileName: String = DATA_STORE_FILE_NAME,
            keyAlias: String = "vibeallday_paired_server_resume_key_v2",
            securityKeys: VibeAllDaySecurityClientKeyStore? = null,
        ): VibeAllDayPairedServerStore {
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
            val dataStore = PreferenceDataStoreFactory.create(
                scope = scope,
                produceFile = { context.applicationContext.preferencesDataStoreFile(fileName) },
            )
            return VibeAllDayPairedServerStore(
                dataStore = dataStore,
                cipher = AndroidKeystoreResumeCredentialCipher(keyAlias),
                securityKeys = securityKeys,
                ownedScope = scope,
            )
        }

        private fun credentialKey(profileId: String): Preferences.Key<String> {
            return stringPreferencesKey("resume_credential_v2_$profileId")
        }
    }
}
