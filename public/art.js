export function portrait(index = 0, large = false) {
  const skins = [
    "#905b40",
    "#704332",
    "#bf865f",
    "#9a624b",
    "#82533f",
    "#694938",
    "#a66c4b",
    "#855139",
    "#bc8b6e",
    "#b88362",
    "#c59c80",
    "#9d6447",
    "#b78b6c",
    "#704936",
  ];
  const shirts = [
    "#eaa951",
    "#528779",
    "#c7654d",
    "#7788a6",
    "#b47796",
    "#cbaa78",
    "#668c7b",
    "#75879b",
  ];
  const skin = skins[index % skins.length],
    shirt = shirts[index % shirts.length],
    old = [4, 5, 10].includes(index),
    woman = [1, 2, 3, 4, 6, 8, 11, 13].includes(index);
  return `<svg viewBox="0 0 200 200" role="img" aria-label="Illustrated character portrait" class="portrait ${large ? "large" : ""}"><defs><clipPath id="p${index}"><rect width="200" height="200" rx="20"/></clipPath></defs><g clip-path="url(#p${index})"><path fill="${["#e3e9da", "#e9dfce", "#ead9cc", "#dfe6e8"][index % 4]}" d="M0 0h200v200H0z"/><circle cx="160" cy="48" r="55" fill="#fff" opacity=".28"/><path d="M10 200q0-58 58-65h64q57 6 58 65" fill="${shirt}"/><path d="M79 116v28q21 18 42 0v-28" fill="${skin}"/><path d="M${woman ? "48 104Q35 19 97 20q68-1 56 99l-12 38-87-2" : "52 79Q46 22 100 23q58 1 49 62"}" fill="${old ? "#c9c5b8" : "#34302c"}"/><ellipse cx="100" cy="86" rx="44" ry="53" fill="${skin}"/><path d="M54 72q-3-48 44-49 43-1 50 46-28-4-43-24-19 25-51 27" fill="${old ? "#c9c5b8" : "#34302c"}"/><path d="M70 80q8-5 15 0m30 0q8-5 15 0" stroke="#3d302b" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="79" cy="87" r="2.5" fill="#2b2c27"/><circle cx="121" cy="87" r="2.5" fill="#2b2c27"/><path d="m100 86-4 16h7m-16 12q14 10 27-1" stroke="#563c31" fill="none" stroke-width="2.3" stroke-linecap="round"/>${old ? '<g stroke="#4c514b" fill="none" stroke-width="3"><rect x="63" y="78" width="30" height="20" rx="7"/><rect x="108" y="78" width="30" height="20" rx="7"/><path d="M93 85h15"/></g>' : ""}<path d="m76 146 24 22 24-22m-24 22v33" stroke="#fff" opacity=".35" fill="none" stroke-width="3"/>${index === 0 ? '<path d="M46 148q-9 19-9 52m116-52q9 19 9 52" stroke="#343e39" stroke-width="13"/>' : ""}${index === 3 ? '<rect x="126" y="164" width="19" height="26" rx="3" fill="#eee9db"/><path d="M130 174h11m-6-5v10" stroke="#9a624b" stroke-width="3"/>' : ""}</g></svg>`;
}

