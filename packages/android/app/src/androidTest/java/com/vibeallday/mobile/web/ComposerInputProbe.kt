package com.vibeallday.mobile.web

import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until

internal object ComposerInputProbe {
    fun tap(evaluate: (String) -> String, awaitReady: (String) -> Unit) {
        evaluate("""
            (() => {
              window.nativeComposerTapReady = false;
              window.nativeComposerTapTrace = [];
              for (const type of ['pointerdown', 'pointerup', 'focusin', 'focusout']) {
                document.addEventListener(type, event => {
                  window.nativeComposerTapTrace.push({type, at:performance.now(),
                    target:event.target.outerHTML?.slice(0,200), x:event.clientX, y:event.clientY});
                }, {capture:true});
              }
              let previous = '', stable = 0;
              const check = () => {
                const input = document.querySelector('textarea[data-composer-input]');
                const rect = input?.getBoundingClientRect();
                const hit = rect && document.elementFromPoint(rect.x + rect.width/2, rect.y + rect.height/2);
                const geometry = rect && JSON.stringify([rect.x, rect.y, rect.width, rect.height]);
                stable = input && !input.disabled && hit === input && document.fonts.status === 'loaded'
                  && geometry === previous ? stable + 1 : 0;
                previous = geometry;
                if (stable >= 2) window.nativeComposerTapReady = true;
                else requestAnimationFrame(check);
              };
              requestAnimationFrame(check);
              return true;
            })()
        """.trimIndent())
        awaitReady("window.nativeComposerTapReady === true")
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val composer = device.wait(Until.findObject(By.clazz("android.widget.EditText")), 30_000)
        checkNotNull(composer) { "Composer is absent from Android accessibility" }.click()
    }
}
