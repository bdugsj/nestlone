# Nestlone Security Platform

AI-powered security analysis and penetration testing agent. Built on CodeWhale
runtime, deployed with a full Kali Linux toolchain.

## Capabilities

- **Penetration Testing** — nmap, sqlmap, hydra, ffuf, nikto, Metasploit
- **Vulnerability Research** — CVE lookup (NVD/OSV), dependency scanning, GitHub Advisories
- **Malware Analysis** — hex dump, string extraction, TEA/base64/hex decode, binary RE
- **Red/Blue Team** — offensive & defensive persona skills with structured workflows
- **Code Review** — security-focused code audit with exploitability assessment

## Quick Start

### Docker (all platforms)

```bash
git clone https://github.com/bdugsj/nestlone.git
cd nestlone
cp .env.example .env        # edit API key
docker compose up -d
docker exec -it nestlone nestlone
```

### Kali Linux (native)

```bash
git clone https://github.com/bdugsj/nestlone.git
cd nestlone/CodeWhale
chmod +x install.sh
./install.sh                # select option 2 (Native)
```

## Architecture

```
nestlone/
├── mcp/                          ← MCP servers (vuln + pentest)
│   ├── vuln_server.py            ← CVE / deps / advisory lookup
│   └── pentest_server.py         ← nmap / sqlmap / hydra / msf wrappers
├── workspace/                    ← persisted data (scans, reports, experience)
├── docker-compose.yml            ← Docker deployment
└── CodeWhale/                    ← Rust source
    ├── crates/tui/src/tools/binary_analysis.rs  ← native RE tools
    ├── crates/tui/assets/skills/           ← persona skills
    └── Dockerfile.kali                     ← Kali container build
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
