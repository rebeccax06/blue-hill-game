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
  root.insertAdjacentHTML(
    "beforeend",
    `<div data-playback hidden><label>Start from paragraph <select data-paragraph aria-label="Paragraph to read"></select></label><button type="button" data-pause disabled>Pause</button><label>Speed <select data-speed><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><label>Position in paragraph <input data-seek type="range" min="0" max="0" step="0.1" value="0" aria-label="Seek within paragraph" disabled></label><output data-time>0:00 / 0:00</output></div>`,
  );
  const disclosure = document.createElement("details");
  disclosure.className = "voice-disclosure";
  const summary = document.createElement("summary");
  summary.textContent = "Voice";
  const body = document.createElement("div");
  body.className = "voice-disclosure-body";
  body.append(...root.childNodes);
  disclosure.append(summary, body);
  root.append(disclosure);
  const playback = root.querySelector("[data-playback]");
  const options = document.createElement("details");
  options.className = "voice-playback-options";
  options.innerHTML = "<summary>Playback options</summary>";
  const playbackBody = document.createElement("div");
  playbackBody.append(...playback.childNodes);
  options.append(playbackBody);
  playback.append(options);
  root
    .querySelector(".voice-buttons")
    .append(root.querySelector("[data-pause]"));
  root.querySelector("[data-pause]").hidden = true;
  app.before(root);
  const q = (selector) => root.querySelector(selector);
  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  let voice = false,
    recognition = null,
    player = null,
    audioURL = null,
    pending = null;
  let paragraphs = [],
    activeParagraph = 0;
  const message = (text) => {
    q("[data-status]").textContent = text;
  };
  const stopReading = () => {
    pending?.abort();
    pending = null;
    if (player) {
      player.onloadedmetadata =
        player.ontimeupdate =
        player.onended =
        player.onerror =
          null;
      player.pause();
      player.src = "";
      player = null;
    }
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      audioURL = null;
    }
    app
      .querySelectorAll(".reading-paragraph")
      .forEach((el) => el.classList.remove("reading-paragraph"));
    q("[data-time]").textContent = "0:00 / 0:00";
    q("[data-seek]").value = 0;
    q("[data-stop]").hidden = true;
    q("[data-pause]").disabled = true;
    q("[data-pause]").hidden = true;
    q("[data-seek]").disabled = true;
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
    summary.textContent = voice ? "Voice · on" : "Voice";
    q("[data-mic]").hidden =
      !voice || !Recognition || !app.querySelector("#answer, [data-option]");
    q("[data-read]").hidden = !voice;
    q("[data-help]").hidden = !voice;
    q("[data-playback]").hidden = !voice;
    app
      .querySelectorAll(".read-paragraph")
      .forEach((el) => (el.hidden = !voice));
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
  const clock = (seconds) =>
    `${Math.floor((seconds || 0) / 60)}:${String(Math.floor((seconds || 0) % 60)).padStart(2, "0")}`;
  q("[data-speed]").onchange = () => {
    if (player) player.playbackRate = Number(q("[data-speed]").value);
  };
  q("[data-seek]").oninput = () => {
    if (player && Number.isFinite(player.duration))
      player.currentTime = Number(q("[data-seek]").value);
  };
  q("[data-pause]").onclick = async () => {
    if (!player) return;
    if (player.paused) {
      try {
        await player.play();
      } catch {
        message("Playback could not resume. Try Read aloud again.");
      }
    } else player.pause();
    q("[data-pause]").textContent = player.paused ? "Resume" : "Pause";
  };
  q("[data-paragraph]").onchange = () => {
    activeParagraph = Number(q("[data-paragraph]").value);
    if (player || pending) readParagraph(activeParagraph);
  };
  q("[data-read]").onclick = () =>
    readParagraph(Number(q("[data-paragraph]").value) || 0);
  async function readParagraph(index) {
    stopListening();
    stopReading();
    activeParagraph = index;
    q("[data-paragraph]").value = String(index);
    app
      .querySelectorAll(".reading-paragraph")
      .forEach((el) => el.classList.remove("reading-paragraph"));
    const paragraph = paragraphs[index];
    if (!paragraph) return;
    paragraph.classList.add("reading-paragraph");
    const text = paragraph.textContent.trim();
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
      player.playbackRate = Number(q("[data-speed]").value);
      player.onloadedmetadata = () => {
        q("[data-seek]").max = Number.isFinite(player.duration)
          ? player.duration
          : 0;
        q("[data-seek]").disabled = !Number.isFinite(player.duration);
      };
      player.ontimeupdate = () => {
        q("[data-seek]").value = player.currentTime;
        q("[data-time]").textContent =
          `${clock(player.currentTime)} / ${clock(player.duration)}`;
      };
      q("[data-pause]").disabled = false;
      q("[data-pause]").hidden = false;
      q("[data-pause]").textContent = "Pause";
      player.onended = () => {
        if (activeParagraph + 1 < paragraphs.length)
          readParagraph(activeParagraph + 1);
        else {
          stopReading();
          message("Finished reading.");
        }
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
  }
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
      disclosure.open = false;
      options.open = false;
      message("");
      root.remove();
    },
    mount() {
      q("[data-mic]").hidden =
        !voice || !Recognition || !app.querySelector("#answer, [data-option]");
      const content = app.querySelector(".panel") || app;
      paragraphs = [
        ...content.querySelectorAll(
          ".dialogue .quote, .dialogue .markdown p, .source-opening p, .text-block p, .event, .question-label",
        ),
      ].filter((el) => el.textContent.trim());
      if (!paragraphs.length)
        paragraphs = [...content.querySelectorAll("p")].filter(
          (el) => !el.closest(".voice-controls, .source-discussion"),
        );
      q("[data-paragraph]").replaceChildren(
        ...paragraphs.map((el, index) => {
          const option = document.createElement("option");
          option.value = index;
          option.textContent = `${index + 1}. ${el.textContent.trim().slice(0, 80)}`;
          return option;
        }),
      );
      activeParagraph = 0;
      paragraphs.forEach((el, index) => {
        const pick = document.createElement("button");
        pick.type = "button";
        pick.className = "read-paragraph";
        pick.textContent = "▶";
        pick.setAttribute("aria-label", `Read paragraph ${index + 1}`);
        pick.hidden = !voice;
        // Keep the narration text separate from its playback button.
        el.after(pick);
        pick.onclick = () => readParagraph(index);
      });

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
