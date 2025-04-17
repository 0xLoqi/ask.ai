// main.js (v5.2 - Fix Schema Violation)
// Made 'context' optional in history schema to handle old data.

console.log('[Debug] main.js starting...'); // Log start

const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  desktopCapturer,
  dialog,
  shell,
  net
} = require('electron');
const path = require('path');
const fs = require('fs');

console.log('[Debug] Modules required.');

let Store; // Define Store variable
try {
    Store = require('electron-store'); // Try requiring electron-store
    console.log('[Debug] electron-store required successfully.');
} catch (e) {
    console.error('[Debug] Failed to require electron-store. Did you run npm install?', e);
    app.quit();
    return; // Stop further execution if store failed
}


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
let tray = null;
let popupWindow = null;
let historyWindow = null;
let lastCapturedScreenshotDataUrl = null;

// --- Utility Functions ---
function loadHistory() { return store.get('history', []); }
function addHistoryEntry(question, answer, context) {
    // Add context if provided, otherwise maybe default it? Or leave undefined.
    const newContext = context || 'unknown'; // Assign default if missing
    const history = loadHistory();
    history.push({
        timestamp: new Date().toISOString(),
        question: question,
        answer: answer,
        context: newContext // Ensure new entries always have context
    });
    const recentHistory = history.slice(-MAX_HISTORY);
    store.set('history', recentHistory);
    updateTrayMenu();
    if (historyWindow && !historyWindow.isDestroyed()) {
        historyWindow.webContents.send('history-updated', recentHistory);
    }
}
function getAuthToken() { return store.get('authToken', null); }

// --- Window Creation ---
// NOTE: Make sure createPopupWindow and createHistoryWindow are defined here
// (Assuming they are the same as previous versions for brevity)
function createPopupWindow() { /* ... (same as v4) ... */
    if (popupWindow && !popupWindow.isDestroyed()) { if (!popupWindow.isVisible()) { popupWindow.show(); } popupWindow.focus(); return; }
    const primaryDisplay = screen.getPrimaryDisplay(); const { width, height } = primaryDisplay.workAreaSize; const popupWidth = 550; const popupHeight = 450;
    popupWindow = new BrowserWindow({ width: popupWidth, height: popupHeight, x: Math.round((width - popupWidth) / 2), y: Math.round((height - popupHeight) / 4), frame: false, resizable: false, movable: true, show: false, skipTaskbar: true, alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, }, });
    popupWindow.loadFile(path.join(__dirname, 'popup.html'));
    popupWindow.once('ready-to-show', () => { popupWindow.show(); popupWindow.webContents.send('initial-load-data', { showScreenshotPreview: store.get('showScreenshotPreview'), lastScreenshotDataUrl: lastCapturedScreenshotDataUrl, backendUrl: BACKEND_API_ENDPOINT }); });
    popupWindow.on('blur', () => { if (popupWindow && !popupWindow.isDestroyed() && !popupWindow.webContents.isDevToolsOpened()) { popupWindow.hide(); } });
    popupWindow.on('closed', () => { popupWindow = null; });
}
function createHistoryWindow() { /* ... (same as v2) ... */
    if (historyWindow && !historyWindow.isDestroyed()) { historyWindow.show(); historyWindow.focus(); return; }
    historyWindow = new BrowserWindow({ width: 600, height: 500, title: 'History', show: false, frame: true, resizable: true, movable: true, skipTaskbar: false, alwaysOnTop: false, webPreferences: { preload: path.join(__dirname, 'preload_history.js'), contextIsolation: true, nodeIntegration: false, }, });
    historyWindow.loadFile(path.join(__dirname, 'history.html'));
    historyWindow.once('ready-to-show', () => { historyWindow.show(); historyWindow.webContents.send('history-updated', loadHistory()); });
    historyWindow.on('closed', () => { historyWindow = null; });
}


// --- Core Logic ---
function showAssistantPopup() { console.log('[Debug] showAssistantPopup called.'); createPopupWindow(); }
async function captureNewScreenshot() { /* ... (same as v4) ... */ console.log('[Debug] Capturing NEW screenshot...'); try { const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: screen.getPrimaryDisplay().size }); const primaryScreenSource = sources.find(source => source.display_id === String(screen.getPrimaryDisplay().id)) || sources[0]; if (!primaryScreenSource) throw new Error('No screen source found'); lastCapturedScreenshotDataUrl = primaryScreenSource.thumbnail.toDataURL(); console.log('[Debug] New screenshot captured.'); return lastCapturedScreenshotDataUrl; } catch (e) { console.error('[Debug] Failed to capture new screenshot:', e); dialog.showErrorBox('Screenshot Error', `Failed to capture screen: ${e.message}`); throw e; } }

