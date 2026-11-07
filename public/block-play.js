import { mountPlanViewer } from "./plan-viewer.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Topic indices refer to the actual section-12 proposal notes; color groups are
// deliberately kept distinct from individual engineering features.
export const blockFeatures = [
  {
    id: "bus",
    summary:
      "A new center platform sits near Vesta Road, on the right of this drawing.",
    label: "Bus platforms",
    layer: "platforms",
    topic: 4,
    people: ["Malik", "Tiana"],
    amendments: [5, 7],
    question:
      "How would the proposed bus platforms at Vesta Road affect your trips?",
  },
  {
    id: "parking",
    summary:
      "Five net new parking spaces, with a carriageway lane at Happy Supermarket.",
    label: "Supermarket access",
    layer: "blue",
    topic: 1,
    people: ["Denise", "Marisol", "Angela"],
    amendments: [1, 2, 3],
    question:
      "Would the proposed carriageway parking lane at Happy Supermarket meet your access needs?",
  },
  {
    id: "crossings",
    summary:
      "Southbound left turns use a signalized U-turn before Paxton Street.",
    label: "Turns & crossings",
    layer: "yellow",
    topic: 2,
    people: ["Tiana", "Angela"],
    amendments: [6, 7],
    question:
      "How would the proposed Harvard–Talbot turn changes and crossings affect you?",
  },
  {
    id: "bike",
    summary: "A sidewalk-level bike path runs along the west side.",
    label: "Bike path",
    layer: "green",
    topic: 3,
    people: ["Tiana", "Malik"],
    amendments: [6, 7],
    question:
      "What would the proposed west-side sidewalk-level bike path mean for your daily trips?",
  },
  {
    id: "trees",
    summary: "At least 15 new trees are proposed.",
    label: "Trees",
    layer: "green",
    topic: 5,
    people: ["Gloria", "Raymond"],
    amendments: [10, 12],
    question:
      "What matters to you about the proposed trees and changes to the feel of this block?",
  },
  {
    id: "traffic",
    summary: "Two travel lanes remain in each direction.",
    label: "Travel lanes",
    layer: "all",
    topic: 0,
    people: ["Angela", "Raymond"],
    amendments: [4, 12],
    question:
      "What concerns would you have about traffic on this block with two travel lanes in each direction?",
  },
];
export function mountBlockPlay(
  root,
  {
    block,
    content,
    state,
    selectedAmendments,
    focus,
    onFocus,
    onAsk,
    onAmend,
    onDetailsChange,
  },
) {
  let active =
    focus === null
      ? null
      : blockFeatures.find((f) => f.id === focus) || blockFeatures[1];
  let detailsOpen = !!state.proposalDetailsOpen;
  root.innerHTML = `<section class="block-play" aria-label="Play this block"><div class="block-play-heading"><div><span class="eyebrow">Your block · ${block.number}</span><h2>${esc(block.title)}</h2></div><span class="proposal-badge">Actual proposal</span></div><p class="micro">Tap a colored marking or choose a feature. Drag to explore.</p><div class="game-plan"></div><nav class="block-feature-tabs" aria-label="Explore block features">${blockFeatures.map((f) => `<button type="button" data-block-feature="${f.id}" aria-pressed="false">${esc(f.label)}</button>`).join("")}</nav><div class="block-feature-card" aria-live="polite"></div><details class="block-plan-source"><summary>Drawing & accuracy</summary><p>The plan uses the original proposal geometry. 3D boundaries follow source colors; building heights and context are illustrative. Color groups can include several uses. Recommendation markers represent policy choices, not engineered changes.</p><a href="${esc(block.slide)}" target="_blank" rel="noopener">Open extracted slide ${block.page} ↗</a></details></section>`;
  const viewerBlock = {
    ...block,
    plan: {
      ...block.plan,
      layers: [
        {
          id: "platforms",
          label: "Bus platform near Vesta Road (right side of drawing)",
          image: "/explorer/assets/section-12-layer-platforms.png",
          color: "#d7b829",
          pixels: 2547,
        },
        ...block.plan.layers,
      ],
    },
  };
  const viewer = root.querySelector(".game-plan");
  const card = root.querySelector(".block-feature-card");
  const editable = !state.frozen && state.stage === "final";
  function show(feature, highlight = true) {
    const previousDetails = card.querySelector(".feature-detail");
    if (previousDetails) detailsOpen = previousDetails.open;
    active = feature;
    onFocus(feature?.id ?? null);
    card.hidden = !feature;
    root
      .querySelectorAll("[data-block-feature]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.blockFeature === feature?.id),
        ),
      );
    if (highlight)
      viewer
        .querySelector(`[data-plan-layer="${feature?.layer || "all"}"]`)
        ?.click();
    if (!feature) {
      card.replaceChildren();
      return;
    }
    const ids = selectedAmendments || [];
    const availablePeople = feature.people.filter((name) => {
      const met = state.people.find((p) => p.name === name);
      return (
        (state.stage === "people" && !met && state.people.length < 3) ||
        (state.stage === "interview" &&
          state.active?.name === name &&
          !met?.followup)
      );
    });
    const commitments = feature.amendments.filter(
      (id) => editable || ids.includes(id),
    );
    card.innerHTML = `<p class="proposal-fact">${esc(feature.summary)}</p><details class="feature-detail" ${detailsOpen ? "open" : ""}><summary>Proposal details</summary><p>${esc(block.topics[feature.topic].text)}</p>${feature.id === "bus" ? "<p>The visible platform is the long yellow island on the right. Green on the left is the bike path; the second platform described in the notes is beyond this drawing.</p>" : ""}</details>${availablePeople.length ? `<div class="feature-people">${availablePeople.map((name) => `<button type="button" data-feature-person="${name}">${state.stage === "interview" ? "Draft a question" : `Ask ${esc(name)}`} ↗</button>`).join("")}</div>` : ""}${
      commitments.length
        ? `<div class="feature-changes">${commitments
            .map((id) => {
              const a = content.amendments.find((a) => a.id === id),
                chosen = ids.includes(id);
              return `<div class="feature-amendment ${chosen ? "is-chosen" : ""}"><div><strong>${esc(a.name)}</strong><details><summary>Tradeoff</summary><p>${esc(a.tradeoff)}</p></details></div>${editable ? `<button type="button" data-feature-amendment="${id}" aria-pressed="${chosen}">${chosen ? "Remove ✓" : "Add +"}</button>` : '<span aria-label="Selected commitment">✓</span>'}</div>`;
            })
            .join(
              "",
            )}${editable ? `<p class="micro">${ids.length} of 2 commitments · Confirm in your recommendation.</p>` : ""}</div>`
        : ""
    }`;
    const details = card.querySelector(".feature-detail");
    details.addEventListener("toggle", () => {
      if (!details.isConnected) return;
      detailsOpen = details.open;
      onDetailsChange?.(detailsOpen);
    });
    card
      .querySelectorAll("[data-feature-person]")
      .forEach(
        (b) => (b.onclick = () => onAsk(b.dataset.featurePerson, active)),
      );
    card
      .querySelectorAll("[data-feature-amendment]")
      .forEach(
        (b) => (b.onclick = () => onAmend(Number(b.dataset.featureAmendment))),
      );
  }
  const dispose = mountPlanViewer(viewer, viewerBlock, {
    initialStyle: "clear",
    onFeature(layer) {
      let key = viewer.querySelector(".source-color-key");
      if (!key) {
        key = document.createElement("p");
        key.className = "source-color-key micro";
        viewer.append(key);
      }
      key.textContent =
        layer === "all"
          ? "Showing all proposal markings"
          : `Source color group: ${viewerBlock.plan.layers.find((l) => l.id === layer)?.label || layer}`;
      if (layer === active?.layer || layer === "all") return;
      const feature =
        layer === "red"
          ? blockFeatures[1]
          : blockFeatures.find((f) => f.layer === layer);
      if (feature) show(feature, false);
    },
  });
  root
    .querySelectorAll("[data-block-feature]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          show(
            active?.id === b.dataset.blockFeature
              ? null
              : blockFeatures.find((f) => f.id === b.dataset.blockFeature),
          )),
    );
  show(active);
  if (selectedAmendments?.length) {
    const markers = document.createElement("div");
    markers.className = "plan-policy-markers";
    markers.innerHTML = `<span class="eyebrow">Your policy commitments</span>${selectedAmendments.map((id) => `<span>✓ ${esc(content.amendments.find((a) => a.id === id)?.name)}</span>`).join("")}`;
    viewer.querySelector(".plan-canvas-wrap").after(markers);
  }
  return dispose;
}
