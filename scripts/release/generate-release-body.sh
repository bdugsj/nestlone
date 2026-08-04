#!/usr/bin/env bash
# Generate the GitHub Release body for a tag.
#
# Usage: generate-release-body.sh <vX.Y.Z> [path/to/CHANGELOG.md]
#
# The install/verify sections are static; the release notes and contributor
# credits come from the CHANGELOG section for the version, so they can never
# drift the way a hand-edited workflow body does.
set -euo pipefail

tag="${1:?usage: $0 <vX.Y.Z> [CHANGELOG.md]}"
changelog="${2:-CHANGELOG.md}"
version="${tag#v}"

section="$(awk -v version="${version}" '
  index($0, "## [" version "]") == 1 { in_section = 1; next }
  in_section && /^## \[/ { exit }
  in_section { print }
' "${changelog}")"

contributors="$(printf '%s\n' "${section}" | awk '
  /^### Contributors[[:space:]]*$/ { in_contributors = 1; next }
  in_contributors && /^### / { exit }
  in_contributors { print }
')"

notes="$(printf '%s\n' "${section}" | awk '
  /^### Contributors[[:space:]]*$/ { in_contributors = 1; next }
  in_contributors && /^### / { in_contributors = 0 }
  !in_contributors { print }
')"

cat <<EOF
> **Nestlone** is the terminal coding agent for supported hosted and local
> models — open models first. The \`nestlone\` command, npm package, and
> release-asset names are lowercase technical identifiers. The legacy npm
> package \`deepseek-tui\` is deprecated and receives no further releases.
> Users coming from v0.8.x legacy \`deepseek\` / \`deepseek-tui\` names should
> migrate with \`docs/REBRAND.md\`.

## Install

### Recommended — npm (one command, all three entrypoints)

\`\`\`bash
npm install -g nestlone
\`\`\`

The wrapper downloads the matched \`nestlone\`, \`nest\`, and \`nestlone-tui\`
binaries from this Release and places them in the same directory.

### Docker

\`\`\`bash
docker compose up -d
docker exec -it nestlone nestlone-tui
\`\`\`

The image ships the \`nestlone\` dispatcher, \`nest\` shim, and \`nestlone-tui\` runtime, and mounts the state directory at \`/home/nestlone/.nestlone\`.

### Cargo (Linux / macOS)

\`\`\`bash
cargo install nestlone-cli nestlone-tui --locked
\`\`\`

Both crates are required — \`nestlone-cli\` produces the \`nestlone\` dispatcher and \`nest\` shim, while \`nestlone-tui\` produces the interactive runtime that the dispatcher delegates to. Installing only one crate will fail at runtime with a \`MISSING_COMPANION_BINARY\` error.

### Manual download — platform archives (recommended)

Each archive below contains the \`nestlone\` dispatcher, \`nest\` shim, and \`nestlone-tui\` runtime, plus an install script:

| Platform | Archive | Install script |
|---|---|---|
| Linux x64 | \`nestlone-linux-x64.tar.gz\` | \`install.sh\` |
| Linux ARM64 | \`nestlone-linux-arm64.tar.gz\` | \`install.sh\` |
| Android ARM64 (Termux) | \`nestlone-android-arm64.tar.gz\` | \`install.sh\` |
| macOS x64 | \`nestlone-macos-x64.tar.gz\` | \`install.sh\` |
| macOS ARM | \`nestlone-macos-arm64.tar.gz\` | \`install.sh\` |
| Windows x64 (installer) | \`NestloneSetup.exe\` | NSIS setup |
| Windows x64 | \`nestlone-windows-x64.zip\` | \`install.bat\` |
| Windows x64 (portable) | \`nestlone-windows-x64-portable.zip\` | — |
| Windows ARM64 | \`nestlone-windows-arm64.zip\` | \`install.bat\` |
| Windows ARM64 (portable) | \`nestlone-windows-arm64-portable.zip\` | — |

**Unix (Linux / macOS):**
\`\`\`bash
tar xzf nestlone-<platform>.tar.gz
cd nestlone-<platform>
./install.sh
\`\`\`

**Windows:**
- For the installer path, run \`NestloneSetup.exe\`; it installs \`nestlone.exe\`, \`nest.exe\`, and \`nestlone-tui.exe\` under \`%LOCALAPPDATA%\\Programs\\Nestlone\\bin\` and adds that directory to the current-user PATH.
- Extract the archive for your machine: \`nestlone-windows-x64.zip\` or
  \`nestlone-windows-arm64.zip\`
- Run \`install.bat\` (copies to \`%USERPROFILE%\\bin\`)
- Add \`%USERPROFILE%\\bin\` to your PATH

The **portable** Windows archive skips the install script — extract and run from any directory. The NSIS installer is currently unsigned and may trigger Windows SmartScreen until a signing certificate is wired into the release pipeline.

Each platform also has **bare, unarchived** binaries attached below (\`nestlone-<platform>\`, \`nest-<platform>\`, and \`nestlone-tui-<platform>\`) — the npm wrapper and the in-app \`nestlone update\` download the matched runtime binaries, whereas the \`.tar.gz\` / \`.zip\` archives above are the recommended manual download and additionally bundle an install script. The legacy npm package \`deepseek-tui\` is deprecated and is not republished. For migration from v0.8.x legacy binary names, see \`docs/REBRAND.md\`.

### Verify (recommended)

Download the checksum manifests from this Release and verify:

\`\`\`bash
# Linux — archive bundles
sha256sum -c nestlone-bundles-sha256.txt --ignore-missing

# Linux — individual binaries
sha256sum -c nestlone-artifacts-sha256.txt --ignore-missing

# macOS
shasum -a 256 -c nestlone-bundles-sha256.txt --ignore-missing
shasum -a 256 -c nestlone-artifacts-sha256.txt --ignore-missing
\`\`\`

## What's in ${tag}
EOF

if [[ -n "${notes}" ]]; then
  printf '%s\n' "${notes}"
else
  printf '%s\n' "See the changelog link below for this release's notes."
fi

cat <<EOF

## Contributors
EOF

if [[ -n "${contributors}" ]]; then
  printf '%s\n' "${contributors}"
else
  printf '%s\n' "Thank you to everyone whose reports, PRs, reviews, and reproductions shaped this release."
fi

cat <<EOF

See [CHANGELOG.md](https://github.com/bdugsj/nestlone/blob/main/CHANGELOG.md) for full notes and [docs/CHANGELOG_ARCHIVE.md](https://github.com/bdugsj/nestlone/blob/main/docs/CHANGELOG_ARCHIVE.md) for older releases.
EOF
