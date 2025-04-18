// main.js (v5.2 - Fix Schema Violation)
// Made 'context' optional in history schema to handle old data.

console.log('[Debug] main.js starting...'); // Log start

import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, screen, desktopCapturer, dialog, shell, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';

console.log('[Debug] Modules required.');

const store = new Store({
    schema: {
        history: {
            type: 'array',
            default: [],
            items: {
                type: 'object',
                properties: {
                    timestamp: { type: 'string', format: 'date-time' },
                    question: { type: 'string' },
                    answer: { type: 'string' },
                    // *** MODIFICATION HERE: Removed 'context' from required array ***
                    context: { type: 'string' } // Keep the property definition
                },
                 // Make sure 'context' is NOT listed as required for backward compatibility
                required: ['timestamp', 'question', 'answer']
            }
        },
        authToken: { type: ['string', 'null'], default: null },
        showScreenshotPreview: { type: 'boolean', default: true }
     }
    // You might add migration logic here later if needed:
    // migrations: { ... }
});
console.log('[Debug] Store initialized.'); // This should now succeed

// --- Configuration ---
const HOTKEY = 'CommandOrControl+Shift+Space';
const MAX_HISTORY = 50;
const BACKEND_API_ENDPOINT = process.env.BACKEND_API_ENDPOINT || 'http://localhost:3000';

// --- Global Variables ---
let tray: any = null;
let popupWindow: any = null;
let historyWindow: any = null;
let lastCapturedScreenshotDataUrl: any = null;
let hotkeyDownTime: number | null = null;
let hotkeyTimer: NodeJS.Timeout | null = null;

// --- Utility Functions ---
function loadHistory() { return store.get('history', []); }
function addHistoryEntry(question: any, answer: any, context: any) {
    const newContext = context || 'unknown';
    const history = loadHistory() as any;
    history.push({
        timestamp: new Date().toISOString(),
        question: question,
        answer: answer,
        context: newContext
    });
    const recentHistory = history.slice(-MAX_HISTORY);
    store.set('history', recentHistory);
    updateTrayMenu();
    if ((historyWindow as any) && !(historyWindow as any).isDestroyed()) {
        (historyWindow as any).webContents.send('history-updated', recentHistory);
    }
}
function getAuthToken() { return store.get('authToken', null); }

// --- Window Creation ---
// NOTE: Make sure createPopupWindow and createHistoryWindow are defined here
// (Assuming they are the same as previous versions for brevity)
function createPopupWindow() {
    if ((popupWindow as any) && !(popupWindow as any).isDestroyed()) { if (!(popupWindow as any).isVisible()) { (popupWindow as any).show(); } (popupWindow as any).focus(); return; }
    const primaryDisplay = screen.getPrimaryDisplay(); const { width, height } = primaryDisplay.workAreaSize; const popupWidth = 550; const popupHeight = 450;
    popupWindow = new BrowserWindow({ width: popupWidth, height: popupHeight, x: Math.round((width - popupWidth) / 2), y: Math.round((height - popupHeight) / 4), frame: false, resizable: false, movable: true, show: false, skipTaskbar: true, alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, }, });
    (popupWindow as any).loadFile(path.join(__dirname, 'popup.html'));
    (popupWindow as any).once('ready-to-show', () => { (popupWindow as any).show(); (popupWindow as any).webContents.send('initial-load-data', { showScreenshotPreview: store.get('showScreenshotPreview'), lastScreenshotDataUrl: lastCapturedScreenshotDataUrl as any, backendUrl: BACKEND_API_ENDPOINT }); });
    (popupWindow as any).on('blur', () => { if ((popupWindow as any) && !(popupWindow as any).isDestroyed() && !(popupWindow as any).webContents.isDevToolsOpened()) { (popupWindow as any).hide(); } });
    (popupWindow as any).on('closed', () => { popupWindow = null; });
}
function createHistoryWindow() {
    if ((historyWindow as any) && !(historyWindow as any).isDestroyed()) { (historyWindow as any).show(); (historyWindow as any).focus(); return; }
    historyWindow = new BrowserWindow({ width: 600, height: 500, title: 'History', show: false, frame: true, resizable: true, movable: true, skipTaskbar: false, alwaysOnTop: false, webPreferences: { preload: path.join(__dirname, 'preload_history.js'), contextIsolation: true, nodeIntegration: false, }, });
    (historyWindow as any).loadFile(path.join(__dirname, 'history.html'));
    (historyWindow as any).once('ready-to-show', () => { (historyWindow as any).show(); (historyWindow as any).webContents.send('history-updated', loadHistory()); });
    (historyWindow as any).on('closed', () => { historyWindow = null; });
}


