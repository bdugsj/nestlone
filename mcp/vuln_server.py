#!/usr/bin/env python3
"""
Nestlone Vulnerability MCP Server.

Tools: lookup_cve, scan_deps, search_advisory, search_exploit.

Data sources: NVD (nvd.nist.gov), OSV (osv.dev), GitHub Advisory DB,
              Exploit-DB (local clone or searchsploit).

Setup:
    pip install mcp
    # Optional: set NVD_API_KEY, GITHUB_TOKEN env vars

CodeWhale .mcp.json:
{
  "mcpServers": {
    "nestlone-vuln": {
      "command": "python",
      "args": ["path/to/nestlone/mcp/vuln_server.py"],
      "env": { "NVD_API_KEY": "", "GITHUB_TOKEN": "" },
      "enabled": true
    }
  }
}
"""

from __future__ import annotations

import csv
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path
from typing import Any

try:
    from mcp.server import MCPServer
except ImportError:
    print("mcp SDK not installed. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)

mcp = MCPServer("nestlone-vuln")

NVD_API_KEY = os.environ.get("NVD_API_KEY", "")
NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"
OSV_BASE = "https://api.osv.dev/v1"
GH_ADVISORY_BASE = "https://api.github.com/advisories"
EXPLOIT_DB_PATH = os.environ.get(
    "EXPLOIT_DB_PATH",
    str(Path.home() / ".nestlone" / "exploitdb"),
)
REQUEST_TIMEOUT = 15


def _http_get(url: str, headers: dict[str, str] | None = None) -> dict[str, Any]:
    req = urllib.request.Request(url, headers=headers or {})
    req.add_header("User-Agent", "nestlone-vuln-mcp/1.0")
    if NVD_API_KEY and "nvd.nist.gov" in url:
        req.add_header("apiKey", NVD_API_KEY)
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:500] if e.fp else ""
        return {"error": f"HTTP {e.code}", "detail": body}
    except urllib.error.URLError as e:
        return {"error": "Request failed", "detail": str(e.reason)}
    except json.JSONDecodeError:
        return {"error": "Invalid JSON response"}


def _http_post(url: str, body: dict, headers: dict[str, str] | None = None) -> dict[str, Any]:
    hdrs: dict[str, str] = {"Content-Type": "application/json"}
    hdrs.update(headers or {})
    hdrs["User-Agent"] = "nestlone-vuln-mcp/1.0"
    data = json.dumps(body).encode()
    try:
        req = urllib.request.Request(url, data=data, headers=hdrs, method="POST")
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()[:500] if e.fp else ""
        return {"error": f"HTTP {e.code}", "detail": err_body}
    except urllib.error.URLError as e:
        return {"error": "Request failed", "detail": str(e.reason)}


def _fmt_cvss(metrics: dict | None) -> str:
    if not metrics:
        return "N/A"
    cvss_v31 = metrics.get("cvssMetricV31", [{}])[0]
    cvss_v30 = metrics.get("cvssMetricV30", [{}])[0]
    cvss_v2 = metrics.get("cvssMetricV2", [{}])[0]
    primary = cvss_v31 or cvss_v30
    if primary:
        cvss = primary.get("cvssData", {})
        return (
            f"v{cvss.get('version','?')}: {cvss.get('baseScore','?')} "
            f"({cvss.get('baseSeverity','?')})"
        )
    if cvss_v2:
        cvss = cvss_v2.get("cvssData", {})
        return f"v2: {cvss.get('baseScore','?')} ({cvss_v2.get('baseSeverity','?')})"
    return "N/A"


# ---- lookup_cve ----

