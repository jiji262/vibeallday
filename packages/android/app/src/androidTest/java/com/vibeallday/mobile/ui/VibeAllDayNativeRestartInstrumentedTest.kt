package com.vibeallday.mobile.ui

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.vibeallday.mobile.VibeAllDayApplication
import com.vibeallday.mobile.profiles.VibeAllDayServerRoute
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertNotNull
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class VibeAllDayNativeRestartInstrumentedTest {
    @Test
    fun provisionsATestOwnedProfileForAHostDrivenRestart() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val arguments = InstrumentationRegistry.getArguments()
        assumeTrue(arguments.getString("vibeAllDayRestartPhase") == "provision")
        val wsUrl = arguments.getString("vibeAllDayProbeWsUrl")
        val username = arguments.getString("vibeAllDayProbeUsername")
        val password = arguments.getString("vibeAllDayProbePassword")
        assumeTrue(wsUrl != null && username != null && password != null)
        val application = instrumentation.targetContext.applicationContext
            as VibeAllDayApplication
        val store = application.nativeRuntime.pairedServers
        val testPreferences = instrumentation.context.getSharedPreferences(
            TEST_PREFERENCES,
            Context.MODE_PRIVATE,
        )

        val paired = runBlocking {
            val staleTestProfileIds = store.snapshots()
                .filter { it.profile.label == TEST_PROFILE_LABEL }
                .map { it.profile.id }
            val selectedBeforeCleanup = store.selectedProfileId.first()
            staleTestProfileIds.forEach { store.forget(it) }
            val previousSelected = selectedBeforeCleanup?.takeUnless {
                it in staleTestProfileIds
            }
            testPreferences.edit()
                .putString(PREVIOUS_SELECTION_KEY, previousSelected)
                .apply()
            withTimeout(15_000) {
                application.nativeRuntime.pairing.pair(
                    label = TEST_PROFILE_LABEL,
                    username = checkNotNull(username),
                    password = checkNotNull(password),
                    route = VibeAllDayServerRoute.direct(checkNotNull(wsUrl)),
                )
            }
        }

        assertNotNull(runBlocking { store.snapshot(paired.id)?.resumeCredential })
    }

    @Test
    fun removesTheTestOwnedRestartProfile() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        assumeTrue(
            InstrumentationRegistry.getArguments().getString("vibeAllDayRestartPhase") == "cleanup",
        )
        val application = instrumentation.targetContext.applicationContext
            as VibeAllDayApplication
        val store = application.nativeRuntime.pairedServers
        val testPreferences = instrumentation.context.getSharedPreferences(
            TEST_PREFERENCES,
            Context.MODE_PRIVATE,
        )

        runBlocking {
            store.snapshots()
                .filter { it.profile.label == TEST_PROFILE_LABEL }
                .forEach { store.forget(it.profile.id) }
            val previousSelected = testPreferences.getString(PREVIOUS_SELECTION_KEY, null)
            if (
                previousSelected != null &&
                store.snapshot(previousSelected) != null
            ) {
                store.select(previousSelected)
            }
        }
        testPreferences.edit().remove(PREVIOUS_SELECTION_KEY).apply()
    }

    companion object {
        const val TEST_PROFILE_LABEL = "Disposable Android restart probe"
        private const val TEST_PREFERENCES = "vibeallday_native_restart_probe"
        private const val PREVIOUS_SELECTION_KEY = "previous_selection"
    }
}
