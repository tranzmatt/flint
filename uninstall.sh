#!/usr/bin/env bash
set -e

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  ⬡ Flint — Uninstall${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ ! -d "$FLINT_DIR" ]; then
    echo -e "${YELLOW}Flint is not installed.${NC}"
    exit 0
fi

# Ask about data
echo -e "${DIM}This will remove Flint from your system.${NC}"
echo ""
read -p "Keep vault data for future reinstall? (y/N): " KEEP_DATA
echo ""

# Kill running processes
echo -e "${YELLOW}[1/4]${NC} Stopping processes..."
pkill -f "flint-agent" 2>/dev/null || true
pkill -f "agent.py.*flint" 2>/dev/null || true
pkill -f "electron.*flint" 2>/dev/null || true
# Kill agent via PID file
if [ -f "/tmp/flint-agent-$(id -u).pid" ]; then
    OLD_PID=$(cat "/tmp/flint-agent-$(id -u).pid" 2>/dev/null)
    kill "$OLD_PID" 2>/dev/null || true
    rm -f "/tmp/flint-agent-$(id -u).pid"
fi
echo -e "      ${GREEN}✓${NC} Processes stopped"

# Remove app menu entry
echo -e "${YELLOW}[2/4]${NC} Removing app menu entry..."
rm -f "$HOME/.local/share/applications/flint.desktop"
update-desktop-database ~/.local/share/applications/ 2>/dev/null || true
echo -e "      ${GREEN}✓${NC} Desktop entry removed"

# Remove CLI command
echo -e "${YELLOW}[3/4]${NC} Removing CLI command..."
rm -f "/usr/local/bin/flint" 2>/dev/null || sudo rm -f "/usr/local/bin/flint" 2>/dev/null || true
echo -e "      ${GREEN}✓${NC} Command removed"

# Remove installation
echo -e "${YELLOW}[4/4]${NC} Removing Flint..."
if [[ "$KEEP_DATA" =~ ^[Yy]$ ]]; then
    echo -e "      ${DIM}Keeping vault data...${NC}"
    rm -rf "$FLINT_DIR/app"
    rm -rf "$FLINT_DIR/agent"
    rm -rf "$FLINT_DIR/icons"
    rm -rf "$FLINT_DIR/.build"
    rm -f "$FLINT_DIR/flint"
    rm -f "$FLINT_DIR/flint-agent"
    rm -f "$FLINT_DIR/icon.png"
    echo -e "      ${GREEN}✓${NC} Flint removed (vault data kept at $FLINT_DIR)"
else
    rm -rf "$FLINT_DIR"
    echo -e "      ${GREEN}✓${NC} Flint completely removed"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Flint has been uninstalled${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
