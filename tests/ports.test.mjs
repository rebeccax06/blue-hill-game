import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { listenAvailable } from "../server.mjs";
class FakeServer extends EventEmitter {
  constructor(errors, host = "127.0.0.1") {
    super();
    this.errors = [...errors];
    this.host = host;
    this.ports = [];
  }
  listen(port, host) {
    this.ports.push(port);
    assert.equal(host, this.host);
    const code = this.errors.shift();
    queueMicrotask(() =>
      code
        ? this.emit("error", Object.assign(new Error(code), { code }))
        : this.emit("listening"),
    );
    return this;
  }
  address() {
    return { port: this.ports.at(-1) };
  }
}
test("occupied ports advance to the next available port", async () => {
  const server = new FakeServer(["EADDRINUSE", "EADDRINUSE"]);
  assert.equal(await listenAvailable(server, 3000, { log: () => {} }), 3002);
  assert.deepEqual(server.ports, [3000, 3001, 3002]);
  assert.equal(server.listenerCount("error"), 0);
});
test("other errors and exhausted retries fail without continuing", async () => {
  const blocked = new FakeServer(["EPERM"]);
  await assert.rejects(listenAvailable(blocked, 3000), { code: "EPERM" });
  assert.deepEqual(blocked.ports, [3000]);
  const occupied = new FakeServer(["EADDRINUSE", "EADDRINUSE"]);
  await assert.rejects(
    listenAvailable(occupied, 3000, { attempts: 2, log: () => {} }),
    { code: "EADDRINUSE" },
  );
  assert.deepEqual(occupied.ports, [3000, 3001]);
});

test("hosting binds the assigned port on the public interface", async () => {
  const server = new FakeServer([], "0.0.0.0");
  assert.equal(
    await listenAvailable(server, 10000, { host: "0.0.0.0", attempts: 1 }),
    10000,
  );
  assert.deepEqual(server.ports, [10000]);
});
