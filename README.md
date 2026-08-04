# Nestlone Security Platform

AI-powered security analysis and penetration testing agent with a full Kali
Linux toolchain.

## Capabilities

- **Penetration Testing** — nmap, sqlmap, hydra, ffuf, nikto, Metasploit
- **Vulnerability Research** — CVE lookup (NVD/OSV), dependency scanning, GitHub Advisories
- **Malware Analysis** — hex dump, string extraction, TEA/base64/hex decode, binary RE
- **Red/Blue Team** — offensive & defensive persona skills with structured workflows
- **Code Review** — security-focused code audit with exploitability assessment

## Quick Start

### npm (all platforms, prebuilt binaries)

```bash
npm install -g nestlone
nestlone --help
```

The npm wrapper downloads the matching `nestlone`, `nest`, and `nestlone-tui`
binaries for your platform from the latest GitHub Release. Prebuilt binaries and
platform archives are also attached to every release.

### Docker (all platforms)

```bash
git clone https://github.com/bdugsj/nestlone.git
cd nestlone
cp .env.example .env        # edit API key
docker build -f Dockerfile.kali -t nestlone .
docker run --rm -it --network host \
  -v nestlone_state:/home/nestlone/.nestlone nestlone
```

For the full deployment (MCP servers, workspace bind-mounts, Web UI), see
`install.sh` option 1, which wires up `docker-compose.yml` beside this checkout.

### Kali Linux (native)

```bash
git clone https://github.com/bdugsj/nestlone.git
cd nestlone
chmod +x install.sh
./install.sh                # select option 2 (Native)
```

The installer prefers the prebuilt release binaries and falls back to a Cargo
build only when no release asset matches the platform.

## Architecture

```
nestlone/
├── crates/                          ← Rust workspace (tui, cli, config, ...)
├── mcp/                             ← MCP servers (vuln + pentest)
│   ├── vuln_server.py               ← CVE / deps / advisory lookup
│   └── pentest_server.py            ← nmap / sqlmap / hydra / msf wrappers
├── workspace/                       ← persisted data (scans, reports, experience)
├── scripts/                         ← installer, release, and CI helpers
├── install.sh                       ← native installer
├── Dockerfile / Dockerfile.kali     ← container builds
└── entrypoint.sh                    ← container entrypoint
```

## Persona Skills

| Skill | Role |
|---|---|
| `nestlone-security` | Full-spectrum security analysis |
| `red-team` | Offensive penetration testing |
| `blue-team` | Defensive incident response |
| `malware-analyst` | Malware reverse engineering |

## License

MIT
