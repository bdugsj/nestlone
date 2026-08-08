const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const os = require("os");

const ARTIFACTS_PATH = path.join(__dirname, "..", "scripts", "artifacts.js");

function withMockedOs(platform, arch, fn) {
  const origPlatform = os.platform;
  const origArch = os.arch;
  os.platform = () => platform;
  os.arch = () => arch;
  delete require.cache[ARTIFACTS_PATH];
  try {
    return fn();
  } finally {
    os.platform = origPlatform;
    os.arch = origArch;
    delete require.cache[ARTIFACTS_PATH];
  }
}

test("openharmony x64 resolves to linux x64 binaries", () => {
  withMockedOs("openharmony", "x64", () => {
    const { detectBinaryNames } = require(ARTIFACTS_PATH);
    const result = detectBinaryNames();
    assert.equal(result.nestlone, "nestlone-linux-x64");
    assert.equal(result.tui, "nestlone-tui-linux-x64");
    assert.equal(result.nest, "nest-linux-x64");
  });
});

test("openharmony arm64 resolves to linux arm64 binaries", () => {
  withMockedOs("openharmony", "arm64", () => {
    const { detectBinaryNames } = require(ARTIFACTS_PATH);
    const result = detectBinaryNames();
    assert.equal(result.nestlone, "nestlone-linux-arm64");
    assert.equal(result.tui, "nestlone-tui-linux-arm64");
    assert.equal(result.nest, "nest-linux-arm64");
  });
});

test("android arm64 resolves to Termux-native Android assets", () => {
  withMockedOs("android", "arm64", () => {
    const { detectBinaryNames } = require(ARTIFACTS_PATH);
    const result = detectBinaryNames();
    assert.equal(result.nestlone, "nestlone-android-arm64");
    assert.equal(result.tui, "nestlone-tui-android-arm64");
    assert.equal(result.nest, "nest-android-arm64");
  });
});

test("genuinely unsupported platform throws with raw platform name", () => {
  withMockedOs("freebsd", "x64", () => {
    const { detectBinaryNames } = require(ARTIFACTS_PATH);
    assert.throws(
      () => detectBinaryNames(),
      (err) => {
        assert.match(err.message, /Unsupported platform: freebsd/);
        return true;
      },
    );
  });
});

test("known platforms are unaffected by alias map", () => {
  for (const [platform, arch, expectedNestlone] of [
    ["linux", "x64", "nestlone-linux-x64"],
    ["darwin", "arm64", "nestlone-macos-arm64"],
    ["win32", "x64", "nestlone-windows-x64.exe"],
    ["win32", "arm64", "nestlone-windows-arm64.exe"],
  ]) {
    withMockedOs(platform, arch, () => {
      const { detectBinaryNames } = require(ARTIFACTS_PATH);
      const result = detectBinaryNames();
      assert.equal(result.nestlone, expectedNestlone);
    });
  }
});

test("Windows arm64 resolves the complete native binary family", () => {
  withMockedOs("win32", "arm64", () => {
    const { detectBinaryNames } = require(ARTIFACTS_PATH);
    assert.deepEqual(detectBinaryNames(), {
      platform: "win32",
      arch: "arm64",
      nestlone: "nestlone-windows-arm64.exe",
      tui: "nestlone-tui-windows-arm64.exe",
      nest: "nest-windows-arm64.exe",
    });
  });
});

test("linux riscv64 reports the temporary upstream binding blocker", () => {
  withMockedOs("linux", "riscv64", () => {
    const { detectBinaryNames } = require(ARTIFACTS_PATH);
    assert.throws(
      () => detectBinaryNames(),
      (err) => {
        assert.match(err.message, /Unsupported architecture: riscv64 on platform linux/);
        assert.match(err.message, /rquickjs-sys/);
        assert.match(err.message, /riscv64gc-unknown-linux-gnu/);
        return true;
      },
    );
  });
});