@mcp.tool()
def lookup_cve(cve_id: str) -> str:
    """Look up a CVE by ID from NVD + osv.dev.

    Returns description, CVSS score/severity, affected products, references.
    Accepts both 'CVE-2024-1234' and '2024-1234' formats.
    """
    cve_id = cve_id.strip().upper()
    if not cve_id.startswith("CVE-"):
        cve_id = f"CVE-{cve_id}"

    nvd_url = f"{NVD_BASE}?cveId={cve_id}"
    nvd = _http_get(nvd_url)

    if "vulnerabilities" in nvd and nvd["vulnerabilities"]:
        vuln = nvd["vulnerabilities"][0]["cve"]
        desc_list = vuln.get("descriptions", [])
        desc = next(
            (d["value"] for d in desc_list if d.get("lang") == "en"),
            "No description",
        )
        cvss_str = _fmt_cvss(vuln.get("metrics", {}))
        published = vuln.get("published", "?")
        modified = vuln.get("lastModified", "?")

        products: list[str] = []
        for cfg in vuln.get("configurations", [])[:3]:
            for node in cfg.get("nodes", []):
                for match in node.get("cpeMatch", [])[:10]:
                    crit = match.get("criteria", "")
                    if crit:
                        products.append(
                            crit.replace("cpe:2.3:a:", "")
                            .replace("cpe:2.3:o:", "")
                            .replace("cpe:2.3:h:", "")
                        )

        refs = [r["url"] for r in vuln.get("references", [])[:5]]

        return (
            f"=== {cve_id} ===\n\n"
            f"Description: {desc}\n\n"
            f"CVSS: {cvss_str}\n"
            f"Published: {published}\n"
            f"Modified:  {modified}\n\n"
            f"Affected Products ({len(products)}):\n"
            + "\n".join(f"  - {p}" for p in products[:20])
            + "\n\nReferences:\n"
            + "\n".join(f"  - {r}" for r in refs)
        )

    osv_url = f"{OSV_BASE}/vulns/{cve_id}"
    osv = _http_get(osv_url)
    if "details" in osv:
        aliases = osv.get("aliases", [])
        summary = osv.get("summary", osv.get("details", "No details"))
        severity = osv.get("severity", [])
        sev_lines = [
            f"  {s.get('type','?')}: {s.get('score','?')}" for s in severity
        ]
        refs = [r["url"] for r in osv.get("references", [])[:5]]
        return (
            f"=== {cve_id} (via osv.dev) ===\n\n"
            f"Summary: {summary}\n"
            f"Aliases: {', '.join(aliases) if aliases else 'none'}\n"
            + ("Severity:\n" + "\n".join(sev_lines) + "\n" if sev_lines else "")
            + ("References:\n" + "\n".join(f"  - {r}" for r in refs))
        )

    return f"Error: {cve_id} not found in NVD or OSV databases."


# ---- scan_deps ----

OSV_ECOSYSTEM_MAP = {
    "npm": "npm", "pypi": "PyPI", "pip": "PyPI",
    "cargo": "crates.io", "rust": "crates.io",
    "gem": "RubyGems", "ruby": "RubyGems",
    "maven": "Maven", "gradle": "Maven",
    "go": "Go", "golang": "Go",
    "nuget": "NuGet",
    "composer": "Packagist", "php": "Packagist",
    "hex": "Hex", "elixir": "Hex",
    "pub": "Pub", "dart": "Pub",
    "conan": "ConanCenter", "c": "ConanCenter", "cpp": "ConanCenter",
    "alpine": "Alpine", "debian": "Debian",
    "ubuntu": "Ubuntu", "chainguard": "Chainguard", "wolfi": "Wolfi",
}


