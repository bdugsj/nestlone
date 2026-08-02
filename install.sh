#!/bin/bash
# Nestlone — Universal Installer
# Detects platform and offers Docker / Native / Both deployment.
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
BOLD='\033[1m'
log()  { echo -e "  ${GREEN}[OK]${NC} $1"; }
warn() { echo -e "  ${RED}[!]${NC}  $1"; }
info() { echo -e "  ${CYAN}[*]${NC}  $1"; }
head() { echo -e "\n${BOLD}${YELLOW}$1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Platform Detection ──────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Nestlone Security Platform Installer"
echo "============================================"

PLATFORM="unknown"
IS_WSL=false
HAS_DOCKER=false
HAS_CARGO=false
IS_KALI=false

# Detect OS
case "$(uname -s)" in
    Linux)
        IS_WSL=$(grep -qi "microsoft\|WSL" /proc/version 2>/dev/null && echo true || echo false)
        IS_KALI_OS=$(grep -qi "kali" /etc/os-release 2>/dev/null && echo true || echo false)
        if [ "$IS_KALI_OS" = true ]; then
            if [ "$IS_WSL" = true ]; then
                PLATFORM="Kali Linux (WSL2)"
            else
                PLATFORM="Kali Linux"
            fi
            IS_KALI=true
        elif [ "$IS_WSL" = true ]; then
            PLATFORM="WSL2 (Windows)"
        else
            PLATFORM="Linux ($(grep '^NAME=' /etc/os-release 2>/dev/null | cut -d'"' -f2 || echo 'unknown'))"
        fi
        ;;
    Darwin)  PLATFORM="macOS" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="Windows (Git Bash)" ;;
    *)       PLATFORM="$(uname -s)" ;;
esac

# Detect Docker
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    HAS_DOCKER=true
fi

# Detect Rust
if command -v cargo &>/dev/null; then
    HAS_CARGO=true
fi

# Detect Kali tools
if command -v nmap &>/dev/null && command -v msfconsole &>/dev/null; then
    IS_KALI=true
fi

echo ""
echo "  Platform:     $PLATFORM"
echo "  Docker:       $([ "$HAS_DOCKER" = true ] && echo "available" || echo "not found")"
echo "  Rust:         $([ "$HAS_CARGO" = true ] && echo "available ($(rustc --version 2>/dev/null | cut -d' ' -f2))" || echo "not found")"
echo "  Kali tools:   $([ "$IS_KALI" = true ] && echo "available" || echo "not found")"
echo ""

# ── Deployment Selection ────────────────────────────────────────────────
echo "Select deployment mode:"
echo ""
echo "  1) Docker        — Containerized, works everywhere (recommended for Windows/macOS)"
echo "  2) Native        — Bare-metal, requires Kali Linux (full pentest capability)"
echo "  3) Both          — Docker + Native (Kali with full toolkit)"
echo "  4) Development   — Just build from source, no container"
echo "  5) Quit"
echo ""

read -r -p "  Choice [1-5]: " CHOICE

case "$CHOICE" in
    1) MODE="docker" ;;
    2) MODE="native" ;;
    3) MODE="both" ;;
    4) MODE="dev" ;;
    5) echo "  Bye."; exit 0 ;;
    *) warn "Invalid choice"; exit 1 ;;
esac

echo ""
info "Selected: $MODE"

# ── .env Setup ──────────────────────────────────────────────────────────
head "API Configuration"

if [ ! -f ".env" ]; then
    cat > .env << 'ENVEOF'
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com
CODEWHALE_SESSION_MODEL=deepseek-v4-pro
NVD_API_KEY=
GITHUB_TOKEN=
ENVEOF
    warn ".env created — edit it before starting:"
    echo "       $SCRIPT_DIR/.env"
else
    log ".env exists"
fi

# ── Workspace ───────────────────────────────────────────────────────────
head "Workspace"
mkdir -p workspace/.nestlone/env workspace/.nestlone/experience \
         workspace/binaries workspace/hashes workspace/wordlists \
         workspace/reports workspace/targets

if [ ! -f "workspace/.nestlone/scope.json" ]; then
    echo '{"targets":[],"description":"Define authorized targets"}' > workspace/.nestlone/scope.json
fi
log "Workspace ready: $SCRIPT_DIR/workspace/"

