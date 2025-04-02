// main.js (v4)
// Integrates revised flow: Single hotkey triggers popup, which handles voice input
// and provides options for sending with or without a new screenshot.
// Includes setting for screenshot preview toggle.

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
  const Store = require('electron-store');
  
  // Enhanced schema for electron-store
  const store = new Store({
      schema: {
          history: { /* ... (same as v2) ... */ },
          authToken: { type: ['string', 'null'], default: null },
          // Setting to control if screenshot preview is shown in popup
          showScreenshotPreview: {
              type: 'boolean',
              default: true // Show preview by default
          }
          // Add hotkey customization setting later
      },
      // Watch for changes in settings (optional but can be useful)
      // watch: true // Be cautious with watch: true in main process
  });
  
  
  // --- Configuration ---
  const HOTKEY = 'CommandOrControl+Shift+Space'; // Primary hotkey
  const MAX_HISTORY = 50;
  const BACKEND_API_ENDPOINT = 'YOUR_BACKEND_API_ENDPOINT/api/ask'; // Replace!
  
  // --- Global Variables ---
  let tray = null;
  let popupWindow = null;
  let historyWindow = null;
  // Store the *last captured* screenshot for potential preview
  let lastCapturedScreenshotDataUrl = null;
  
  // --- Utility Functions ---
  
  function loadHistory() { /* ... (same as v2) ... */ }
  function addHistoryEntry(question, answer, context) { // Added context param
    const history = loadHistory();
    history.push({
      timestamp: new Date().toISOString(),
      question: question,
      answer: answer,
      context: context // e.g., 'text-only' or 'with-screenshot'
    });
    const recentHistory = history.slice(-MAX_HISTORY);
    store.set('history', recentHistory);
    updateTrayMenu();
    if (historyWindow && !historyWindow.isDestroyed()) {
        historyWindow.webContents.send('history-updated', recentHistory);
    }
  }
  function getAuthToken() { /* ... (same as v3) ... */ }
  
  /**
   * Makes the actual API call to your backend service.
   * Now includes a flag indicating if a new screenshot is included.
   * @param {string} transcribedText - The user's transcribed question.
   * @param {string | null} newScreenshotDataUrl - The new screenshot (if requested), otherwise null.
   * @returns {Promise<string>} - A promise that resolves with the AI's answer text.
   * @throws {Error} - Throws an error if the API call fails or returns an error.
   */
  async function callBackendAPI(transcribedText, newScreenshotDataUrl) {
    const endpoint = BACKEND_API_ENDPOINT; // Use configured endpoint
    console.log(`Calling backend API at ${endpoint}`);
    console.log(` - With new screenshot: ${!!newScreenshotDataUrl}`);
    console.log(` - Question text: "${transcribedText.substring(0, 50)}..."`);
  
  
    const token = getAuthToken();
    if (!token) throw new Error("Authentication required. Please log in.");
    if (!endpoint || endpoint.startsWith('YOUR_BACKEND')) throw new Error("Backend service is not configured.");
  
    // Prepare request body - conditionally include screenshot
    const requestBodyData = {
        question: transcribedText,
        // Only include screenshot data if it's provided
        ...(newScreenshotDataUrl && { screenshotDataUrl: newScreenshotDataUrl })
    };
  
    return new Promise((resolve, reject) => {
        const request = net.request({
            method: 'POST',
            url: endpoint,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
  
        request.on('response', (response) => { /* ... (same handling as v3) ... */
              console.log(`Backend response status: ${response.statusCode}`);
              let responseBody = '';
              response.on('data', (chunk) => { responseBody += chunk; });
              response.on('end', () => {
                  try {
                      const parsedResponse = JSON.parse(responseBody);
                      if (response.statusCode >= 200 && response.statusCode < 300) {
                          if (parsedResponse.answer) resolve(parsedResponse.answer);
                          else reject(new Error("Invalid response format (missing 'answer')."));
                      } else {
                          const errorMessage = parsedResponse.error || `API Error (${response.statusCode})`;
                          reject(new Error(errorMessage));
                      }
                  } catch (e) { reject(new Error(`Invalid JSON response: ${e.message}`)); }
              });
              response.on('error', (error) => { reject(new Error(`Network response error: ${error.message}`)); });
        });
        request.on('error', (error) => { reject(new Error(`Network request failed: ${error.message}`)); });
  
        request.write(JSON.stringify(requestBodyData));
        request.end();
    });
  }
  
  
  // --- Window Creation ---
  
  /**
   * Creates or shows the main popup window.
   * Now sends initial settings like showScreenshotPreview.
   */
  function createPopupWindow() {
    if (popupWindow && !popupWindow.isDestroyed()) {
      if (!popupWindow.isVisible()) {
          popupWindow.show();
      }
      popupWindow.focus();
      // Optionally resend settings if they can change while window is hidden
      // popupWindow.webContents.send('settings-updated', {
      //     showScreenshotPreview: store.get('showScreenshotPreview')
      // });
      return;
    }
  
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    // Adjust size slightly for new UI elements
    const popupWidth = 550;
    const popupHeight = 450;
  
    popupWindow = new BrowserWindow({
      width: popupWidth,
      height: popupHeight,
      x: Math.round((width - popupWidth) / 2),
      y: Math.round((height - popupHeight) / 4),
      frame: false,
      resizable: false, // Keep non-resizable for now
      movable: true,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'), // Use the main preload
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
  
    popupWindow.loadFile(path.join(__dirname, 'popup.html'));
  
    popupWindow.once('ready-to-show', () => {
      popupWindow.show();
      // Send initial settings and last captured screenshot for preview
      popupWindow.webContents.send('initial-load-data', {
          showScreenshotPreview: store.get('showScreenshotPreview'),
          lastScreenshotDataUrl: lastCapturedScreenshotDataUrl // Send for preview only
      });
    });
  
    popupWindow.on('blur', () => {
       if (popupWindow && !popupWindow.isDestroyed() && !popupWindow.webContents.isDevToolsOpened()) {
          popupWindow.hide();
       }
    });
  
    popupWindow.on('closed', () => { popupWindow = null; });
  }
  
  function createHistoryWindow() { /* ... (same as v2) ... */ }
  
  // --- Core Logic ---
  
  /**
   * Primary action triggered by the hotkey. Just shows the popup.
   * Screenshot capture is now triggered *conditionally* from the popup.
   */
  function showAssistantPopup() {
      console.log('Hotkey triggered - showing assistant popup...');
      createPopupWindow(); // Creates or shows the existing window
  }
  
  /**
   * Captures a fresh screenshot. Used when "Send with New Screenshot" is clicked.
   * @returns {Promise<string>} Data URL of the captured screenshot.
   */
  async function captureNewScreenshot() {
      console.log('Capturing NEW screenshot...');
      try {
          const sources = await desktopCapturer.getSources({
              types: ['screen'],
              thumbnailSize: screen.getPrimaryDisplay().size
          });
          const primaryScreenSource = sources.find(source => source.display_id === String(screen.getPrimaryDisplay().id)) || sources[0];
          if (!primaryScreenSource) throw new Error('No screen source found');
  
          // Store this as the *last captured* one as well for preview consistency
          lastCapturedScreenshotDataUrl = primaryScreenSource.thumbnail.toDataURL();
          console.log('New screenshot captured.');
          return lastCapturedScreenshotDataUrl;
      } catch (e) {
          console.error('Failed to capture new screenshot:', e);
          dialog.showErrorBox('Screenshot Error', `Failed to capture screen: ${e.message}`);
          throw e; // Re-throw to be handled by caller
      }
  }
  
  
  function createTray() { /* ... (same basic setup as v2) ... */
      // Modify updateTrayMenu to include the toggle
      const iconPath = path.join(__dirname, 'assets', 'icon.png');
      let icon;
      try { /* ... (icon loading logic same as v2/v3) ... */
          if (fs.existsSync(iconPath)) {
              icon = nativeImage.createFromPath(iconPath);
              if (process.platform === 'darwin') icon.setTemplateImage(true);
          } else {
              console.warn("Icon file not found..."); // Handle missing icon
              const fallbackIconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAEUlEQVR42mNkIAAYRxWAAQAG9gAK/UNr+AAAAABJRU5ErkJggg==';
              icon = nativeImage.createFromDataURL(fallbackIconDataUrl);
          }
      } catch (error) { /* ... error handling ... */ }
  
      tray = new Tray(icon);
      tray.setToolTip('AI Assistant');
      updateTrayMenu(); // Set initial menu
  
      tray.on('click', showAssistantPopup); // Simple click shows popup
  }
  
  /**
   * Updates the tray menu, including the screenshot preview toggle.
   */
  function updateTrayMenu() {
      const isPreviewEnabled = store.get('showScreenshotPreview');
  
      const contextMenu = Menu.buildFromTemplate([
          { label: 'Ask Assistant', click: showAssistantPopup }, // Changed label slightly
          { label: 'View History', click: createHistoryWindow },
          { type: 'separator' },
          // Toggle for showing screenshot preview in popup
          {
              label: 'Show Screenshot Preview',
              type: 'checkbox',
              checked: isPreviewEnabled,
              click: (menuItem) => {
                  const newState = menuItem.checked;
                  store.set('showScreenshotPreview', newState);
                  console.log(`Screenshot preview set to: ${newState}`);
                  // Notify popup window if it's open
                  if (popupWindow && !popupWindow.isDestroyed()) {
                      popupWindow.webContents.send('settings-updated', {
                          showScreenshotPreview: newState
                      });
                  }
              }
          },
          // { label: 'Settings...', enabled: false }, // Placeholder for more settings
          { type: 'separator' },
          { label: 'Quit AI Assistant', click: () => app.quit() }
      ]);
      if (tray) {
          try { tray.setContextMenu(contextMenu); }
          catch (error) { console.error("Failed to set tray context menu:", error); }
      }
  }
  
  
  // --- App Lifecycle ---
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) { /* ... */ app.quit(); }
  else {
      app.on('second-instance', (event, commandLine, workingDirectory) => {
          // Focus existing window or show popup if none exist
          if (popupWindow && !popupWindow.isDestroyed()) {
              if (!popupWindow.isVisible()) popupWindow.show();
              popupWindow.focus();
          } else if (historyWindow && !historyWindow.isDestroyed()) {
              historyWindow.focus();
          } else {
              showAssistantPopup(); // Show popup if app activated and no windows open
          }
      });
      app.whenReady().then(() => {
          if (process.platform === 'darwin') app.dock.hide();
          // Register the single primary hotkey
          try {
              if (!globalShortcut.register(HOTKEY, showAssistantPopup)) { // Hotkey now just shows popup
                  console.error(`Failed to register hotkey: ${HOTKEY}.`);
                  dialog.showErrorBox('Hotkey Error', `Failed to register global hotkey "${HOTKEY}". It might be in use.`);
              } else { console.log(`Global hotkey "${HOTKEY}" registered.`); }
          } catch (error) { console.error(`Error registering hotkey ${HOTKEY}:`, error); /* ... */ }
          createTray();
          console.log('App ready. Data stored at:', app.getPath('userData'));
      });
  }
  app.on('window-all-closed', (e) => { /* ... (no quit) ... */ });
  app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) showAssistantPopup();
      else { /* ... (focus existing) ... */ }
  });
  app.on('will-quit', () => { globalShortcut.unregisterAll(); /* ... */ });
  
  
  // --- IPC Handlers ---
  
  // ** UPDATED to handle different send types **
  ipcMain.handle('send-query', async (event, { transcribedText, sendWithNewScreenshot }) => {
    console.log(`IPC: Received query. Send with new screenshot: ${sendWithNewScreenshot}`);
    console.log(`IPC: Text: "${transcribedText.substring(0,50)}..."`);
  
    let screenshotDataForApi = null;
    let historyContext = 'text-only';
  
    try {
      // Capture a new screenshot ONLY if requested
      if (sendWithNewScreenshot) {
          screenshotDataForApi = await captureNewScreenshot(); // This updates lastCapturedScreenshotDataUrl
          historyContext = 'with-screenshot';
          // Notify popup that a new screenshot was taken for preview update
           if (popupWindow && !popupWindow.isDestroyed()) {
               popupWindow.webContents.send('screenshot-updated', screenshotDataForApi);
           }
      }
  
      // Call the backend API
      const answer = await callBackendAPI(transcribedText, screenshotDataForApi);
      console.log(`IPC: Received answer from backend.`);
      addHistoryEntry(transcribedText, answer, historyContext); // Save successful Q&A with context
      return { answer: answer }; // Return success response to renderer
  
    } catch (error) {
      console.error('IPC Error: Failed during query processing:', error);
      // Don't save history on error
      return { error: error.message || 'An unexpected error occurred.' };
    }
  });
  
  // Handler to get initial data when popup loads
  ipcMain.handle('get-initial-data', (event) => {
      console.log("IPC: Sending initial data to popup.");
      return {
          showScreenshotPreview: store.get('showScreenshotPreview'),
          lastScreenshotDataUrl: lastCapturedScreenshotDataUrl // Send last captured for preview
      };
  });
  
  
  ipcMain.on('close-popup', () => { /* ... (same as v3) ... */ });
  ipcMain.handle('get-history', async (event) => { /* ... (same as v3) ... */ });
  ipcMain.handle('clear-history', async (event) => { /* ... (same as v3) ... */ });
  
  // Add login/logout handlers later
  