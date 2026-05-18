#!/usr/bin/env bash
set -e

# ============================
# Flint — Install Script v4
# With Python AI Agent
# ============================

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"
FLINT_APP="$FLINT_DIR/app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo ""
echo -e "███████╗██╗     ██╗███╗   ██╗████████╗ "
echo -e "██╔════╝██║     ██║████╗  ██║╚══██╔══╝ "
echo -e "█████╗  ██║     ██║██╔██╗ ██║   ██║    "
echo -e "██╔══╝  ██║     ██║██║╚██╗██║   ██║    "
echo -e "██║     ███████╗██║██║ ╚████║   ██║    "
echo -e "╚═╝     ╚══════╝╚═╝╚═╝  ╚═══╝   ╚═╝    "
echo ""

# ---- Step 1: Check Node.js ----

echo -e "${BLUE}[1/9]${NC} Checking Node.js..."

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found.${NC}"
    echo -e "Install it from ${BOLD}https://nodejs.org${NC} (v18+) and re-run this script."
    exit 1
fi

NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${RED}Node.js 18+ required. You have $(node -v). Please upgrade.${NC}"
    exit 1
fi

echo -e "      ${GREEN}✓${NC} Node.js $(node -v)"
echo -e "      ${GREEN}✓${NC} npm $(npm -v)"

# ---- Step 2: Check Python ----

echo -e "${BLUE}[2/9]${NC} Checking Python..."

PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
fi

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${YELLOW}⚠ Python not found. AI Agent will not be available.${NC}"
    echo -e "      Install Python 3: ${BOLD}sudo apt install python3 python3-pip${NC} (or equivalent)"
else
    PY_VERSION=$($PYTHON_CMD --version 2>&1 | head -1)
    echo -e "      ${GREEN}✓${NC} $PY_VERSION"
fi

# ---- Step 3: Clean old installation ----

echo -e "${BLUE}[3/9]${NC} Preparing installation directory..."

# Preserve vault data from localStorage (in browser profile)
if [ -d "$FLINT_DIR" ]; then
    echo -e "      ${DIM}Cleaning old installation (vault data preserved)...${NC}"
    # Keep the flint-data backup if it exists
    if [ -f "$FLINT_DIR/vault-backup.json" ]; then
        VAULT_BACKUP="$FLINT_DIR/vault-backup.json"
    fi
    rm -rf "$FLINT_DIR/app" "$FLINT_DIR/.build" "$FLINT_DIR/agent"
    rm -f "$FLINT_DIR/flint" "$FLINT_DIR/icon.png"
fi

mkdir -p "$FLINT_APP"

# Restore vault backup if exists
if [ -n "$VAULT_BACKUP" ] && [ -f "$VAULT_BACKUP" ]; then
    cp "$VAULT_BACKUP" "$FLINT_DIR/vault-backup.json"
fi

# ---- Step 4: Build the web app ----

echo -e "${BLUE}[4/9]${NC} Building Flint..."

BUILD_DIR="$FLINT_DIR/.build"
mkdir -p "$BUILD_DIR"

