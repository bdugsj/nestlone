---
name: nestlone-security
description: Full-spectrum security analysis and penetration testing — binary RE, crypto decode, CVE/dependency scanning, nmap/sqlmap/hydra/msf/nikto/john/ffuf pentest tools, and Exploit-DB search. Runs inside Kali Linux.
invocation: model+user
---

# Nestlone Security Toolkit

Everything runs inside a Kali Linux container. CodeWhale provides the agent
runtime + built-in binary analysis tools. Kali provides the pentest toolchain.
Two MCP servers (vuln + pentest) wrap external APIs and destructive tools
with safety gates.

## Environment

- **CodeWhale app-server** — headless runtime at :7878 with embedded Web UI
- **Kali Linux** — nmap, sqlmap, hydra, msf, nikto, john, ffuf, searchsploit + 600 more
- **MCP: nestlone-vuln** — CVE lookup, dependency scanning, advisory search
- **MCP: nestlone-pentest** — structured pentest tools with scope enforcement

## Available Tools

### Binary Analysis (Rust native — always available)

| Tool | Description |
|---|---|
| `hex_dump` | Hex dump with ASCII sidebar. `path`, optional `length` (256), `offset` (0). |
| `extract_strings` | Extract printable strings from binaries. `path`, optional `min_length` (4). |
| `base64_decode` | Decode base64 → UTF-8 text. |
| `base64_encode` | Encode text → base64. |
| `hex_decode` | Decode hex string → UTF-8 text. |
| `tea_decrypt` | TEA decrypt (32 rounds, delta 0x9E3779B9). `key_hex` (16B), `data_hex`. |

### Vulnerability Intelligence (MCP: nestlone-vuln)

| Tool | Description |
|---|---|
| `lookup_cve` | Fetch CVE details from NVD + osv.dev. Description, CVSS, affected products, refs. |
| `scan_deps` | Batch-scan dependencies against OSV.dev. Covers npm/PyPI/cargo/Go/Maven etc. |
| `search_advisory` | Search GitHub Advisory Database by package + ecosystem. |
| `search_exploit` | Search Exploit-DB via searchsploit or local CSV. |

### Penetration Testing (MCP: nestlone-pentest)

All destructive tools require `scope_confirmed=true` and targets must be
in `.nestlone/scope.json`. See Scope Management below.

| Tool | Description | Destructive |
|---|---|---|
| `nmap_scan` | Port scan + service/OS detection. Supports syn/connect/udp/version/os/quick/full. | Yes |
| `nikto_scan` | Web server vulnerability scanner. Returns findings list. | Yes |
| `ffuf_fuzz` | Directory/file/parameter/vhost fuzzing. Rate-limited to 5 req/s. | Yes |
| `sqlmap_test` | SQL injection detection. Detection only — os-shell/file access blocked. | Yes |
| `hydra_brute` | Login brute-force against ssh/ftp/http/mysql/rdp/smb/etc. Passwords redacted. | **Yes — requires authorization** |
| `msf_search` | Search Metasploit modules by keyword or CVE. Read-only. | No |
| `msf_info` | Get detailed info on a Metasploit module. Read-only. | No |
| `john_crack` | Offline password hash cracking. Local files only, passwords redacted. | No (offline) |
| `search_exploit` | Exploit-DB search via Kali's searchsploit. Read-only. | No |

### Kali Native Tools (via Bash tool)

These are available directly in $PATH. Use CodeWhale's `Bash` tool to invoke them:

**Reconnaissance**: `nmap`, `dnsrecon`, `dnsenum`, `enum4linux`, `smbclient`, `whatweb`, `whois`, `dig`

**Web Testing**: `dirb`, `gobuster`, `curl`, `wget`, `wfuzz`, `wapiti`

**Password Testing**: `hashcat`, `john`, `hydra`, `crunch`, `cewl`

**Exploitation**: `msfconsole`, `msfvenom`, `searchsploit`, `responder`, `impacket-*`

**Sniffing/Network**: `tcpdump`, `wireshark`, `tshark`, `bettercap`, `responder`

## Scope Management

All destructive MCP tools enforce target scope. Create `.nestlone/scope.json`:

```json
{
  "targets": ["192.168.1.0/24", "example.com", "10.0.0.50"],
  "description": "Internal lab pentest — authorized engagement #2024-001",
  "rules_of_engagement": "No DoS, no production systems, 9am-5pm only"
}
```

Without this file, all destructive tools return an error.

## Workspace Layout

All files live under `/workspace/` (bind-mounted to host `./workspace/`).
Follow this structure — the agent creates directories on demand.

```
workspace/
├── targets/                          ← per-target, slugified
│   └── <target-slug>/                ← e.g. 192.168.1.0_24, example.com
│       ├── notes.md                  ← running notes, hypotheses, timeline
│       └── scans/                    ← raw tool output, dated
│           ├── 2026-08-01/
│           │   ├── nmap_initial.txt
│           │   ├── nikto.txt
│           │   └── ffuf_api.json
│           └── 2026-08-02/
├── binaries/                         ← samples and dumps for RE
│   └── <target-slug>/
├── hashes/                           ← password hashes for john/hashcat
├── wordlists/                        ← custom wordlists
├── reports/                          ← final deliverables
│   └── 2026-08-01_<engagement>.md
└── .nestlone/
    ├── scope.json
    └── experience/                   ← self-evolution journal (see below)
```

