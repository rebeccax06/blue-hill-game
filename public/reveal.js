import { street } from "./art.js";

export function beforeAfterStreet(final, view = "perspective", progress = 100) {
  const passive = (svg) => svg.replaceAll('tabindex="0"', 'tabindex="-1"');
  return `<div class="street-reveal" id="street-reveal" style="--reveal:${progress}%"><div class="scene reveal-scene" role="img" aria-label="Before and after: an illustrative starting street changes into your final Option ${final.option} design."><div class="reveal-before" aria-hidden="true">${passive(street("A", [], view, { before: true }))}<span class="reveal-badge reveal-before-badge">Before</span></div><div class="reveal-after" aria-hidden="true">${passive(street(final.option, final.amendments, view))}<span class="reveal-badge reveal-after-badge">Five years later · ${final.option}</span></div><span class="reveal-divider" aria-hidden="true"><span>↔</span></span></div><div class="reveal-controls"><div class="reveal-control-heading"><label for="street-reveal-range">Explore the change</label><button type="button" class="quiet" data-action="replay-street">↻ Replay</button></div><input id="street-reveal-range" type="range" min="0" max="100" value="${Math.round(progress)}" aria-label="Before and after street reveal" aria-valuetext="${Math.round(progress)}% of final design revealed"><div class="reveal-endpoints"><span>Starting street</span><span>Your final design</span></div></div></div>`;
}

// Animation state is independent of DOM nodes so AI responses and view changes
// can re-render the page without restarting the transition or losing the slider.
export function createStreetReveal({
  root = document,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
  now = () => performance.now(),
  reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches,
} = {}) {
  let progress = 100,
    frame = null;
  const sync = () => {
    root
      .querySelector("#street-reveal")
      ?.style.setProperty("--reveal", `${progress}%`);
    const range = root.querySelector("#street-reveal-range");
    if (range) {
      range.value = String(Math.round(progress));
      range.setAttribute(
        "aria-valuetext",
        `${Math.round(progress)}% of final design revealed`,
      );
    }
  };
  const stop = () => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
  };
  const set = (value) => {
    stop();
    progress = Math.max(0, Math.min(100, Number(value) || 0));
    sync();
  };
  const play = () => {
    stop();
    if (reducedMotion()) {
      progress = 100;
      sync();
      return;
    }
    progress = 0;
    sync();
    const start = now();
    const tick = (time) => {
      const t = Math.max(0, Math.min(1, (time - start) / 2800));
      progress = 100 * (t * t * (3 - 2 * t));
      sync();
      frame = t < 1 ? requestFrame(tick) : null;
    };
    frame = requestFrame(tick);
  };
  return {
    get progress() {
      return progress;
    },
    sync,
    set,
    play,
  };
}
