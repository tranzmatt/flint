#!/usr/bin/env bash
set -e

# ─────────────────────────────────────────
# Flint — Local Knowledge Base Installer
# ─────────────────────────────────────────

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
WHITE='\033[0;37m'
GRAY='\033[0;90m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"
REPO_URL="https://github.com/flint-editor/flint.git"

echo ""
echo -e "${BOLD}${WHITE}  ┌─────────────────────────────┐${NC}"
echo -e "${BOLD}${WHITE}  │                             │${NC}"
echo -e "${BOLD}${WHITE}  │   🪨  Flint Installer       │${NC}"
echo -e "${BOLD}${WHITE}  │   Local Knowledge Base      │${NC}"
echo -e "${BOLD}${WHITE}  │                             │${NC}"
echo -e "${BOLD}${WHITE}  └─────────────────────────────┘${NC}"
echo ""

# Check dependencies
echo -e "${GRAY}  Checking dependencies...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "  ${GREEN}Installing Node.js...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y -qq nodejs npm
    elif command -v brew &> /dev/null; then
        brew install node
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y nodejs npm
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm nodejs npm
    else
        echo -e "  Please install Node.js manually: https://nodejs.org"
        exit 1
    fi
fi

echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"
echo -e "  ${GREEN}✓${NC} npm $(npm -v)"

# Setup directory
echo ""
echo -e "${GRAY}  Setting up Flint...${NC}"

mkdir -p "$FLINT_DIR"

# If running from the repo, use current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/package.json" ]; then
    echo -e "  ${GREEN}✓${NC} Using local source: $SCRIPT_DIR"
    cd "$SCRIPT_DIR"
else
    # Clone from remote
    if [ ! -d "$FLINT_DIR/src" ]; then
        echo -e "  ${GRAY}  Cloning repository...${NC}"
        git clone "$REPO_URL" "$FLINT_DIR/app" 2>/dev/null || {
            echo -e "  Could not clone repository."
            echo -e "  Please run this script from the Flint project directory."
            exit 1
        }
        cd "$FLINT_DIR/app"
    else
        cd "$FLINT_DIR"
    fi
fi

# Install dependencies
echo -e "  ${GRAY}  Installing dependencies...${NC}"
npm install --silent 2>/dev/null

# Build
echo -e "  ${GRAY}  Building Flint...${NC}"
npm run build 2>/dev/null

# Copy dist to data directory
mkdir -p "$FLINT_DIR/dist"
cp -r dist/* "$FLINT_DIR/dist/" 2>/dev/null || true

echo -e "  ${GREEN}✓${NC} Build complete"

# Create launcher script
mkdir -p "$FLINT_DIR/bin"
cat > "$FLINT_DIR/bin/flint" << 'LAUNCHER'
#!/usr/bin/env bash
# Flint Launcher
FLINT_DIR="$HOME/.flint"
PORT="${FLINT_PORT:-4777}"

# Kill any existing Flint server
pkill -f "flint-server" 2>/dev/null || true

# Start server
echo "Starting Flint on http://localhost:$PORT"

# Try python3 first, then node, then busybox
if command -v python3 &> /dev/null; then
    python3 -c "
import http.server
import os
import threading
import webbrowser

os.chdir('$FLINT_DIR/dist')
server = http.server.HTTPServer(('127.0.0.1', $PORT), http.server.SimpleHTTPRequestHandler)
threading.Timer(0.5, lambda: webbrowser.open('http://localhost:$PORT')).start()
print('Flint is running at http://localhost:$PORT')
print('Press Ctrl+C to stop')
server.serve_forever()
"
elif command -v npx &> /dev/null; then
    echo "Opening Flint in your browser..."
    (sleep 1 && xdg-open "http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT" 2>/dev/null) &
    npx -y serve "$FLINT_DIR/dist" -l $PORT -s
else
    echo "Error: Python3 or Node.js required to run the server"
    exit 1
fi
LAUNCHER
chmod +x "$FLINT_DIR/bin/flint"

# Symlink to /usr/local/bin
if [ -w /usr/local/bin ]; then
    ln -sf "$FLINT_DIR/bin/flint" /usr/local/bin/flint
else
    sudo ln -sf "$FLINT_DIR/bin/flint" /usr/local/bin/flint
fi
echo -e "  ${GREEN}✓${NC} Command installed: ${DIM}flint${NC}"

# Create .desktop file
mkdir -p "$HOME/.local/share/applications"
cat > "$HOME/.local/share/applications/flint.desktop" << DESKTOP
[Desktop Entry]
Name=Flint
Comment=Local Knowledge Base
Exec=$FLINT_DIR/bin/flint
Icon=$FLINT_DIR/dist/flint-logo.png
Terminal=false
Type=Application
Categories=Office;Utility;TextEditor;
StartupNotify=true
DESKTOP
chmod +x "$HOME/.local/share/applications/flint.desktop"

# Copy logo for icon
cp -f "$SCRIPT_DIR/public/flint-logo.png" "$FLINT_DIR/dist/flint-logo.png" 2>/dev/null || true
cp -f "$FLINT_DIR/dist/flint-logo.png" "$FLINT_DIR/flint-logo.png" 2>/dev/null || true

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

echo -e "  ${GREEN}✓${NC} App menu entry created"

# Add to PATH if needed
if [[ ":$PATH:" != *":$FLINT_DIR/bin:"* ]]; then
    SHELL_RC="$HOME/.bashrc"
    if [ -f "$HOME/.zshrc" ] && [ "$SHELL" = *"zsh"* ]; then
        SHELL_RC="$HOME/.zshrc"
    fi
    echo "" >> "$SHELL_RC"
    echo "# Flint" >> "$SHELL_RC"
    echo "export PATH=\"\$PATH:$FLINT_DIR/bin\"" >> "$SHELL_RC"
    echo -e "  ${GREEN}✓${NC} Added to PATH in $(basename $SHELL_RC)"
fi

echo ""
echo -e "${BOLD}${GREEN}  ✅ Flint installed successfully!${NC}"
echo ""
echo -e "  ${WHITE}Usage:${NC}"
echo -e "    ${DIM}flint${NC}              Start Flint"
echo -e "    ${DIM}bash update.sh${NC}     Update Flint"
echo -e "    ${DIM}bash uninstall.sh${NC}  Remove Flint"
echo ""
echo -e "  ${DIM}Or search 'Flint' in your application menu.${NC}"
echo ""
