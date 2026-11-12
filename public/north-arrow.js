// These diagrams align north with the corridor toward Grove Hall; they are
// schematics, so this marks corridor direction rather than a surveyed bearing.
export function northArrow(angle = 90) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 100" role="img" aria-label="Corridor north, toward Grove Hall"><rect x="1" y="1" width="148" height="98" rx="10" fill="#fffdf5" fill-opacity=".95" stroke="#c4cebd"/><g transform="translate(75 34) rotate(${angle})" fill="#294b3e"><path d="M0-23 9-5 3-8 3 22H-3V-8L-9-5Z"/></g><text x="75" y="71" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#294b3e">N · Corridor north</text><text x="75" y="88" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#526448">Toward Grove Hall</text></svg>`;
}
