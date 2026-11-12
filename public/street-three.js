import { northArrow } from "./north-arrow.js";
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
  const compass = document.createElement("div");
  compass.className = "north-indicator";
  compass.innerHTML = northArrow();
  root.append(compass);
  const compassNeedle = compass.querySelector("g");
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    `3D model of ${section.title}. Drag to orbit, pinch to zoom, or use camera buttons. Keyboard arrows rotate; plus and minus zoom.`,
  );
  const scale = 130 / model.width;
  const unit = model.metersPerPixel ? scale / model.metersPerPixel : 1;
  const labelTextures = [];
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
  const materialCache = new Map();
  const features = ["context", "bus", "green", "yellow", "blue", "red"];
  features.forEach((key) => {
    const group = new THREE.Group();
    group.userData.feature = key;
    groups.set(key, group);
    scene.add(group);
  });
  const material = (color, feature = "context") => {
    const key = `${feature}:${color}`;
    if (materialCache.has(key)) return materialCache.get(key);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    materialCache.set(key, mat);
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
  const polygon = (
    points,
    height,
    color,
    feature = "context",
    base = 0,
    holes = [],
  ) => {
    const shape = new THREE.Shape();
    points.forEach(([px, py], i) =>
      i ? shape.lineTo(x(px), -z(py)) : shape.moveTo(x(px), -z(py)),
    );
    shape.closePath();
    for (const ring of holes) {
      const hole = new THREE.Path();
      ring.forEach(([px, py], i) =>
        i ? hole.lineTo(x(px), -z(py)) : hole.moveTo(x(px), -z(py)),
      );
      hole.closePath();
      shape.holes.push(hole);
    }
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
  if (model.roadShapes)
    model.roadShapes.forEach((shape) =>
      polygon(shape.outer, 0.08, "#737c76", "context", 0, shape.holes),
    );
  else
    (model.roads || [model.road])
      .filter((points) => points.length)
      .forEach((points) => polygon(points, 0.08, "#737c76"));
  if (model.sidewalkShapes)
    model.sidewalkShapes.forEach((shape) =>
      polygon(
        shape.outer,
        0.23 * unit,
        "#dcd4bf",
        "context",
        0.08,
        shape.holes,
      ),
    );
  else model.sidewalks.forEach((points) => polygon(points, 0.25, "#dcd4bf"));
  if (model.carriageway.length) polygon(model.carriageway, 0.08, "#808c82");
  const featureColors = {
    bus: "#bc776d",
    green: "#4d936d",
    yellow: "#d7b829",
    blue: "#4b6db5",
    red: "#d76254",
  };
  for (const feature of model.features)
    for (const ring of feature.polygons) {
      const object = polygon(
        ring,
        feature.id === "yellow" ? 0.35 : feature.id === "green" ? 0.15 : 0.05,
        featureColors[feature.id],
        feature.id,
        0.09,
      );
      if (
        model.section === 12 &&
        feature.id === "yellow" &&
        ring.every(
          ([px, py]) => px >= 738 && px <= 916 && py >= 297 && py <= 320,
        )
      ) {
        object.material.userData.platform = true;
        object.userData.feature = "platforms";
      }
    }
  // Shared facade language across the corridor; footprints and massing vary by GIS building.
  const windows = [];
  const label = (text, px, py, elevation, kind = "landmark") => {
    const image = document.createElement("canvas");
    const context = image.getContext("2d");
    context.font = "600 30px system-ui";
    const textWidth = Math.ceil(context.measureText(text).width);
    image.width = textWidth + 32;
    image.height = 58;
    context.fillStyle = kind === "street" ? "#f7f4e8e8" : "#fdf9edf5";
    context.beginPath();
    context.roundRect(0, 0, image.width, image.height, 10);
    context.fill();
    context.fillStyle = "#254b3d";
    context.font = "600 30px system-ui";
    context.textBaseline = "middle";
    context.fillText(text, 16, 29);
    const texture = new THREE.CanvasTexture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    labelTextures.push(texture);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    materials.push(mat);
    const sprite = new THREE.Sprite(mat);
    const height = kind === "street" ? 2.0 : 2.8;
    sprite.scale.set((height * image.width) / image.height, height, 1);
    sprite.position.set(x(px), elevation, z(py));
    sprite.userData.label = text;
    groups.get("context").add(sprite);
    return sprite;
  };
  model.buildings.forEach((building, index) => {
    const residential = ["R1", "R2", "R3", "R4", "A"].includes(building.use);
    const colors = residential
      ? ["#c9bda7", "#c1c1ac", "#bdafa0", "#cbbca5"]
      : ["#b79780", "#b4ac98", "#b7b8a5"];
    const facade = colors[index % colors.length];
    polygon(building.footprint, building.height, facade, "context", 0.1);
    const roof = polygon(
      building.footprint,
      0.22 * unit,
      residential ? "#aaa99b" : "#bdb9a9",
      "context",
      building.height + 0.1,
    );
    roof.userData.name = building.name;
    // One instanced draw for all windows keeps dense neighborhood blocks responsive.
    for (let i = 0; i < building.footprint.length; i++) {
      const a = building.footprint[i],
        b = building.footprint[(i + 1) % building.footprint.length];
      const dx = x(b[0]) - x(a[0]),
        dz = z(b[1]) - z(a[1]);
      const length = Math.hypot(dx, dz);
      for (
        let distance = 1.3 * unit;
        distance < length - unit;
        distance += 2.8 * unit
      )
        for (
          let level = 2.3 * unit;
          level < building.height - 0.8 * unit;
          level += 3.1 * unit
        ) {
          const fraction = distance / length;
          windows.push({
            x: x(a[0]) + dx * fraction,
            y: level + 0.1,
            z: z(a[1]) + dz * fraction,
            angle: -Math.atan2(dz, dx),
          });
        }
    }
  });
  if (windows.length) {
    const panes = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.05 * unit, 1.25 * unit, 0.08 * unit),
      material("#607c78"),
      windows.length,
    );
    const dummy = new THREE.Object3D();
    windows.forEach((window, i) => {
      dummy.position.set(window.x, window.y, window.z);
      dummy.rotation.y = window.angle;
      dummy.updateMatrix();
      panes.setMatrixAt(i, dummy.matrix);
    });
    panes.userData.feature = "context";
    groups.get("context").add(panes);
  }
  // Landmark names are taken from the project drawings, not inferred businesses.
  (model.landmarks || []).forEach((landmark) => {
    const building = model.buildings.find((b) => b.id === landmark.buildingId);
    label(
      landmark.name,
      ...landmark.position,
      (building?.height || 0) + 3.4,
      landmark.kind,
    );
  });
  (model.streetLabels || [])
    .slice(0, 4)
    .forEach((street) => label(street.text, ...street.position, 1.4, "street"));
  root.dataset.buildings = String(model.buildings.length);
  const tree = (px, py) => {
    const trunk = mesh(
      new THREE.CylinderGeometry(0.16 * unit, 0.22 * unit, 2.7 * unit, 7),
      material("#8a755a", "green"),
      "green",
    );
    trunk.position.set(x(px), 1.6 * unit, z(py));
    const crown = mesh(
      new THREE.IcosahedronGeometry(2.15 * unit, 1),
      material("#7e9a6d", "green"),
      "green",
    );
    crown.position.set(x(px), 4.2 * unit, z(py));
  };
  [...model.trees, ...(model.contextTrees || [])].forEach((point) =>
    tree(...point),
  );
  const roadCenter = (px) => {
    const count = Math.floor(model.road.length / 2);
    const samples = model.road
      .slice(0, count)
      .map(([x, y], i) => [
        x,
        (y + model.road[model.road.length - i - 1][1]) / 2,
      ]);
    let index = samples.findIndex((point, i) => i && point[0] >= px);
    if (index < 1) index = px < samples[0][0] ? 1 : samples.length - 1;
    const a = samples[index - 1],
      b = samples[index];
    return a[1] + ((b[1] - a[1]) * (px - a[0])) / (b[0] - a[0]);
  };
  const alignVehicle = (feature, start, px, py) => {
    const group = groups.get(feature);
    const parts = group.children.slice(start);
    const vehicle = new THREE.Group();
    vehicle.userData.feature = feature;
    vehicle.position.set(x(px), 0, z(py));
    vehicle.rotation.y = -Math.atan2(
      roadCenter(px + 10) - roadCenter(px - 10),
      20,
    );
    parts.forEach((part) => {
      part.position.x -= x(px);
      part.position.z -= z(py);
      vehicle.add(part);
    });
    group.add(vehicle);
  };
  model.buses.forEach(([px, py], index) => {
    const start = groups.get("bus").children.length;
    box(
      px,
      py,
      11.8 * unit,
      2.5 * unit,
      2.7 * unit,
      "#eee4ca",
      "bus",
      0.09 + 0.35 * unit,
    );
    box(
      px,
      py,
      10.5 * unit,
      2.53 * unit,
      1 * unit,
      "#496a6d",
      "bus",
      0.09 + 1.5 * unit,
    );
    box(
      px,
      py,
      11.5 * unit,
      2.4 * unit,
      0.15 * unit,
      "#f2ebd9",
      "bus",
      0.09 + 3.05 * unit,
    );
    for (const delta of [-3.7, 3.7])
      for (const side of [-1, 1]) {
        const wheel = mesh(
          new THREE.CylinderGeometry(0.45 * unit, 0.45 * unit, 0.2 * unit, 12),
          material("#35473d", "bus"),
          "bus",
        );
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(
          x(px) + delta * unit,
          0.09 + 0.45 * unit,
          z(py) + side * 1.25 * unit,
        );
      }
    alignVehicle("bus", start, px, py);
  });
  model.cars.forEach(([px, py], index) => {
    const feature = "blue";
    const start = groups.get(feature).children.length;
    box(
      px,
      py,
      4.3 * unit,
      1.8 * unit,
      0.9 * unit,
      ["#e4dcca", "#8ca6a0", "#d5b580"][index % 3],
      feature,
      0.09 + 0.25 * unit,
    );
    box(
      px,
      py,
      2.2 * unit,
      1.6 * unit,
      0.65 * unit,
      "#526d70",
      feature,
      0.09 + 1.15 * unit,
    );
    alignVehicle(feature, start, px, py);
  });
  // Waiting passengers stand inside the long source-traced bus platform.
  // These figures provide scale and do not represent observed passenger counts.
  const passenger = (px, py, shirt, skin, withBag = false) => {
    const person = new THREE.Group();
    person.userData.feature = "platforms";
    person.userData.kind = "waiting-passenger";
    const part = (geometry, color, position) => {
      const object = mesh(geometry, material(color, "yellow"), "yellow");
      object.material.userData.platform = true;
      object.userData.feature = "platforms";
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
    person.scale.setScalar(unit);
    person.position.set(x(px), 0.46, z(py));
    groups.get("yellow").add(person);
  };
  (model.section === 12
    ? [
        [760, 310, "#b96c51", "#a76e4c", false],
        [792, 309, "#537e88", "#79523c", true],
        [825, 309, "#c3a256", "#b78260", false],
        [860, 308, "#7d7692", "#684833", true],
        [892, 308, "#6c8a69", "#ca9873", false],
      ]
    : (model.passengers || []).map(([px, py], index) => [
        px,
        py,
        ["#b96c51", "#537e88", "#c3a256"][index % 3],
        ["#a76e4c", "#79523c", "#b78260"][index % 3],
        index % 2 === 0,
      ])
  ).forEach((args) => passenger(...args));
  root.dataset.passengers = String(
    model.section === 12 ? 5 : (model.passengers || []).length,
  );
  root.dataset.modelSection = String(model.section);
  // Reuse actual road linework as paint, clipped to the traced road footprint.
  let paintTexture;
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = model.sourceSurface || section.plan.clear;
    });
    const paint = document.createElement("canvas");
    paint.width = model.width;
    paint.height = model.height;
    const context = paint.getContext("2d", { willReadFrequently: true });
    for (const shape of model.roadShapes ||
      (model.roads || [model.road]).map((outer) => ({ outer, holes: [] }))) {
      const road = shape.outer;
      context.beginPath();
      road.forEach(([px, py], index) =>
        index ? context.lineTo(px, py) : context.moveTo(px, py),
      );
      context.closePath();
      for (const ring of shape.holes) {
        ring.forEach(([px, py], index) =>
          index ? context.lineTo(px, py) : context.moveTo(px, py),
        );
        context.closePath();
      }
      context.save();
      context.clip("evenodd");
      context.drawImage(image, 0, 0);
      context.restore();
    }
    const pixels = context.getImageData(0, 0, paint.width, paint.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i],
        g = pixels.data[i + 1],
        b = pixels.data[i + 2],
        a = pixels.data[i + 3];
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
    // Source sheets run south to north from left to right (+X). Project that
    // ground direction through the current camera so orbiting stays truthful.
    const origin = controls.target.clone().project(camera);
    const north = controls.target
      .clone()
      .add(new THREE.Vector3(10, 0, 0))
      .project(camera);
    const angle =
      (Math.atan2(
        (north.x - origin.x) * canvas.clientWidth,
        (north.y - origin.y) * canvas.clientHeight,
      ) *
        180) /
      Math.PI;
    compassNeedle.setAttribute(
      "transform",
      `translate(75 34) rotate(${angle})`,
    );
    root.dataset.zoom = String(camera.zoom);
    if (!root.hidden) {
      const output = root.closest(".interactive-plan")?.querySelector("output");
      if (output) output.textContent = `${Math.round(camera.zoom * 100)}%`;
    }
  };
  const resize = () => {
    const { width, height } = root.getBoundingClientRect();
    if (!width || !height) return;
    // Fit the complete source sheet at both narrow and wide viewport ratios.
    const span = Math.max(155, ((model.height * scale + 12) * width) / height);
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
      const active =
        feature === "all" ||
        (feature === "platforms"
          ? mat.userData.platform === true
          : mat.userData.feature === feature);
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
      labelTextures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