# ── Binary PATH installation ────────────────────────────────────────────
install_to_path() {
    info "Installing binaries to PATH..."
    BIN_TARGET=""
    if [ -w /usr/local/bin ]; then
        BIN_TARGET="/usr/local/bin"
    else
        BIN_TARGET="$HOME/.local/bin"
        mkdir -p "$BIN_TARGET"
    fi
    # nestlone is the real TUI binary; nestlone-cli aliases the CLI facade
    ln -sf "$SCRIPT_DIR/CodeWhale/target/release/nestlone" "$BIN_TARGET/nestlone"
    ln -sf "$SCRIPT_DIR/CodeWhale/target/release/codewhale" "$BIN_TARGET/nestlone-cli"
    ln -sf "$SCRIPT_DIR/CodeWhale/target/release/codewhale" "$BIN_TARGET/codewhale"
    ln -sf "$SCRIPT_DIR/CodeWhale/target/release/nestlone"  "$BIN_TARGET/codewhale-tui"
    # Ensure the target dir is on PATH for future shells (bash + zsh)
    case ":$PATH:" in
        *":$BIN_TARGET:"*) ;;
        *)
            export PATH="$PATH:$BIN_TARGET"
            for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
                if [ -f "$rc" ] && ! grep -q "export PATH=.*$BIN_TARGET" "$rc" 2>/dev/null; then
                    echo "export PATH=\"\$PATH:$BIN_TARGET\"" >> "$rc"
                fi
            done
            ;;
    esac
    log "Installed: nestlone, nestlone-cli, codewhale → $BIN_TARGET"
}

# ═══════════════════════════════════════════════════════════════════════════
# Docker Install
# ═══════════════════════════════════════════════════════════════════════════
if [ "$MODE" = "docker" ] || [ "$MODE" = "both" ]; then
    head "Docker Deployment"

    if [ "$HAS_DOCKER" != "true" ]; then
        warn "Docker not found. Install Docker Desktop first:"
        echo "       https://www.docker.com/products/docker-desktop"
        exit 1
    fi

    # Ensure build context has required files
    mkdir -p CodeWhale/.codewhale
    cp -f .codewhale/mcp.json CodeWhale/.codewhale/mcp.json 2>/dev/null || true

    # Build
    info "Building Docker image (10-30 min on first run)..."
    if docker compose build; then
        log "Docker image built: nestlone-kali:latest"
    else
        warn "Docker build failed. Check Docker Desktop:"
        echo "       - Settings → Resources → Advanced → Memory ≥ 8GB"
        echo "       - Restart Docker Desktop and re-run: docker compose build"
        exit 1
    fi

    # Start
    info "Starting container..."
    docker compose up -d 2>&1 | tail -3
    log "Container running — access at:"
    echo "       TUI:    docker exec -it nestlone nestlone"
    echo "       Web UI: http://localhost:7878"
fi

