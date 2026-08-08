const path = require("path");
const os = require("os");

const CHECKSUM_MANIFEST = "nestlone-artifacts-sha256.txt";
const BUNDLE_CHECKSUM_MANIFEST = "nestlone-bundles-sha256.txt";
const WINDOWS_INSTALLER_ASSET = "NestloneSetup.exe";

const CNB_BINARY_ASSET_NAMES = [
  "nestlone-linux-x64",
  "nest-linux-x64",
  "nestlone-tui-linux-x64",
];
const CNB_RELEASE_ASSET_NAMES = [
  ...CNB_BINARY_ASSET_NAMES,
  CHECKSUM_MANIFEST,
];

const BUNDLE_ASSET_NAMES = [
  "nestlone-linux-x64.tar.gz",
  "nestlone-linux-arm64.tar.gz",
  "nestlone-android-arm64.tar.gz",
  "nestlone-macos-x64.tar.gz",
  "nestlone-macos-arm64.tar.gz",
  "nestlone-windows-x64.zip",
  "nestlone-windows-x64-portable.zip",
  "nestlone-windows-arm64.zip",
  "nestlone-windows-arm64-portable.zip",
];

const ASSET_MATRIX = {
  linux: {
    x64: ["nestlone-linux-x64", "nestlone-tui-linux-x64", "nest-linux-x64"],
    arm64: ["nestlone-linux-arm64", "nestlone-tui-linux-arm64", "nest-linux-arm64"],
  },
  android: {
    arm64: ["nestlone-android-arm64", "nestlone-tui-android-arm64", "nest-android-arm64"],
  },
  darwin: {
    x64: ["nestlone-macos-x64", "nestlone-tui-macos-x64", "nest-macos-x64"],
    arm64: ["nestlone-macos-arm64", "nestlone-tui-macos-arm64", "nest-macos-arm64"],
  },
  win32: {
    x64: ["nestlone-windows-x64.exe", "nestlone-tui-windows-x64.exe", "nest-windows-x64.exe", "nestlone.bat"],
    arm64: ["nestlone-windows-arm64.exe", "nestlone-tui-windows-arm64.exe", "nest-windows-arm64.exe"],
  },
};

// HarmonyPC (openharmony) is an x86_64 Linux-compatible environment; map it to
// the linux binary family so npm install succeeds without a separate build target.
const PLATFORM_ALIASES = {
  openharmony: "linux",
};

function detectBinaryNames() {
  const rawPlatform = os.platform();
  const platform = PLATFORM_ALIASES[rawPlatform] || rawPlatform;
  const arch = os.arch();
  const defaults = ASSET_MATRIX[platform];
  if (!defaults) {
    const supported = Object.keys(ASSET_MATRIX).map(p => `'${p}'`).join(', ');
    throw new Error(
      `Unsupported platform: ${rawPlatform}. Supported platforms: ${supported}.\n\n` +
      unsupportedBuildHint(),
    );
  }
  const pair = defaults[arch];
  if (!pair) {
    const supported = Object.keys(defaults).map(a => `'${a}'`).join(', ');
    const hint = platform === "linux" && arch === "riscv64" ? unsupportedRiscvHint() : unsupportedBuildHint();
    throw new Error(
      `Unsupported architecture: ${arch} on platform ${platform}. ` +
      `Supported architectures: ${supported}.\n\n` +
      hint,
    );
  }
  return {
    platform,
    arch,
    nestlone: pair[0],
    tui: pair[1],
    nest: pair[2],
  };
}

function unsupportedBuildHint() {
  return [
    "No prebuilt binary is available for this platform/architecture combo.",
    "You can still run nestlone by building from source with Cargo:",
    "",
    "  # Requires Rust 1.88+ (https://rustup.rs)",
    "  cargo install nestlone-cli --locked   # provides `nestlone` and `nest`",
    "  cargo install nestlone-tui --locked   # provides `nestlone-tui`",
    "",
    "Or build from a checkout:",
    "",
    "  git clone https://github.com/bdugsj/nestlone.git",
    "  cd nestlone",
    "  cargo install --path crates/cli --locked",
    "  cargo install --path crates/tui --locked",
    "",
    "See https://github.com/bdugsj/nestlone/blob/main/docs/INSTALL.md",
    "for cross-compilation, mirror, and Linux ARM64 specifics.",
  ].join("\n");
}

