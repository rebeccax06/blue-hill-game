const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Lane counts and west-side cycling treatments interpreted from slides 1–20.
// Transitional/rush-hour lane arrangements are explained in the original notes.
const layouts = [
  [2, 2, "none"],
  [2, 2, "none"],
  [2, 2, "bike"],
  [2, 1, "bike"],
  [1, 1, "bike"],
  [2, 1, "bike"],
  [2, 2, "bike"],
  [1, 1, "bike"],
  [1, 1, "bike"],
  [1, 1, "bike"],
  [2, 2, "bike"],
  [2, 2, "bike"],
  [2, 2, "bike"],
  [2, 2, "shared"],
  [2, 2, "shared"],
  [2, 2, "park"],
  [3, 2, "shared"],
  [1, 2, "none"],
  [1, 1, "none"],
  [2, 2, "none"],
];
export function sectionIllustrationProfile(section) {
  const row = layouts[section.number - 1];
  if (!row) throw Error("Unknown section");
  const parking = section.topics.find((t) => t.label === "Parking")?.text || "";
  return {
    northbound: row[0],
    southbound: row[1],
    cycling: row[2],
    westParking: true,
    eastParking: section.number !== 11,
    hasAdded: /increase|new parking spaces|spaces.*added|spaces.*created/i.test(
      parking,
    ),
    hasRemoved: /decrease|remov/i.test(parking),
    carriageway: section.number === 12,
    median: [8, 9, 12, 13, 19].includes(section.number),
    park: [10, 11, 13, 14, 15, 16, 17].includes(section.number),
    station: [1, 2, 3, 4, 5, 6, 7, 10, 12, 13, 15, 16, 18, 19].includes(
      section.number,
    ),
    parkingNote: parking,
    trafficNote: section.topics[0].text,
  };
}

