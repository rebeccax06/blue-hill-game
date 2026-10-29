import * as THREE from "three";
import { OrbitControls } from "/vendor/three/OrbitControls.js";

export async function mountStreetThree(root, section, onFeature) {
  root.innerHTML =
    '<p class="three-loading" role="status">Building the street model…</p>';
  const response = await fetch(`/explorer/street-${section.number}.json`);
  if (!response.ok) throw Error("Street model unavailable");
  const model = await response.json();
  if (!root.isConnected)
    return { dispose() {}, setFeature() {}, setZoom() {}, preset() {} };
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor("#e8eddf");
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const loading = root.querySelector(".three-loading");
  root.replaceChildren(renderer.domElement);
  if (loading) root.append(loading);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    `3D model of ${section.title}. Drag to orbit, pinch to zoom, or use camera buttons. Keyboard arrows rotate; plus and minus zoom.`,
  );
  const scale = 0.12;
  const x = (value) => (value - model.width / 2) * scale;
  const z = (value) => (value - model.height / 2) * scale;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#ffffff", "#8e9c7c", 1.8));
  const sun = new THREE.DirectionalLight("#fff4d8", 2);
  sun.position.set(-40, 100, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -100,
    right: 100,
    top: 90,
    bottom: -90,
    near: 1,
    far: 240,
  });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-80, 80, 60, -60, 0.1, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.minZoom = 0.5;
  controls.maxZoom = 6;
  controls.enableDamping = false;
  const groups = new Map(),
    materials = [];
  const features = ["context", "bus", "green", "yellow", "blue", "red"];
  features.forEach((key) => {
    const group = new THREE.Group();
    group.userData.feature = key;
    groups.set(key, group);
    scene.add(group);
  });
  const material = (color, feature = "context") => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    mat.userData.feature = feature;
    materials.push(mat);
    return mat;
  };
  const mesh = (geometry, mat, feature = "context") => {
    const object = new THREE.Mesh(geometry, mat);
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData.feature = feature;
    groups.get(feature).add(object);
    return object;
  };
  const polygon = (points, height, color, feature = "context", base = 0) => {
    const shape = new THREE.Shape();
    points.forEach(([px, py], i) =>
      i ? shape.lineTo(x(px), -z(py)) : shape.moveTo(x(px), -z(py)),
    );
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    const object = mesh(geometry, material(color, feature), feature);
    object.position.y = base;
    return object;
  };
  const box = (px, py, w, d, h, color, feature = "context", base = 0) => {
    const object = mesh(
      new THREE.BoxGeometry(w, h, d),
      material(color, feature),
      feature,
    );
    object.position.set(x(px), base + h / 2, z(py));
    return object;
  };
  polygon(
    [
      [0, 0],
      [model.width, 0],
      [model.width, model.height],
      [0, model.height],
    ],
    0.5,
    "#cbd5bd",
    "context",
    -0.6,
  );
  polygon(model.road, 0.08, "#737c76");
  model.sidewalks.forEach((points) => polygon(points, 0.25, "#dcd4bf"));
  polygon(model.carriageway, 0.08, "#808c82");
  const featureColors = {
    bus: "#ba7a6e",
    green: "#91ad86",
    yellow: "#d8c38a",
    blue: "#a8b9c3",
    red: "#c47062",
  };
  for (const feature of model.features)
    for (const ring of feature.polygons) {
      polygon(
        ring,
        feature.id === "yellow" ? 0.35 : feature.id === "green" ? 0.15 : 0.05,
        featureColors[feature.id],
        feature.id,
        0.09,
      );
    }
  model.buildings.forEach((building, index) => {
    polygon(
      building.footprint,
      building.height,
      ["#cab99e", "#c6c7b5", "#cbbfae"][index % 3],
    );
    // Source footprints are retained; roof heights are display assumptions.
    const roof = polygon(
      building.footprint,
      0.12,
      "#e7dfc9",
      "context",
      building.height,
    );
    roof.userData.name = building.name;
    for (let i = 0; i < building.footprint.length; i++) {
      const a = building.footprint[i],
        b = building.footprint[(i + 1) % building.footprint.length];
      const dx = x(b[0]) - x(a[0]),
        dz = z(b[1]) - z(a[1]),
        length = Math.hypot(dx, dz);
      for (let distance = 2; distance < length - 1; distance += 3.3)
        for (let level = 2.7; level < building.height - 1; level += 3) {
          const fraction = distance / length;
          const window = mesh(
            new THREE.BoxGeometry(1.15, 1.15, 0.12),
            material("#6b8781"),
          );
          window.position.set(
            x(a[0]) + dx * fraction,
            level,
            z(a[1]) + dz * fraction,
          );
          window.rotation.y = -Math.atan2(dz, dx);
        }
    }
  });
  const tree = (px, py) => {
    const trunk = mesh(
      new THREE.CylinderGeometry(0.12, 0.17, 2, 7),
      material("#8a755a", "green"),
      "green",
    );
    trunk.position.set(x(px), 1.25, z(py));
    const crown = mesh(
      new THREE.IcosahedronGeometry(1.3, 1),
      material("#7e9a6d", "green"),
      "green",
    );
    crown.position.set(x(px), 3, z(py));
  };
  model.trees.forEach((point) => tree(...point));
  model.buses.forEach(([px, py], index) => {
    box(px, py, 9.5, 2.4, 2.6, "#eee4ca", "bus", 0.3);
    box(px, py, 8.5, 2.43, 0.95, "#496a6d", "bus", 1.4);
    box(px, py, 9.1, 2.3, 0.15, "#f2ebd9", "bus", 2.95);
    for (const delta of [-3, 3])
      for (const side of [-1, 1]) {
        const wheel = mesh(
          new THREE.CylinderGeometry(0.4, 0.4, 0.2, 12),
          material("#35473d", "bus"),
          "bus",
        );
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x(px) + delta, 0.5, z(py) + side * 1.2);
      }
  });
  model.cars.forEach(([px, py], index) => {
    const feature = index < 4 ? "blue" : "context";
    box(
      px,
      py,
      3.9,
      1.6,
      0.8,
      ["#e4dcca", "#8ca6a0", "#d5b580"][index % 3],
      feature,
      0.35,
    );
    box(px, py, 2, 1.4, 0.6, "#526d70", feature, 1.15);
  });
  // Waiting passengers stand inside the long source-traced bus platform.
  // These figures provide scale and do not represent observed passenger counts.
  const passenger = (px, py, shirt, skin, withBag = false) => {
    const person = new THREE.Group();
    person.userData.feature = "yellow";
    person.userData.kind = "waiting-passenger";
    const part = (geometry, color, position) => {
      const object = mesh(geometry, material(color, "yellow"), "yellow");
      object.position.set(...position);
      person.add(object);
      return object;
    };
    for (const side of [-1, 1]) {
      part(new THREE.CylinderGeometry(0.075, 0.085, 0.7, 7), "#40524b", [
        side * 0.11,
        0.35,
        0,
      ]);
      part(new THREE.BoxGeometry(0.17, 0.1, 0.27), "#34423b", [
        side * 0.11,
        0.05,
        0.045,
      ]);
      part(new THREE.CylinderGeometry(0.065, 0.075, 0.51, 7), shirt, [
        side * 0.285,
        0.99,
        0,
      ]);
      part(new THREE.SphereGeometry(0.07, 7, 5), skin, [side * 0.285, 0.71, 0]);
    }
    part(new THREE.CylinderGeometry(0.21, 0.235, 0.57, 8), shirt, [0, 1, 0]);
    part(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 7), skin, [0, 1.33, 0]);
    part(new THREE.SphereGeometry(0.175, 10, 8), skin, [0, 1.52, 0]);
    part(
      new THREE.SphereGeometry(0.179, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.48),
      "#3c3930",
      [0, 1.56, 0],
    );
    if (withBag)
      part(
        new THREE.BoxGeometry(0.22, 0.35, 0.16),
        "#b58d61",
        [0.3, 0.64, 0.05],
      );
    person.position.set(x(px), 0.46, z(py));
    groups.get("yellow").add(person);
  };
  [
    [760, 310, "#b96c51", "#a76e4c", false],
    [792, 309, "#537e88", "#79523c", true],
    [825, 309, "#c3a256", "#b78260", false],
    [860, 308, "#7d7692", "#684833", true],
    [892, 308, "#6c8a69", "#ca9873", false],
  ].forEach((args) => passenger(...args));
  root.dataset.passengers = "5";
  // Reuse actual road linework as paint, clipped to the traced road footprint.
  let paintTexture;
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = section.plan.clear;
    });
    const paint = document.createElement("canvas");
    paint.width = model.width;
    paint.height = model.height;
    const context = paint.getContext("2d", { willReadFrequently: true });
    context.beginPath();
    model.road.forEach(([px, py], index) =>
      index ? context.lineTo(px, py) : context.moveTo(px, py),
    );
    context.closePath();
    context.clip();
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, paint.width, paint.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const [r, g, b, a] = pixels.data.slice(i, i + 4);
      pixels.data[i] = 239;
      pixels.data[i + 1] = 235;
      pixels.data[i + 2] = 216;
      pixels.data[i + 3] =
        a && Math.max(r, g, b) < 120
          ? Math.round((120 - Math.max(r, g, b)) * 2)
          : 0;
    }
    context.putImageData(pixels, 0, 0);
    paintTexture = new THREE.CanvasTexture(paint);
    paintTexture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: paintTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    materials.push(mat);
    const paintMesh = mesh(
      new THREE.PlaneGeometry(model.width * scale, model.height * scale),
      mat,
    );
    paintMesh.rotation.x = -Math.PI / 2;
    paintMesh.position.y = 0.46;
    paintMesh.castShadow = false;
  } catch {
    /* Model geometry remains usable without the paint texture. */
  }
  let dead = false;
  const render = () => {
    if (dead) return;
    renderer.render(scene, camera);
    root.dataset.zoom = String(camera.zoom);
    if (!root.hidden) {
      const output = root.closest(".interactive-plan")?.querySelector("output");
      if (output) output.textContent = `${Math.round(camera.zoom * 100)}%`;
    }
  };
  const resize = () => {
    const { width, height } = root.getBoundingClientRect();
    if (!width || !height) return;
    const span = 155;
    camera.left = -span / 2;
    camera.right = span / 2;
    camera.top = (span * height) / width / 2;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  };
  const preset = (name) => {
    camera.position.set(
      ...(name === "top"
        ? [0, 155, 0.01]
        : name === "street"
          ? [0, 18, 95]
          : [35, 90, 105]),
    );
    controls.target.set(0, 0, 0);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
    render();
    root.dataset.camera = name;
  };
  const setFeature = (feature) => {
    materials.forEach((mat) => {
      if (!mat.userData.feature) return;
      const active = feature === "all" || mat.userData.feature === feature;
      mat.transparent = !active;
      mat.opacity = active ? 1 : 0.2;
      mat.depthWrite = active;
      mat.needsUpdate = true;
    });
    root.dataset.feature = feature;
    render();
  };
  const setZoom = (value) => {
    camera.zoom = value;
    camera.updateProjectionMatrix();
    controls.update();
    render();
  };
  const raycaster = new THREE.Raycaster();
  let start;
  canvas.addEventListener("pointerdown", (event) => {
    start = [event.clientX, event.clientY];
  });
  canvas.addEventListener("pointerup", (event) => {
    if (
      !start ||
      Math.hypot(start[0] - event.clientX, start[1] - event.clientY) > 5
    )
      return;
    const bounds = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster
      .intersectObjects(scene.children, true)
      .find(
        (hit) =>
          hit.object.userData.feature &&
          hit.object.userData.feature !== "context",
      );
    if (hit) onFeature(hit.object.userData.feature);
  });
  canvas.onkeydown = (event) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "-",
        "0",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    if (event.key === "0") return preset("overview");
    if (event.key === "+" || event.key === "-")
      return setZoom(
        Math.max(
          0.5,
          Math.min(6, camera.zoom * (event.key === "+" ? 1.2 : 0.8)),
        ),
      );
    const offset = camera.position.clone().sub(controls.target);
    if (event.key === "ArrowLeft" || event.key === "ArrowRight")
      offset.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        event.key === "ArrowLeft" ? 0.12 : -0.12,
      );
    else offset.y = Math.max(5, offset.y + (event.key === "ArrowUp" ? 7 : -7));
    camera.position.copy(controls.target).add(offset);
    controls.update();
    render();
  };
  controls.addEventListener("change", render);
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  preset("overview");
  resize();
  root.querySelector(".three-loading")?.remove();
  root.dataset.ready = "true";
  canvas.dataset.ready = "true";
  root.dataset.engine = "three";
  return {
    setFeature,
    setZoom,
    preset,
    dispose() {
      dead = true;
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => object.geometry?.dispose());
      materials.forEach((mat) => mat.dispose());
      paintTexture?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
