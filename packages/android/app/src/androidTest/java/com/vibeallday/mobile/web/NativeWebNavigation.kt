package com.vibeallday.mobile.web

/** Readiness and ordinary mobile navigation shared by the bundled-web probes. */
internal object NativeWebNavigation {
    const val HOST_READY = "!!document.querySelector('main') && !!document.querySelector('[data-tab=more]') && !!window.vibeAllDayNativeTransport"
    const val INBOX_READY = "location.pathname === '/inbox' && !!document.querySelector('nav[aria-label=\"Session views\"] a[aria-current=page][href=\"/inbox\"]') && !!document.querySelector('main')"
    const val OPEN_MORE = "document.querySelector('[data-tab=more]').click(); true"
    const val SWITCH_HOST_READY = "[...document.querySelectorAll('main button')].some(button => button.textContent.trim().toLowerCase().startsWith('switch host'))"
    const val SWITCH_HOST = "[...document.querySelectorAll('main button')].find(button => button.textContent.trim().toLowerCase().startsWith('switch host')).click(); true"
}
