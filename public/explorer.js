import { mountPlanViewer } from "./plan-viewer.js";
import { corridorMap } from "./corridor-map.js";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const topicIcons = ["↕", "P", "↱", "↔", "BUS", "♧"];

export function createSectionExplorer({ onDone }) {
  let dataPromise,
    selected = 11,
    currentView = "drawing",
    query = "";
  let disposePlan = () => {};

  return {
    unmount() {
      disposePlan();
      disposePlan = () => {};
    },
    async mount(root) {
      root.innerHTML =
        '<p class="explorer-loading" role="status">Opening the avenue…</p>';
      try {
        dataPromise ||= fetch("/explorer/sections.json")
          .then((r) => {
            if (!r.ok) throw Error("The section guide could not be loaded.");
            return r.json();
          })
          .catch((error) => {
            dataPromise = null;
            throw error;
          });
        const data = await dataPromise;
        if (!root.isConnected) return;
        root.innerHTML = `<section class="section-explorer" aria-labelledby="explorer-title">
          <div class="explorer-heading"><div><span class="eyebrow orange">Explore the real proposal · September 2026</span><h1 id="explorer-title" tabindex="-1">Explore the avenue,<br> block by block.</h1><p>Get to know Blue Hill Avenue, from Mattapan Square to Grove Hall. Pick a block on the corridor map, then explore the design in detail.</p></div><button type="button" class="primary explorer-done">Continue to the game <span aria-hidden="true">↗</span></button></div>
          <p class="explorer-context">These are the City of Boston and MBTA’s September 2026 proposal materials. The game’s A, B, and C options are separate simulated choices.</p>
          <div class="explorer-layout"><aside class="explorer-sidebar" aria-label="Choose a section"><div class="explorer-sidebar-top"><span class="eyebrow">The corridor · South to north</span><p>Mattapan Square <span aria-hidden="true">→</span> Grove Hall</p><label for="section-search">Find a street or landmark</label><input id="section-search" type="search" placeholder="Try Harvard or Happy Supermarket" value="${escape(query)}" autocomplete="off"></div><div class="corridor-map"></div><details class="section-list-disclosure"><summary>Browse all sections</summary><nav class="corridor-guide" aria-label="Blue Hill Avenue sections"></nav></details><p class="corridor-caption">Schematic corridor diagram, not to scale. Click a numbered block to explore its drawing.</p></aside><div class="explorer-detail"></div></div>
        </section>`;
        const detail = root.querySelector(".explorer-detail");
        const guide = root.querySelector(".corridor-guide");
        const search = root.querySelector("#section-search");
        root.querySelector(".explorer-done").onclick = onDone;

        const renderGuide = () => {
          const map = root.querySelector(".corridor-map");
          map.innerHTML = corridorMap(data.sections, selected);
          map.querySelectorAll("[data-map-section]").forEach((block) => {
            block.onclick = () => select(Number(block.dataset.mapSection));
            block.onkeydown = (event) => {
              if (["Enter", " "].includes(event.key)) {
                event.preventDefault();
                select(Number(block.dataset.mapSection));
              }
            };
          });
          root.querySelector(".section-list-disclosure").open = Boolean(
            query.trim(),
          );
          const matches = data.sections.filter((section) =>
            `${section.title} ${section.description}`
              .toLowerCase()
              .includes(query.toLowerCase().trim()),
          );
          guide.innerHTML = matches.length
            ? matches
                .map(
                  (section) =>
                    `<button type="button" class="corridor-section ${section.number - 1 === selected ? "is-selected" : ""}" data-section="${section.number - 1}" aria-current="${section.number - 1 === selected ? "location" : "false"}"><span class="corridor-number">${String(section.number).padStart(2, "0")}</span><span>${escape(section.title)}<small>${escape(section.description.replace(/^This section (?:is |runs |)/, ""))}</small></span></button>`,
                )
                .join("")
            : '<p class="explorer-no-results" role="status">No matching section. Try another street or landmark.</p>';
          guide
            .querySelectorAll("[data-section]")
            .forEach(
              (button) =>
                (button.onclick = () => select(Number(button.dataset.section))),
            );
          const active = guide.querySelector(".is-selected");
          if (active)
            guide.scrollTop =
              active.offsetTop -
              guide.offsetTop -
              guide.clientHeight / 2 +
              active.offsetHeight / 2;
        };

        const openZoom = (image, label, source) => {
          const dialog = document.createElement("dialog");
          dialog.className = "explorer-zoom";
          dialog.setAttribute("aria-label", label);
          dialog.innerHTML = `<div class="explorer-zoom-toolbar"><strong>${escape(label)}</strong><div><button type="button" data-zoom="out" aria-label="Zoom out">−</button><output aria-live="polite">100%</output><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="reset">Fit</button><a href="${escape(source)}" target="_blank" rel="noopener">Source PDF ↗</a><button type="button" data-zoom="close" aria-label="Close enlarged image" autofocus>×</button></div></div><div class="explorer-zoom-scroll" tabindex="0" aria-label="Enlarged design. Use zoom buttons and scroll to explore."><img src="${image}" alt="${escape(label)}"></div>`;
          document.body.append(dialog);
          const img = dialog.querySelector("img");
          const viewport = dialog.querySelector(".explorer-zoom-scroll");
          let zoom = 1;
          const update = () => {
            img.style.width = `${zoom * 100}%`;
            dialog.querySelector("output").textContent =
              `${Math.round(zoom * 100)}%`;
            dialog.querySelector('[data-zoom="out"]').disabled = zoom <= 1;
            dialog.querySelector('[data-zoom="in"]').disabled = zoom >= 4;
          };
          dialog.querySelectorAll("[data-zoom]").forEach(
            (button) =>
              (button.onclick = () => {
                const action = button.dataset.zoom;
                if (action === "close") return dialog.close();
                zoom =
                  action === "reset"
                    ? 1
                    : Math.max(
                        1,
                        Math.min(4, zoom + (action === "in" ? 0.5 : -0.5)),
                      );
                update();
                if (action === "reset") viewport.scrollTo(0, 0);
              }),
          );
          dialog.onclick = (event) => {
            if (event.target === dialog) dialog.close();
          };
          dialog.addEventListener("close", () => dialog.remove(), {
            once: true,
          });
          dialog.showModal();
          update();
        };

        const renderDetail = () => {
          disposePlan();
          const section = data.sections[selected];
          const views = [
            {
              id: "drawing",
              label: "Design drawing",
              image: section.drawing,
              title: `${section.title} — proposed design drawing`,
              source: `${data.sources.blocks.url}#page=${section.page}`,
              page: section.page,
              sourceTitle: data.sources.blocks.title,
            },
            {
              id: "slide",
              label: "Full project slide",
              image: section.slide,
              title: `${section.title} — full project slide`,
              source: `${data.sources.blocks.url}#page=${section.page}`,
              page: section.page,
              sourceTitle: data.sources.blocks.title,
            },
            ...section.renderings.map((id) => {
              const view = data.renderings.find((r) => r.id === id);
              return {
                ...view,
                label: view.condition,
                source: `${data.sources.renderings.url}#page=${view.page}`,
                sourceTitle: data.sources.renderings.title,
              };
            }),
          ];
          const active =
            views.find((view) => view.id === currentView) || views[0];
          currentView = active.id;
          detail.innerHTML = `<article aria-labelledby="section-title"><div class="section-detail-top"><span class="eyebrow">Section ${String(section.number).padStart(2, "0")} / 20</span><div class="section-step"><button type="button" data-step="-1" aria-label="Previous section" ${selected === 0 ? "disabled" : ""}>←</button><button type="button" data-step="1" aria-label="Next section" ${selected === data.sections.length - 1 ? "disabled" : ""}>→</button></div></div><h2 id="section-title" tabindex="-1">${escape(section.title)}</h2><p class="section-location">${escape(section.description)}</p><div class="section-compare"><section class="interactive-plan-card" aria-labelledby="interactive-plan-title"><div class="compare-card-heading"><span class="eyebrow">Explore the design</span><h3 id="interactive-plan-title">Picture this stretch of the avenue</h3></div><div class="interactive-plan"></div><p class="plan-source-note">${section.number === 12 ? "Three.js prototype: colored road features are traced from this drawing. Context footprints are interpreted; building heights and object details are illustrative. Other sections currently use the schematic street sketch." : "Street sketch is approximate: widths, buildings, and object locations are schematic. The detailed Three.js prototype is available at Harvard St to Vesta Rd (section 12)."} Clear plan and aerial context preserve the original design geometry.</p></section><section class="source-plan-card" aria-label="Original project drawing"><div class="compare-card-heading"><span class="eyebrow">Compare with the source</span><h3>The original project drawing</h3></div><div class="section-view-controls" role="group" aria-label="Project views">${views.map((view) => `<button type="button" data-project-view="${view.id}" aria-pressed="${active.id === view.id}">${escape(view.label)}</button>`).join("")}</div><figure class="section-figure"><button type="button" class="section-image-button" aria-label="Enlarge ${escape(active.title)}"><img src="${active.image}" alt="${escape(active.title)}" ${active.id === "slide" ? 'class="section-full-slide"' : ""}><span class="section-enlarge"><span aria-hidden="true">⊕</span> Enlarge & explore</span></button><figcaption><span>${escape(active.sourceTitle)} · Page ${active.page}</span><a href="${escape(active.source)}" target="_blank" rel="noopener">Open source PDF ↗</a></figcaption></figure>${section.renderings.length ? '<p class="section-rendering-note">The existing and proposed views above show the nearby named landmark; the design drawing shows this section.</p>' : '<p class="section-rendering-note">Explore the full project slide for street photos, annotations, and the drawing legend.</p>'}</section></div><div class="section-notes-heading"><h3>What’s proposed here</h3><span>From project slide ${section.page}</span></div><div class="section-topics">${section.topics.map((topic, index) => `<section class="section-topic"><div class="section-topic-icon" aria-hidden="true">${topicIcons[index]}</div><div><h4>${escape(topic.label)}</h4><p>${escape(topic.text)}</p></div></section>`).join("")}</div><div class="section-bottom-nav"><button type="button" data-step="-1" ${selected === 0 ? "disabled" : ""}>← Previous section</button><button type="button" data-step="1" ${selected === data.sections.length - 1 ? "disabled" : ""}>Next section →</button></div></article>`;
          disposePlan = mountPlanViewer(
            detail.querySelector(".interactive-plan"),
            section,
          );
          detail
            .querySelectorAll("[data-step]")
            .forEach(
              (button) =>
                (button.onclick = () =>
                  select(selected + Number(button.dataset.step))),
            );
          detail.querySelectorAll("[data-project-view]").forEach(
            (button) =>
              (button.onclick = () => {
                currentView = button.dataset.projectView;
                renderDetail();
                detail
                  .querySelector(`[data-project-view="${currentView}"]`)
                  .focus({ preventScroll: true });
              }),
          );
          detail.querySelector(".section-image-button").onclick = () =>
            openZoom(active.image, active.title, active.source);
        };

        const select = (index) => {
          if (index < 0 || index >= data.sections.length) return;
          selected = index;
          currentView = "drawing";
          renderGuide();
          renderDetail();
          detail.querySelector("h2").focus({ preventScroll: true });
          if (window.innerWidth < 800)
            detail.scrollIntoView({ block: "start" });
        };
        search.oninput = () => {
          query = search.value;
          renderGuide();
        };
        renderGuide();
        renderDetail();
        root.querySelector("#explorer-title").focus({ preventScroll: true });
      } catch (error) {
        if (!root.isConnected) return;
        root.innerHTML =
          '<div class="explorer-error"><h2>The section guide could not load.</h2><p>Your game progress is saved. You can retry or continue playing.</p><div class="button-row"><button type="button" class="secondary" data-retry>Try again</button><button type="button" class="primary" data-continue>Continue to the game</button></div></div>';
        root.querySelector("[data-retry]").onclick = () => this.mount(root);
        root.querySelector("[data-continue]").onclick = onDone;
      }
    },
  };
}