test("release asset inventory includes binaries, archives, installer, and manifests", () => {
  const {
    allAssetNames,
    allReleaseAssetNames,
    BUNDLE_ASSET_NAMES,
    BUNDLE_CHECKSUM_MANIFEST,
    CHECKSUM_MANIFEST,
    checksummedReleaseAssetNames,
    WINDOWS_INSTALLER_ASSET,
  } = require(ARTIFACTS_PATH);
  const assetNames = allAssetNames();
  const releaseAssetNames = allReleaseAssetNames();
  assert.ok(assetNames.includes("nestlone-windows-x64.exe"));
  assert.ok(assetNames.includes("nestlone-tui-windows-x64.exe"));
  assert.ok(assetNames.includes("nest-windows-x64.exe"));
  assert.ok(assetNames.includes("nestlone.bat"));
  assert.ok(assetNames.includes("nestlone-windows-arm64.exe"));
  assert.ok(assetNames.includes("nestlone-tui-windows-arm64.exe"));
  assert.ok(assetNames.includes("nest-windows-arm64.exe"));
  assert.ok(assetNames.includes("nestlone-android-arm64"));
  assert.ok(assetNames.includes("nestlone-tui-android-arm64"));
  assert.ok(assetNames.includes("nest-android-arm64"));
  assert.ok(!assetNames.includes("nestlone-linux-riscv64"));
  assert.ok(releaseAssetNames.includes("nest-windows-x64.exe"));
  assert.ok(releaseAssetNames.includes("nestlone.bat"));
  assert.ok(releaseAssetNames.includes("nest-windows-arm64.exe"));
  assert.ok(releaseAssetNames.includes("nest-android-arm64"));
  for (const bundle of BUNDLE_ASSET_NAMES) {
    assert.ok(releaseAssetNames.includes(bundle));
  }
  assert.ok(releaseAssetNames.includes(WINDOWS_INSTALLER_ASSET));
  assert.ok(releaseAssetNames.includes(BUNDLE_CHECKSUM_MANIFEST));
  assert.ok(releaseAssetNames.includes(CHECKSUM_MANIFEST));
  assert.ok(checksummedReleaseAssetNames().includes(BUNDLE_CHECKSUM_MANIFEST));
  assert.ok(!checksummedReleaseAssetNames().includes(CHECKSUM_MANIFEST));
});

test("CNB mirror URLs use the repository that publishes release assets", () => {
  withMockedOs("linux", "x64", () => {
    const keys = [
      "CODEWHALE_RELEASE_BASE_URL",
      "DEEPSEEK_TUI_RELEASE_BASE_URL",
      "DEEPSEEK_RELEASE_BASE_URL",
      "CODEWHALE_USE_CNB_MIRROR",
    ];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    try {
      for (const key of keys) delete process.env[key];
      process.env.CODEWHALE_USE_CNB_MIRROR = "1";
      const {
        checksumManifestUrl,
        CNB_RELEASE_ASSET_NAMES,
        releaseAssetUrl,
        releaseBaseUrl,
      } = require(ARTIFACTS_PATH);

      assert.deepEqual(CNB_RELEASE_ASSET_NAMES, [
        "nestlone-linux-x64",
        "nest-linux-x64",
        "nestlone-tui-linux-x64",
        "nestlone-artifacts-sha256.txt",
      ]);
      assert.equal(
        releaseBaseUrl("0.8.68"),
        "https://cnb.cool/nestlone.net/nestlone/-/releases/v0.8.68/",
      );
      assert.equal(
        releaseAssetUrl("nestlone-linux-x64", "0.8.68"),
        "https://cnb.cool/nestlone.net/nestlone/-/releases/v0.8.68/nestlone-linux-x64",
      );
      assert.equal(
        checksumManifestUrl("0.8.68"),
        "https://cnb.cool/nestlone.net/nestlone/-/releases/v0.8.68/nestlone-artifacts-sha256.txt",
      );
    } finally {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  });
});

test("CNB mirror fails clearly outside its Linux x64 build matrix", () => {
  withMockedOs("darwin", "arm64", () => {
    const previous = process.env.CODEWHALE_USE_CNB_MIRROR;
    process.env.CODEWHALE_USE_CNB_MIRROR = "1";
    try {
      const { releaseBaseUrl } = require(ARTIFACTS_PATH);
      assert.throws(
        () => releaseBaseUrl("0.8.68"),
        /currently supports only Linux x64.*detected darwin arm64/,
      );
    } finally {
      if (previous === undefined) delete process.env.CODEWHALE_USE_CNB_MIRROR;
      else process.env.CODEWHALE_USE_CNB_MIRROR = previous;
    }
  });
});

test("an explicit release base takes precedence over the CNB shortcut", () => {
  withMockedOs("darwin", "arm64", () => {
    const previousBase = process.env.CODEWHALE_RELEASE_BASE_URL;
    const previousCnb = process.env.CODEWHALE_USE_CNB_MIRROR;
    process.env.CODEWHALE_RELEASE_BASE_URL = "https://mirror.example/v0.8.68";
    process.env.CODEWHALE_USE_CNB_MIRROR = "1";
    try {
      const { releaseBaseUrl, usesCnbMirror } = require(ARTIFACTS_PATH);
      assert.equal(usesCnbMirror(), false);
      assert.equal(releaseBaseUrl("0.8.68"), "https://mirror.example/v0.8.68/");
    } finally {
      if (previousBase === undefined) delete process.env.CODEWHALE_RELEASE_BASE_URL;
      else process.env.CODEWHALE_RELEASE_BASE_URL = previousBase;
      if (previousCnb === undefined) delete process.env.CODEWHALE_USE_CNB_MIRROR;
      else process.env.CODEWHALE_USE_CNB_MIRROR = previousCnb;
    }
  });
});
