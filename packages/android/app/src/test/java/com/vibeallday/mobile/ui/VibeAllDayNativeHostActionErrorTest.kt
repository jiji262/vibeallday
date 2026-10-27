package com.vibeallday.mobile.ui

import org.junit.Assert.assertEquals
import org.junit.Test
import uniffi.vibeallday_mobile_core.CoreException

class VibeAllDayNativeHostActionErrorTest {
    @Test fun transportFailuresDoNotAccuseCredentials() {
        for (error in listOf(CoreException.Unavailable(), CoreException.Timeout(), CoreException.Closed())) {
            assertEquals(VibeAllDayNativeUiError.SERVER_UNAVAILABLE, nativeHostActionError(error))
        }
    }

    @Test fun authenticationAndVerificationFailuresRemainDistinctFromAnOutage() {
        for (error in listOf(CoreException.ReauthenticationRequired(), CoreException.InvalidMessage())) {
            assertEquals(VibeAllDayNativeUiError.AUTHENTICATION_FAILED, nativeHostActionError(error))
        }
    }
}