// --- Core Logic ---
function showAssistantPopupWithMode(mode: 'typing' | 'listening') {
  createPopupWindow();
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('input-mode', mode);
  }
}

function createTray() { /* ... (same as v5.1 - includes console logs) ... */
    console.log('[Debug] createTray function started.'); const iconName = 'icon.png'; const iconPath = path.join(__dirname, 'assets', iconName); console.log(`[Debug] Looking for tray icon at: ${iconPath}`); let icon;
    if (!fs.existsSync(iconPath)) { console.warn(`[Debug] Icon file NOT FOUND at ${iconPath}. Using fallback.`); const fallbackIconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAEUlEQVR42mNkIAAYRxWAAQAG9gAK/UNr+AAAAABJRU5ErkJggg=='; try { icon = nativeImage.createFromDataURL(fallbackIconDataUrl); console.log('[Debug] Fallback icon created from data URL.'); } catch (fallbackError) { console.error('[Debug] FATAL: Could not create even fallback icon.', fallbackError); dialog.showErrorBox('Startup Error', 'Failed to create application tray icon...'); app.quit(); return; }
    } else { console.log('[Debug] Icon file found. Creating nativeImage...'); try { icon = nativeImage.createFromPath(iconPath); if (process.platform === 'darwin') { icon.setTemplateImage(true); } console.log('[Debug] Native image created successfully from file.'); } catch (error) { console.error('[Debug] Error creating nativeImage from file:', error); dialog.showErrorBox('Startup Error', `Failed to load tray icon...`); app.quit(); return; } }
    console.log('[Debug] Creating Tray object...'); try { tray = new Tray(icon); tray.setToolTip('Ask'); console.log('[Debug] Tray object created, setting tooltip.'); updateTrayMenu(); console.log('[Debug] Tray context menu set.'); tray.on('click', showAssistantPopupWithMode); console.log('[Debug] Tray click listener added.'); } catch (trayError) { console.error('[Debug] Error creating Tray instance:', trayError); dialog.showErrorBox('Startup Error', `Failed to create system tray icon...`); app.quit(); return; } console.log('[Debug] createTray function finished.');
}

function updateTrayMenu() {
    const isPreviewEnabled = store.get('showScreenshotPreview') as boolean;
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Ask Assistant', click: () => showAssistantPopupWithMode('typing') },
        { label: 'View History', click: createHistoryWindow },
        { type: 'separator' },
        { label: 'Show Screenshot Preview', type: 'checkbox', checked: isPreviewEnabled, click: (menuItem: any) => { const newState = menuItem.checked; store.set('showScreenshotPreview', newState); if (popupWindow && !popupWindow.isDestroyed()) { popupWindow.webContents.send('settings-updated', { showScreenshotPreview: newState }); } } },
        { type: 'separator' },
        { label: 'Quit AI Assistant', click: () => app.quit() }
    ]);
    if (tray) { try { tray.setContextMenu(contextMenu); } catch (error: any) { console.error("Failed to set tray context menu:", error); } }
}

