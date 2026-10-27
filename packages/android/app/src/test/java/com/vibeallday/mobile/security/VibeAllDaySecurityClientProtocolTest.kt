package com.vibeallday.mobile.security

import java.security.MessageDigest
import okio.ByteString.Companion.decodeBase64
import okio.ByteString.Companion.toByteString
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class VibeAllDaySecurityClientProtocolTest {
    @Test
    fun matchesTheLanguageNeutralProofVector() {
        val vector = JSONObject(
            checkNotNull(javaClass.getResourceAsStream("/security-client-proof-v1.json"))
                .bufferedReader()
                .use { it.readText() },
        )
        val proofBody = vector.getJSONObject("proofBody")
        val canonical = VibeAllDaySecurityClientProtocol.canonicalize(proofBody)
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(canonical.toByteArray(Charsets.UTF_8))
        val transcript = VibeAllDaySecurityClientProtocol.transcript(
            operation = vector.getString("operation"),
            route = vector.getString("route"),
            sessionId = vector.getString("sessionId"),
            transportNonce = vector.getString("transportNonce"),
            subjectId = vector.getString("subjectId"),
            bodyDigest = digest,
        )

        assertEquals(vector.getString("canonicalBody"), canonical)
        assertEquals(
            vector.getString("bodyDigestBase64Url"),
            digest.toByteString().base64Url().trimEnd('='),
        )
        assertArrayEquals(
            checkNotNull(vector.getString("transcriptBase64Url").decodeBase64()).toByteArray(),
            transcript,
        )
    }
}
