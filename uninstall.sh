#!/usr/bin/env bash

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
WHITE='\033[0;37m'
GRAY='\033[0;90m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"

echo ""
echo -e "${BOLD}${WHITE}  🪨  Flint Uninstaller${NC}"
echo ""

if [ ! -d "$FLINT_DIR" ]; then
    echo -e "  ${GRAY}Flint is not installed.${NC}"
    exit 0
fi

echo -e "  ${RED}This will remove Flint and all your vaults.${NC}"
echo -e "  ${GRAY}All notes and data in $FLINT_DIR will be deleted.${NC}"
echo ""
read -p "  Are you sure? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "  ${GREEN}Cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${GRAY}  Removing Flint...${NC}"

# Kill any running instance
pkill -f "flint" 2>/dev/null || true
sleep 1

# Remove app directory
rm -rf "$FLINT_DIR"
echo -e "  ${GREEN}✓${NC} Removed $FLINT_DIR"

# Remove CLI symlink
if [ -L /usr/local/bin/flint ]; then
    if [ -w /usr/local/bin ]; then
        rm /usr/local/bin/flint
    else
        sudo rm /usr/local/bin/flint
    fi
    echo -e "  ${GREEN}✓${NC} Removed /usr/local/bin/flint"
fi

# Remove .desktop file
rm -f "$HOME/.local/share/applications/flint.desktop" 2>/dev/null
echo -e "  ${GREEN}✓${NC} Removed app menu entry"

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

# Remove from PATH in shell configs
for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    if [ -f "$rc" ]; then
        sed -i '/# Flint/d' "$rc" 2>/dev/null || true
        sed -i '/flint\/bin/d' "$rc" 2>/dev/null || true
    fi
done
echo -e "  ${GREEN}✓${NC} Cleaned shell config"

echo ""
echo -e "${BOLD}${GREEN}  ✅ Flint has been completely removed.${NC}"
echo ""
