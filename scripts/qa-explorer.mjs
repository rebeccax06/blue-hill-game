// Optional browser QA using installed Chrome; no extra npm dependencies.
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handler } from "../server.mjs";

const server = http.createServer(handler);
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), "bha-explorer-qa-"));
let chrome, socket;
try {
  chrome = spawn(
    process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    [
      "--headless",
      "--disable-gpu",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const debugging = await new Promise((resolve, reject) => {
    let log = "";
    const timeout = setTimeout(
      () => reject(Error("Chrome startup timed out")),
      15000,
    );
    chrome.once("error", reject);
    chrome.once("exit", () => {
      clearTimeout(timeout);
      reject(Error(`Chrome exited: ${log.slice(-1000)}`));
    });
    chrome.stderr.on("data", (chunk) => {
      log += chunk;
      const url = log.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
      if (url) {
        clearTimeout(timeout);
        resolve(url);
      }
    });
  });
  const debugURL = new URL(debugging);
  debugURL.protocol = "http:";
  const target = await (
    await fetch(new URL("/json/new?about:blank", debugURL), { method: "PUT" })
  ).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let id = 0;
  const pending = new Map(),
    errors = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown")
      errors.push(message.params.exceptionDetails);
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    clearTimeout(task.timeout);
    message.error
      ? task.reject(Error(message.error.message))
      : task.resolve(message.result);
  };
  const command = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const requestId = ++id;
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        reject(Error(`${method} timed out`));
      }, 15000);
      pending.set(requestId, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = (expression) =>
    evaluate(
      `new Promise((resolve,reject)=>{const deadline=Date.now()+8000;const check=()=>{if(${expression})resolve(true);else if(Date.now()>deadline)reject(Error('Waiting for UI timed out'));else setTimeout(check,40)};check()})`,
    );
  const click = (selector) =>
    evaluate(
      `(() => { const target = document.querySelector(${JSON.stringify(selector)}); if (${JSON.stringify(selector)}.startsWith("[data-block-feature=") && target.getAttribute("aria-pressed") === "true") return; target.dispatchEvent(new MouseEvent("click", {bubbles: true})); })()`,
    );
  const screenshot = async (path) => {
    const shot = await command("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(path, Buffer.from(shot.data, "base64"));
  };
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await command("Page.navigate", { url: origin });
  await wait('document.querySelector("[data-action=begin]")');
  await click('[data-action="begin"]');
  await wait('document.querySelectorAll("[data-section]").length===20');
  assert.equal(
    await evaluate('document.querySelectorAll("[data-map-section]").length'),
    20,
  );
  for (let index = 0; index < 20; index++) {
    await click(`[data-map-section="${index}"]`);
    await wait(
      'document.querySelector(".section-image-button img")?.naturalWidth>0',
    );
    assert.equal(
      await evaluate('document.querySelectorAll(".section-topic").length'),
      6,
    );
    await wait(
      'document.querySelector(".three-street-view")?.dataset.ready==="true"',
    );
    assert.equal(
      await evaluate(
        'document.querySelector(".three-street-view").dataset.modelSection',
      ),
      String(index + 1),
    );
    await click('[data-three-camera="top"]');
    await click('[data-plan-layer="bus"]');
    assert.equal(
      await evaluate(
        'document.querySelector(".three-street-view").dataset.feature',
      ),
      "bus",
    );
    await click('[data-plan-layer="all"]');
    await click('[data-three-camera="overview"]');
    if ([0, 5, 14, 19].includes(index)) {
      await evaluate(
        'document.querySelector(".interactive-plan").scrollIntoView({block:"center"})',
      );
      await screenshot(`/tmp/bha-block-${index + 1}-3d.png`);
    }
  }
  await click('[data-map-section="11"]');
  await wait(
    'document.querySelector(".interactive-plan canvas")?.dataset.ready==="true"',
  );
  await wait(
    'document.querySelector(".section-image-button img")?.naturalWidth>0',
  );
  assert.match(
    await evaluate('document.querySelector(".section-topics").textContent'),
    /carriageway/,
  );
  await wait(
    'document.querySelector(".three-street-view")?.dataset.ready==="true"',
  );
  assert.equal(
    await evaluate(
      'document.querySelector("[data-plan-style=three]").getAttribute("aria-pressed")',
    ),
    "true",
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".three-street-view").dataset.engine',
    ),
    "three",
  );

  await click('[data-plan-layer="blue"]');
  assert.equal(
    await evaluate(
      'document.querySelector(".three-street-view").dataset.feature',
    ),
    "blue",
  );
  await click('[data-three-camera="top"]');
  assert.equal(
    await evaluate(
      'document.querySelector(".three-street-view").dataset.camera',
    ),
    "top",
  );
  await click('[data-three-camera="overview"]');
  await screenshot("/tmp/bha-perspective-parking.png");
  await click('[data-plan-layer="all"]');
  for (const view of ["slide", "rendering-07", "rendering-08", "drawing"]) {
    await click(`[data-project-view="${view}"]`);
    await wait(
      'document.querySelector(".section-image-button img")?.naturalWidth>0',
    );
  }
  await wait(
    'document.querySelector(".interactive-plan canvas")?.dataset.ready==="true"',
  );
  await click('[data-plan-zoom="in"]');
  assert.equal(
    await evaluate(
      'document.querySelector(".plan-zoom-controls output").textContent',
    ),
    "150%",
  );
  await click('[data-plan-layer="bus"]');
  assert.equal(
    await evaluate(
      'document.querySelector("[data-plan-layer=bus]").getAttribute("aria-pressed")',
    ),
    "true",
  );
  await click('[data-plan-style="original"]');
  await click('[data-plan-style="clear"]');
  await click('[data-plan-layer="all"]');
  await click('[data-plan-zoom="fit"]');
  await evaluate(
    'document.querySelector(".explorer-detail").scrollIntoView({block:"start"})',
  );
  await click('[data-plan-style="three"]');
  await evaluate("new Promise(resolve=>setTimeout(resolve,100))");
  await screenshot("/tmp/bha-explorer-desktop.png");
  await click(".section-image-button");
  await wait('document.querySelector(".explorer-zoom")?.open');
  await click('[data-zoom="in"]');
  assert.equal(
    await evaluate(
      'document.querySelector(".explorer-zoom output").textContent',
    ),
    "150%",
  );
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await wait('!document.querySelector(".explorer-zoom")');
  await evaluate(
    'document.querySelector("#section-search").value="happy";document.querySelector("#section-search").dispatchEvent(new Event("input"))',
  );
  assert.equal(
    await evaluate('document.querySelectorAll("[data-section]").length'),
    JSON.parse(
      await readFile(
        new URL("../public/explorer/sections.json", import.meta.url),
        "utf8",
      ),
    ).sections.filter((section) =>
      `${section.title} ${section.description}`.toLowerCase().includes("happy"),
    ).length,
  );
  await evaluate(
    'document.querySelector("#section-search").value="xyzdoesnotexist";document.querySelector("#section-search").dispatchEvent(new Event("input"))',
  );
  assert.equal(
    await evaluate('!!document.querySelector(".explorer-no-results")'),
    true,
  );
  await evaluate(
    'document.querySelector("#section-search").value="";document.querySelector("#section-search").dispatchEvent(new Event("input"))',
  );
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evaluate("window.scrollTo(0,0)");
  assert.equal(
    await evaluate("document.documentElement.scrollWidth<=window.innerWidth"),
    true,
  );
  await screenshot("/tmp/bha-explorer-mobile.png");
  await click('[data-section="11"]');
  await wait(
    'document.querySelector(".three-street-view")?.dataset.ready==="true"',
  );
  await screenshot("/tmp/bha-explorer-mobile-detail.png");
  await click(".section-image-button");
  assert.equal(
    await evaluate(
      'document.querySelector(".explorer-zoom").getBoundingClientRect().right<=innerWidth',
    ),
    true,
  );
  await click('[data-zoom="close"]');
  await click(".explorer-done");
  await wait('document.querySelector("[data-action=initial]")');
  await click('[data-option="C"]');
  await click("#explore-avenue");
  await wait('document.querySelectorAll("[data-section]").length===20');
  await click(".explorer-done");
  assert.equal(
    await evaluate(
      'document.querySelector("[data-option=C]").getAttribute("aria-pressed")',
    ),
    "true",
  );
  assert.match(
    await evaluate('document.querySelector(".block-play").textContent'),
    /Your block.*12/s,
  );
  assert.equal(
    await evaluate('document.querySelector(".voice-disclosure").open'),
    false,
  );
  await click(".voice-disclosure > summary");
  await evaluate('document.querySelector("[data-voice-toggle]").click()');
  assert.equal(
    await evaluate('document.querySelector(".voice-playback-options").open'),
    false,
  );
  await click(".voice-playback-options > summary");
  assert.ok(
    await evaluate(
      'document.querySelectorAll("[data-paragraph] option").length > 1',
    ),
  );
  assert.equal(
    await evaluate('document.querySelector("[data-playback]").hidden'),
    false,
  );
  await evaluate(`window.Audio = class {
    constructor() { this.duration = 60; this.currentTime = 0; this.paused = true; window.testPlayer = this; }
    async play() { this.paused = false; this.onloadedmetadata?.(); this.ontimeupdate?.(); }
    pause() { this.paused = true; }
  }; const realFetch = window.fetch; window.fetch = (url, opts) => url === '/api/speech' ? Promise.resolve(new Response(new Blob(['test'], {type:'audio/mpeg'}))) : realFetch(url, opts);`);
  await click(".read-paragraph");
  await wait('!document.querySelector("[data-pause]").disabled');
  await click("[data-pause]");
  assert.equal(await evaluate("window.testPlayer.paused"), true);
  await click("[data-pause]");
  await evaluate(
    'document.querySelector("[data-speed]").value="1.5"; document.querySelector("[data-speed]").dispatchEvent(new Event("change")); document.querySelector("[data-seek]").value=25; document.querySelector("[data-seek]").dispatchEvent(new Event("input"))',
  );
  assert.equal(await evaluate("window.testPlayer.playbackRate"), 1.5);
  assert.equal(await evaluate("window.testPlayer.currentTime"), 25);
  await click('[data-action="initial"]');
  await click('[data-priority="0"]');
  await click('[data-priority="1"]');
  await click('[data-action="priorities"]');
  await wait(
    'document.querySelector(".game-plan canvas")?.dataset.ready === "true"',
  );
  for (const feature of [
    "bus",
    "parking",
    "crossings",
    "bike",
    "trees",
    "traffic",
  ]) {
    await click(`[data-block-feature="${feature}"]`);
    assert.equal(
      await evaluate(
        `document.querySelector('[data-block-feature="${feature}"]').getAttribute('aria-pressed')`,
      ),
      "true",
    );
  }
  await click('.game-plan [data-plan-layer="platforms"]');
  assert.equal(
    await evaluate(
      'document.querySelector("[data-block-feature=bus]").getAttribute("aria-pressed")',
    ),
    "true",
  );
  assert.match(
    await evaluate('document.querySelector(".source-color-key").textContent'),
    /platform near Vesta Road/,
  );
  assert.match(
    await evaluate(
      'document.querySelector(".block-plan-source a").getAttribute("href")',
    ),
    /section-12-slide.webp$/,
  );
  await click('.game-plan [data-plan-style="three"]');
  await wait(
    'document.querySelector(".game-plan .three-street-view")?.dataset.ready === "true"',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".game-plan .three-street-view").dataset.feature',
    ),
    "platforms",
  );
  await screenshot("/tmp/bha-platforms-3d.png");
  await click('.game-plan [data-plan-style="clear"]');
  await screenshot("/tmp/bha-platforms-plan.png");
  await click('.game-plan [data-plan-layer="red"]');
  assert.equal(
    await evaluate(
      'document.querySelector("[data-block-feature=parking]").getAttribute("aria-pressed")',
    ),
    "true",
  );
  assert.match(
    await evaluate('document.querySelector(".source-color-key").textContent'),
    /Parking removed/,
  );
  await click('[data-block-feature="parking"]');
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".feature-people button:disabled").length',
    ),
    0,
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll("[data-feature-amendment]").length',
    ),
    0,
  );
  await click('[data-feature-person="Denise"]');
  assert.equal(
    await evaluate('document.querySelector(".task-map").open'),
    false,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".task-workspace > .panel") !== null',
    ),
    true,
  );
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("[data-feature-person]")].every(b => b.dataset.featurePerson === "Denise")',
    ),
    true,
  );
  assert.equal(
    await evaluate('document.querySelector(".feature-detail").open'),
    false,
  );
  assert.match(
    await evaluate('document.querySelector("#answer").value'),
    /carriageway/,
  );
  assert.equal(
    await evaluate(
      'document.querySelector("[data-block-feature=parking]").getAttribute("aria-pressed")',
    ),
    "true",
  );
  assert.ok(
    await evaluate('document.querySelectorAll(".source-comment").length > 0'),
  );
  await evaluate(
    'document.querySelector("[data-comment-search]").value="rent";document.querySelector("[data-comment-search]").dispatchEvent(new Event("input"))',
  );
  assert.match(
    await evaluate(
      'document.querySelector("[data-comment-results]").textContent',
    ),
    /rent/i,
  );
  await evaluate(
    'document.querySelector(".panel").scrollIntoView({block:"start"})',
  );
  await screenshot("/tmp/bha-game-mobile.png");
  await evaluate('document.querySelector(".task-map").open = true');
  await wait(
    'document.querySelector(".game-plan .plan-canvas-wrap canvas").getBoundingClientRect().width > 0',
  );
  await evaluate(
    'document.querySelector(".block-play").scrollIntoView({block:"start"})',
  );
  await screenshot("/tmp/bha-feature-clean-mobile.png");
  assert.ok(
    await evaluate("document.documentElement.scrollWidth <= innerWidth"),
  );
  await evaluate(
    `const saved = JSON.parse(localStorage.getItem('bha-game-v1')); saved.stage='final'; saved.active=null; localStorage.setItem('bha-game-v1',JSON.stringify(saved));`,
  );
  await command("Page.reload");
  await wait('document.querySelector("[data-feature-amendment]")');
  await click('[data-block-feature="parking"]');
  await click('[data-feature-amendment="1"]');
  assert.equal(
    await evaluate('document.querySelector("[data-amendment]")?.checked'),
    true,
  );
  await click('[data-feature-amendment="2"]');
  await click('[data-feature-amendment="3"]');
  assert.match(
    await evaluate('document.querySelector("#toast").textContent'),
    /up to two/,
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".plan-policy-markers > span:not(.eyebrow)").length',
    ),
    2,
  );
  await click('[data-action="confirm-package"]');
  assert.deepEqual(
    await evaluate(
      'JSON.parse(localStorage.getItem("bha-game-v1")).final.amendments',
    ),
    [1, 2],
  );
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(
    'document.querySelector(".block-play").scrollIntoView({block:"start"})',
  );
  await wait(
    'document.querySelector(".game-plan canvas")?.dataset.ready === "true"',
  );
  await evaluate(
    'document.querySelector(".panel").scrollIntoView({block:"start"})',
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll("[data-feature-person], [data-feature-amendment]").length',
    ),
    0,
  );
  await screenshot("/tmp/bha-block-play-desktop.png");
  await evaluate(
    `const saved = JSON.parse(localStorage.getItem('bha-game-v1')); saved.stage='ending'; saved.frozen=true; saved.ending='Five years later, this is the simulated outcome of your final recommendation.'; localStorage.setItem('bha-game-v1',JSON.stringify(saved));`,
  );
  await command("Page.reload");
  await wait('document.querySelector(".outcome-visual #street-reveal-range")');
  assert.match(
    await evaluate('document.querySelector(".panel").textContent'),
    /would you make the same decision again/i,
  );
  assert.equal(await evaluate('document.querySelector(".task-map")'), null);
  assert.ok(
    await evaluate(
      'document.querySelector(".outcome-visual").getBoundingClientRect().right <= document.querySelector(".panel").getBoundingClientRect().left',
    ),
  );
  await evaluate(
    'document.querySelector("#street-reveal-range").value=55; document.querySelector("#street-reveal-range").dispatchEvent(new Event("input"))',
  );
  assert.equal(
    await evaluate(
      'document.querySelector("#street-reveal").style.getPropertyValue("--reveal")',
    ),
    "55%",
  );
  await screenshot("/tmp/bha-outcome-desktop.png");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  assert.ok(
    await evaluate(
      'document.querySelector(".outcome-visual").getBoundingClientRect().bottom <= document.querySelector(".panel").getBoundingClientRect().top',
    ),
  );
  assert.ok(
    await evaluate("document.documentElement.scrollWidth <= innerWidth"),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser QA passed: 20 map blocks, source drawings, interactive plan layers and zoom, related views, Escape, search, mobile widths, and game progress.",
  );
  console.log(
    "Screenshots: /tmp/bha-explorer-desktop.png and /tmp/bha-explorer-mobile.png",
  );
} finally {
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill();
    await new Promise((resolve) => chrome.once("exit", resolve));
  }
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}
