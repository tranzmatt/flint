#!/usr/bin/env bash
set -e

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "███████╗██╗     ██╗███╗   ██╗████████╗ "
echo -e "██╔════╝██║     ██║████╗  ██║╚══██╔══╝ "
echo -e "█████╗  ██║     ██║██╔██╗ ██║   ██║    "
echo -e "██╔══╝  ██║     ██║██║╚██╗██║   ██║    "
echo -e "██║     ███████╗██║██║ ╚████║   ██║    "
echo -e "╚═╝     ╚══════╝╚═╝╚═╝  ╚═══╝   ╚═╝    "
echo ""

# Check if installed
if [ ! -d "$FLINT_DIR/app" ]; then
    echo -e "${YELLOW}Flint is not installed. Run bash install.sh first.${NC}"
    exit 1
fi

# Check for changes
echo -e "${BLUE}[1/3]${NC} Checking for updates..."

if [ -d "$SCRIPT_DIR/.git" ]; then
    # Git-based update
    OLD_COMMIT=$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
    git -C "$SCRIPT_DIR" fetch origin main 2>/dev/null || git -C "$SCRIPT_DIR" fetch origin 2>/dev/null || true
    NEW_COMMIT=$(git -C "$SCRIPT_DIR" rev-parse origin/main 2>/dev/null || echo "$OLD_COMMIT")

    if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
        echo -e "      ${GREEN}App is up to date${NC}"
        echo ""
        exit 0
    fi

    echo -e "      ${DIM}Changes detected. Updating...${NC}"
    git -C "$SCRIPT_DIR" pull origin main 2>/dev/null || git -C "$SCRIPT_DIR" pull 2>/dev/null || true
else
    # Source directory update — just rebuild
    echo -e "      ${DIM}Rebuilding from source directory...${NC}"
fi

# Rebuild
echo -e "${BLUE}[2/3]${NC} Rebuilding..."

BUILD_DIR="$FLINT_DIR/.build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

for item in "$SCRIPT_DIR"/*; do
    name=$(basename "$item")
    case "$name" in
        node_modules|dist|.git) ;;
        *) cp -r "$item" "$BUILD_DIR/" ;;
    esac
done

cd "$BUILD_DIR"
npm install --loglevel=error 2>/dev/null || npm install
npm run build

if [ ! -f "$BUILD_DIR/dist/index.html" ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

# Copy new dist
rm -rf "$FLINT_DIR/app/dist"
cp -r "$BUILD_DIR/dist" "$FLINT_DIR/app/dist"

# Copy new agent
if [ -d "$BUILD_DIR/agent" ]; then
    rm -rf "$FLINT_DIR/agent"
    cp -r "$BUILD_DIR/agent" "$FLINT_DIR/agent"
    cp -r "$BUILD_DIR/agent" "$FLINT_DIR/app/agent"
fi

# Copy new Electron main
if [ -f "$BUILD_DIR/electron/main.cjs" ]; then
    cp "$BUILD_DIR/electron/main.cjs" "$FLINT_DIR/app/main.cjs"
fi

rm -rf "$BUILD_DIR"

echo -e "      ${GREEN}✓${NC} Build complete"

# Restart agent if running
echo -e "${BLUE}[3/3]${NC} Restarting AI Agent..."
if [ -f "/tmp/flint-agent-$(id -u).pid" ]; then
    OLD_PID=$(cat "/tmp/flint-agent-$(id -u).pid" 2>/dev/null)
    kill "$OLD_PID" 2>/dev/null || true
    rm -f "/tmp/flint-agent-$(id -u).pid"
    echo -e "      ${DIM}Agent stopped. It will restart with Flint.${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Flint updated successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Run ${BOLD}flint${NC} to start the updated version."
echo ""
