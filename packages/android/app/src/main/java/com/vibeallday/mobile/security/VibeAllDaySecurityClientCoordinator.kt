package com.vibeallday.mobile.security

import com.vibeallday.mobile.connection.VibeAllDayApiResponse
import com.vibeallday.mobile.connection.VibeAllDayMessageTransport
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerProfile
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerRepository
import com.vibeallday.mobile.profiles.VibeAllDaySecurityClientBinding
import java.util.UUID
import kotlinx.coroutines.withTimeout
import org.json.JSONObject

fun interface VibeAllDaySecurityClientLifecycle {
    suspend fun ensure(
        profile: VibeAllDayPairedServerProfile,
        transport: VibeAllDayMessageTransport,
    ): VibeAllDayPairedServerProfile
}

class VibeAllDaySecurityClientRevokedException(val clientId: String) :
    IllegalStateException("This Android security client was revoked")

class VibeAllDaySecurityClientCoordinator(
    private val repository: VibeAllDayPairedServerRepository,
    private val keys: VibeAllDaySecurityClientKeyStore,
    private val descriptors: VibeAllDaySecurityClientDescriptorProvider,
) : VibeAllDaySecurityClientLifecycle {
    override suspend fun ensure(
        profile: VibeAllDayPairedServerProfile,
        transport: VibeAllDayMessageTransport,
    ): VibeAllDayPairedServerProfile {
        val proofTransport = checkNotNull(transport.securityBinding) {
            "Security-client registration requires an established SRP transport"
        }
        var binding = profile.securityClient ?: VibeAllDaySecurityClientBinding.pending(
            VibeAllDaySecurityClientProtocol.keyAlias(profile.id),
        ).also { repository.updateSecurityClientBinding(profile.id, it) }
        if (binding.revoked) {
            throw VibeAllDaySecurityClientRevokedException(checkNotNull(binding.clientId))
        }

        val version = request(transport, "GET", "/api/version")
        check(version.status == 200) { "VIBEALLDAY version request failed with ${version.status}" }
        val capabilities = (version.body as? JSONObject)?.optJSONArray("capabilities")
        val supported = capabilities != null &&
            (0 until capabilities.length()).any {
                capabilities.optString(it) == VibeAllDaySecurityClientProtocol.CAPABILITY
            }
        if (!supported) {
            if (!binding.capabilityMissing) {
                binding = binding.copy(capabilityMissing = true)
                repository.updateSecurityClientBinding(profile.id, binding)
            }
            return profile.copy(securityClient = binding)
        }
        if (binding.capabilityMissing) {
            binding = binding.copy(capabilityMissing = false)
            repository.updateSecurityClientBinding(profile.id, binding)
        }

        val keyAlias = checkNotNull(binding.keyAlias)
        keys.ensureKey(keyAlias)
        return if (binding.clientId == null) {
            register(profile.copy(securityClient = binding), transport, proofTransport)
        } else {
            checkIn(profile.copy(securityClient = binding), transport, proofTransport)
        }
    }

    private suspend fun register(
        profile: VibeAllDayPairedServerProfile,
        transport: VibeAllDayMessageTransport,
        proofTransport: com.vibeallday.mobile.connection.VibeAllDaySrpTransportBinding,
    ): VibeAllDayPairedServerProfile {
        val binding = checkNotNull(profile.securityClient)
        val keyAlias = checkNotNull(binding.keyAlias)
        val requestId = checkNotNull(binding.pendingRequestId)
        val publicKey = keys.publicKeySpki(keyAlias)
        val publicKeyBase64 = VibeAllDaySecurityClientProtocol.publicKeyBase64Url(publicKey)
        val descriptor = descriptors.descriptor(profile)
        val proofBody = VibeAllDaySecurityClientProtocol.registerProofBody(
            requestId = requestId,
            label = profile.label,
            descriptor = descriptor,
            publicKeySpki = publicKeyBase64,
        )
        val signature = VibeAllDaySecurityClientProtocol.sign(
            keys = keys,
            keyAlias = keyAlias,
            operation = "register",
            route = VibeAllDaySecurityClientProtocol.REGISTER_ROUTE,
            subjectId = requestId,
            proofBody = proofBody,
            transport = proofTransport,
        )
        val response = request(
            transport,
            "POST",
            VibeAllDaySecurityClientProtocol.REGISTER_ROUTE,
            VibeAllDaySecurityClientProtocol.registerRequest(proofBody, signature),
        )
        requireSuccessful(response)
        val client = response.client()
        assertFingerprint(client, VibeAllDaySecurityClientProtocol.fingerprint(publicKey))
        val registered = VibeAllDaySecurityClientBinding.registered(
            keyAlias = keyAlias,
            clientId = client.getString("clientId"),
        )
        repository.updateSecurityClientBinding(profile.id, registered)
        return profile.copy(securityClient = registered)
    }

    private suspend fun checkIn(
        profile: VibeAllDayPairedServerProfile,
        transport: VibeAllDayMessageTransport,
        proofTransport: com.vibeallday.mobile.connection.VibeAllDaySrpTransportBinding,
    ): VibeAllDayPairedServerProfile {
        val binding = checkNotNull(profile.securityClient)
        val keyAlias = checkNotNull(binding.keyAlias)
        val clientId = checkNotNull(binding.clientId)
        val descriptor = descriptors.descriptor(profile)
        val proofBody = VibeAllDaySecurityClientProtocol.checkInProofBody(descriptor)
        val route = VibeAllDaySecurityClientProtocol.checkInRoute(clientId)
        val signature = VibeAllDaySecurityClientProtocol.sign(
            keys = keys,
            keyAlias = keyAlias,
            operation = "check-in",
            route = route,
            subjectId = clientId,
            proofBody = proofBody,
            transport = proofTransport,
        )
        val response = request(
            transport,
            "POST",
            route,
            VibeAllDaySecurityClientProtocol.checkInRequest(proofBody, signature),
        )
        when (response.errorCode()) {
            "security_client_unknown" -> {
                val pending = VibeAllDaySecurityClientBinding.pending(
                    keyAlias = keyAlias,
                    requestId = UUID.randomUUID().toString(),
                )
                repository.updateSecurityClientBinding(profile.id, pending)
                return register(profile.copy(securityClient = pending), transport, proofTransport)
            }
            "security_client_revoked" -> {
                repository.markSecurityClientRevoked(profile.id, clientId)
                runCatching { keys.delete(keyAlias) }
                throw VibeAllDaySecurityClientRevokedException(clientId)
            }
        }
        requireSuccessful(response)
        assertFingerprint(
            response.client(),
            VibeAllDaySecurityClientProtocol.fingerprint(keys.publicKeySpki(keyAlias)),
        )
        return profile.copy(securityClient = binding.copy(capabilityMissing = false))
    }

    private fun assertFingerprint(client: JSONObject, expected: String) {
        val proofs = client.getJSONArray("proofs")
        val continuityProof = (0 until proofs.length())
            .map { proofs.getJSONObject(it) }
            .firstOrNull { it.optString("type") == "continuity-key" }
            ?: error("VIBEALLDAY security-client response omitted the continuity proof")
        check(continuityProof.getString("keyFingerprint") == expected) {
            "VIBEALLDAY security-client key fingerprint did not match Android Keystore"
        }
    }

    private fun requireSuccessful(response: VibeAllDayApiResponse) {
        check(response.status in 200..299) {
            val body = response.body as? JSONObject
            body?.optString("error")?.takeIf(String::isNotBlank)
                ?: "VIBEALLDAY security-client request failed with ${response.status}"
        }
    }

    private fun VibeAllDayApiResponse.client(): JSONObject {
        return checkNotNull(checkNotNull(body as? JSONObject).getJSONObject("client"))
    }

    private fun VibeAllDayApiResponse.errorCode(): String? {
        if (status < 400) return null
        return (body as? JSONObject)?.optString("code")?.takeIf(String::isNotBlank)
    }

    private suspend fun request(
        transport: VibeAllDayMessageTransport,
        method: String,
        path: String,
        body: JSONObject? = null,
    ): VibeAllDayApiResponse {
        transport.directRequest(method, path, body)?.let { return it }
        val requestId = UUID.randomUUID().toString()
        val message = JSONObject()
            .put("type", "request")
            .put("id", requestId)
            .put("method", method)
            .put("path", path)
            .put(
                "headers",
                JSONObject()
                    .put("Content-Type", "application/json")
                    .put("X-VibeAllDay", "true"),
            )
        if (body != null) message.put("body", body)
        transport.send(message)
        return withTimeout(REQUEST_TIMEOUT_MS) {
            repeat(MAX_MESSAGES_BEFORE_RESPONSE) {
                val response = transport.receive()
                if (
                    response.optString("type") == "response" &&
                    response.optString("id") == requestId
                ) {
                    return@withTimeout response.toApiResponse()
                }
            }
            error("VIBEALLDAY security-client response was not received within the message bound")
        }
    }

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
            body = if (!has("body") || isNull("body")) null else get("body"),
        )
    }

    companion object {
        private const val REQUEST_TIMEOUT_MS = 30_000L
        private const val MAX_MESSAGES_BEFORE_RESPONSE = 32
    }
}
