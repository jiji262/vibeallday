package com.vibeallday.mobile.ui

import android.content.Intent
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.vibeallday.mobile.MainActivity
import com.vibeallday.mobile.VibeAllDayApplication
import com.vibeallday.mobile.connection.VibeAllDayConnectionPhase
import com.vibeallday.mobile.profiles.VibeAllDayServerRoute
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class VibeAllDayHostManagementInstrumentedTest {
    @Test
    fun displaysSavedHostsWithoutStartingDashboardConnections() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val arguments = InstrumentationRegistry.getArguments()
        val wsUrl = arguments.getString("vibeAllDayProbeWsUrl")
        val username = arguments.getString("vibeAllDayProbeUsername")
        val password = arguments.getString("vibeAllDayProbePassword")
        assumeTrue(
            "Native home integration arguments are intentionally absent in config-free CI",
            wsUrl != null && username != null && password != null,
        )
        val application = instrumentation.targetContext.applicationContext
            as VibeAllDayApplication
        val runtime = application.nativeRuntime
        val previouslySelected = runBlocking {
            runtime.pairedServers.selectedProfileId.first()
        }
        val profile = runBlocking {
            withTimeout(15_000) {
                runtime.pairing.pair(
                    label = "Disposable direct server",
                    username = checkNotNull(username),
                    password = checkNotNull(password),
                    route = VibeAllDayServerRoute.direct(checkNotNull(wsUrl)),
                )
            }
        }

        val device = UiDevice.getInstance(instrumentation)
        val scenario = ActivityScenario.launch<MainActivity>(Intent(application, MainActivity::class.java).putExtra(MainActivity.SHOW_HOSTS, true))
        try {
            assertTrue(device.wait(Until.hasObject(By.text("Disposable direct server")), 5_000))
            assertTrue(device.wait(Until.hasObject(By.text("Open full app")), 5_000))
            assertEquals(VibeAllDayConnectionPhase.IDLE, runtime.connectionManager(profile.id).state.value.phase)
        } finally {
            scenario.close()
            runBlocking {
                val manager = runtime.connectionManager(profile.id)
                withTimeout(5_000) {
                    manager.state.first { it.phase == VibeAllDayConnectionPhase.IDLE }
                }
                assertEquals(VibeAllDayConnectionPhase.IDLE, manager.state.value.phase)
                runtime.pairedServers.forget(profile.id)
                if (
                    previouslySelected != null &&
                    runtime.pairedServers.snapshot(previouslySelected) != null
                ) {
                    runtime.pairedServers.select(previouslySelected)
                }
            }
        }
    }
}
