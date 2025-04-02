// preload.js (v2)
// Exposes IPC channels needed for the voice input flow.

const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of valid channels for IPC communication
const validSendChannels = ['close-popup']; // One-way: Renderer -> Main
const validInvokeChannels = [ // Two-way: Renderer -> Main -> Renderer
    'send-query',
    'get-initial-data'
    // Add login/logout invokes later
];
const validOnChannels = [ // Main -> Renderer
    'settings-updated',
    'screenshot-updated', // For when main captures a new screenshot
    // Add others if needed, e.g., 'login-status-changed'
];

console.log('Preload script executing...');

contextBridge.exposeInMainWorld('electronAPI', {
  // Send: Renderer -> Main (one-way)
  send: (channel, data) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`Preload: Invalid send channel attempted: ${channel}`);
    }
  },
  // Invoke: Renderer -> Main -> Renderer (two-way)
  invoke: async (channel, ...args) => {
    if (validInvokeChannels.includes(channel)) {
      console.log(`Preload: Invoking channel "${channel}"`);
      try {
          return await ipcRenderer.invoke(channel, ...args);
      } catch (error) {
           console.error(`Preload: Error invoking channel "${channel}":`, error);
           throw error; // Re-throw error
      }
    } else {
      console.warn(`Preload: Invalid invoke channel attempted: ${channel}`);
      throw new Error(`Invalid invoke channel: ${channel}`);
    }
  },
  // On: Main -> Renderer
  on: (channel, func) => {
    if (validOnChannels.includes(channel)) {
      const listener = (event, ...args) => func(...args);
      console.log(`Preload: Registering listener for channel "${channel}"`);
      ipcRenderer.on(channel, listener);
      // Return function to remove listener
      return () => {
         console.log(`Preload: Removing listener for channel "${channel}"`);
         ipcRenderer.removeListener(channel, listener);
      };
    } else {
      console.warn(`Preload: Invalid 'on' channel attempted: ${channel}`);
      return () => {}; // No-op function
    }
  },
});

console.log('Preload script finished execution. electronAPI exposed.');
