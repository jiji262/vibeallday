import assert from "node:assert/strict";

/** Measure trusted key creation through input and paint, separately from CDP RTT. */
export async function beginTypingMetrics(locator) {
  await locator.evaluate((element) => {
    element.__vibeAllDayTypingSamples = [];
    element.__vibeAllDayTypingLongTasks = [];
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      element.__vibeAllDayTypingObserver = new PerformanceObserver(
        (entries) => {
          for (const entry of entries.getEntries()) {
            element.__vibeAllDayTypingLongTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
              name: entry.name,
            });
            if (element.__vibeAllDayTypingLongTasks.length > 128)
              element.__vibeAllDayTypingLongTasks.shift();
          }
        },
      );
      element.__vibeAllDayTypingObserver.observe({ type: "longtask" });
    }
    element.addEventListener("keydown", (event) => {
      if (
        event.key.length !== 1 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const sample = {
        key: event.key,
        eventAt: event.timeStamp,
        trusted: event.isTrusted,
        queuedMs: performance.now() - event.timeStamp,
      };
      element.__vibeAllDayTypingSamples.push(sample);
      element.addEventListener(
        "input",
        () => {
          sample.inputMs = performance.now() - event.timeStamp;
          requestAnimationFrame(() => {
            sample.paintMs = performance.now() - event.timeStamp;
            sample.value = element.value;
            sample.connected = element.isConnected;
          });
        },
        { once: true },
      );
    });
  });
}

export async function finishTypingMetrics(locator, text, commandTimes) {
  const timing = await locator.evaluate(async (element) => {
    await new Promise(requestAnimationFrame);
    element.__vibeAllDayTypingObserver?.disconnect();
    return {
      samples: element.__vibeAllDayTypingSamples,
      longTasks: element.__vibeAllDayTypingLongTasks,
      visible: document.visibilityState,
      focused: document.hasFocus(),
    };
  });
  const { samples } = timing;
  try {
    assert.equal(
      samples?.length,
      text.length,
      "Every sequential key must be recorded",
    );
    assert.equal(samples.map((sample) => sample.key).join(""), text);
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      assert(
        sample.trusted && sample.connected,
        "Typing must use trusted input on the retained element",
      );
      assert(
        sample.value.startsWith(text.slice(0, i + 1)),
        "Each keystroke must survive until paint",
      );
      for (const name of ["queuedMs", "inputMs", "paintMs"])
        assert(
          Number.isFinite(sample[name]) &&
            sample[name] >= 0 &&
            sample[name] <= 100,
          `${name} exceeded 100 ms for key ${i}: ${sample[name]}`,
        );
    }
    return {
      characters: text.length,
      inputMaxMs: Math.max(...samples.map((s) => s.inputMs)),
      paintMaxMs: Math.max(...samples.map((s) => s.paintMs)),
      queuedMaxMs: Math.max(...samples.map((s) => s.queuedMs)),
      commandRoundTripMaxMs: Math.max(...commandTimes),
    };
  } catch (error) {
    error.typingEvidence = { ...timing, commandTimes };
    throw error;
  }
}
