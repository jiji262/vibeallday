package com.vibeallday.mobile.connection

import org.json.JSONObject
import com.vibeallday.mobile.profiles.*
import java.util.UUID
import org.junit.Assert.*
import org.junit.Test

class VibeAllDayRustCredentialTest {
    @Test fun conversionPreservesExistingKeySessionAndDowngradePin() {
        val original = VibeAllDayResumeCredential("saved-owner", "existing-session", ByteArray(32) { (255 - it).toByte() }, 7)
        val bytes = VibeAllDayRustCredential.encode(original)
        val value = JSONObject(bytes.toString(Charsets.UTF_8))
        assertEquals(255, value.getJSONArray("base_key").getInt(0))
        assertEquals(7, value.getInt("resume_protocol_version"))
        assertEquals(original, VibeAllDayRustCredential.decode(bytes))
        assertTrue(bytes.all { it == 0.toByte() })
    }
    @Test fun nativePersistenceCannotRecreateForgottenOrRevokedProfiles() {
        val profile = VibeAllDayPairedServerProfile.create("Fixture", "saved-owner", VibeAllDayServerRoute.direct("wss://fixture.invalid/api/ws"), 1)
        val credential = VibeAllDayResumeCredential(profile.username, "fixture-session", ByteArray(32), 4)
        val stored = VibeAllDayStoredResumeCredential(credential, 1, null)
        var snapshot: VibeAllDayPairedServerSnapshot? = null
        val repository = object : VibeAllDayPairedServerRepository {
            override suspend fun snapshot(profileId: String) = snapshot
            override suspend fun upsert(profile: VibeAllDayPairedServerProfile, resumeCredential: VibeAllDayStoredResumeCredential?, select: Boolean) { snapshot = VibeAllDayPairedServerSnapshot(profile, resumeCredential) }
            override suspend fun clearCredential(profileId: String) { snapshot = snapshot?.copy(resumeCredential = null) }
            override suspend fun recordSuccessfulAuthentication(profileId: String, routeId: String, resumeCredential: VibeAllDayStoredResumeCredential, connectedAtEpochMs: Long) { error("Unexpected route update") }
        }
        val persistence = VibeAllDayRustCredentialPersistence(repository, profile, stored, pairing = true)
        assertTrue(persistence.persist(VibeAllDayRustCredential.encode(credential)))
        assertNotNull(snapshot)
        snapshot = null
        assertFalse(persistence.persist(VibeAllDayRustCredential.encode(credential)))
        assertNull(snapshot)
        snapshot = VibeAllDayPairedServerSnapshot(profile.copy(securityClient = VibeAllDaySecurityClientBinding.revoked(UUID.randomUUID().toString())), null)
        assertFalse(persistence.beginResume())
        assertFalse(persistence.persist(VibeAllDayRustCredential.encode(credential)))
        assertNull(snapshot?.resumeCredential)
    }
    @Test fun conversionRejectsMalformedNativeCredentials() {
        val original = VibeAllDayResumeCredential("saved-owner", "existing-session", ByteArray(32), 4)
        val malformed = JSONObject(VibeAllDayRustCredential.encode(original).toString(Charsets.UTF_8))
        malformed.getJSONArray("base_key").put(0, 256)
        val bytes = malformed.toString().toByteArray()
        assertThrows(IllegalArgumentException::class.java) { VibeAllDayRustCredential.decode(bytes) }
        assertTrue(bytes.all { it == 0.toByte() })
    }
}
