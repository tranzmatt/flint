# How to Build and Install Flint

Flint is packaged as a universal desktop application using **Electron** (for the frontend) and **PyInstaller** (for the backend AI agent). This means users can run Flint locally without needing to install Python or configure dependencies themselves.

## Requirements
To generate the desktop installer from the source code, you need:
- **Node.js** (v18+)
- **Python 3**
- **pip**

## 1. Initial Setup
Before building the app for the first time, install the required frontend and backend dependencies:

```bash
# Install Node dependencies (including electron & electron-builder)
npm install

# Install PyInstaller (used to compile the Python backend)
pip install pyinstaller

# Install Python backend dependencies
cd agent
pip install -r requirements.txt
cd ..
```

## 2. Generate the Desktop Installer
To package the app into a standalone desktop executable, run the universal build command:

```bash
npm run package
```

### What this command does:
1. **Builds the React Frontend:** Runs Vite to create the optimized web assets.
2. **Compiles the Python Agent:** Uses PyInstaller to bundle `agent.py` into a single, standalone executable binary (`agent.exe` on Windows, or `agent` on Linux).
3. **Packages the Electron App:** Bundles the UI and the compiled Python agent into a final installer based on your operating system.

## 3. Locate the Generated App
Once the command finishes, the native installer will be available in the `dist_electron/` directory:

- **Windows:** You will find a file like `Flint Setup 1.0.0.exe`
- **Linux:** You will find an `.AppImage` and a `.deb` package.

> **Note:** To build a Windows `.exe`, you must run the package command on a Windows machine. To build a Linux `.AppImage`, you must run the package command on a Linux machine.

## Development Mode
If you just want to run the app in development mode without building the full desktop package, simply run:
```bash
npm run dev
```