function createTray() { /* ... (same as v5.1 - includes console logs) ... */
    console.log('[Debug] createTray function started.'); const iconName = 'icon.png'; const iconPath = path.join(__dirname, 'assets', iconName); console.log(`[Debug] Looking for tray icon at: ${iconPath}`); let icon;
    if (!fs.existsSync(iconPath)) { console.warn(`[Debug] Icon file NOT FOUND at ${iconPath}. Using fallback.`); const fallbackIconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAEUlEQVR42mNkIAAYRxWAAQAG9gAK/UNr+AAAAABJRU5ErkJggg=='; try { icon = nativeImage.createFromDataURL(fallbackIconDataUrl); console.log('[Debug] Fallback icon created from data URL.'); } catch (fallbackError) { console.error('[Debug] FATAL: Could not create even fallback icon.', fallbackError); dialog.showErrorBox('Startup Error', 'Failed to create application tray icon...'); app.quit(); return; }
    } else { console.log('[Debug] Icon file found. Creating nativeImage...'); try { icon = nativeImage.createFromPath(iconPath); if (process.platform === 'darwin') { icon.setTemplateImage(true); } console.log('[Debug] Native image created successfully from file.'); } catch (error) { console.error('[Debug] Error creating nativeImage from file:', error); dialog.showErrorBox('Startup Error', `Failed to load tray icon...`); app.quit(); return; } }
    console.log('[Debug] Creating Tray object...'); try { tray = new Tray(icon); tray.setToolTip('AI Assistant'); console.log('[Debug] Tray object created, setting tooltip.'); updateTrayMenu(); console.log('[Debug] Tray context menu set.'); tray.on('click', showAssistantPopup); console.log('[Debug] Tray click listener added.'); } catch (trayError) { console.error('[Debug] Error creating Tray instance:', trayError); dialog.showErrorBox('Startup Error', `Failed to create system tray icon...`); app.quit(); return; } console.log('[Debug] createTray function finished.');
}

function updateTrayMenu() { /* ... (same as v4 - includes toggle logic) ... */
    const isPreviewEnabled = store.get('showScreenshotPreview'); const contextMenu = Menu.buildFromTemplate([ { label: 'Ask Assistant', click: showAssistantPopup }, { label: 'View History', click: createHistoryWindow }, { type: 'separator' }, { label: 'Show Screenshot Preview', type: 'checkbox', checked: isPreviewEnabled, click: (menuItem) => { const newState = menuItem.checked; store.set('showScreenshotPreview', newState); if (popupWindow && !popupWindow.isDestroyed()) { popupWindow.webContents.send('settings-updated', { showScreenshotPreview: newState }); } } }, { type: 'separator' }, { label: 'Quit AI Assistant', click: () => app.quit() } ]); if (tray) { try { tray.setContextMenu(contextMenu); } catch (error) { console.error("Failed to set tray context menu:", error); } }
}

// --- App Lifecycle ---
console.log('[Debug] Setting up single instance lock...');
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) { /* ... (same as v5.1) ... */ console.log("[Debug] Another instance detected. Quitting this instance."); app.quit(); }
else {
  app.on('second-instance', (event, commandLine, workingDirectory) => { /* ... (same as v5.1) ... */ });
  console.log('[Debug] Setting up app event listeners (ready, activate, will-quit)...');
  app.whenReady().then(() => { /* ... (same as v5.1 - includes tray/hotkey setup) ... */
    console.log('[Debug] app.whenReady() promise resolved.'); if (process.platform === 'darwin') { try { app.dock.hide(); } catch (dockError) { console.error('[Debug] Error hiding dock icon:', dockError); } }
    console.log(`[Debug] Attempting to register hotkey: ${HOTKEY}...`); try { if (!globalShortcut.register(HOTKEY, showAssistantPopup)) { console.error(`[Debug] Failed to register hotkey: ${HOTKEY}. It might be in use.`); dialog.showErrorBox('Hotkey Error', `Failed to register global hotkey "${HOTKEY}"...`); } else { console.log(`[Debug] Global hotkey "${HOTKEY}" registered successfully.`); } } catch (error) { console.error(`[Debug] Error during globalShortcut.register:`, error); dialog.showErrorBox('Hotkey Error', `An unexpected error occurred...`); } console.log('[Debug] Hotkey registration attempt finished.');
    console.log('[Debug] Calling createTray()...'); createTray(); console.log('[Debug] createTray() call finished.'); console.log('[Debug] App ready sequence complete. Data stored at:', app.getPath('userData'));
  }).catch(error => { /* ... (same as v5.1) ... */ console.error('[Debug] Error during app.whenReady() execution:', error); dialog.showErrorBox('Application Startup Error', `Failed to initialize...`); app.quit(); });
  app.on('window-all-closed', (e) => { /* ... (same as v5.1) ... */ });
  app.on('activate', () => { /* ... (same as v5.1) ... */ });
  app.on('will-quit', () => { /* ... (same as v5.1) ... */ });
} // End of else block for gotTheLock

// --- IPC Handlers ---
console.log('[Debug] Setting up IPC handlers...');
// --- NOTE: Ensure all handlers used by preload v3 are defined ---
ipcMain.handle('get-auth-token', (event) => { console.log("IPC: get-auth-token"); return getAuthToken(); });
ipcMain.handle('capture-new-screenshot', async (event) => { console.log("IPC: capture-new-screenshot"); try { const url = await captureNewScreenshot(); if (popupWindow && !popupWindow.isDestroyed()) popupWindow.webContents.send('screenshot-updated', url); return url; } catch (e) { return null; } });
ipcMain.handle('get-initial-data', (event) => { console.log("IPC: get-initial-data"); return { showScreenshotPreview: store.get('showScreenshotPreview'), lastScreenshotDataUrl: lastCapturedScreenshotDataUrl, backendUrl: BACKEND_API_ENDPOINT }; });
ipcMain.on('query-complete', (event, { question, answer, context }) => { console.log("IPC: query-complete"); if (question && answer) addHistoryEntry(question, answer, context); });
ipcMain.on('close-popup', () => { console.log("IPC: close-popup"); if (popupWindow && !popupWindow.isDestroyed()) popupWindow.hide(); });
ipcMain.handle('get-history', async (event) => { console.log("IPC: get-history"); return loadHistory(); });
ipcMain.handle('clear-history', async (event) => { console.log("IPC: clear-history"); store.set('history', []); updateTrayMenu(); if (historyWindow && !historyWindow.isDestroyed()) historyWindow.webContents.send('history-updated', []); return { success: true }; });
console.log('[Debug] IPC handlers set up.');

