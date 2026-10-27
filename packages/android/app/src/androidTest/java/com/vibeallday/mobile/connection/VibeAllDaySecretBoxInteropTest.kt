package com.vibeallday.mobile.connection

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class VibeAllDaySecretBoxInteropTest {
    @Test
    fun lazySodiumMatchesTweetNaClProofAndBinaryEnvelopeVectors() {
        val fixture = loadFixture()
        val secretBox = LazySodiumSecretBox()
        val baseKey = hexBytes(fixture.getJSONObject("srp").getString("baseKeyHex"))
        val fullSession = fixture.getJSONObject("fullSession")
        val serverInfoProof = fullSession.getJSONObject("serverInfoProof").toString()

        assertEquals(
            fullSession.getString("serverInfoPlaintext"),
            VibeAllDaySecureTransportCrypto.decryptJsonEnvelope(serverInfoProof, baseKey, secretBox),
        )

        val binary = fixture.getJSONObject("binaryEnvelope")
        val transportKey = hexBytes(fullSession.getString("transportKeyHex"))
        val expectedEnvelope = VibeAllDaySecureTransportCrypto.decodeBase64(
            binary.getString("envelopeBase64"),
        )
        assertEquals(
            binary.getString("plaintext"),
            VibeAllDaySecureTransportCrypto.decryptBinaryJson(expectedEnvelope, transportKey, secretBox),
        )
        assertTrue(
            expectedEnvelope.contentEquals(
                VibeAllDaySecureTransportCrypto.encryptBinaryJson(
                    plaintext = binary.getString("plaintext"),
                    key = transportKey,
                    secretBox = secretBox,
                    nonce = VibeAllDaySecureTransportCrypto.decodeBase64(binary.getString("nonce")),
                ),
            ),
        )

        val changed = expectedEnvelope.copyOf().also { it[it.lastIndex] = (it.last() + 1).toByte() }
        assertNull(VibeAllDaySecureTransportCrypto.decryptBinaryJson(changed, transportKey, secretBox))
    }

    @Test
    fun lazySodiumMatchesTweetNaClResumeVectors() {
        val fixture = loadFixture()
        val resume = fixture.getJSONObject("resume")
        val secretBox = LazySodiumSecretBox()
        val baseKey = hexBytes(fixture.getJSONObject("srp").getString("baseKeyHex"))

        assertEquals(
            resume.getString("proofPlaintext"),
            VibeAllDaySecureTransportCrypto.decryptJsonEnvelope(
                resume.getJSONObject("proof").toString(),
                baseKey,
                secretBox,
            ),
        )
        assertEquals(
            resume.getString("serverProofPlaintext"),
            VibeAllDaySecureTransportCrypto.decryptJsonEnvelope(
                resume.getJSONObject("serverProof").toString(),
                baseKey,
                secretBox,
            ),
        )
        assertEquals(
            resume.getString("transportKeyHex"),
            VibeAllDaySecureTransportCrypto.deriveTransportKey(
                baseKey,
                VibeAllDaySecureTransportCrypto.decodeBase64(resume.getString("serverNonce")),
            ).toHex(),
        )
    }

    private fun loadFixture(): JSONObject {
        val context = InstrumentationRegistry.getInstrumentation().context
        return context.assets.open(FIXTURE_NAME).use {
            JSONObject(it.readBytes().toString(Charsets.UTF_8))
        }
    }

    companion object {
        private const val FIXTURE_NAME = "vibeallday-secure-interop-v1.json"

        private fun hexBytes(value: String): ByteArray {
            require(value.length % 2 == 0)
            return ByteArray(value.length / 2) { index ->
                value.substring(index * 2, index * 2 + 2).toInt(16).toByte()
            }
        }

        private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
    }
}
