// Speech stays opt-in; game transitions still use the existing confirmation controls.
export function parseSpokenOption(text) {
  const match = text
    .trim()
    .replace(/[.!?]+$/, "")
    .match(
      /^(?:(?:i\s+)?(?:choose|select|pick)\s+)?(?:option\s+)?(a|b|c|ay|bee|be|see)$/i,
    );
  return match
    ? { AY: "A", BEE: "B", BE: "B", SEE: "C" }[match[1].toUpperCase()] ||
        match[1].toUpperCase()
    : null;
}

export function createVoiceControls({ app, toast }) {
  const root = document.createElement("section");
  root.className = "voice-controls";
  root.setAttribute("aria-label", "Text and voice controls");
  root.innerHTML = `<div class="voice-buttons"><label class="voice-switch"><input type="checkbox" role="switch" aria-label="Voice mode" data-voice-toggle><span class="voice-switch-track" aria-hidden="true"></span><span>Voice <strong data-mode-label>off</strong></span></label><button type="button" data-mic hidden>Start microphone</button><button type="button" data-read hidden>Read aloud</button><button type="button" data-stop hidden>Stop reading</button></div><p class="micro" data-help hidden>Press the mic to speak an answer or say “choose option B”. Review before confirming. Microphone audio is handled by your browser’s speech service.</p><span role="status" aria-live="polite" data-status></span>`;
  app.before(root);
  const q = (selector) => root.querySelector(selector);
  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  let voice = false,
    recognition = null,
    player = null,
    audioURL = null,
    pending = null;
  const message = (text) => {
    q("[data-status]").textContent = text;
  };
  const stopReading = () => {
    pending?.abort();
    pending = null;
    if (player) {
      player.pause();
      player.src = "";
      player = null;
    }
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      audioURL = null;
    }
    q("[data-stop]").hidden = true;
  };
  const stopListening = () => {
    if (recognition) {
      const current = recognition;
      recognition = null;
      current.abort();
    }
    q("[data-mic]").textContent = "Start microphone";
  };
  q("[data-voice-toggle]").onchange = (event) => {
    voice = event.target.checked;
    stopListening();
    stopReading();
    q("[data-mode-label]").textContent = voice ? "on" : "off";
    q("[data-mic]").hidden = !voice;
    q("[data-read]").hidden = !voice;
    q("[data-help]").hidden = !voice;
    message(
      voice
        ? Recognition
          ? "Press Start microphone to speak, or Read aloud to listen."
          : "Microphone input is unavailable in this browser. You can still type and listen."
        : "",
    );
  };
  q("[data-mic]").disabled = !Recognition;
  q("[data-stop]").onclick = stopReading;
  q("[data-read]").onclick = async () => {
    stopListening();
    stopReading();
    const content = app.querySelector(".panel") || app;
    const readable = content.cloneNode(true);
    readable.querySelectorAll(".voice-controls").forEach((el) => el.remove());
    const text = readable.textContent.trim();
    if (!text) return;
    const controller = new AbortController();
    pending = controller;
    q("[data-stop]").hidden = false;
    message("Preparing voice…");
    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw Error(
          (await response.json()).error || "Could not prepare voice.",
        );
      const blob = await response.blob();
      if (pending !== controller) return;
      audioURL = URL.createObjectURL(blob);
      player = new Audio(audioURL);
      player.onended = () => {
        stopReading();
        message("Finished reading.");
      };
      player.onerror = () => {
        stopReading();
        message("Audio playback failed. Try Read aloud again.");
      };
      await player.play();
      if (pending === controller) message("Reading aloud…");
    } catch (error) {
      if (pending !== controller) return;
      stopReading();
      message(error.message || "Could not play voice. Try again.");
    }
  };
  q("[data-mic]").onclick = () => {
    if (!voice || !Recognition) return;
    if (recognition) {
      recognition.stop();
      return;
    }
    stopReading();
    const current = new Recognition();
    recognition = current;
    current.lang = "en-US";
    current.continuous = false;
    current.interimResults = false;
    current.onresult = (event) => {
      if (recognition !== current) return;
      const text = event.results[0][0].transcript.trim();
      const option = parseSpokenOption(text);
      const button = option && app.querySelector(`[data-option="${option}"]`);
      if (button && !button.disabled) {
        button.click();
        message(
          `Option ${option} selected. Review it and use the confirmation button to continue.`,
        );
        return;
      }
      const answer = app.querySelector("#answer");
      if (answer && !answer.disabled) {
        answer.value = `${answer.value}${answer.value ? " " : ""}${text}`.slice(
          0,
          answer.maxLength > 0 ? answer.maxLength : 2000,
        );
        answer.dispatchEvent(new Event("input", { bubbles: true }));
        answer.focus();
        message(
          "Speech added to your answer. Review or edit it before sending.",
        );
      } else
        message(
          `Heard: “${text}”. To select a street design, say “choose option A”, B, or C when the options are shown.`,
        );
    };
    current.onerror = (event) => {
      if (recognition !== current) return;
      const errors = {
        "not-allowed":
          "Microphone access was denied. Allow microphone access in your browser or use Text.",
        "no-speech": "No speech heard. Try again.",
        network: "Speech recognition could not connect. Try again or use Text.",
        "audio-capture":
          "No microphone is available. Check your device or use Text.",
      };
      message(
        errors[event.error] ||
          "Speech recognition stopped. Try again or use Text.",
      );
    };
    current.onend = () => {
      if (recognition !== current) return;
      recognition = null;
      q("[data-mic]").textContent = "Start microphone";
      if (q("[data-status]").textContent === "Listening…")
        message("Microphone stopped.");
    };
    try {
      current.start();
      q("[data-mic]").textContent = "Stop microphone";
      message("Listening…");
    } catch {
      stopListening();
      toast("Microphone could not start. Try again or use Text.");
    }
  };
  window.addEventListener("pagehide", () => {
    stopListening();
    stopReading();
  });
  return {
    sync() {
      stopListening();
      stopReading();
      root.remove();
    },
    mount() {
      const header = app.querySelector(".person-head");
      root.classList.toggle("voice-controls-person", !!header);
      if (header) header.append(root);
      else {
        const panel = app.querySelector(
          ".panel, .complete, .welcome > div, #section-explorer-root",
        );
        if (panel) panel.prepend(root);
        else app.prepend(root);
      }
    },
  };
}
