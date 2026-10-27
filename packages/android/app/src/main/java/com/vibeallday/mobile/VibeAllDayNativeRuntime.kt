package com.vibeallday.mobile

import android.content.Context
import com.vibeallday.mobile.connection.VibeAllDayRustProfileConnector
import com.vibeallday.mobile.connection.VibeAllDayRustTls
import com.vibeallday.mobile.connection.VibeAllDayPairingCoordinator
import com.vibeallday.mobile.connection.VibeAllDayServerConnectionManager
import com.vibeallday.mobile.profiles.VibeAllDayPairedServerStore
import com.vibeallday.mobile.security.AndroidKeystoreSecurityClientKeyStore
import com.vibeallday.mobile.security.VibeAllDayAndroidSecurityClientDescriptorProvider
import com.vibeallday.mobile.security.VibeAllDaySecurityClientCoordinator
import java.io.Closeable
import com.vibeallday.mobile.notifications.NativePushCoordinator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.cancel

class VibeAllDayNativeRuntime(context: Context) : Closeable {
    private val lifecycleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val securityKeys = AndroidKeystoreSecurityClientKeyStore()
    val pairedServers = VibeAllDayPairedServerStore.create(context, securityKeys = securityKeys)
    private val connector = VibeAllDayRustProfileConnector(pairedServers)
    init { VibeAllDayRustTls.ensure(context) }
    private val securityClients = VibeAllDaySecurityClientCoordinator(
        repository = pairedServers,
        keys = securityKeys,
        descriptors = VibeAllDayAndroidSecurityClientDescriptorProvider(context),
    )
    val pairing = VibeAllDayPairingCoordinator(pairedServers, connector, securityClients)
    val nativePush = NativePushCoordinator(context.applicationContext, this)
    init {
        lifecycleScope.launch {
            pairedServers.listState.collect { list ->
                val profiles = list.profiles.associateBy { it.id }
                nativePush.bindings.all().forEach { binding ->
                    val profile = profiles[binding.profileId]
                    if (profile == null || profile.securityClient?.revoked == true || profile.securityClient?.clientId != binding.clientId) {
                        try { nativePush.forget(binding.profileId) }
                        catch (error: kotlinx.coroutines.CancellationException) { throw error }
                        catch (_: Exception) { /* Keep a disabled tombstone for the next explicit cleanup. */ }
                    }
                }
            }
        }
    }
    private val connectionManagers = mutableMapOf<String, VibeAllDayServerConnectionManager>()

    @Synchronized
    fun connectionManager(profileId: String): VibeAllDayServerConnectionManager {
        return connectionManagers.getOrPut(profileId) {
            VibeAllDayServerConnectionManager(
                profileId = profileId,
                repository = pairedServers,
                connector = connector,
                securityClients = securityClients,
            )
        }
    }

    override fun close() {
        lifecycleScope.cancel()
        val managers = synchronized(this) {
            connectionManagers.values.toList().also { connectionManagers.clear() }
        }
        managers.forEach { it.close() }
        connector.close()
        pairedServers.close()
    }
}
