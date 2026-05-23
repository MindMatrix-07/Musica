const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const { fork } = require("child_process");

let serverProcess = null;
let mainWindow = null;
const APP_PORT = process.env.MUSICA_PORT || "45732";

function startExpressServer() {
  const serverPath = path.join(__dirname, "dist", "server.cjs");
  console.log("Starting backend server at:", serverPath);

  // Run the express backend in a separate thread so it doesn't block Electron's UI
  serverProcess = fork(serverPath, [], {
    env: { ...process.env, NODE_ENV: "production", PORT: APP_PORT },
    stdio: "inherit"
  });

  serverProcess.on("exit", (code, signal) => {
    console.log(`Backend server exited with code ${code} and signal ${signal}`);
  });
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#09070d",
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#09070d",
      symbolColor: "#f8f4ff",
      height: 36
    },
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the running full-stack app hosted locally
  const appUrl = `http://localhost:${APP_PORT}`;
  
  // Clean retry loop to wait for Express server to start up
  const loadWithRetry = () => {
    mainWindow.loadURL(appUrl).catch((err) => {
      console.log(`Waiting for backend API on port ${APP_PORT} to boot up...`);
      setTimeout(loadWithRetry, 550);
    });
  };

  loadWithRetry();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Start Express API Server + Client static router
  startExpressServer();
  // Create Main Electron Desktop Window
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Quit Express server on exit
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