@mcp.tool()
def scan_deps(deps_json: str) -> str:
    """Batch-scan dependencies for known vulnerabilities via OSV.dev (free, no auth).

    Covers npm, PyPI, crates.io, RubyGems, Maven, Go, NuGet, Packagist,
    Hex, Pub, and Linux distros.

    Input: JSON array of {"ecosystem": "npm|pypi|cargo|go|...",
                           "name": "package-name",
                           "version": "1.2.3"}

    Example:
        [{"ecosystem":"npm","name":"lodash","version":"4.17.15"},
         {"ecosystem":"cargo","name":"tokio","version":"1.0.0"}]
    """
    try:
        deps = json.loads(deps_json)
    except json.JSONDecodeError as e:
        return f"Error: invalid JSON: {e}"

    if not isinstance(deps, list):
        return "Error: deps_json must be a JSON array"

    results: list[str] = []
    for i, dep in enumerate(deps):
        if not isinstance(dep, dict):
            results.append(f"[{i}] Error: each entry must be a dict")
            continue

        eco_raw = dep.get("ecosystem", "").lower()
        ecosystem = OSV_ECOSYSTEM_MAP.get(eco_raw, eco_raw)
        name = dep.get("name", "")
        version = dep.get("version", "")

        if not ecosystem or not name:
            results.append(f"[{i}] Error: missing ecosystem or name: {dep}")
            continue

        body: dict[str, Any] = {
            "package": {"name": name, "ecosystem": ecosystem},
        }
        if version:
            body["version"] = version

        resp = _http_post(f"{OSV_BASE}/query", body)

        if "error" in resp:
            results.append(
                f"[{i}] {name} v{version} ({ecosystem}): "
                f"API error — {resp.get('detail', resp['error'])}"
            )
            continue

        vulns = resp.get("vulns", [])
        if not vulns:
            status = f"v{version}" if version else "any version"
            results.append(
                f"[{i}] {name} {status} ({ecosystem}): "
                f"0 known vulnerabilities"
            )
            continue

        for v in vulns:
            vid = v.get("id", "?")
            aliases = v.get("aliases", [])
            alias_str = f" ({', '.join(aliases)})" if aliases else ""
            summary = v.get("summary", "No summary")

            ver_info = ""
            if "affected" in v:
                for aff in v["affected"][:1]:
                    rng = aff.get("ranges", [{}])[0]
                    events = rng.get("events", [])
                    ev_strs = []
                    for ev in events:
                        if "introduced" in ev:
                            ev_strs.append(f"introduced={ev['introduced']}")
                        if "fixed" in ev:
                            ev_strs.append(f"fixed={ev['fixed']}")
                    if ev_strs:
                        ver_info = f" [Versions: {', '.join(ev_strs)}]"

            results.append(
                f"[{i}] {name} v{version} ({ecosystem}): "
                f"{vid}{alias_str} — {summary}{ver_info}"
            )

        time.sleep(0.15)

    return "\n".join(results)


# ---- search_advisory ----

@mcp.tool()
def search_advisory(package: str, ecosystem: str = "") -> str:
    """Search the GitHub Advisory Database for a package or keyword.

    Returns GHSA advisories with severity, CVE cross-references, and summaries.
    Without GITHUB_TOKEN env var, rate limit is 60 req/hour.

    Args:
        package: Package name or keyword to search for.
        ecosystem: Optional filter — npm, pip, cargo, go, maven,
                   rubygems, nuget, composer, hex, pub, erlang.
    """
    params: dict[str, str] = {"query": package, "per_page": "10"}
    if ecosystem:
        eco_map = {
            "npm": "npm", "pip": "pip", "pypi": "pip",
            "cargo": "cargo", "rust": "cargo",
            "go": "go", "golang": "go",
            "maven": "maven",
            "gem": "rubygems", "ruby": "rubygems",
            "nuget": "nuget",
            "composer": "composer", "php": "composer",
            "hex": "hex", "elixir": "hex",
            "pub": "pub", "dart": "pub",
            "erlang": "erlang",
        }
        params["ecosystem"] = eco_map.get(ecosystem.lower(), ecosystem.lower())

    qs = urllib.parse.urlencode(params)
    url = f"{GH_ADVISORY_BASE}?{qs}"
    headers: dict[str, str] = {"Accept": "application/vnd.github+json"}
    token = os.environ.get("GITHUB_TOKEN", "")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    resp = _http_get(url, headers=headers)

    if "error" in resp:
        detail = resp.get("detail", "")
        if "rate limit" in detail.lower() or "403" in str(resp.get("error", "")):
            return (
                "GitHub API rate limit reached. Set GITHUB_TOKEN for "
                f"higher limits.\nError: {detail}"
            )
        return f"GitHub Advisory API error: {resp['error']} — {detail}"

    items = resp if isinstance(resp, list) else resp.get("items", resp)
    if not isinstance(items, list) or not items:
        return (
            f"No advisories found for '{package}'"
            + (f" in ecosystem={ecosystem}" if ecosystem else ".")
        )

    lines = [
        f"GitHub Advisories for '{package}'"
        + (f" (ecosystem: {ecosystem})" if ecosystem else "")
        + f" — {len(items)} results:\n"
    ]
    for adv in items[:10]:
        ghsa_id = adv.get("ghsa_id", "?")
        severity = adv.get("severity", "?").upper()
        cve_id = adv.get("cve_id", "")
        cve_str = f" ({cve_id})" if cve_id else ""
        summary = adv.get("summary", "No summary")
        updated = adv.get("updated_at", "?")[:10]
        lines.append(
            f"  [{severity}] {ghsa_id}{cve_str}\n"
            f"    {summary}\n"
            f"    Updated: {updated}"
        )

    return "\n".join(lines)


