'use strict';
/**
 * Electron shell for PuzzleForge Web.
 *
 * Boots the existing Express app (server.js) in-process and opens it in a
 * native window. Every page — including the Publisher-style page editor —
 * runs unmodified: same DOM/canvas renderer that also powers the Puppeteer
 * PDF export, just hosted in a real app window instead of a browser tab.
 */
const { app, BrowserWindow, Menu, shell } = require('electron');

const PORT = Number(process.env.PORT) || 4000;
const HOST = '127.0.0.1';
const ORIGIN = `http://${HOST}:${PORT}`;

let mainWindow = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const { app: expressApp } = require('../server');
    const server = expressApp.listen(PORT, HOST, () => resolve());
    server.on('error', (err) => {
      // A dev server (`npm start`) may already be running on this port —
      // reuse it instead of failing to launch.
      if (err.code === 'EADDRINUSE') resolve();
      else reject(err);
    });
  });
}

function isLocalUrl(url) {
  return url.startsWith(`${ORIGIN}/`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'PuzzleForge',
    backgroundColor: '#ffffff',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(`${ORIGIN}/index.html`);

  // In-app navigation (Puzzle Maker, Book Builder, the page editor, Cover
  // Builder, AI Art, ...) opens in this window; anything else (mailto:,
  // "browse issues", external links) opens in the OS's default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isLocalUrl(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isLocalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();
    await startServer();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
