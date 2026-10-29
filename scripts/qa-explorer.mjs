// Optional browser QA using installed Chrome; no extra npm dependencies.
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
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
      `document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent("click", {bubbles: true}))`,
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
    2,
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