# ---- search_exploit ----

@mcp.tool()
def search_exploit(query: str, max_results: int = 15) -> str:
    """Search Exploit-DB for PoC code and exploits.

    Uses searchsploit if available, falls back to grepping the local
    Exploit-DB files_exploits.csv.

    Args:
        query: Search term — CVE ID, software name, platform, or keyword.
        max_results: Max results to return (default 15).

    Setup (one-time):
        git clone https://gitlab.com/exploit-database/exploitdb.git ~/.nestlone/exploitdb
    """
    edb_path = Path(EXPLOIT_DB_PATH)
    csv_path = edb_path / "files_exploits.csv"
    if not csv_path.exists():
        return (
            "Exploit-DB not found locally. Clone it once:\n"
            "  git clone https://gitlab.com/exploit-database/exploitdb.git "
            f"{EXPLOIT_DB_PATH}\n\n"
            "Or use searchsploit if Kali/BlackArch:\n"
            f"  searchsploit {query}"
        )

    # Try searchsploit first
    try:
        result = subprocess.run(
            ["searchsploit", "--colour", "-w", query],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0 and result.stdout.strip():
            lines = result.stdout.strip().split("\n")
            header = lines[:2] if len(lines) >= 2 else lines[:1]
            body = lines[2:] if len(lines) >= 2 else []
            trimmed = body[:max_results]
            return (
                f"searchsploit results for '{query}':\n\n"
                + "\n".join(header) + "\n"
                + "\n".join(trimmed)
                + (
                    f"\n\n... ({len(body) - max_results} more)"
                    if len(body) > max_results else ""
                )
            )
    except FileNotFoundError:
        pass
    except subprocess.TimeoutExpired:
        return "searchsploit timed out after 15s."

    # Fallback: grep CSV
    ql = query.lower()
    matches: list[dict[str, str]] = []
    with open(csv_path, encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            searchable = (
                f"{row.get('id','')} {row.get('description','')} "
                f"{row.get('author','')} {row.get('codes','')}"
            )
            if ql in searchable.lower():
                matches.append(row)
            if len(matches) >= max_results * 3:
                break

    if not matches:
        return f"No Exploit-DB entries found matching '{query}'."

    lines = [
        f"Exploit-DB matches for '{query}' "
        f"— {min(len(matches), max_results)} shown:\n"
    ]
    for m in matches[:max_results]:
        edb_id = m.get("id", "?")
        desc = m.get("description", "No description")
        author = m.get("author", "?")
        date_str = m.get("date", "?")
        codes = m.get("codes", "")
        cve_line = f"  CVE: {codes}" if codes else ""
        lines.append(
            f"  EDB-ID: {edb_id}\n"
            f"  {desc}\n"
            f"  Author: {author} | Date: {date_str}"
            + (f"\n{cve_line}" if cve_line else "")
        )

    return "\n".join(lines)


# ---- scan_project_deps ----

@mcp.tool()
def scan_project_deps(project_dir: str = "/workspace") -> str:
    """Auto-detect and scan all dependencies in a project directory.

    Reads package.json, Cargo.toml, requirements.txt, go.mod, Gemfile,
    pom.xml, and composer.json from the given directory, extracts
    package@version pairs, and scans them all against OSV.dev.

    Args:
        project_dir: Path to project root (default /workspace).
    """
    import glob as glob_mod

    base = Path(project_dir)
    if not base.exists():
        return f"Error: directory not found: {project_dir}"

    deps: list[dict[str, str]] = []
    found_files: list[str] = []

    # -- Node.js: package.json --
    pkg_json = base / "package.json"
    if pkg_json.exists():
        found_files.append("package.json")
        try:
            data = json.loads(pkg_json.read_text(encoding="utf-8"))
            for section in ["dependencies", "devDependencies"]:
                for name, ver in data.get(section, {}).items():
                    clean = str(ver).lstrip("^~>=<")
                    deps.append({"ecosystem": "npm", "name": name, "version": clean})
        except Exception:
            pass

    # -- Rust: Cargo.toml --
    cargo_toml = base / "Cargo.toml"
    if cargo_toml.exists():
        found_files.append("Cargo.toml")
        try:
            text = cargo_toml.read_text(encoding="utf-8")
            in_deps = False
            for line in text.split("\n"):
                line = line.strip()
                if line.startswith("[dependencies") or line.startswith("[build-dependencies"):
                    in_deps = True
                    continue
                if line.startswith("["):
                    in_deps = False
                    continue
                if in_deps and "=" in line and not line.startswith("#"):
                    name = line.split("=")[0].strip().strip('"')
                    ver_match = line.split("=")[1].strip().strip('"')
                    ver = ver_match.split()[0] if ver_match else "0"
                    deps.append({"ecosystem": "cargo", "name": name, "version": ver})
        except Exception:
            pass

    # -- Python: requirements.txt --
    req_txt = base / "requirements.txt"
    if req_txt.exists():
        found_files.append("requirements.txt")
        try:
            for line in req_txt.read_text(encoding="utf-8").split("\n"):
                line = line.strip()
                if line and not line.startswith("#") and not line.startswith("-"):
                    for sep in ["==", ">=", "<=", "~=", "!="]:
                        if sep in line:
                            name, ver = line.split(sep, 1)
                            deps.append({"ecosystem": "pypi", "name": name.strip(), "version": ver.strip()})
                            break
                    else:
                        deps.append({"ecosystem": "pypi", "name": line.strip(), "version": ""})
        except Exception:
            pass

    # -- Go: go.mod --
    go_mod = base / "go.mod"
    if go_mod.exists():
        found_files.append("go.mod")
        try:
            for line in go_mod.read_text(encoding="utf-8").split("\n"):
                line = line.strip()
                if line.startswith("require ") or line.startswith("\t"):
                    parts = line.lstrip("require ").split()
                    if len(parts) >= 2 and not parts[0].startswith("//"):
                        deps.append({"ecosystem": "go", "name": parts[0], "version": parts[1]})
        except Exception:
            pass

    # -- Ruby: Gemfile --
    gemfile = base / "Gemfile"
    if gemfile.exists():
        found_files.append("Gemfile")
        try:
            for line in gemfile.read_text(encoding="utf-8").split("\n"):
                line = line.strip()
                if line.startswith("gem "):
                    parts = line[4:].strip().strip("'").strip('"').split(",")
                    name = parts[0].strip().strip("'").strip('"')
                    ver = ""
                    for p in parts[1:]:
                        p = p.strip().strip("'").strip('"')
                        for v in p.split():
                            if v[0].isdigit():
                                ver = v
                    deps.append({"ecosystem": "gem", "name": name, "version": ver})
        except Exception:
            pass

    # -- PHP: composer.json --
    composer_json = base / "composer.json"
    if composer_json.exists():
        found_files.append("composer.json")
        try:
            data = json.loads(composer_json.read_text(encoding="utf-8"))
            for section in ["require", "require-dev"]:
                for name, ver in data.get(section, {}).items():
                    if name != "php":
                        clean = str(ver).lstrip("^~>=<")
                        deps.append({"ecosystem": "composer", "name": name, "version": clean})
        except Exception:
            pass

    if not deps:
        return f"No dependency files found in {project_dir}. Looked for: package.json, Cargo.toml, requirements.txt, go.mod, Gemfile, composer.json"

    # Deduplicate
    seen: set[tuple[str, str, str]] = set()
    unique: list[dict[str, str]] = []
    for d in deps:
        key = (d["ecosystem"], d["name"], d["version"])
        if key not in seen:
            seen.add(key)
            unique.append(d)

    # Run the batch scan
    result = scan_deps(json.dumps(unique[:100]))  # cap at 100 deps

    return (
        f"=== Dependency Scan: {project_dir} ===\n"
        f"Found: {', '.join(found_files)}\n"
        f"Dependencies extracted: {len(unique)}\n\n"
        f"{result}"
    )


# ---- Entry point ----

if __name__ == "__main__":
    mcp.run()
