// preload.js (v3)
// Exposes IPC channels needed for renderer-driven streaming flow.

import { contextBridge, ipcRenderer } from 'electron';

// Whitelist of valid channels for IPC communication
const validSendChannels = [ // One-way: Renderer -> Main
    'close-popup',
    'query-complete' // For renderer to notify main when stream is done
];
const validInvokeChannels = [ // Two-way: Renderer -> Main -> Renderer
    'get-auth-token',
    'capture-new-screenshot',
    'get-initial-data'
    // Add login/logout invokes later
];
const validOnChannels = [ // Main -> Renderer
    'settings-updated',
    'screenshot-updated',
];

console.log('Preload script executing...');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: any, data: any) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else { /* ... warning ... */ }
  },
  invoke: async (channel: any, ...args: any[]) => {
    if (validInvokeChannels.includes(channel)) {
      console.log(`Preload: Invoking channel "${channel}"`);
      try { return await ipcRenderer.invoke(channel, ...args); }
      catch (error) { /* ... error handling ... */ throw error; }
    } else { /* ... warning ... */ throw new Error(`Invalid invoke channel: ${channel}`); }
  },
  on: (channel: any, func: any) => {
    if (validOnChannels.includes(channel)) {
      const listener = (event: any, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, listener);
      return () => { ipcRenderer.removeListener(channel, listener); };
    } else { /* ... warning ... */ return () => {}; }
  },
  // Expose backend URL directly (alternative to getting it via get-initial-data)
  // This assumes the backend URL is relatively static during the app's runtime.
  // Note: This might expose the URL slightly more, but it's generally needed by the client anyway.
  // If the URL needs to be dynamic, getting it via IPC is better.
  // getBackendUrl: () => process.env.BACKEND_API_ENDPOINT || 'http://localhost:3000' // Example if main set it as env var
});

console.log('Preload script finished execution. electronAPI exposed.');
