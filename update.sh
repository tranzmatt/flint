#!/usr/bin/env bash
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
WHITE='\033[0;37m'
GRAY='\033[0;90m'
YELLOW='\033[0;33m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"

echo ""
echo -e "${BOLD}${WHITE}  🪨  Flint Update${NC}"
echo ""

if [ ! -d "$FLINT_DIR" ]; then
    echo -e "  ${YELLOW}Flint is not installed. Run bash install.sh first.${NC}"
    exit 1
fi

# Find the source directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -d "$SCRIPT_DIR/.git" ]; then
    cd "$SCRIPT_DIR"
elif [ -d "$FLINT_DIR/app/.git" ]; then
    cd "$FLINT_DIR/app"
else
    cd "$SCRIPT_DIR"
fi

echo -e "${GRAY}  Checking for updates...${NC}"

# Get current commit
CURRENT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

# Fetch latest
git fetch origin main 2>/dev/null || git fetch origin master 2>/dev/null || {
    echo -e "  ${YELLOW}Could not fetch updates. You may be running a local copy.${NC}"
    echo -e "  ${GRAY}Rebuilding from current source...${NC}"
    npm install --silent 2>/dev/null
    npm run build 2>/dev/null
    mkdir -p "$FLINT_DIR/dist"
    cp -r dist/* "$FLINT_DIR/dist/" 2>/dev/null || true
    cp -f public/flint-logo.png "$FLINT_DIR/dist/flint-logo.png" 2>/dev/null || true
    echo -e "  ${GREEN}✓ Rebuilt from current source${NC}"
    exit 0
}

# Get remote commit
REMOTE=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null || echo "unknown")

if [ "$CURRENT" = "$REMOTE" ]; then
    echo ""
    echo -e "  ${GREEN}✅ App is up to date${NC}"
    echo -e "  ${GRAY}Version: ${CURRENT:0:8}${NC}"
    echo ""
    exit 0
fi

echo -e "  ${GRAY}  New version found. Updating...${NC}"

# Pull changes
git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || git pull 2>/dev/null

# Rebuild
echo -e "  ${GRAY}  Rebuilding...${NC}"
npm install --silent 2>/dev/null
npm run build 2>/dev/null

# Update dist
mkdir -p "$FLINT_DIR/dist"
cp -r dist/* "$FLINT_DIR/dist/" 2>/dev/null || true
cp -f public/flint-logo.png "$FLINT_DIR/dist/flint-logo.png" 2>/dev/null || true

# Update launcher
if [ -f "$FLINT_DIR/bin/flint" ]; then
    cp -f install.sh "$FLINT_DIR/install.sh" 2>/dev/null || true
fi

echo ""
echo -e "  ${GREEN}✅ Flint updated successfully!${NC}"
echo -e "  ${GRAY}${CURRENT:0:8} → ${REMOTE:0:8}${NC}"
echo ""