// Relative drawing units show the tradeoff in a fixed amount of street space.
// These are illustrative allocations, not proposed lane counts or dimensions.
const colors = {
  Walk: "#dfd2b9",
  Bike: "#78a890",
  Curb: "#b4bec5",
  Traffic: "#737e7b",
  Bus: "#b8755f",
  "Traffic + bus": "#737e7b",
};
export const streetDesigns = {
  A: {
    title: "Targeted improvements",
    focus: "Familiar traffic, parking and access",
    tradeoff: "Buses still share congested traffic.",
    details: [
      "Shared bus and traffic space",
      "Most parking and curb access retained",
      "Targeted crossing and sidewalk upgrades",
    ],
    lanes: [
      ["Walk", 10],
      ["Curb", 10],
      ["Traffic + bus", 28],
      ["Traffic + bus", 28],
      ["Curb", 10],
      ["Walk", 10],
    ],
  },
  B: {
    title: "Transit-first transformation",
    focus: "More room for transit, biking and public space",
    tradeoff: "Less room for some traffic, parking and loading.",
    details: [
      "Dedicated center bus space",
      "More room for biking, trees and gathering",
      "More limited parking and stopping space",
    ],
    lanes: [
      ["Walk", 10],
      ["Bike", 6],
      ["Curb", 5],
      ["Traffic", 12],
      ["Bus", 15],
      ["Bus", 15],
      ["Traffic", 12],
      ["Curb", 5],
      ["Bike", 6],
      ["Walk", 10],
    ],
  },
  C: {
    title: "Transit with greater local access",
    focus: "More room for parking, loading and local traffic",
    tradeoff:
      "Keeping more access limits transit and public-space improvements.",
    details: [
      "Dedicated center bus space remains",
      "More parking, loading and pickup space",
      "Less room for biking and public space than B",
    ],
    lanes: [
      ["Walk", 8],
      ["Bike", 3],
      ["Curb", 10],
      ["Traffic", 14],
      ["Bus", 13],
      ["Bus", 13],
      ["Traffic", 14],
      ["Curb", 10],
      ["Bike", 3],
      ["Walk", 8],
    ],
  },
};
export function street(
  option = "A",
  amendments = [],
  view = "perspective",
  { before = false } = {},
) {
  const design = streetDesigns[option] || streetDesigns.A,
    bus = option !== "A",
    green = option === "B";
  const P = (x, y, z = 0) =>
    view === "plan"
      ? [450 + x * 5, 85 + (y + 180) * 2]
      : [450 + x * 4.4 + (y + 72.5) * 2, 345 + (y + 72.5) * 0.9 - x * 1.15 - z];
  const poly = (points, fill, extra = "") =>
    `<polygon points="${points.map((p) => P(...p).join(",")).join(" ")}" fill="${fill}" ${extra}/>`;
  const box = (x, y, w, d, h, color, roof = "#e9dfca") =>
    poly(
      [
        [x - 0.5, y],
        [x + w + 0.5, y],
        [x + w + 0.5, y + d + 1],
        [x - 0.5, y + d + 1],
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
  const line = (points, color, width = 1, extra = "") =>
    `<polyline points="${points.map((p) => P(...p).join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
  const worldText = (x, y, text, size = 10, color = "#f6f4e9") => {
    const p = P(x, y, 0.3),
      xx = view === "plan" ? [5, 0] : [4.4, -1.15],
      yy = view === "plan" ? [0, 2] : [2, 0.9];
    return `<text transform="matrix(${xx[0]} ${xx[1]} ${yy[0]} ${yy[1]} ${p[0]} ${p[1]})" font-family="sans-serif" font-weight="700" font-size="${size / 4}" text-anchor="middle" fill="${color}" pointer-events="none">${text}</text>`;
  };
  const tree = (x, y) => {
    const [px, py] = P(x, y);
    return `<g class="street-tree" pointer-events="none"><ellipse cx="${px + 5}" cy="${py + 2}" rx="13" ry="5" fill="#526f49" opacity=".13"/>${view === "plan" ? "" : `<path d="M${px} ${py}v-24" stroke="#8b7757" stroke-width="3"/>`}<circle cx="${px}" cy="${py - (view === "plan" ? 0 : 32)}" r="13" fill="#668c66"/><circle cx="${px - 4}" cy="${py - (view === "plan" ? 3 : 36)}" r="9" fill="#8aa77c"/></g>`;
  };
  const person = (x, y, shirt = "#bc7158") => {
    const [px, py] = P(x, y);
    return `<g pointer-events="none"><ellipse cx="${px}" cy="${py + 1}" rx="4" ry="2" fill="#344a39" opacity=".16"/><path d="m${px - 1.5} ${py} 1-6m2 6-1-6" stroke="#394e48" stroke-width="1.6"/><path d="M${px} ${py - 6}v-5" stroke="${shirt}" stroke-width="4" stroke-linecap="round"/><circle cx="${px}" cy="${py - 14}" r="2.5" fill="#a66e4e"/></g>`;
  };
  const car = (cx, y, w = 4.5, d = 14, color = "#dee2d8") => {
    const x = cx - w / 2;
    let art = box(x, y, w, d, 5, color, color);
    art += poly(
      [
        [x + 0.4, y + 3, 5.1],
        [x + w - 0.4, y + 3, 5.1],
        [x + w - 0.4, y + 5, 5.1],
        [x + 0.4, y + 5, 5.1],
      ],
      "#3f5b5d",
    );
    art += poly(
      [
        [x + 0.4, y + d - 4, 5.1],
        [x + w - 0.4, y + d - 4, 5.1],
        [x + w - 0.4, y + d - 2, 5.1],
        [x + 0.4, y + d - 2, 5.1],
      ],
      "#3f5b5d",
    );
    return `<g class="street-car" pointer-events="none">${art}</g>`;
  };
  let edge = -48;
  const lanes = design.lanes.map(([label, width]) => {
    const lane = { label, width, start: edge, center: edge + width / 2 };
    edge += width;
    return lane;
  });
  const get = (label) => lanes.filter((l) => l.label === label);
  // Paint elevated objects from far to near using their ground position.
  // Grouping by vehicle type would paint distant cars over nearer bus roofs.
  const objects = [];
  const place = (x, y, art) => objects.push({ depth: P(x, y)[1], art });
  let parts = poly(
    [
      [-84, -180],
      [84, -180],
      [84, 35],
      [-84, 35],
    ],
    "#d9e0ce",
  );
  // Identical neighborhood context across choices makes the change in street
  // allocation easier to compare without implying different redevelopment.
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const x = side === -1 ? -78 : 57,
        y = -174 + i * 51,
        w = 21,
        d = 38,
        h = 30 + (i % 2) * 10;
      parts += box(
        x,
        y,
        w,
        d,
        h,
        ["#b8a388", "#c7b193", "#b7b8a2", "#c1a991"][i],
      );
      if (view !== "plan") {
        for (let yy = y + 7; yy < y + 32; yy += 10)
          parts += poly(
            [
              [x, yy, 15],
              [x, yy + 5, 15],
              [x, yy + 5, 23],
              [x, yy, 23],
            ],
            "#6c7e75",
          );
        parts += poly(
          [
            [x, y + d, 3],
            [x + w, y + d, 3],
            [x + w, y + d, 13],
            [x, y + d, 13],
          ],
          "#617e70",
        );
        parts += poly(
          [
            [x, y + d, 13],
            [x + w, y + d, 13],
            [x + w, y + d + 3, 11],
            [x, y + d + 3, 11],
          ],
          i % 2 ? "#c58d68" : "#e2c88d",
        );
      }
    }
  for (const l of lanes) {
    parts += poly(
      [
        [l.start, -180],
        [l.start + l.width, -180],
        [l.start + l.width, 35],
        [l.start, 35],
      ],
      colors[l.label],
      `class="street-lane" data-lane="${l.label}" tabindex="0" role="button" aria-label="${l.label}: show explanation"`,
    );
    parts += line(
      [
        [l.start, -180],
        [l.start, 35],
      ],
      "#f7f4e4",
      0.7,
      'opacity=".6" pointer-events="none"',
    );
    if (l.label === "Traffic" || l.label === "Traffic + bus")
      for (let y = -170; y < 25; y += 27)
        parts += line(
          [
            [l.center, y],
            [l.center, y + 10],
          ],
          "#dddccc",
          1.3,
          'pointer-events="none"',
        );
    if (l.label === "Bus")
      for (const y of [-158, -13]) parts += worldText(l.center, y, "BUS", 13);
    if (l.label === "Bike") {
      for (const y of [-150, -42, 13])
        parts += worldText(l.center, y, "↟", 15, "#eef4e8");
      // White separators make the extra bike space in B readable from above.
      parts += line(
        [
          [l.start + 0.5, -180],
          [l.start + 0.5, 35],
        ],
        "#eaf0de",
        green ? 2 : 1,
        'pointer-events="none"',
      );
    }
  }
  // Mark the crossing consistently across options.
  if (!before)
    for (let x = -47; x < 47; x += 7)
      parts += poly(
        [
          [x, -83],
          [x + 4, -83],
          [x + 4, -75],
          [x, -75],
        ],
        "#f3efdf",
        'pointer-events="none"',
      );
  const curbs = get("Curb"),
    walks = get("Walk"),
    bikes = get("Bike");
  // B still has local access, but fewer illustrative stopping opportunities.
  for (const [side, l] of curbs.entries()) {
    const stops = green ? [-132] : [-151, -119, -52, 0];
    for (const [i, y] of stops.entries()) {
      parts += poly(
        [
          [l.start + 0.5, y],
          [l.start + l.width - 0.5, y],
          [l.start + l.width - 0.5, y + 23],
          [l.start + 0.5, y + 23],
        ],
        i === 0 ? "#dcb771" : "#bdc8ce",
        'pointer-events="none"',
      );
      parts += line(
        [
          [l.start + 0.5, y],
          [l.start + l.width - 0.5, y],
          [l.start + l.width - 0.5, y + 23],
          [l.start + 0.5, y + 23],
          [l.start + 0.5, y],
        ],
        "#f8f3df",
        1,
        'pointer-events="none"',
      );
      if (i === 0) {
        // A visible loading van and handcart distinguish stopping from driving.
        place(
          l.center,
          y + 10,
          box(l.center - 2.1, y + 3, 4.2, 14, 8, "#f0e7d3", "#f7efdf"),
        );
        parts += worldText(l.center, y + 21, "LOAD", 8, "#67553a");
      } else {
        place(
          l.center,
          y + 11,
          car(l.center, y + 4, 4.5, 14, i % 2 ? "#e9e4d7" : "#789799"),
        );
        parts += worldText(l.center, y + 22, "P", 12, "#435e69");
      }
    }
  }
  for (const [i, l] of walks.entries()) {
    const count = before ? 2 : green ? 7 : 4;
    for (let j = 0; j < count; j++) {
      const y = -160 + j * (before ? 140 : green ? 29 : 52);
      place(l.center, y, tree(l.center, y));
    }
    if (green) {
      // Seating and planters occupy public space, rather than extra parking.
      for (const y of [-111, -31, 18]) {
        place(
          l.center,
          y + 6,
          `<g class="public-seating" pointer-events="none">${box(l.center - 2, y, 4, 7, 3, "#a88660", "#c6aa7a")}${box(l.center - 2, y + 9, 4, 4, 4, "#91a680", "#a9ba92")}</g>`,
        );
      }
    }
    for (let j = 0; j < 3; j++)
      place(
        l.center + (i ? -2 : 2),
        -143 + j * 62,
        person(
          l.center + (i ? -2 : 2),
          -143 + j * 62,
          ["#bc7158", "#647d9a", "#c7a456"][j],
        ),
      );
  }
  // Cyclists remain in C, with visibly less space than in B.
  for (const l of bikes) {
    const [px, py] = P(l.center, -108);
    place(
      l.center,
      -108,
      `<g class="street-cyclist" pointer-events="none" transform="translate(${px} ${py})"><g fill="none" stroke="#36554a" stroke-width="1.5"><circle cx="-5" cy="0" r="3"/><circle cx="5" cy="3" r="3"/><path d="m-5 0 5-5 5 8-8-2 3-6"/></g><path d="m0-5 0-5 4 3" stroke="#c78153" stroke-width="3" fill="none"/><circle cx="0" cy="-13" r="2.5" fill="#8a6047"/></g>`,
    );
  }
  const transitBus = (cx, y, direction) => {
    const w = 7.5,
      d = 34,
      h = 16,
      bx = cx - w / 2;
    const face = (points, color, extra = "") =>
      poly(
        points.map(([u, v, z = 0]) => [bx + u, y + v, z]),
        color,
        extra,
      );
    const wheel = (v) => {
      const [px, py] = P(bx - 0.15, y + v, 2.5);
      return `<g transform="translate(${px} ${py})"><ellipse rx="3.8" ry="5.2" fill="#28332e" transform="rotate(-22)"/><ellipse rx="1.7" ry="2.5" fill="#a5afa7" transform="rotate(-22)"/></g>`;
    };
    let vehicle = face(
      [
        [-0.7, 0],
        [w + 0.7, 0],
        [w + 0.7, d + 1],
        [-0.7, d + 1],
      ],
      "#33463a",
      'opacity=".16"',
    );
    if (view === "plan") {
      // Roof-only silhouette in a true top view; height must not shift the bus.
      vehicle += face(
        [
          [0, 0],
          [w, 0],
          [w, d],
          [0, d],
        ],
        "#e6e8d8",
      );
      for (const end of [1, d - 2.5])
        vehicle += face(
          [
            [0.5, end],
            [w - 0.5, end],
            [w - 0.5, end + 1.5],
            [0.5, end + 1.5],
          ],
          "#344d50",
        );
      vehicle += face(
        [
          [1.7, 11],
          [w - 1.7, 11],
          [w - 1.7, 20],
          [1.7, 20],
        ],
        "#c6cebf",
      );
      return `<g class="transit-bus" aria-label="Transit bus">${vehicle}</g>`;
    }
    // Long passenger side, with a low floor, continuous glazing and two axles.
    vehicle += face(
      [
        [0, 0, 2],
        [0, d, 2],
        [0, d, h],
        [0, 0, h],
      ],
      "#eeeede",
    );
    vehicle += face(
      [
        [0, 0, 5],
        [0, d, 5],
        [0, d, 7],
        [0, 0, 7],
      ],
      "#d7ac4b",
    );
    for (let v = 2; v < d - 2; v += 5)
      vehicle += face(
        [
          [0, v, 9],
          [0, v + 4, 9],
          [0, v + 4, 14],
          [0, v, 14],
        ],
        "#3d5756",
      );
    for (const v of [4, 25]) {
      vehicle += face(
        [
          [-0.03, v, 3],
          [-0.03, v + 4, 3],
          [-0.03, v + 4, 14],
          [-0.03, v, 14],
        ],
        "#425755",
      );
      vehicle += face(
        [
          [-0.05, v + 1.8, 3],
          [-0.05, v + 2.1, 3],
          [-0.05, v + 2.1, 14],
          [-0.05, v + 1.8, 14],
        ],
        "#b7c2b7",
      );
    }
    vehicle += wheel(7) + wheel(27);
    // The visible end is the windshield for one direction and rear glazing
    // for the opposite direction, rather than two buses facing the same way.
    vehicle += face(
      [
        [0, d, 2],
        [w, d, 2],
        [w, d, h],
        [0, d, h],
      ],
      "#e4e6d6",
    );
    vehicle += face(
      [
        [0.6, d, 8],
        [w - 0.6, d, 8],
        [w - 0.6, d, 13.5],
        [0.6, d, 13.5],
      ],
      "#304b4d",
    );
    vehicle += face(
      [
        [0.7, d, 14],
        [w - 0.7, d, 14],
        [w - 0.7, d, 15.4],
        [0.7, d, 15.4],
      ],
      "#293f38",
    );
    for (const u of [1, w - 1.7])
      vehicle += face(
        [
          [u, d, 4],
          [u + 0.7, d, 4],
          [u + 0.7, d, 5.5],
          [u, d, 5.5],
        ],
        direction > 0 ? "#fff0b6" : "#b9604b",
      );
    vehicle += face(
      [
        [0.4, d, 2],
        [w - 0.4, d, 2],
        [w - 0.4, d, 3],
        [0.4, d, 3],
      ],
      "#53635b",
    );
    vehicle += face(
      [
        [0, 0, h],
        [w, 0, h],
        [w, d, h],
        [0, d, h],
      ],
      "#f4f2e5",
    );
    vehicle += face(
      [
        [1.8, 11, h + 0.3],
        [w - 1.8, 11, h + 0.3],
        [w - 1.8, 21, h + 0.3],
        [1.8, 21, h + 0.3],
      ],
      "#c7cfbf",
    );
    return `<g class="transit-bus" aria-label="Transit bus">${vehicle}</g>`;
  };

  const busCenters = get(bus ? "Bus" : "Traffic + bus").map((l) => l.center);
  busCenters.forEach((center, i) => {
    const y = -135 + i * 105;
    place(center, y + 17, transitBus(center, y, i === 0 ? -1 : 1));
  });
  get(bus ? "Traffic" : "Traffic + bus").forEach((l, i) => {
    for (const y of [-163, -54])
      place(
        l.center,
        y + i * 10 + 7,
        car(l.center, y + i * 10, 4.5, 14, i ? "#91a7a4" : "#cf9d80"),
      );
  });
  if (amendments.includes(1)) {
    const l = curbs[0];
    parts += poly(
      [
        [l.start, -22],
        [l.start + l.width, -22],
        [l.start + l.width, 4],
        [l.start, 4],
      ],
      "#dcb771",
      'pointer-events="none"',
    );
    parts += worldText(l.center, -4, "LOAD", 9, "#67553a");
  }
  if (amendments.includes(6))
    for (let x = -47; x < 47; x += 7)
      parts += poly(
        [
          [x, -5],
          [x + 4, -5],
          [x + 4, 3],
          [x, 3],
        ],
        "#f3efdf",
        'pointer-events="none"',
      );
  if (amendments.includes(7))
    for (const l of walks) {
      const [sx, sy] = P(l.center, -60);
      place(
        l.center,
        -60,
        `<path d="M${sx} ${sy}v-42h10" fill="none" stroke="#617066" stroke-width="2.5"/><circle cx="${sx + 10}" cy="${sy - 42}" r="4" fill="#f2c858"/>`,
      );
    }
  parts += objects
    .sort((a, b) => a.depth - b.depth)
    .map((object) => object.art)
    .join("");
  // Labels sit outside the street, connected to the actual space they describe.
  const callout = (label, detail, lane, y, tx, ty) => {
    const [px, py] = P(lane.center, y);
    return `<g class="street-callout" pointer-events="none"><path d="M${tx + 12} ${ty + 42} L${tx + 12} ${py - 12} L${px} ${py}" fill="none" stroke="#526e60" stroke-width="1.2"/><circle cx="${px}" cy="${py}" r="3.5" fill="#f7f5ed" stroke="#526e60" stroke-width="1.5"/><rect x="${tx}" y="${ty}" width="234" height="43" rx="6" fill="#f8f7ef" fill-opacity=".97" stroke="#d3ddcd"/><text x="${tx + 12}" y="${ty + 17}" font-family="sans-serif" font-size="12" font-weight="700" fill="#294b3e">${label}</text><text x="${tx + 12}" y="${ty + 32}" font-family="sans-serif" font-size="10" fill="#65786a">${detail}</text></g>`;
  };
  if (view !== "plan" && !before) {
    if (option === "B")
      parts +=
        callout(
          "More biking & public space",
          "Wider bike space, trees and seating",
          bikes[0],
          -48,
          28,
          66,
        ) +
        callout(
          "More limited curb access",
          "Fewer parking and loading spaces",
          curbs[1],
          -10,
          624,
          66,
        );
    else if (option === "C")
      parts +=
        callout(
          "Less room for other improvements",
          "Narrower bike and public space",
          bikes[0],
          -48,
          28,
          66,
        ) +
        callout(
          "More local access",
          "Parking, loading and quick stops",
          curbs[1],
          -10,
          624,
          66,
        );
    else
      parts +=
        callout(
          "Buses stay in mixed traffic",
          "Targeted upgrades, familiar layout",
          get("Traffic + bus")[0],
          -48,
          28,
          66,
        ) +
        callout(
          "Familiar curb access",
          "Most parking and access retained",
          curbs[1],
          -10,
          624,
          66,
        );
  }
  return `<svg viewBox="0 0 900 580" role="img" aria-label="${before ? "Illustrative starting street with shared bus and traffic space" : `Option ${option}: ${design.focus}. ${design.tradeoff}`} Illustrative layout, not an engineering plan."><defs><pattern id="dots-${option}-${before ? "before" : "after"}" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#85947c" opacity=".12"/></pattern></defs><rect width="900" height="580" fill="#e8eddf"/><rect width="900" height="580" fill="url(#dots-${option}-${before ? "before" : "after"})"/>${parts}<text x="28" y="555" font-family="sans-serif" font-size="10" fill="#6c7c68">${before ? "ILLUSTRATIVE STARTING STREET" : "SAME STREET SPACE · DIFFERENT PRIORITIES"}</text></svg>`;
}
