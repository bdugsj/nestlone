#!/bin/bash
# Nestlone — Kali native one-click installer.
# Run: chmod +x install.sh && ./install.sh
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${RED}[!]${NC} $1"; }
info() { echo -e "${CYAN}[*]${NC} $1"; }

NESTLONE_HOME="${NESTLONE_HOME:-$HOME/nestlone}"
WORKSPACE="$HOME/nestlone-workspace"

echo "============================================"
echo "  Nestlone Security Platform — Kali Installer"
echo "============================================"
echo ""

# ── Step 1: System dependencies ─────────────────────────────────────
info "Step 1/6: System packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
    build-essential pkg-config libssl-dev libdbus-1-dev \
    python3 python3-pip git curl xxd \
    nmap sqlmap hydra nikto ffuf john hashcat metasploit-framework \
    dirb gobuster whatweb dnsrecon enum4linux smbclient \
    exploitdb 2>&1 | tail -1
log "System packages ready"

# ── Step 2: Rust toolchain ──────────────────────────────────────────
info "Step 2/6: Rust toolchain..."
if command -v cargo &>/dev/null; then
    log "Rust already installed: $(rustc --version)"
else
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    log "Rust installed: $(rustc --version)"
fi

# ── Step 3: Python MCP deps ──────────────────────────────────────────
info "Step 3/6: Python MCP SDK..."
pip3 install --break-system-packages mcp 2>&1 | tail -1
log "MCP SDK ready"

# ── Step 4: Project directory ────────────────────────────────────────
info "Step 4/6: Project setup..."
mkdir -p "$NESTLONE_HOME" "$WORKSPACE"
log "Nestlone home: $NESTLONE_HOME"
log "Workspace: $WORKSPACE"

# Copy project if running from source, otherwise clone
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/Cargo.toml" ]; then
    info "Detected source at $SCRIPT_DIR — building from local copy"
    PROJECT_DIR="$SCRIPT_DIR"
elif [ -d "$NESTLONE_HOME/CodeWhale" ]; then
    info "Project already at $NESTLONE_HOME/CodeWhale"
    PROJECT_DIR="$NESTLONE_HOME/CodeWhale"
else
    warn "No project source found. Place CodeWhale source at $NESTLONE_HOME/CodeWhale/"
    warn "Then re-run: cd $NESTLONE_HOME/CodeWhale && ./install.sh"
    exit 1
fi

# ── Step 5: Build ────────────────────────────────────────────────────
info "Step 5/6: Compiling Nestlone (this takes 10-20 min)..."
cd "$PROJECT_DIR"
cargo build --release -p codewhale-cli -p codewhale-tui 2>&1 | tail -5
log "Build complete"
log "  Binary: $PROJECT_DIR/target/release/codewhale"
log "  TUI:    $PROJECT_DIR/target/release/codewhale-tui"

# ── Step 6: Configuration ────────────────────────────────────────────
info "Step 6/6: Configuration..."

# .env
if [ ! -f "$PROJECT_DIR/.env" ]; then
    cat > "$PROJECT_DIR/.env" << 'ENVEOF'
# Nestlone API Configuration
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com
CODEWHALE_SESSION_MODEL=deepseek-v4-pro
NVD_API_KEY=
GITHUB_TOKEN=
ENVEOF
    warn "Created .env — edit it: $PROJECT_DIR/.env"
fi

# Workspace structure
mkdir -p "$WORKSPACE"/{.nestlone/env,binaries,hashes,wordlists,reports,targets}
mkdir -p "$WORKSPACE/.nestlone/experience"

# MCP config
mkdir -p "$HOME/.codewhale"
cat > "$HOME/.codewhale/mcp.json" << 'MCPEOF'
{
  "mcpServers": {
    "nestlone-vuln": {
      "command": "python3",
      "args": ["NESTLONE_HOME/mcp/vuln_server.py"],
      "enabled": true
    },
    "nestlone-pentest": {
      "command": "python3",
      "args": ["NESTLONE_HOME/mcp/pentest_server.py"],
      "enabled": true
    }
  }
}
MCPEOF
sed -i "s|NESTLONE_HOME|$PROJECT_DIR|g" "$HOME/.codewhale/mcp.json"
log "MCP config: ~/.codewhale/mcp.json"

# Scope file template
if [ ! -f "$WORKSPACE/.nestlone/scope.json" ]; then
    cat > "$WORKSPACE/.nestlone/scope.json" << 'SCOPEEOF'
{
  "targets": [],
  "description": "Define authorized targets here before using pentest tools"
}
SCOPEEOF
fi

# ── Done ──────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Installation Complete"
echo "============================================"
echo ""
echo "  Edit API key:  $PROJECT_DIR/.env"
echo "  Start (TUI):   $PROJECT_DIR/target/release/codewhale-tui"
echo "  Start (Web):   $PROJECT_DIR/target/release/codewhale app-server --http --host 0.0.0.0 --port 7878"
echo ""
echo "  Workspace:     $WORKSPACE"
echo "  Scope file:    $WORKSPACE/.nestlone/scope.json"
echo ""
echo "  Before first pentest: edit scope.json with authorized targets"
echo "  Update Exploit-DB:    searchsploit -u"
echo ""