**Rules**:
- Raw tool output goes under `targets/<slug>/scans/YYYY-MM-DD/` — never in root.
- Binaries get their own target subdirectory under `binaries/`.
- Reports are dated markdown files in `reports/`.
- Create directories on first use. Don't pre-create empty trees.
- Target slug: replace `/` `:` with `_`, strip `http://`, lowercase.

## Workflow

### Phase 1: Reconnaissance
1. **Read `.nestlone/NETWORK.md` first** — identifies Docker bridge vs host LAN. NEVER scan Docker internal subnets (172.x, 10.x).
2. `nmap_scan` — discover open ports, services, OS on the host-facing network
2. For every service+version discovered, run the exploit chain:
   - `search_exploit <service> <version>` → find PoCs
   - `lookup_cve <CVE-ID>` → CVSS score and details
   - `msf_search <service> <version>` → Metasploit modules
3. `nikto_scan` + `whatweb` — web fingerprinting
4. `dnsrecon`, `dig` — DNS enumeration
5. `ffuf_fuzz` — discover hidden directories/files
6. `search_advisory` — check known vulns for discovered services

### Phase 2: Vulnerability Assessment
1. For each service version found, use `lookup_cve` to check for known issues
2. `scan_deps` if you have the project's dependency manifests
3. `search_exploit` for each high-severity CVE to check exploit availability
4. `msf_search` to find Metasploit modules for discovered vulnerabilities
5. `nikto_scan` + `sqlmap_test` for web targets

### Phase 3: Exploitation (within scope)
1. `msf_info` to understand module requirements before running
2. Use `msfconsole` via Bash for manual exploitation
3. `hydra_brute` for credential testing (requires explicit authorization)
4. `john_crack` for offline hash analysis

### Phase 4: Post-Exploitation & Reporting
1. Document every finding with tool output as evidence
2. Cross-reference discovered vulnerabilities with CVE IDs and CVSS scores
3. Collect service banners, open ports, and successful access points
4. Use `msf_search` to find privilege escalation modules
5. Recommend remediations for each finding

### Reverse Engineering (parallel workflow)
1. `extract_strings` on unknown binaries for clues
2. `hex_dump` to inspect headers and structure
3. `base64_decode` / `hex_decode` for encoded payloads
4. `tea_decrypt` for TEA-encrypted data
5. Use `Bash` to disassemble with `objdump`, `radare2`, or `ghidra` (if installed)

## Self-Evolution (Experience Journal)

You MUST maintain a persistent experience journal. This is how you improve
over time instead of repeating the same discoveries.

### First thing on every session

Read environment context (only the files relevant to your task):
```bash
cat .nestlone/env/active/network.md     # network setup — ALWAYS before scanning
cat .nestlone/env/active/container.md   # container limits
cat .nestlone/env/active/capabilities.md # tool quick reference
```
The `active/` link points to the detected platform (windows/docker/linux).
Read only what's needed — saves context.

If `.nestlone/BOOTSTRAP.md` exists (fresh environment): read it, act on it, delete it.

### Before any task

Check for relevant past experience:

```bash
ls .nestlone/experience/        # list date directories
find .nestlone/experience -name "*.md" | xargs grep -li "<keyword>"  # search
```

### After every non-trivial task

Save reusable findings. Create the date directory if needed, then write a
compact markdown file:

```
.nestlone/experience/YYYY-MM-DD/<topic-slug>.md
```

Template:

```markdown
# <topic>

**Goal**: <what we were trying to do>
**Target**: <IP/hostname/URL/binary>
**Duration**: <how long it took>

## Tools & Commands
- `<exact command>` — <why it worked / what it revealed>
- `<exact command>` — <why it worked>

## Key Findings
- <finding 1>
- <finding 2>

## Pitfalls
- <thing that went wrong, and how we fixed it>

## Reusable Patterns
- <pattern that applies to similar targets>
```

### Rules
- **Before starting a task**: glob `.nestlone/experience/` for relevant past
  sessions. Search by service name, tool, CVE, or target pattern.
- **After completing a task**: write one experience file. One topic per file —
  don't cram unrelated things together.
- **Date directories**: always `YYYY-MM-DD` format so they sort chronologically.
- **Slug filenames**: lowercase, hyphens, e.g. `smb-enumeration.md`,
  `sqlmap-blind-injection.md`, `tea-decrypt-xiadan.md`.
- **Cross-reference**: if this task builds on a past experience, link it:
  `See also: 2026-07-30/smb-enumeration.md`.
- **Don't over-log**: saving the 100th identical nmap scan adds noise.
  Save when you learn something new — a pattern, a gotcha, a novel technique.

## Constraints
- All destructive MCP tools require `scope_confirmed=true` + `.nestlone/scope.json`
- `sqlmap_test` blocks `--os-shell`, `--os-pwn`, `--file-*` flags for safety
- `hydra_brute` redacts passwords in output (review `/tmp/hydra/` manually)
- `ffuf_fuzz` rate-limits to 5 req/s by default
- `john_crack` only accepts local workspace files
- Kali tool availability: verify with `which <tool>` or `apt list --installed`
- Exploit-DB: update with `searchsploit -u` before searches
- Metasploit: initial database setup with `msfdb init` (first run)
