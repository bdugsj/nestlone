const assert = require("node:assert/strict");
const test = require("node:test");

const { run, _internal } = require("../scripts/run");

test("version fallback handles only version flags", () => {
  assert.equal(_internal.isVersionFlag(["--version"]), true);
  assert.equal(_internal.isVersionFlag(["-V"]), true);
  assert.equal(_internal.isVersionFlag(["-v"]), false);
  assert.equal(_internal.isVersionFlag(["--verbose"]), false);
});

test("version flags prefer the installed binary over package metadata", async () => {
  let spawned = false;
  const exits = [];

  await run("nestlone", {
    args: ["--version"],
    getBinaryPath: async () => "/tmp/nestlone-test-binary",
    spawnSync: (binary, args, options) => {
      spawned = true;
      assert.equal(binary, "/tmp/nestlone-test-binary");
      assert.deepEqual(args, ["--version"]);
      assert.deepEqual(options, { stdio: "inherit" });
      return { status: 0 };
    },
    exit: (status) => {
      exits.push(status);
    },
  });

  assert.equal(spawned, true);
  assert.deepEqual(exits, [0]);
});

test("nest wrapper dispatches the native shortcut binary", async () => {
  const resolvedNames = [];
  const spawned = [];

  await run("nest", {
    args: ["--version"],
    getBinaryPath: async (name) => {
      resolvedNames.push(name);
      return "/tmp/nest-test-binary";
    },
    spawnSync: (binary, args) => {
      spawned.push({ binary, args });
      return { status: 0 };
    },
    exit: () => {},
  });

  assert.deepEqual(resolvedNames, ["nest"]);
  assert.deepEqual(spawned, [
    { binary: "/tmp/nest-test-binary", args: ["--version"] },
  ]);
});

test("version flags fall back to package metadata when the binary is unavailable", async () => {
  const originalLog = console.log;
  const lines = [];
  const exits = [];
  console.log = (line) => lines.push(line);
  try {
    await run("nestlone", {
      args: ["--version"],
      getBinaryPath: async () => {
        throw new Error("download unavailable");
      },
      spawnSync: () => {
        throw new Error("spawn should not run without a binary");
      },
      exit: (status) => {
        exits.push(status);
      },
    });
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(exits, [0]);
  assert.match(lines.join("\n"), /nestlone \(npm wrapper\) v/);
  assert.match(lines.join("\n"), /binary version: v/);
});