for item in "$SCRIPT_DIR"/*; do
    name=$(basename "$item")
    case "$name" in
        node_modules|dist|.git) ;;
        *) cp -r "$item" "$BUILD_DIR/" ;;
    esac
done

cd "$BUILD_DIR"

echo -e "      ${DIM}Installing npm dependencies...${NC}"
npm install --loglevel=error 2>/dev/null || npm install

echo -e "      ${DIM}Compiling...${NC}"
npm run build

if [ ! -f "$BUILD_DIR/dist/index.html" ]; then
    echo -e "${RED}Build failed — dist/index.html not created.${NC}"
    exit 1
fi

echo -e "      ${GREEN}✓${NC} Build complete"

# ---- Step 5: Set up Python AI Agent ----

echo -e "${BLUE}[5/9]${NC} Setting up AI Agent..."

AGENT_DIR="$FLINT_DIR/agent"
mkdir -p "$AGENT_DIR"

# Copy agent files
if [ -d "$BUILD_DIR/agent" ]; then
    cp -r "$BUILD_DIR/agent/"* "$AGENT_DIR/"
    echo -e "      ${GREEN}✓${NC} Agent files copied"
else
    echo -e "      ${YELLOW}⚠ No agent/ directory found in source${NC}"
fi

# Install Python dependencies
if [ -n "$PYTHON_CMD" ]; then
    if [ -f "$AGENT_DIR/requirements.txt" ]; then
        echo -e "      ${DIM}Installing Python packages (flask, flask-cors, requests)...${NC}"
        $PYTHON_CMD -m pip install -q flask flask-cors requests 2>/dev/null || {
            # Try with --user flag
            $PYTHON_CMD -m pip install --user -q flask flask-cors requests 2>/dev/null || {
                echo -e "      ${YELLOW}⚠ pip install failed. Agent may need manual setup.${NC}"
                echo -e "      ${DIM}Run: pip3 install flask flask-cors requests${NC}"
            }
        }
        if $PYTHON_CMD -c "import flask, flask_cors, requests" 2>/dev/null; then
            echo -e "      ${GREEN}✓${NC} Python packages installed"
        else
            echo -e "      ${YELLOW}⚠ Some packages missing. AI will use browser fallback.${NC}"
        fi
    fi
fi

# Test agent can start
if [ -n "$PYTHON_CMD" ] && [ -f "$AGENT_DIR/agent.py" ]; then
    # Quick syntax check
    if $PYTHON_CMD -c "import ast; ast.parse(open('$AGENT_DIR/agent.py').read())" 2>/dev/null; then
        echo -e "      ${GREEN}✓${NC} Agent script valid"
    else
        echo -e "      ${YELLOW}⚠ Agent script has errors${NC}"
    fi
fi

# ---- Step 6: Create application icon ----

echo -e "${BLUE}[6/9]${NC} Creating application icon..."

ICON_DIR="$FLINT_DIR/icons"
mkdir -p "$ICON_DIR"

if [ -f "$BUILD_DIR/public/flint-logo.png" ]; then
    # Copy the main PNG icon everywhere
    cp "$BUILD_DIR/public/flint-logo.png" "$FLINT_DIR/icon.png"
    cp "$BUILD_DIR/public/flint-logo.png" "$FLINT_APP/icon.png"
    cp "$BUILD_DIR/public/flint-logo.png" "$ICON_DIR/flint.png"

    # Create resized versions using ImageMagick if available
    if command -v convert &> /dev/null; then
        convert -background none -resize 256x256 "$ICON_DIR/flint.png" "$ICON_DIR/flint-256.png" 2>/dev/null || true
        convert -background none -resize 128x128 "$ICON_DIR/flint.png" "$ICON_DIR/flint-128.png" 2>/dev/null || true
        convert -background none -resize 64x64 "$ICON_DIR/flint.png" "$ICON_DIR/flint-64.png" 2>/dev/null || true
        convert -background none -resize 48x48 "$ICON_DIR/flint.png" "$ICON_DIR/flint-48.png" 2>/dev/null || true
        if [ -f "$ICON_DIR/flint-256.png" ]; then
            cp "$ICON_DIR/flint-256.png" "$FLINT_DIR/icon.png"
            cp "$ICON_DIR/flint-256.png" "$FLINT_APP/icon.png"
        fi
        echo -e "      ${GREEN}✓${NC} Icon created at all sizes (ImageMagick)"
    else
        # Just use the PNG as-is at all sizes
        cp "$ICON_DIR/flint.png" "$ICON_DIR/flint-256.png"
        cp "$ICON_DIR/flint.png" "$ICON_DIR/flint-128.png"
        cp "$ICON_DIR/flint.png" "$ICON_DIR/flint-64.png"
        cp "$ICON_DIR/flint.png" "$ICON_DIR/flint-48.png"
        echo -e "      ${GREEN}✓${NC} Icon created from PNG"
    fi
else
    echo -e "      ${YELLOW}⚠${NC} No flint-logo.png found"
fi

# ---- Step 7: Set up Electron app ----

echo -e "${BLUE}[7/9]${NC} Setting up desktop mode..."

# Create isolated Electron app directory with NO "type":"module"
cat > "$FLINT_APP/package.json" << 'PKGJSON'
{
  "name": "flint-desktop",
  "version": "1.0.0",
  "private": true,
  "main": "main.cjs"
}
PKGJSON

# Copy Electron main process
cp "$BUILD_DIR/electron/main.cjs" "$FLINT_APP/main.cjs"

# Copy built web app
cp -r "$BUILD_DIR/dist" "$FLINT_APP/dist"

# Copy agent into app dir too (for Electron to auto-start)
mkdir -p "$FLINT_APP/agent"
cp -r "$AGENT_DIR/"* "$FLINT_APP/agent/" 2>/dev/null || true

# Install Electron
cd "$FLINT_APP"
echo -e "      ${DIM}Installing Electron (this may take a minute)...${NC}"
npm install electron --save-dev --loglevel=error 2>/dev/null || {
    echo -e "      ${YELLOW}Electron install from npm failed, retrying...${NC}"
    npm install electron --save-dev
}

ELECTRON_OK=false
if [ -d "$FLINT_APP/node_modules/electron" ]; then
    ELECTRON_OK=true
    EVERSION=$(node -e "console.log(require('./node_modules/electron/package.json').version)" 2>/dev/null || echo "installed")
    echo -e "      ${GREEN}✓${NC} Electron v$EVERSION"
else
    echo -e "      ${YELLOW}⚠ Electron not available. Will use browser mode.${NC}"
fi

# Clean up build directory
rm -rf "$BUILD_DIR"

# ---- Step 8: Create launcher scripts ----

echo -e "${BLUE}[8/9]${NC} Creating launcher..."

# Main launcher — starts agent + Electron
cat > "$FLINT_DIR/flint" << LAUNCHER
#!/usr/bin/env bash
# Flint Desktop Launcher v4 — with AI Agent

FLINT_DIR="$FLINT_DIR"
FLINT_APP="$FLINT_APP"
AGENT_PID_FILE="/tmp/flint-agent-\$(id -u).pid"

# Start Python AI Agent in background
start_agent() {
    if [ -f "\$AGENT_PID_FILE" ]; then
        OLD_PID=\$(cat "\$AGENT_PID_FILE" 2>/dev/null)
        if kill -0 "\$OLD_PID" 2>/dev/null; then
            return  # Already running
        fi
    fi
    
    PYTHON_CMD=""
    command -v python3 &>/dev/null && PYTHON_CMD="python3"
    [ -z "\$PYTHON_CMD" ] && command -v python &>/dev/null && PYTHON_CMD="python"
    
    if [ -n "\$PYTHON_CMD" ] && [ -f "\$FLINT_DIR/agent/agent.py" ]; then
        \$PYTHON_CMD "\$FLINT_DIR/agent/agent.py" &
        AGENT_PID=\$!
        echo \$AGENT_PID > "\$AGENT_PID_FILE"
        sleep 1  # Give agent time to start
    fi
}

stop_agent() {
    if [ -f "\$AGENT_PID_FILE" ]; then
        OLD_PID=\$(cat "\$AGENT_PID_FILE" 2>/dev/null)
        kill "\$OLD_PID" 2>/dev/null
        rm -f "\$AGENT_PID_FILE"
    fi
}

# Start agent
start_agent

# Launch app
if [ -d "\$FLINT_APP/node_modules/electron" ]; then
    "\$FLINT_APP/node_modules/.bin/electron" "\$FLINT_APP" "\$@"
    EXIT_CODE=\$?
else
    echo "Flint: Electron not found, opening in browser..."
    python3 -m http.server 4777 --directory "\$FLINT_APP/dist" &
    HTTP_PID=\$!
    xdg-open http://localhost:4777 2>/dev/null || sensible-browser http://localhost:4777
    wait \$HTTP_PID
    EXIT_CODE=\$?
fi

# Cleanup agent on exit
stop_agent
exit \$EXIT_CODE
LAUNCHER
chmod +x "$FLINT_DIR/flint"

# Agent-only launcher (for browser mode)
cat > "$FLINT_DIR/flint-agent" << AGENT_LAUNCHER
#!/usr/bin/env bash
# Flint AI Agent standalone launcher
PYTHON_CMD=""
command -v python3 &>/dev/null && PYTHON_CMD="python3"
[ -z "\$PYTHON_CMD" ] && command -v python &>/dev/null && PYTHON_CMD="python"

if [ -z "\$PYTHON_CMD" ]; then
    echo "Error: Python 3 not found"
    exit 1
fi

echo "Starting Flint AI Agent on http://localhost:5100"
echo "Press Ctrl+C to stop"
exec \$PYTHON_CMD "$FLINT_DIR/agent/agent.py"
AGENT_LAUNCHER
chmod +x "$FLINT_DIR/flint-agent"

# System-wide command
FLINT_BIN="/usr/local/bin/flint"
if [ -w "/usr/local/bin" ] || [ -w "$FLINT_BIN" ]; then
    ln -sf "$FLINT_DIR/flint" "$FLINT_BIN" 2>/dev/null || {
        sudo ln -sf "$FLINT_DIR/flint" "$FLINT_BIN" 2>/dev/null || true
    }
else
    sudo ln -sf "$FLINT_DIR/flint" "$FLINT_BIN" 2>/dev/null || true
fi

echo -e "      ${GREEN}✓${NC} Command: ${BOLD}flint${NC}"

# ---- Step 9: Create desktop entry ----

echo -e "${BLUE}[9/9]${NC} Creating app menu entry..."

DESKTOP_FILE="$HOME/.local/share/applications/flint.desktop"
mkdir -p "$(dirname "$DESKTOP_FILE")"

ICON_PATH="$FLINT_DIR/icon.png"
if [ -f "$ICON_DIR/flint-256.png" ]; then
    ICON_PATH="$ICON_DIR/flint-256.png"
fi

cat > "$DESKTOP_FILE" << DESKTOP
[Desktop Entry]
Name=Flint
Comment=Local Knowledge Base with AI
Exec=$FLINT_DIR/flint %U
Icon=$ICON_PATH
Type=Application
Categories=Office;Utility;TextEditor;
Keywords=notes;markdown;knowledge;ai;
StartupNotify=true
Terminal=false
StartupWMClass=Flint
DESKTOP

chmod +x "$DESKTOP_FILE"
update-desktop-database ~/.local/share/applications/ 2>/dev/null || true

echo -e "      ${GREEN}✓${NC} Added to app menu"

# ---- Done ----

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Flint installed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Open from app menu:   ${BOLD}Search 'Flint' in your app launcher${NC}"
echo -e "  Run from terminal:    ${BOLD}flint${NC}"
echo -e "  AI Agent only:        ${BOLD}flint-agent${NC}"
echo -e "  Installed at:         ${DIM}$FLINT_APP${NC}"
echo ""
if [ "$ELECTRON_OK" = true ]; then
    echo -e "  Mode:    ${GREEN}Desktop app (Electron)${NC}"
else
    echo -e "  Mode:    ${YELLOW}Browser mode (install Electron for desktop)${NC}"
fi
if [ -n "$PYTHON_CMD" ]; then
    echo -e "  AI:      ${GREEN}Python Agent + Ollama${NC}"
else
    echo -e "  AI:      ${YELLOW}Browser fallback (install Python for agent)${NC}"
fi
echo ""
echo -e "  ${DIM}Update:  bash update.sh${NC}"
echo -e "  ${DIM}Remove:  bash uninstall.sh${NC}"
echo ""
echo -e "  ${DIM}For full AI: Install Ollama from https://ollama.ai${NC}"
echo -e "  ${DIM}Then: ollama pull llama3.2 (or any model)${NC}"
echo ""
