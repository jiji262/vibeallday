package com.vibeallday.mobile.links

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AppLinkDestinationTest {
    private val clientUrl = "https://appassets.androidplatform.net/"

    @Test
    fun nativePairingKeepsCredentialsOutOfWebUrls() {
        assertEquals(AppLinkDestination.NativePairingLink("user", "password", "wss://relay.example/ws"),
            AppLinkDestination.toNativePairingLink("android.intent.action.VIEW",
                "https://vibeallday.navs.dpdns.org/open?u=user&p=password&r=https%3A%2F%2Frelay.example"))
        assertNull(AppLinkDestination.toNativePairingLink("android.intent.action.VIEW",
            "https://evil.example/open?u=user&p=password"))
        assertNull(AppLinkDestination.toNativePairingLink("android.intent.action.VIEW",
            "https://vibeallday.navs.dpdns.org/open?u=user&p=password&r=javascript%3Aevil"))
    }

    @Test
    fun ignoresOrdinaryLauncherIntentsEvenWhenTheActivityAlreadyExists() {
        assertNull(
            AppLinkDestination.toWebClientUrlForIntent(
                action = "android.intent.action.MAIN",
                appLink = null,
                clientStartUrl = clientUrl,
            ),
        )
    }

    @Test
    fun acceptsAValidViewIntent() {
        assertEquals(
            "https://appassets.androidplatform.net/#u=user&p=password",
            AppLinkDestination.toWebClientUrlForIntent(
                action = "android.intent.action.VIEW",
                appLink = "https://vibeallday.navs.dpdns.org/open?u=user&p=password",
                clientStartUrl = clientUrl,
            ),
        )
    }

    @Test
    fun mapsCredentialsToTheFixedClientOriginFragment() {
        assertEquals(
            "https://appassets.androidplatform.net/#u=user%2Bname&p=safe%27value&" +
                "r=https%3A%2F%2Frelay.example",
            AppLinkDestination.toWebClientUrl(
                "https://vibeallday.navs.dpdns.org/open?u=user%2Bname&p=safe%27value&" +
                    "r=https%3A%2F%2Frelay.example",
                clientUrl,
            ),
        )
    }

    @Test
    fun rejectsUnapprovedOriginsPathsAndPorts() {
        for (
            url in listOf(
                "http://vibeallday.navs.dpdns.org/open?u=user&p=password",
                "https://evil.example/open?u=user&p=password",
                "https://vibeallday.navs.dpdns.org:444/open?u=user&p=password",
                "https://vibeallday.navs.dpdns.org/open/extra?u=user&p=password",
            )
        ) {
            assertNull(AppLinkDestination.toWebClientUrl(url, clientUrl))
        }
    }

    @Test
    fun rejectsIncompleteOrMalformedCredentials() {
        for (
            url in listOf(
                "https://vibeallday.navs.dpdns.org/open",
                "https://vibeallday.navs.dpdns.org/open?u=user",
                "https://vibeallday.navs.dpdns.org/open?u=user&p=",
                "https://vibeallday.navs.dpdns.org/open?u=%ZZ&p=password",
                "https://vibeallday.navs.dpdns.org/open?u=user&p=password#other",
            )
        ) {
            assertNull(AppLinkDestination.toWebClientUrl(url, clientUrl))
        }
    }
}