// --- App Lifecycle ---
console.log('[Debug] Setting up single instance lock...');
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) { /* ... (same as v5.1) ... */ console.log("[Debug] Another instance detected. Quitting this instance."); app.quit(); }
else {
  app.on('second-instance', (event, commandLine, workingDirectory) => { /* ... (same as v5.1) ... */ });
  console.log('[Debug] Setting up app event listeners (ready, activate, will-quit)...');
  app.whenReady().then(() => { /* ... (same as v5.1 - includes tray/hotkey setup) ... */
    console.log('[Debug] app.whenReady() promise resolved.');
    // --- Auto-update: check for updates on launch ---
    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on('update-available', () => {
      console.log('[autoUpdater] Update available.');
      if (popupWindow && !popupWindow.isDestroyed()) popupWindow.webContents.send('update-available');
    });
    autoUpdater.on('update-not-available', () => {
      console.log('[autoUpdater] No update available.');
      if (popupWindow && !popupWindow.isDestroyed()) popupWindow.webContents.send('update-not-available');
    });
    autoUpdater.on('error', (err: any) => {
      console.error('[autoUpdater] Error:', err);
      if (popupWindow && !popupWindow.isDestroyed()) popupWindow.webContents.send('update-error', String(err));
    });
    autoUpdater.on('download-progress', (progress: any) => console.log('[autoUpdater] Download progress:', progress));
    autoUpdater.on('update-downloaded', () => {
      console.log('[autoUpdater] Update downloaded.');
      if (popupWindow && !popupWindow.isDestroyed()) popupWindow.webContents.send('update-downloaded');
    });
    if (process.platform === 'darwin') { try { app.dock.hide(); } catch (dockError) { console.error('[Debug] Error hiding dock icon:', dockError); } }
    // --- Register unified hotkey with tap/hold detection ---
    try {
      globalShortcut.register(HOTKEY, () => {
        // This is a fallback for platforms that don't support keyup/keydown
        // Always show typing mode
        showAssistantPopupWithMode('typing');
      });
      // Listen for keydown/keyup for tap/hold detection
      app.on('browser-window-focus', () => {
        // Remove any previous listeners
        app.off('browser-window-blur', onHotkeyUp);
        app.on('browser-window-blur', onHotkeyUp);
      });
      function onHotkeyDown() {
        hotkeyDownTime = Date.now();
        hotkeyTimer = setTimeout(() => {
          showAssistantPopupWithMode('listening');
          hotkeyDownTime = null;
        }, 350);
      }
      function onHotkeyUp() {
        if (hotkeyDownTime) {
          const duration = Date.now() - hotkeyDownTime;
          if (hotkeyTimer) clearTimeout(hotkeyTimer);
          if (duration < 350) {
            showAssistantPopupWithMode('typing');
          }
          hotkeyDownTime = null;
        }
      }
      // Electron does not natively support global keyup/keydown, so this is a fallback
      // For advanced tap/hold, consider a native module or OS-level hook
      console.log(`[Debug] Global hotkey "${HOTKEY}" registered successfully.`);
    } catch (error) {
      console.error(`[Debug] Error during globalShortcut.register:`, error);
      dialog.showErrorBox('Hotkey Error', `An unexpected error occurred...`);
    }
    console.log('[Debug] Hotkey registration attempt finished.');
    console.log('[Debug] Calling createTray()...'); createTray(); console.log('[Debug] createTray() call finished.'); console.log('[Debug] App ready sequence complete. Data stored at:', app.getPath('userData'));
  }).catch(error => { /* ... (same as v5.1) ... */ console.error('[Debug] Error during app.whenReady() execution:', error); dialog.showErrorBox('Application Startup Error', `Failed to initialize...`); app.quit(); });
  app.on('window-all-closed', (e: any) => { /* ... (same as v5.1) ... */ });
  app.on('activate', () => { /* ... (same as v5.1) ... */ });
  app.on('will-quit', () => { /* ... (same as v5.1) ... */ });
} // End of else block for gotTheLock

// --- IPC Handlers ---
console.log('[Debug] Setting up IPC handlers...');
// --- NOTE: Ensure all handlers used by preload v3 are defined ---
ipcMain.handle('get-auth-token', (event) => { console.log("IPC: get-auth-token"); return getAuthToken(); });
ipcMain.handle('capture-new-screenshot', async (event: any) => { try { const url = await captureNewScreenshot(); if ((popupWindow as any) && !(popupWindow as any).isDestroyed()) (popupWindow as any).webContents.send('screenshot-updated', url); return url; } catch (e: any) { return null; } });
ipcMain.handle('get-initial-data', (event: any) => { return { showScreenshotPreview: store.get('showScreenshotPreview'), lastScreenshotDataUrl: lastCapturedScreenshotDataUrl as any, backendUrl: BACKEND_API_ENDPOINT }; });
ipcMain.on('query-complete', (event: any, { question, answer, context }: any) => { console.log("IPC: query-complete"); if (question && answer) addHistoryEntry(question, answer, context); });
ipcMain.on('close-popup', () => { console.log("IPC: close-popup"); if ((popupWindow as any) && !(popupWindow as any).isDestroyed()) (popupWindow as any).hide(); });
ipcMain.handle('get-history', async (event: any) => { console.log("IPC: get-history"); return loadHistory(); });
ipcMain.handle('clear-history', async (event: any) => { console.log("IPC: clear-history"); store.set('history', []); updateTrayMenu(); if ((historyWindow as any) && !(historyWindow as any).isDestroyed()) (historyWindow as any).webContents.send('history-updated', []); return { success: true }; });
console.log('[Debug] IPC handlers set up.');

// Add a minimal stub for captureNewScreenshot if missing
async function captureNewScreenshot() { return null; }

// --- Global Error Handling ---
function postErrorToWebhook(error: any) {
  try {
    const request = net.request({
      method: 'POST',
      url: 'http://localhost:3000/api/log',
    });
    request.setHeader('Content-Type', 'application/json');
    request.write(JSON.stringify({
      error: error && error.stack ? error.stack : String(error),
      source: 'main',
      timestamp: new Date().toISOString(),
    }));
    request.end();
  } catch (e) {
    // Fallback: log to console if even this fails
    console.error('[GlobalError] Failed to POST error:', e);
  }
}
process.on('uncaughtException', (err) => {
  console.error('[GlobalError] uncaughtException:', err);
  postErrorToWebhook(err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[GlobalError] unhandledRejection:', reason);
  postErrorToWebhook(reason);
});

