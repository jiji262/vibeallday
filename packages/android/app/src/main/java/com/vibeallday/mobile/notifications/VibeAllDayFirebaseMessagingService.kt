package com.vibeallday.mobile.notifications

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.vibeallday.mobile.BuildConfig
import com.vibeallday.mobile.VibeAllDayApplication
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.Dispatchers

class VibeAllDayFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        if (BuildConfig.DEBUG) {
            Log.i(TAG, "Legacy FCM registration token refreshed")
        }
    }

    override fun onRegistered(installationId: String) {
        val outcome = NotificationFoundation
            .installationCoordinator(applicationContext)
            .registerTarget(installationId)
        if (BuildConfig.DEBUG) {
            Log.i(TAG, "Broker installation registration: ${outcome.name.lowercase()}")
        }
    }

    override fun onUnregistered(installationId: String) {
        if (BuildConfig.DEBUG) {
            Log.i(TAG, "FCM installation unregistered")
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        runBlocking(Dispatchers.IO) {
            NativePushPresenter.present(applicationContext, (application as VibeAllDayApplication).nativeRuntime, message.data)
        }
        if (BuildConfig.DEBUG) {
            Log.i(
                TAG,
                "FCM message received: dataKeys=${message.data.keys.sorted()} " +
                    "hasNotification=${message.notification != null}",
            )
        }
    }

    companion object {
        private const val TAG = "VibeAllDayFCM"
    }
}
