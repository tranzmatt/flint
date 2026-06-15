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

# ✅ YOUR GITHUB REPO
REPO_URL="https://github.com/Chintanpatel24/flint.git"
BRANCH="main"

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
    # ✅ Already a git repo — force origin to your URL
    git -C "$SCRIPT_DIR" remote set-url origin "$REPO_URL" 2>/dev/null || \
    git -C "$SCRIPT_DIR" remote add origin "$REPO_URL" 2>/dev/null || true

    OLD_COMMIT=$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")

    git -C "$SCRIPT_DIR" fetch origin "$BRANCH" 2>/dev/null || true

    NEW_COMMIT=$(git -C "$SCRIPT_DIR" rev-parse origin/"$BRANCH" 2>/dev/null || echo "$OLD_COMMIT")

    if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
        echo -e "      ${GREEN}App is up to date${NC}"
        echo ""
        exit 0
    fi

    echo -e "      ${DIM}Changes detected. Updating...${NC}"
    git -C "$SCRIPT_DIR" pull origin "$BRANCH" 2>/dev/null || true

else
    # ✅ No git folder — clone fresh from your GitHub URL
    echo -e "      ${DIM}No git folder found. Cloning from GitHub...${NC}"

    TEMP_CLONE="$FLINT_DIR/.clone"
    rm -rf "$TEMP_CLONE"

    if ! git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$TEMP_CLONE"; then
        echo -e "${RED}Failed to clone from GitHub. Check your internet connection.${NC}"
        exit 1
    fi

    # Copy new files into SCRIPT_DIR (excluding .git folder)
    rsync -a --exclude='.git' "$TEMP_CLONE/" "$SCRIPT_DIR/"

    rm -rf "$TEMP_CLONE"

    echo -e "      ${DIM}Source updated from GitHub.${NC}"
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

echo -e "      ${DIM}Installing dependencies...${NC}"
npm install --loglevel=error 2>/dev/null || npm install

echo -e "      ${DIM}Building app...${NC}"
npm run build

if [ ! -f "$BUILD_DIR/dist/index.html" ]; then
    echo -e "${RED}Build failed! dist/index.html not found.${NC}"
    exit 1
fi

# Copy new dist
echo -e "      ${DIM}Copying new build...${NC}"
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
else
    echo -e "      ${DIM}No running agent found.${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Flint updated successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Run ${BOLD}flint${NC} to start the updated version."
echo ""
