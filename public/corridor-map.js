const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

// An ordinal corridor diagram, not invented geographic coordinates.
// Every segment and boundary name comes from the twenty source slides.
export function corridorMap(sections, selected) {
  const point = (index) => [
    82 + index * 0.8 + Math.sin(index * 0.38) * 17,
    610 - index * 27,
  ];
  const line = (a, b) => `M${a.join(",")}L${b.join(",")}`;
  const bounds = sections.map((s) => s.title.split(/ to /i)[0]);
  bounds.push(sections.at(-1).title.split(/ to /i)[1]);
  return `<svg class="corridor-map-svg" viewBox="0 0 320 665" role="group" aria-label="Select a Blue Hill Avenue section. Schematic corridor map, north at top."><rect width="320" height="665" rx="12" fill="#e9eddf"/><path d="M15 165 Q55 138 62 225 L57 302 Q20 333 14 280Z" fill="#d4dfc4"/><text x="15" y="231" class="map-park-label">FRANKLIN</text><text x="15" y="243" class="map-park-label">PARK</text><path d="M125 347 Q164 330 158 382 L132 409Z" fill="#d4dfc4"/><text x="168" y="369" class="map-park-label">HARAMBEE</text><text x="168" y="381" class="map-park-label">PARK</text><text x="272" y="39" class="map-north">N ↑</text>${sections
    .map((section, index) => {
      const a = point(index),
        b = point(index + 1),
        mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return `<g data-map-section="${index}" tabindex="0" role="button" aria-label="Section ${section.number}: ${escape(section.title)}" aria-pressed="${selected === index}" class="map-section ${selected === index ? "is-selected" : ""}"><title>${escape(section.title)}</title><path d="${line(a, b)}" class="map-section-hit"/><path d="${line(a, b)}" class="map-section-line"/><circle cx="${mid[0]}" cy="${mid[1]}" r="9" class="map-section-dot"/><text x="${mid[0]}" y="${mid[1] + 3}" text-anchor="middle" class="map-section-number">${section.number}</text></g>`;
    })
    .join("")}${bounds
    .map((name, index) => {
      const [x, y] = point(index);
      return `<path d="M${x - 18},${y}H${x + 25}" stroke="#b6c0ad" stroke-width="1"/><text x="${x + 31}" y="${y + 3}" class="map-street-label">${escape(name)}</text>`;
    })
    .join(
      "",
    )}<text x="18" y="24" class="map-end-label">GROVE HALL</text><text x="18" y="646" class="map-end-label">MATTAPAN SQUARE</text></svg>`;
}
