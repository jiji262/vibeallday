package com.vibeallday.mobile.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerProfile
import com.vibeallday.mobile.profiles.VibeAllDayServerRoute
import java.security.KeyFactory
import java.security.KeyStore
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidKeystoreSecurityClientKeyStoreInstrumentedTest {
    @Test
    fun createsANonExportableP256SigningKeyAndAValidDescriptor() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val profile = VibeAllDayPairedServerProfile.create(
            label = "Instrumented Android",
            username = "test-user",
            route = VibeAllDayServerRoute.direct("wss://desktop.example.test/api/ws"),
        )
        val alias = "vibeallday_security_client_p256_v1_${UUID.randomUUID()}"
        val keys = AndroidKeystoreSecurityClientKeyStore()
        try {
            keys.ensureKey(alias)
            val publicKeySpki = keys.publicKeySpki(alias)
            val message = "security-client-instrumented-proof".toByteArray()
            val signature = keys.sign(alias, message)
            val publicKey = KeyFactory.getInstance("EC")
                .generatePublic(X509EncodedKeySpec(publicKeySpki))
            val verified = Signature.getInstance(
                AndroidKeystoreSecurityClientKeyStore.SIGNATURE_ALGORITHM,
            ).run {
                initVerify(publicKey)
                update(message)
                verify(signature)
            }
            val privateKey = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
                .getKey(alias, null)
            val descriptor = VibeAllDayAndroidSecurityClientDescriptorProvider(context).descriptor(profile)

            assertTrue(verified)
            assertNull(privateKey.encoded)
            assertEquals(43, VibeAllDaySecurityClientProtocol.fingerprint(publicKeySpki).length)
            assertEquals(profile.id, descriptor.getString("installationId"))
            assertEquals("Android", descriptor.getString("osName"))
            assertEquals("continuity-key", descriptor.getJSONArray("supportedProofs").getString(0))
            assertTrue(descriptor.toString().toByteArray().size < 8 * 1024)
        } finally {
            keys.delete(alias)
        }

        assertFalse(
            KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.containsAlias(alias),
        )
    }
}
