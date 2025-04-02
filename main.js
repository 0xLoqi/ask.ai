// main.js (v2)
// Enhanced with electron-store, history viewer window, and better error dialogs.

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
    dialog, // Added for showing error messages
    shell // Added to potentially open file paths if needed
  } = require('electron');
  const path = require('path');
  const fs = require('fs'); // Keep fs for checking icon existence
  
  // Use electron-store for robust data persistence
  const Store = require('electron-store');
  const store = new Store({
      // Define a schema for your data (good practice)
      schema: {
          history: {
              type: 'array',
              default: [],
              items: {
                  type: 'object',
                  properties: {
                      timestamp: { type: 'string', format: 'date-time' },
                      question: { type: 'string' },
                      answer: { type: 'string' }
                  },
                  required: ['timestamp', 'question', 'answer']
              }
          },
          // Add other settings here later if needed
          // settings: { ... }
      }
  });
  
  
  // --- Configuration ---
  const HOTKEY = 'CommandOrControl+Shift+Space'; // Or your preferred hotkey
  const MAX_HISTORY = 50; // Increased max history items
  
  // --- Global Variables ---
  let tray = null;
  let popupWindow = null;
  let historyWindow = null; // Window reference for history viewer
  let lastScreenshotDataUrl = null; // Store the latest screenshot
  
  // --- Utility Functions ---
  
  // Load history using electron-store
  function loadHistory() {
    return store.get('history', []); // Get history, default to empty array
  }
  
  // Add a new entry to history using electron-store
  function addHistoryEntry(question, answer) {
    const history = loadHistory();
    history.push({
      timestamp: new Date().toISOString(),
      question: question,
      answer: answer,
    });
    // Keep only the last MAX_HISTORY items
    const recentHistory = history.slice(-MAX_HISTORY);
    store.set('history', recentHistory); // Save updated history
    updateTrayMenu(); // Update tray menu to reflect changes (optional)
  
    // If history window is open, refresh it
    if (historyWindow && !historyWindow.isDestroyed()) {
        historyWindow.webContents.send('history-updated', recentHistory);
    }
  }
  
  // Placeholder for the actual AI Vision API call (Unchanged)
  async function callVisionAPI(screenshotDataUrl, question) {
    console.log('Simulating AI call for question:', question);
    // ** This is the part you need to replace with actual API calls **
    // Example using a hypothetical library:
    // try {
    //   const visionClient = new YourVisionClient({ apiKey: 'YOUR_API_KEY' });
    //   const response = await visionClient.analyzeImage({
    //     image: screenshotDataUrl, // Or convert data URL to buffer/file
    //     prompt: question
    //   });
    //   return response.text;
    // } catch (error) {
    //   console.error("Actual AI API call failed:", error);
    //   throw new Error("Failed to get response from AI service."); // Propagate error
    // }
  
    // Simulation:
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
    if (question.toLowerCase().includes("error")) { // Simulate an error condition
        throw new Error("Simulated AI processing error.");
    }
    return `Simulated AI Response: You asked "${question}" about the captured image. This feature requires integrating a real AI Vision API.`;
  }
  
  // --- Window Creation ---
  
  function createPopupWindow(screenshotDataUrl) {
    if (popupWindow && !popupWindow.isDestroyed()) {
      if (!popupWindow.isVisible()) {
          popupWindow.show();
      }
      popupWindow.focus(); // Bring to front
       if (screenshotDataUrl) {
         popupWindow.webContents.send('screenshot-captured', screenshotDataUrl);
       }
      return;
    }
  
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const popupWidth = 500;
    const popupHeight = 400;
  
    popupWindow = new BrowserWindow({
      width: popupWidth,
      height: popupHeight,
      x: Math.round((width - popupWidth) / 2),
      y: Math.round((height - popupHeight) / 4),
      frame: false,
      resizable: false,
      movable: true,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
  
    popupWindow.loadFile(path.join(__dirname, 'popup.html'));
  
    popupWindow.once('ready-to-show', () => {
      popupWindow.show();
      if (screenshotDataUrl) {
          popupWindow.webContents.send('screenshot-captured', screenshotDataUrl);
      }
    });
  
    popupWindow.on('blur', () => {
       if (popupWindow && !popupWindow.isDestroyed() && !popupWindow.webContents.isDevToolsOpened()) {
          popupWindow.hide();
       }
    });
  
    popupWindow.on('closed', () => {
      popupWindow = null;
    });
  }
  
  function createHistoryWindow() {
      if (historyWindow && !historyWindow.isDestroyed()) {
          historyWindow.show();
          historyWindow.focus();
          return;
      }
  
      historyWindow = new BrowserWindow({
          width: 600,
          height: 500,
          title: 'History',
          show: false,
          // Use standard frame for history window
          frame: true,
          resizable: true,
          movable: true,
          skipTaskbar: false, // Show in taskbar
          alwaysOnTop: false, // Not always on top
          webPreferences: {
              preload: path.join(__dirname, 'preload_history.js'), // Separate preload for history
              contextIsolation: true,
              nodeIntegration: false,
          },
      });
  
      historyWindow.loadFile(path.join(__dirname, 'history.html'));
  
      historyWindow.once('ready-to-show', () => {
          historyWindow.show();
          // Send current history when window is ready
          historyWindow.webContents.send('history-updated', loadHistory());
      });
  
      historyWindow.on('closed', () => {
          historyWindow = null; // Dereference
      });
  }
  
  
  // --- Core Logic ---
  
  async function captureScreenAndShowPopup() {
      console.log('Hotkey triggered - capturing screen...');
      try {
          const sources = await desktopCapturer.getSources({
              types: ['screen'],
              thumbnailSize: screen.getPrimaryDisplay().size
          });
  
          const primaryScreenSource = sources.find(source => source.display_id === String(screen.getPrimaryDisplay().id)) || sources[0];
  
          if (!primaryScreenSource) {
              throw new Error('No screen source found');
          }
  
          lastScreenshotDataUrl = primaryScreenSource.thumbnail.toDataURL();
          console.log('Screenshot captured, creating popup...');
          createPopupWindow(lastScreenshotDataUrl);
  
      } catch (e) {
          console.error('Failed to capture screen:', e);
          dialog.showErrorBox('Screenshot Error', `Failed to capture screen: ${e.message}`);
      }
  }
  
  
  function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    let icon;
    try {
        if (fs.existsSync(iconPath)) {
            icon = nativeImage.createFromPath(iconPath);
            if (process.platform === 'darwin') {
                icon.setTemplateImage(true);
            }
        } else {
            console.warn("Icon file not found, using placeholder.");
            const fallbackIconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAEUlEQVR42mNkIAAYRxWAAQAG9gAK/UNr+AAAAABJRU5ErkJggg==';
            icon = nativeImage.createFromDataURL(fallbackIconDataUrl);
        }
    } catch (error) {
         console.error("Error creating tray icon:", error);
         const fallbackIconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAEUlEQVR42mNkIAAYRxWAAQAG9gAK/UNr+AAAAABJRU5ErkJggg==';
         icon = nativeImage.createFromDataURL(fallbackIconDataUrl);
    }
  
    tray = new Tray(icon);
    tray.setToolTip('AI Assistant');
    updateTrayMenu(); // Set initial menu
  
    tray.on('click', () => {
        // Toggle popup window visibility on click
        if (popupWindow && !popupWindow.isDestroyed()) {
            popupWindow.isVisible() ? popupWindow.hide() : popupWindow.show();
        } else {
            // If popup doesn't exist, trigger capture
            captureScreenAndShowPopup();
        }
    });
  }
  
  function updateTrayMenu() {
      // History submenu items are now less critical as there's a dedicated window
      // We can keep a few recent ones or remove them entirely from the tray menu.
      // Let's keep it simple for now.
  
      const contextMenu = Menu.buildFromTemplate([
          { label: 'Capture & Ask', click: captureScreenAndShowPopup },
          { label: 'View History', click: createHistoryWindow }, // Added History Viewer
          // { label: 'Open Data Folder', click: () => { shell.openPath(app.getPath('userData')); } }, // Useful for debugging
          { label: 'Settings', enabled: false }, // Placeholder
          { type: 'separator' },
          { label: 'Quit AI Assistant', click: () => app.quit() }
      ]);
      if (tray) {
          try {
              tray.setContextMenu(contextMenu);
          } catch (error) {
              console.error("Failed to set tray context menu:", error);
          }
      }
  }
  
  
  // --- App Lifecycle ---
  
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    console.log("Another instance is already running. Quitting.");
    dialog.showErrorBox("Already Running", "Another instance of AI Assistant is already running.");
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      console.log("Second instance detected. Focusing existing window or creating new.");
      if (popupWindow && !popupWindow.isDestroyed()) {
        if (!popupWindow.isVisible()) popupWindow.show();
        popupWindow.focus();
      } else if (historyWindow && !historyWindow.isDestroyed()) {
          // If only history window is open, focus that
          historyWindow.focus();
      } else {
          // If no window open, trigger capture
          captureScreenAndShowPopup();
      }
    });
  
    app.whenReady().then(() => {
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
  
      try {
          if (!globalShortcut.register(HOTKEY, captureScreenAndShowPopup)) {
              console.error(`Failed to register hotkey: ${HOTKEY}.`);
              dialog.showErrorBox('Hotkey Error', `Failed to register global hotkey "${HOTKEY}". It might be in use by another application. Please check your system settings or other running apps.`);
              // Decide whether to quit or continue without hotkey
              // app.quit();
          } else {
              console.log(`Global hotkey "${HOTKEY}" registered successfully.`);
          }
      } catch (error) {
           console.error(`Error registering hotkey ${HOTKEY}:`, error);
           dialog.showErrorBox('Hotkey Error', `An unexpected error occurred while registering the global hotkey "${HOTKEY}".`);
      }
  
      createTray();
      console.log('App ready. Data stored at:', app.getPath('userData')); // Log data path
    });
  }
  
  app.on('window-all-closed', (e) => {
     // We don't quit when windows are closed because the tray icon keeps the app alive.
     console.log("All windows closed, app remains active in tray.");
  });
  
  app.on('activate', () => {
    // On macOS, re-create window if dock icon is clicked (though ours is hidden)
    // Or handle activation when no windows are open. Trigger capture seems reasonable.
    if (BrowserWindow.getAllWindows().length === 0) {
       console.log("App activated with no windows, triggering capture.");
       captureScreenAndShowPopup();
    } else {
        // If windows exist (popup or history), try to focus one
        if (popupWindow && !popupWindow.isDestroyed()) popupWindow.focus();
        else if (historyWindow && !historyWindow.isDestroyed()) historyWindow.focus();
    }
  });
  
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    console.log('Global shortcuts unregistered. Quitting app.');
  });
  
  // --- IPC Handlers ---
  
  ipcMain.handle('ask-question', async (event, question) => {
    console.log(`Received question from popup: "${question}"`);
    if (!lastScreenshotDataUrl) {
        console.error("No screenshot available to process.");
        return { error: "Missing screenshot data. Please capture again." };
    }
  
    try {
      const answer = await callVisionAPI(lastScreenshotDataUrl, question);
      console.log(`Received simulated answer.`);
      addHistoryEntry(question, answer); // Save successful Q&A
      return { answer: answer };
    } catch (error) {
      console.error('Error during AI processing simulation:', error);
      // Don't save history on error
      // Return a more specific error message if available
      return { error: `Failed to get response: ${error.message || 'AI processing failed.'}` };
    }
  });
  
  ipcMain.on('close-popup', () => {
      if (popupWindow && !popupWindow.isDestroyed()) {
          popupWindow.hide();
          console.log("Popup hidden via close button.");
      }
  });
  
  // IPC handler for history window requesting history data
  ipcMain.handle('get-history', async (event) => {
      console.log("History window requested data.");
      return loadHistory();
  });
  
  // IPC handler for clearing history (optional)
  ipcMain.handle('clear-history', async (event) => {
      console.log("Clearing history.");
      store.set('history', []); // Reset history to empty array
      updateTrayMenu(); // Update menu if needed
      // Notify history window if open
      if (historyWindow && !historyWindow.isDestroyed()) {
          historyWindow.webContents.send('history-updated', []);
      }
      return { success: true };
  });
  