export function sectionIllustration(section, highlight = "all") {
  const f = sectionIllustrationProfile(section);
  const P = (x, y, z = 0) => [
    450 + x * 4.4 + (y + 72.5) * 2,
    345 + (y + 72.5) * 0.9 - x * 1.15 - z,
  ];
  const poly = (points, fill, extra = "") =>
    `<polygon points="${points.map((p) => P(...p).join(",")).join(" ")}" fill="${fill}" ${extra}/>`;
  const line = (points, color, width = 1, extra = "") =>
    `<polyline points="${points.map((p) => P(...p).join(",")).join(" ")}" stroke="${color}" stroke-width="${width}" fill="none" ${extra}/>`;
  const group = (feature, art) =>
    `<g data-illustrated-feature="${feature}" opacity="${highlight === "all" || highlight === feature ? 1 : 0.16}">${art}</g>`;
  const box = (x, y, w, d, h, color, roof = "#e9dfca") =>
    poly(
      [
        [x, y],
        [x + w, y],
        [x + w, y + d],
        [x, y + d],
      ],
      "#344a39",
      'opacity=".12"',
    ) +
    poly(
      [
        [x, y],
        [x, y + d],
        [x, y + d, h],
        [x, y, h],
      ],
      color,
    ) +
    poly(
      [
        [x, y + d],
        [x + w, y + d],
        [x + w, y + d, h],
        [x, y + d, h],
      ],
      "#b9ab91",
    ) +
    poly(
      [
        [x, y, h],
        [x + w, y, h],
        [x + w, y + d, h],
        [x, y + d, h],
      ],
      roof,
    );
  const text = (x, y, value, size = 10, color = "#f5f2e4") => {
    const p = P(x, y, 0.5);
    return `<text transform="matrix(4.4 -1.15 2 .9 ${p.join(" ")})" fill="${color}" font-family="sans-serif" font-weight="700" text-anchor="middle" font-size="${size / 4}">${esc(value)}</text>`;
  };
  const tree = (x, y) => {
    const [px, py] = P(x, y);
    return `<ellipse cx="${px + 5}" cy="${py + 2}" rx="13" ry="5" fill="#526f49" opacity=".13"/><path d="M${px} ${py}v-24" stroke="#8b7757" stroke-width="3"/><circle cx="${px}" cy="${py - 32}" r="13" fill="#668c66"/><circle cx="${px - 4}" cy="${py - 36}" r="9" fill="#8aa77c"/>`;
  };
  const car = (cx, y, color = "#dee2d8") =>
    box(cx - 2.2, y, 4.4, 14, 5, color, color) +
    poly(
      [
        [cx - 1.8, y + 3, 5.1],
        [cx + 1.8, y + 3, 5.1],
        [cx + 1.8, y + 5, 5.1],
        [cx - 1.8, y + 5, 5.1],
      ],
      "#3f5b5d",
    ) +
    poly(
      [
        [cx - 1.8, y + 10, 5.1],
        [cx + 1.8, y + 10, 5.1],
        [cx + 1.8, y + 12, 5.1],
        [cx - 1.8, y + 12, 5.1],
      ],
      "#3f5b5d",
    );
  const bus = (cx, y) => {
    let result = box(cx - 3.4, y, 6.8, 33, 13, "#eee8d2", "#f7f4e7");
    result += poly(
      [
        [cx - 3.5, y + 1, 5],
        [cx - 3.5, y + 31, 5],
        [cx - 3.5, y + 31, 10],
        [cx - 3.5, y + 1, 10],
      ],
      "#486669",
    );
    for (let t = 3; t < 30; t += 4)
      result += line(
        [
          [cx - 3.55, y + t, 5],
          [cx - 3.55, y + t, 10],
        ],
        "#eee7d4",
        1.2,
      );
    result += poly(
      [
        [cx - 3.3, y + 33, 5],
        [cx + 3.3, y + 33, 5],
        [cx + 3.3, y + 33, 10],
        [cx - 3.3, y + 33, 10],
      ],
      "#486669",
    );
    result += poly(
      [
        [cx - 2, y + 9, 13.1],
        [cx + 2, y + 9, 13.1],
        [cx + 2, y + 19, 13.1],
        [cx - 2, y + 19, 13.1],
      ],
      "#c5ccbc",
    );
    return result;
  };
  const definitions = [
    ["Walk", 9, "context"],
    ...(f.cycling === "bike" || f.cycling === "shared"
      ? [["Bike", 6, "green"]]
      : []),
    ["Curb", 7, "blue"],
    ...Array.from({ length: f.southbound }, () => ["Traffic", 7, "context"]),
    ["Bus", 9, "bus"],
    ["Median", f.median ? 5 : 2, "green"],
    ["Bus", 9, "bus"],
    ...Array.from({ length: f.northbound }, () => ["Traffic", 7, "context"]),
    ...(f.eastParking ? [["Curb", 7, "blue"]] : []),
    ["Walk", 9, "context"],
  ];
  const total = definitions.reduce((n, l) => n + l[1], 0),
    lanes = [];
  let edge = -48;
  for (const [label, width, feature] of definitions) {
    const w = (width / total) * 96;
    lanes.push({ label, start: edge, width: w, center: edge + w / 2, feature });
    edge += w;
  }
  const get = (label) => lanes.filter((l) => l.label === label);
  const colors = {
    Walk: "#dfd2b9",
    Bike: "#78a890",
    Curb: "#b4bec5",
    Traffic: "#737e7b",
    Bus: "#b8755f",
    Median: f.median ? "#a2b48f" : "#ded9c6",
  };
  const objects = [];
  const place = (x, y, feature, art) =>
    objects.push({ depth: P(x, y)[1], art: group(feature, art) });
  let ground = poly(
    [
      [-84, -180],
      [84, -180],
      [84, 35],
      [-84, 35],
    ],
    "#d9e0ce",
  );
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const x = side < 0 ? -78 : 57,
        y = -174 + i * 51;
      if (f.park && side < 0) {
        ground += poly(
          [
            [x, y],
            [x + 23, y],
            [x + 23, y + 43],
            [x, y + 43],
          ],
          "#c1d0af",
        );
        place(x + 10, y + 20, "green", tree(x + 10, y + 20));
        continue;
      }
      let building = box(x, y, 21, 38, 30 + (i % 2) * 10, "#cab99e");
      for (let j = 0; j < 3; j++)
        building += poly(
          [
            [x + 3 + j * 6, y + 38, 11],
            [x + 5 + j * 6, y + 38, 11],
            [x + 5 + j * 6, y + 38, 19],
            [x + 3 + j * 6, y + 38, 19],
          ],
          "#7b8d82",
        );
      ground += building;
    }
  let parts = group("context", ground);
  for (const l of lanes) {
    let surface = poly(
      [
        [l.start, -180],
        [l.start + l.width, -180],
        [l.start + l.width, 35],
        [l.start, 35],
      ],
      colors[l.label],
    );
    surface += line(
      [
        [l.start, -180],
        [l.start, 35],
      ],
      "#f4f0e4",
      0.7,
    );
    if (l.label === "Traffic")
      for (let y = -168; y < 30; y += 27)
        surface += line(
          [
            [l.center, y],
            [l.center, y + 11],
          ],
          "#e4e1d2",
          1.2,
        );
    if (l.label === "Bus")
      for (const y of [-160, 12]) surface += text(l.center, y, "BUS", 12);
    if (l.label === "Bike")
      for (const y of [-145, -35, 15])
        surface += text(l.center, y, f.cycling === "shared" ? "↔" : "↟", 14);
    parts += group(l.feature, surface);
    if (l.label === "Traffic")
      place(
        l.center,
        -130 + (lanes.indexOf(l) % 3) * 43,
        "context",
        car(l.center, -130 + (lanes.indexOf(l) % 3) * 43, "#b7c7c1"),
      );
  }
  let crossing = "";
  for (let x = -47; x < 47; x += 7)
    crossing += poly(
      [
        [x, -83],
        [x + 4, -83],
        [x + 4, -75],
        [x, -75],
      ],
      "#f3efdf",
    );
  parts += group("yellow", crossing);
  for (const [side, l] of get("Curb").entries())
    for (const [i, y] of [-155, -118, -50, 0].entries()) {
      const added = f.hasAdded && i === 3,
        feature = added ? "green" : "blue";
      parts += group(
        feature,
        poly(
          [
            [l.start + 0.4, y],
            [l.start + l.width - 0.4, y],
            [l.start + l.width - 0.4, y + 22],
            [l.start + 0.4, y + 22],
          ],
          added ? "#8bac8a" : "#c2cdd1",
        ) +
          line(
            [
              [l.start + 0.4, y],
              [l.start + l.width - 0.4, y],
              [l.start + l.width - 0.4, y + 22],
              [l.start + 0.4, y + 22],
              [l.start + 0.4, y],
            ],
            "#f5f0df",
            1,
          ),
      );
      place(
        l.center,
        y + 12,
        feature,
        car(l.center, y + 4, side % 2 ? "#789799" : "#e9e4d7"),
      );
    }
  for (const [i, l] of get("Walk").entries())
    for (let j = 0; j < 4; j++) {
      const y = -158 + j * 52;
      place(l.center, y, "green", tree(l.center, y));
      const [px, py] = P(l.center + (i ? -2 : 2), y + 14);
      place(
        l.center,
        y + 14,
        "context",
        `<path d="m${px - 1} ${py} 1-6m2 6-1-6" stroke="#394e48" stroke-width="1.5"/><path d="M${px} ${py - 6}v-5" stroke="#bc7158" stroke-width="3"/><circle cx="${px}" cy="${py - 14}" r="2.3" fill="#a66e4e"/>`,
      );
    }
  for (const [i, l] of get("Bus").entries())
    place(l.center, -143 + i * 105, "bus", bus(l.center, -143 + i * 105));
  if (f.median)
    for (const y of [-150, -15])
      place(
        get("Median")[0].center,
        y,
        "green",
        tree(get("Median")[0].center, y),
      );
  if (f.station) {
    const l = get("Median")[0];
    parts += group(
      "yellow",
      poly(
        [
          [l.start - 0.5, -65],
          [l.start + l.width + 0.5, -65],
          [l.start + l.width + 0.5, -20],
          [l.start - 0.5, -20],
        ],
        "#e3cc80",
      ),
    );
    place(
      l.center,
      -40,
      "yellow",
      box(l.center - 0.3, -59, 0.6, 1.2, 17, "#789084") +
        box(l.center - 0.3, -33, 0.6, 1.2, 17, "#789084") +
        poly(
          [
            [l.start - 1, -61, 17],
            [l.start + l.width + 1, -61, 17],
            [l.start + l.width + 1, -30, 17],
            [l.start - 1, -30, 17],
          ],
          "#c4d0ba",
        ),
    );
  }
  if (f.carriageway) {
    const curb = get("Curb").at(-1);
    parts += group(
      "green",
      line(
        [
          [curb.start - 1, -143],
          [curb.start - 1, -100],
          [curb.start - 1, -30],
        ],
        "#e9d27e",
        2,
      ),
    );
  }
  parts += objects
    .sort((a, b) => a.depth - b.depth)
    .map((o) => o.art)
    .join("");
  const callout = (label, detail, lane, y, x, top, feature) => {
    const [px, py] = P(lane.center, y);
    return group(
      feature,
      `<path d="M${x + 12} ${top + 43}V${py - 12}L${px} ${py}" fill="none" stroke="#526e60" stroke-width="1.1"/><circle cx="${px}" cy="${py}" r="3.5" fill="#f7f5ed" stroke="#526e60"/><rect x="${x}" y="${top}" width="250" height="43" rx="6" fill="#f8f7ef" stroke="#d3ddcd"/><text x="${x + 12}" y="${top + 17}" font-family="sans-serif" font-weight="700" font-size="12" fill="#294b3e">${esc(label)}</text><text x="${x + 12}" y="${top + 32}" font-family="sans-serif" font-size="10" fill="#65786a">${esc(detail)}</text>`,
    );
  };
  parts += callout(
    "Center-running buses",
    "Dedicated bus space",
    get("Bus")[0],
    -48,
    28,
    65,
    "bus",
  );
  const label =
    f.cycling === "bike"
      ? "West-side bike path"
      : f.cycling === "shared"
        ? "Shared walking & biking path"
        : f.cycling === "park"
          ? "Bike connections through the park"
          : "No bike lane in this section";
  parts += callout(
    label,
    f.carriageway
      ? "Happy Supermarket access lane"
      : f.median
        ? "Tree-planted median retained"
        : "See the plan for local access details",
    get("Bike")[0] || get("Walk")[0],
    -10,
    620,
    65,
    "green",
  );
  if (highlight === "red")
    parts += `<rect x="220" y="475" width="460" height="46" rx="8" fill="#fff6f0" stroke="#d76254"/><text x="450" y="494" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="12" fill="#a34d40">${f.hasRemoved ? "Parking losses are described on this slide." : "No parking removal is described on this slide."}</text><text x="450" y="510" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#785f50">Use the source drawing for the affected locations.</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 580" role="img" aria-label="${esc(section.title)} — schematic perspective based on project slide ${section.page}"><defs><pattern id="section-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#85947c" opacity=".12"/></pattern></defs><rect width="900" height="580" fill="#e8eddf"/><rect width="900" height="580" fill="url(#section-dots)"/>${parts}<text x="28" y="30" font-family="sans-serif" font-size="11" letter-spacing="1.4" fill="#294b3e">PROJECT SLIDE ${section.page} · ILLUSTRATED PERSPECTIVE</text><text x="28" y="555" font-family="sans-serif" font-size="10" fill="#65786a">SCHEMATIC · WIDTHS, BUILDINGS &amp; FEATURE LOCATIONS ARE ILLUSTRATIVE</text></svg>`;
}
