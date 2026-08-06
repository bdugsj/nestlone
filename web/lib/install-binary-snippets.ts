import type { Arch } from "./install-platform";

function windowsSnippet(arch: "x64" | "arm64"): string {
  return `# PowerShell
$ErrorActionPreference = "Stop"
$dest = "$Env:USERPROFILE\\bin"
New-Item -ItemType Directory -Force $dest | Out-Null
$manifest = Invoke-WebRequest https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-artifacts-sha256.txt

Invoke-WebRequest \`
  -Uri https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-windows-${arch}.exe \`
  -OutFile "$dest\\nestlone.exe"
Invoke-WebRequest \`
  -Uri https://github.com/bdugsj/nestlone/releases/latest/download/nest-windows-${arch}.exe \`
  -OutFile "$dest\\nest.exe"
Invoke-WebRequest \`
  -Uri https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-tui-windows-${arch}.exe \`
  -OutFile "$dest\\nestlone-tui.exe"

$expected = @{}
$manifest.Content -split "\`n" | ForEach-Object {
  $parts = $_.Trim() -split "\\s+"
  if ($parts.Length -ge 2) { $expected[$parts[1]] = $parts[0].ToUpperInvariant() }
}
if ((Get-FileHash "$dest\\nestlone.exe" -Algorithm SHA256).Hash -ne $expected["nestlone-windows-${arch}.exe"]) { throw "nestlone.exe checksum mismatch" }
if ((Get-FileHash "$dest\\nest.exe" -Algorithm SHA256).Hash -ne $expected["nest-windows-${arch}.exe"]) { throw "nest.exe checksum mismatch" }
if ((Get-FileHash "$dest\\nestlone-tui.exe" -Algorithm SHA256).Hash -ne $expected["nestlone-tui-windows-${arch}.exe"]) { throw "nestlone-tui.exe checksum mismatch" }

$Env:Path = "$dest;$Env:Path"`;
}

function windowsVerify(arch: "x64" | "arm64"): string {
  return `# PowerShell
$manifest = Invoke-WebRequest https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-artifacts-sha256.txt
$expected = @{}
$manifest.Content -split "\`n" | ForEach-Object {
  $parts = $_.Trim() -split "\\s+"
  if ($parts.Length -ge 2) { $expected[$parts[1]] = $parts[0].ToUpperInvariant() }
}
if ((Get-FileHash "$Env:USERPROFILE\\bin\\nestlone.exe" -Algorithm SHA256).Hash -ne $expected["nestlone-windows-${arch}.exe"]) { throw "nestlone.exe checksum mismatch" }
if ((Get-FileHash "$Env:USERPROFILE\\bin\\nest.exe" -Algorithm SHA256).Hash -ne $expected["nest-windows-${arch}.exe"]) { throw "nest.exe checksum mismatch" }
if ((Get-FileHash "$Env:USERPROFILE\\bin\\nestlone-tui.exe" -Algorithm SHA256).Hash -ne $expected["nestlone-tui-windows-${arch}.exe"]) { throw "nestlone-tui.exe checksum mismatch" }`;
}

export const SNIPPETS: Record<Arch, string> = {
  "macos-arm64": `curl -fsSL -O https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-artifacts-sha256.txt
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-macos-arm64
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nest-macos-arm64
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-tui-macos-arm64
grep -E ' (nestlone|nest|nestlone-tui)-macos-arm64$' nestlone-artifacts-sha256.txt | shasum -a 256 -c -
chmod +x nestlone-macos-arm64 nest-macos-arm64 nestlone-tui-macos-arm64
xattr -d com.apple.quarantine nestlone-macos-arm64 nest-macos-arm64 nestlone-tui-macos-arm64 2>/dev/null || true
sudo mv nestlone-macos-arm64 /usr/local/bin/nestlone
sudo mv nest-macos-arm64 /usr/local/bin/nest
sudo mv nestlone-tui-macos-arm64 /usr/local/bin/nestlone-tui`,
  "macos-x64": `curl -fsSL -O https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-artifacts-sha256.txt
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-macos-x64
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nest-macos-x64
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-tui-macos-x64
grep -E ' (nestlone|nest|nestlone-tui)-macos-x64$' nestlone-artifacts-sha256.txt | shasum -a 256 -c -
chmod +x nestlone-macos-x64 nest-macos-x64 nestlone-tui-macos-x64
xattr -d com.apple.quarantine nestlone-macos-x64 nest-macos-x64 nestlone-tui-macos-x64 2>/dev/null || true
sudo mv nestlone-macos-x64 /usr/local/bin/nestlone
sudo mv nest-macos-x64 /usr/local/bin/nest
sudo mv nestlone-tui-macos-x64 /usr/local/bin/nestlone-tui`,
  "linux-x64": `curl -fsSL -O https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-artifacts-sha256.txt
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-linux-x64
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nest-linux-x64
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-tui-linux-x64
grep -E ' (nestlone|nest|nestlone-tui)-linux-x64$' nestlone-artifacts-sha256.txt | sha256sum -c -
chmod +x nestlone-linux-x64 nest-linux-x64 nestlone-tui-linux-x64
sudo mv nestlone-linux-x64 /usr/local/bin/nestlone
sudo mv nest-linux-x64 /usr/local/bin/nest
sudo mv nestlone-tui-linux-x64 /usr/local/bin/nestlone-tui`,
  "linux-arm64": `curl -fsSL -O https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-artifacts-sha256.txt
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-linux-arm64
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nest-linux-arm64
curl -fsSL -O \\
  https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-tui-linux-arm64
grep -E ' (nestlone|nest|nestlone-tui)-linux-arm64$' nestlone-artifacts-sha256.txt | sha256sum -c -
chmod +x nestlone-linux-arm64 nest-linux-arm64 nestlone-tui-linux-arm64
sudo mv nestlone-linux-arm64 /usr/local/bin/nestlone
sudo mv nest-linux-arm64 /usr/local/bin/nest
sudo mv nestlone-tui-linux-arm64 /usr/local/bin/nestlone-tui`,
  "windows-x64": windowsSnippet("x64"),
  "windows-arm64": windowsSnippet("arm64"),
};

function unixVerify(platform: string, checksumCommand: string): string {
  return `curl -fsSL -O https://github.com/bdugsj/nestlone/releases/latest/download/nestlone-artifacts-sha256.txt
verify_binary() {
  asset="$1"
  installed="$2"
  expected=$(awk -v asset="$asset" '$2 == asset { print $1 }' nestlone-artifacts-sha256.txt)
  actual=$(${checksumCommand} "$installed" | awk '{ print $1 }')
  if [ -z "$expected" ] || [ "$actual" != "$expected" ]; then
    echo "$installed checksum mismatch" >&2
    return 1
  fi
}
verify_binary nestlone-${platform} /usr/local/bin/nestlone
verify_binary nest-${platform} /usr/local/bin/nest
verify_binary nestlone-tui-${platform} /usr/local/bin/nestlone-tui`;
}

export const VERIFY: Record<Arch, string> = {
  "macos-arm64": unixVerify("macos-arm64", "shasum -a 256"),
  "macos-x64": unixVerify("macos-x64", "shasum -a 256"),
  "linux-x64": unixVerify("linux-x64", "sha256sum"),
  "linux-arm64": unixVerify("linux-arm64", "sha256sum"),
  "windows-x64": windowsVerify("x64"),
  "windows-arm64": windowsVerify("arm64"),
};
