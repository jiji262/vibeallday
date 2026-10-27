#if DEBUG
  import WebKit

  enum InputAcceptance {
    static func install(_ configuration: WKWebViewConfiguration) {
      guard ProcessInfo.processInfo.arguments.contains("-qa-input-metrics") else { return }
      let script = """
        (() => {
          // XCTest can expose the navigation's AX frame before WebKit paints
          // it (CI 38249220195). Gate its tap on the actual DOM hit target and
          // two rendering frames, rather than a fixed sleep or an AX snapshot.
          document.addEventListener('click', event => {
            const drawer = event.target.closest?.('[aria-label="Open sidebar"]');
            if (!drawer && !event.target.closest?.('[data-tab="more"]')) return;
            document.getElementById('qa-host-switch-ready')?.remove();
            const deadline = performance.now() + 5000;
            let frames = 0;
            const check = () => {
              const button = drawer ? document.querySelector('.sidebar-switch-host')
                : [...document.querySelectorAll('main button')].find(button => button.textContent.trim().toLowerCase().startsWith('switch host'));
              const rect = button?.getBoundingClientRect();
              const hit = rect && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
              const settled = button?.closest('aside, main')?.getAnimations().every(animation => animation.playState !== 'running');
              frames = settled && rect && rect.width > 0 && rect.height > 0 && button.contains(hit) ? frames + 1 : 0;
              if (frames >= 2) {
                const ready = document.createElement('div'); ready.id = 'qa-host-switch-ready';
                ready.style.cssText = 'position:fixed;top:0;right:0;z-index:99999;font:10px monospace;background:white;color:black';
                ready.textContent = 'QA host switch ready'; document.body.append(ready);
              } else if (performance.now() < deadline) requestAnimationFrame(check);
            };
            requestAnimationFrame(check);
          }, true);
          window.addEventListener('vibeAllDayKeyboardShown', () => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
              let ready=document.getElementById('qa-keyboard-ready');
              if (!ready) { ready=document.createElement('div');ready.id='qa-keyboard-ready';ready.style.cssText='position:fixed;top:12px;right:0;z-index:99999;font:10px monospace;background:white;color:black';document.body.append(ready); }
              ready.textContent='QA keyboard ready';
            }));
          });
          let count = 0, issued = 0, max = 0, maxKey = 0, domMax = 0, taskMax = 0, dropped = 0, stream = 0, sample = null, peak = null;
          const setItem = Storage.prototype.setItem;
          Storage.prototype.setItem = function(...args) {
            const start = performance.now();
            try { return setItem.apply(this, args); }
            finally { if (sample) sample.storage += performance.now() - start; }
          };
          const publish = () => {
            let report = document.getElementById('qa-input-metrics');
            if (!report) {
              report = document.createElement('div'); report.id = 'qa-input-metrics';
              report.style.cssText = 'position:fixed;top:0;right:0;z-index:99999;font:10px monospace;background:white;color:black';
              document.body.append(report);
            }
            report.textContent = `QA input=${count};max=${Math.ceil(max)};dropped=${dropped};key=${maxKey};dom=${Math.ceil(domMax)};task=${Math.ceil(taskMax)};peak=${JSON.stringify(peak)};stream=${stream}`;
          };
          new MutationObserver(records => {
            if (issued > 0 && issued < 37 && document.activeElement?.matches?.('textarea[data-composer-input]') && records.some(record => (record.target.closest?.('.message-list') || record.target.parentElement?.closest?.('.message-list')))) stream++;
          }).observe(document, {subtree:true,childList:true,characterData:true});
          document.addEventListener('beforeinput', event => {
            const input = event.target;
            if (!input.matches?.('textarea[data-composer-input]')) return;
            const start = performance.now(), before = input.value, key = ++issued;
            const timing = sample = {key, storage:0};
            input.addEventListener('input', () => { timing.dom = performance.now()-start; domMax = Math.max(domMax, timing.dom) }, {once:true});
            document.addEventListener('input', () => {
              timing.bubble = performance.now()-start;
              queueMicrotask(() => { timing.micro = performance.now()-start; });
            }, {once:true});
            setTimeout(() => {
              timing.task = performance.now()-start; taskMax = Math.max(taskMax, timing.task);
              if (peak === timing) publish();
            }, 0);
            requestAnimationFrame(stamp => {
              count++; const latency = performance.now()-start; if (latency>max) {max=latency;maxKey=key}
              timing.frame = stamp-start; timing.raf = latency;
              if (sample === timing) sample = null;
              if (!peak || timing.raf > peak.raf) peak = timing;
              if (input.value === before) dropped++;
              publish();
            });
          }, true);
        })();
        """
      configuration.userContentController.addUserScript(
        WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }
  }
#endif