# ═══════════════════════════════════════════════════════════════════════════
# Native Install
# ═══════════════════════════════════════════════════════════════════════════
if [ "$MODE" = "native" ] || [ "$MODE" = "both" ]; then
    head "Native Deployment"

    # ── Unified mirror detection ───────────────────────────────────
    USE_MIRRORS=false
    info "Checking network..."
    # One test to rule them all
    if ! curl -s --connect-timeout 3 https://github.com >/dev/null 2>&1; then
        USE_MIRRORS=true
        MIRROR_APT="mirrors.ustc.edu.cn"
        MIRROR_RUSTUP="https://mirrors.ustc.edu.cn/rust-static"
        MIRROR_PYPI="https://mirrors.ustc.edu.cn/pypi/web/simple"
        MIRROR_CARGO="sparse+https://mirrors.ustc.edu.cn/crates.io-index/"
        log "Network restricted — all sources use USTC mirrors"
    else
        log "Network open — using official sources"
    fi

    # System deps
    if [ "$IS_KALI" = true ]; then
        # Apply apt mirror if needed
        if [ "$USE_MIRRORS" = true ]; then
            for src in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources; do
                [ -f "$src" ] || continue
                sudo cp "$src" "$src.bak" 2>/dev/null || true
                sudo sed -i "s|URIs: http[s]*://[^/]*/kali|URIs: http://$MIRROR_APT/kali|g" "$src"
            done
        fi
        info "Installing system packages..."
        # Unset proxy vars that interfere with apt
        unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY 2>/dev/null || true
        sudo apt update
        sudo apt install -y build-essential pkg-config \
            libssl-dev libdbus-1-dev python3 python3-pip
        log "Build dependencies ready"
    else
        warn "Not running Kali. Install these manually:"
        echo "       build-essential pkg-config libssl-dev libdbus-1-dev python3 python3-pip"
    fi

    # Rust
    if [ "$HAS_CARGO" != "true" ]; then
        info "Installing Rust..."
        if [ "$USE_MIRRORS" = true ]; then
            export RUSTUP_DIST_SERVER="$MIRROR_RUSTUP"
            export RUSTUP_UPDATE_ROOT="$MIRROR_RUSTUP/rustup"
        fi
        curl --proto '=https' --tlsv1.2 -Sf --progress-bar https://sh.rustup.rs | sh -s -- -y --verbose
        source "$HOME/.cargo/env"
        # Cargo mirror
        if [ "$USE_MIRRORS" = true ]; then
            mkdir -p ~/.cargo
            printf '[source.crates-io]\nreplace-with = "ustc"\n\n[source.ustc]\nregistry = "%s"\n' "$MIRROR_CARGO" > ~/.cargo/config.toml
        fi
        log "Rust installed"
    else
        log "Rust: $(rustc --version)"
    fi

    # Python MCP
    info "Python MCP SDK..."
    PIP_MIRROR=""
    [ "$USE_MIRRORS" = true ] && PIP_MIRROR="-i $MIRROR_PYPI"
    pip3 install --break-system-packages $PIP_MIRROR mcp 2>&1 | tail -1 || \
        pip3 install $PIP_MIRROR mcp 2>&1 | tail -1
    log "MCP SDK ready"

    # Build
    info "Compiling Nestlone (10-20 min)..."
    cd CodeWhale
    cargo build --release -p codewhale-cli -p codewhale-tui
    cd "$SCRIPT_DIR"
    log "Native build complete"

    # Install binaries to PATH
    install_to_path
    log "Install complete — you can now run: nestlone"

    # MCP config
    mkdir -p "$HOME/.codewhale"
    cat > "$HOME/.codewhale/mcp.json" << MCPEOF
{
  "mcpServers": {
    "nestlone-vuln": {
      "command": "python3",
      "args": ["$SCRIPT_DIR/mcp/vuln_server.py"],
      "enabled": true
    },
    "nestlone-pentest": {
      "command": "python3",
      "args": ["$SCRIPT_DIR/mcp/pentest_server.py"],
      "enabled": true
    }
  }
}
MCPEOF
    log "MCP config: ~/.codewhale/mcp.json"
fi

# ═══════════════════════════════════════════════════════════════════════════
# Dev Mode
# ═══════════════════════════════════════════════════════════════════════════
if [ "$MODE" = "dev" ]; then
    head "Development Build"
    if [ "$HAS_CARGO" != "true" ]; then
        curl --proto '=https' --tlsv1.2 -Sf --progress-bar https://sh.rustup.rs | sh -s -- -y --verbose
        source "$HOME/.cargo/env"
    fi
    pip3 install --break-system-packages mcp 2>/dev/null || true
    cd CodeWhale
    cargo build --release -p codewhale-cli -p codewhale-tui
    cd "$SCRIPT_DIR"
    log "Dev build complete"
    install_to_path
    log "Install complete — you can now run: nestlone"
fi

# ── Done ─────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Install Complete"
echo "============================================"
echo ""
echo "  Config:   .env  ← edit API key here"
echo "  Workspace: workspace/"
echo "  Scope:     workspace/.nestlone/scope.json"
echo ""
if [ "$MODE" = "docker" ] || [ "$MODE" = "both" ]; then
    echo "  Docker:"
    echo "    TUI:    docker exec -it nestlone nestlone"
    echo "    Web:    http://localhost:7878"
    echo "    Stop:   docker compose down"
fi
if [ "$MODE" = "native" ] || [ "$MODE" = "both" ] || [ "$MODE" = "dev" ]; then
    echo "  Native:"
    echo "    TUI:    CodeWhale/target/release/nestlone"
    echo "    Web:    CodeWhale/target/release/codewhale app-server --http --host 0.0.0.0 --port 7878"
fi
echo ""
