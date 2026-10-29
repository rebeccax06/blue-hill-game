import { sectionIllustration } from "./section-illustration.js";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function mountPlanViewer(root, section) {
  const plan = section.plan;
  if (!plan) return () => {};
  const hasModel = section.number === 12;
  root.innerHTML = `<div class="plan-toolbar"><div role="group" aria-label="Street visualization">${hasModel ? '<button type="button" data-plan-style="three" aria-pressed="true">3D street</button>' : ""}<button type="button" data-plan-style="illustrated" aria-pressed="${!hasModel}">Street sketch</button><button type="button" data-plan-style="clear" aria-pressed="false">Clear plan</button><button type="button" data-plan-style="original" aria-pressed="false">Aerial context</button></div><div class="plan-zoom-controls"><button type="button" data-plan-zoom="out" aria-label="Zoom plan out">−</button><output aria-live="polite">100%</output><button type="button" data-plan-zoom="in" aria-label="Zoom plan in">+</button><button type="button" data-plan-zoom="fit">Fit</button></div></div><div class="three-camera-controls" ${hasModel ? "" : "hidden"} role="group" aria-label="3D camera"><button type="button" data-three-camera="overview" aria-pressed="true">Overview</button><button type="button" data-three-camera="street" aria-pressed="false">Street level</button><button type="button" data-three-camera="top" aria-pressed="false">Top view</button><span>Drag to orbit · pinch to zoom</span></div><div class="three-street-view" ${hasModel ? "" : "hidden"}></div><div class="plan-canvas-wrap" ${hasModel ? "hidden" : ""}><canvas tabindex="0" role="img" aria-label="Interactive design drawing for ${escape(section.title)}. Drag to pan, use plus and minus to zoom, or arrow keys to pan."></canvas><span class="plan-gesture-hint">Drag to pan · + / − to zoom</span><p class="plan-loading" role="status">Loading the complete drawing…</p></div><div class="plan-layer-buttons" role="group" aria-label="Highlight features in the drawing"><button type="button" data-plan-layer="all" aria-pressed="true">All features</button>${plan.layers.map((layer) => `<button type="button" data-plan-layer="${layer.id}" aria-pressed="false"><i style="background:${layer.color}"></i>${escape(layer.label)}</button>`).join("")}</div><p class="plan-layer-description" aria-live="polite">Choose a color to highlight its markings in the original geometry. Click a colored marking for its key.</p>`;
  const canvas = root.querySelector("canvas"),
    ctx = canvas.getContext("2d");
  let dead = false,
    style = hasModel ? "three" : "illustrated",
    layer = "all",
    zoom = 1,
    panX = 0,
    panY = 0,
    width = 1,
    height = 1;
  const images = {},
    masks = {};
  let illustrationVersion = 0;
  let threeViewer = null;
  const pointers = new Map();
  let dragOrigin = null,
    initialDistance = 0,
    initialZoom = 1,
    travel = 0;
  const description = root.querySelector(".plan-layer-description");
  const load = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(Error("Drawing failed to load"));
      image.src = src;
    });
  const dimensions = () =>
    style === "illustrated" ? { width: 900, height: 580 } : plan;
  const transform = () => {
    const size = dimensions();
    const fit = Math.min(width / size.width, height / size.height) * 0.94;
    const scale = fit * zoom;
    return {
      scale,
      x: (width - size.width * scale) / 2 + panX,
      y: (height - size.height * scale) / 2 + panY,
    };
  };
  const draw = () => {
    if (dead || style === "three") return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f9faf5";
    ctx.fillRect(0, 0, width, height);
    if (!images[style]) return;
    const t = transform(),
      size = dimensions();
    ctx.globalAlpha = style === "illustrated" || layer === "all" ? 1 : 0.2;
    ctx.drawImage(
      images[style],
      t.x,
      t.y,
      size.width * t.scale,
      size.height * t.scale,
    );
    ctx.globalAlpha = 1;
    if (style !== "illustrated" && layer !== "all" && images[layer])
      ctx.drawImage(
        images[layer],
        t.x,
        t.y,
        size.width * t.scale,
        size.height * t.scale,
      );
  };
  const refreshIllustration = async () => {
    const version = ++illustrationVersion;
    const image = await load(
      "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(sectionIllustration(section, layer)),
    );
    if (dead || version !== illustrationVersion) return;
    images.illustrated = image;
    draw();
  };
  const changeZoom = (value) => {
    const next = Math.max(1, Math.min(6, value)),
      ratio = next / zoom;
    panX *= ratio;
    panY *= ratio;
    zoom = next;
    if (zoom === 1) {
      panX = 0;
      panY = 0;
    }
    root.querySelector("output").textContent = `${Math.round(zoom * 100)}%`;
    root.querySelector('[data-plan-zoom="out"]').disabled = zoom <= 1;
    root.querySelector('[data-plan-zoom="in"]').disabled = zoom >= 6;
    if (style === "three") threeViewer?.setZoom(zoom);
    draw();
  };
  const setLayer = (id) => {
    layer = id;
    root
      .querySelectorAll("[data-plan-layer]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.planLayer === id),
        ),
      );
    const item = plan.layers.find((l) => l.id === id);
    description.textContent = item
      ? `${item.label}. Highlighted from the source drawing’s colors. ${item.pixels < 10 ? "This color is not visibly marked in this section. " : ""}${id === "green" ? "Green is used for bike space, trees, and added parking; use the original legend to distinguish them." : id === "yellow" ? "Yellow is used for bus platforms and intersection daylighting; use the original legend to distinguish them." : "The complete drawing and source slide show the detailed annotations."}`
      : "Choose a color to highlight its markings in the original geometry. Click a colored marking for its key.";
    if (style === "three") {
      threeViewer?.setFeature(layer);
      description.textContent =
        layer === "all"
          ? "Happy Supermarket 3D prototype. Colored street boundaries follow the source drawing; context footprints are interpreted and heights are illustrative. Select a feature to highlight its model geometry."
          : `${item.label} highlighted in the 3D model. Source color groups may combine multiple kinds of features; compare with the original drawing.`;
    }
    if (style === "illustrated") {
      description.textContent =
        layer === "all"
          ? "An illustrated interpretation of this section’s slide notes. Use the feature toggles to focus on bus space, bike space, trees, platforms, or parking. Exact geometry and restrictions are in the source drawing."
          : layer === "red"
            ? "The illustration does not guess where parking is removed. The source drawing shows the affected locations."
            : `${item.label} highlighted. Placement and dimensions are illustrative; compare with the source drawing for exact locations.`;
    }
    if (style === "illustrated") refreshIllustration();
    canvas.setAttribute(
      "aria-label",
      `${style === "illustrated" ? "Schematic street perspective" : "Source design drawing"} for ${section.title}. Drag to pan; use plus and minus to zoom.`,
    );
    draw();
  };
  root
    .querySelectorAll("[data-plan-layer]")
    .forEach(
      (button) => (button.onclick = () => setLayer(button.dataset.planLayer)),
    );
  root.querySelectorAll("[data-plan-style]").forEach(
    (button) =>
      (button.onclick = () => {
        style = button.dataset.planStyle;
        panX = 0;
        panY = 0;
        root.querySelector(".three-street-view").hidden = style !== "three";
        root.querySelector(".three-camera-controls").hidden = style !== "three";
        root.querySelector(".plan-canvas-wrap").hidden = style === "three";
        root
          .querySelectorAll("[data-plan-style]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        setLayer(layer);
        changeZoom(1);
      }),
  );
  root.querySelectorAll("[data-three-camera]").forEach(
    (button) =>
      (button.onclick = () => {
        threeViewer?.preset(button.dataset.threeCamera);
        root
          .querySelectorAll("[data-three-camera]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        changeZoom(1);
      }),
  );
  root
    .querySelectorAll("[data-plan-zoom]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          changeZoom(
            button.dataset.planZoom === "fit"
              ? 1
              : (style === "three"
                  ? Number(
                      root.querySelector(".three-street-view").dataset.zoom,
                    ) || zoom
                  : zoom) + (button.dataset.planZoom === "in" ? 0.5 : -0.5),
          )),
    );
  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const distance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  canvas.onpointerdown = (event) => {
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    travel = 0;
    if (pointers.size === 1)
      dragOrigin = { x: event.clientX, y: event.clientY, panX, panY };
    else if (pointers.size === 2) {
      initialDistance = distance();
      initialZoom = zoom;
    }
  };
  canvas.onpointermove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    const old = pointers.get(event.pointerId);
    travel += Math.hypot(event.clientX - old.x, event.clientY - old.y);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      changeZoom((initialZoom * distance()) / Math.max(1, initialDistance));
      return;
    }
    if (dragOrigin) {
      panX = dragOrigin.panX + event.clientX - dragOrigin.x;
      panY = dragOrigin.panY + event.clientY - dragOrigin.y;
      draw();
    }
  };
  canvas.onpointerup = (event) => {
    if (style !== "illustrated" && travel < 5 && pointers.size === 1) {
      const t = transform(),
        bounds = canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - bounds.left - t.x) / t.scale),
        y = Math.floor((event.clientY - bounds.top - t.y) / t.scale);
      if (x >= 0 && y >= 0 && x < plan.width && y < plan.height) {
        const hit = plan.layers.find(
          (item) => masks[item.id]?.[(y * plan.width + x) * 4 + 3] > 0,
        );
        if (hit) setLayer(hit.id);
      }
    }
    pointers.delete(event.pointerId);
    dragOrigin = null;
  };
  canvas.onpointercancel = (event) => {
    pointers.delete(event.pointerId);
    dragOrigin = null;
  };
  canvas.onwheel = (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      changeZoom(zoom * (event.deltaY < 0 ? 1.15 : 0.87));
    }
  };
  canvas.onkeydown = (event) => {
    if (
      ![
        "+",
        "=",
        "-",
        "0",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    if (["+", "=", "-", "0"].includes(event.key))
      changeZoom(
        event.key === "0" ? 1 : zoom + (event.key === "-" ? -0.5 : 0.5),
      );
    else {
      panX +=
        event.key === "ArrowLeft" ? 30 : event.key === "ArrowRight" ? -30 : 0;
      panY +=
        event.key === "ArrowUp" ? 30 : event.key === "ArrowDown" ? -30 : 0;
      draw();
    }
  };
  Promise.all(
    [
      [
        "illustrated",
        "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(sectionIllustration(section)),
      ],
      ["clear", plan.clear],
      ["original", plan.original],
      ...plan.layers.map((l) => [l.id, l.image]),
    ].map(async ([key, src]) => {
      const image = await load(src);
      if (dead) return;
      images[key] = image;
      if (plan.layers.some((l) => l.id === key)) {
        const mask = document.createElement("canvas");
        mask.width = plan.width;
        mask.height = plan.height;
        const context = mask.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        masks[key] = context.getImageData(0, 0, plan.width, plan.height).data;
      }
    }),
  )
    .then(() => {
      if (dead) return;
      root.querySelector(".plan-loading").remove();
      canvas.dataset.ready = "true";
      draw();
    })
    .catch(() => {
      if (dead) return;
      root.querySelector(".plan-loading").textContent =
        "The interactive plan could not load. The original drawing is available alongside.";
    });
  if (hasModel)
    import("./street-three.js")
      .then((module) =>
        module.mountStreetThree(
          root.querySelector(".three-street-view"),
          section,
          setLayer,
        ),
      )
      .then((viewer) => {
        if (dead) {
          viewer.dispose();
          return;
        }
        threeViewer = viewer;
        viewer.setFeature(layer);
        viewer.setZoom(zoom);
      })
      .catch(() => {
        if (dead) return;
        root.querySelector(".three-street-view").innerHTML =
          '<p class="three-loading">The 3D view could not start. Use Street sketch or Clear plan to explore this section.</p>';
        root.querySelector(".three-street-view").dataset.error = "true";
      });
  resize();
  changeZoom(1);
  setLayer("all");
  return () => {
    dead = true;
    observer.disconnect();
    pointers.clear();
    threeViewer?.dispose();
  };
}