function unsupportedRiscvHint() {
  return [
    "Linux riscv64 prebuilt binaries are temporarily unavailable.",
    "Nestlone currently depends on rquickjs-sys, which does not ship",
    "riscv64gc-unknown-linux-gnu bindings in the locked dependency set.",
    "",
    "Track the release notes and docs/INSTALL.md for the next RISC-V support update.",
  ].join("\n");
}

function executableName(base, platform) {
  return platform === "win32" ? `${base}.exe` : base;
}

function releaseBaseUrl(version, repo = "bdugsj/nestlone") {
  // NESTLONE_RELEASE_BASE_URL is the canonical override.
  // CODEWHALE_RELEASE_BASE_URL / DEEPSEEK_TUI_RELEASE_BASE_URL /
  // DEEPSEEK_RELEASE_BASE_URL are legacy aliases.
  const override =
    process.env.NESTLONE_RELEASE_BASE_URL ||
    process.env.CODEWHALE_RELEASE_BASE_URL ||
    process.env.DEEPSEEK_TUI_RELEASE_BASE_URL ||
    process.env.DEEPSEEK_RELEASE_BASE_URL;
  if (override) {
    const trimmed = String(override).trim();
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  }
  // When NESTLONE_USE_CNB_MIRROR (legacy CODEWHALE_USE_CNB_MIRROR) is set, use
  // the CNB (China-friendly) mirror that publishes binary release assets.
  if (usesCnbMirror()) {
    assertCnbMirrorSupportedPlatform();
    return `https://cnb.cool/nestlone.net/nestlone/-/releases/v${version}/`;
  }
  return `https://github.com/${repo}/releases/download/v${version}/`;
}

function usesCnbMirror(env = process.env) {
  const hasExplicitBase = Boolean(
    env.NESTLONE_RELEASE_BASE_URL ||
      env.CODEWHALE_RELEASE_BASE_URL ||
      env.DEEPSEEK_TUI_RELEASE_BASE_URL ||
      env.DEEPSEEK_RELEASE_BASE_URL,
  );
  return (
    !hasExplicitBase &&
    Boolean(env.NESTLONE_USE_CNB_MIRROR || env.CODEWHALE_USE_CNB_MIRROR)
  );
}

function assertCnbMirrorSupportedPlatform(
  rawPlatform = os.platform(),
  arch = os.arch(),
) {
  const platform = PLATFORM_ALIASES[rawPlatform] || rawPlatform;
  if (platform === "linux" && arch === "x64") {
    return;
  }
  throw new Error(
    "NESTLONE_USE_CNB_MIRROR=1 currently supports only Linux x64 " +
      `(including OpenHarmony x64); detected ${rawPlatform} ${arch}. ` +
      "Use the GitHub Release or set NESTLONE_RELEASE_BASE_URL to a " +
      "complete mirror for this platform.",
  );
}

function releaseAssetUrl(baseName, version, repo = "bdugsj/nestlone") {
  return new URL(baseName, releaseBaseUrl(version, repo)).toString();
}

function checksumManifestUrl(version, repo = "bdugsj/nestlone") {
  return releaseAssetUrl(CHECKSUM_MANIFEST, version, repo);
}

function releaseBinaryDirectory() {
  return path.join(__dirname, "..", "bin", "downloads");
}

function allAssetNames() {
  const names = [];
  for (const platformAssets of Object.values(ASSET_MATRIX)) {
    for (const assets of Object.values(platformAssets)) {
      names.push(...assets);
    }
  }
  return Array.from(new Set(names));
}

function allReleaseAssetNames() {
  return [
    ...allAssetNames(),
    ...BUNDLE_ASSET_NAMES,
    WINDOWS_INSTALLER_ASSET,
    BUNDLE_CHECKSUM_MANIFEST,
    CHECKSUM_MANIFEST,
  ];
}

function checksummedReleaseAssetNames() {
  return allReleaseAssetNames().filter((name) => name !== CHECKSUM_MANIFEST);
}

module.exports = {
  allAssetNames,
  allReleaseAssetNames,
  assertCnbMirrorSupportedPlatform,
  BUNDLE_ASSET_NAMES,
  BUNDLE_CHECKSUM_MANIFEST,
  CHECKSUM_MANIFEST,
  checksummedReleaseAssetNames,
  CNB_BINARY_ASSET_NAMES,
  CNB_RELEASE_ASSET_NAMES,
  checksumManifestUrl,
  detectBinaryNames,
  executableName,
  releaseAssetUrl,
  releaseBaseUrl,
  releaseBinaryDirectory,
  usesCnbMirror,
  WINDOWS_INSTALLER_ASSET,
};
