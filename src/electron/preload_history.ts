// preload_history.js
// Exposes specific Electron/Node APIs to the history renderer process securely.

import { contextBridge, ipcRenderer } from 'electron';

// Whitelist of valid channels for history window communication
const validInvokeChannels = ['get-history', 'clear-history'];
const validOnChannels = ['history-updated'];

console.log('Preload script for HISTORY window executing...');

contextBridge.exposeInMainWorld('historyAPI', {
  // Invoke: Renderer -> Main -> Renderer (two-way)
  invoke: async (channel: any, ...args: any[]) => {
    if (validInvokeChannels.includes(channel)) {
      console.log(`History Preload: Invoking channel "${channel}"`);
      try {
          const result = await ipcRenderer.invoke(channel, ...args);
          console.log(`History Preload: Received invoke result for "${channel}"`);
          return result;
      } catch (error) {
           console.error(`History Preload: Error invoking channel "${channel}":`, error);
           throw error; // Re-throw error
      }
    } else {
      console.warn(`History Preload: Invalid invoke channel attempted: ${channel}`);
      throw new Error(`Invalid invoke channel: ${channel}`);
    }
  },
  // On: Main -> Renderer
  on: (channel: any, func: any) => {
    if (validOnChannels.includes(channel)) {
      const listener = (event: any, ...args: any[]) => func(...args);
      console.log(`History Preload: Registering listener for channel "${channel}"`);
      ipcRenderer.on(channel, listener);
      // Return a function to remove this specific listener
      return () => {
         console.log(`History Preload: Removing listener for channel "${channel}"`);
         ipcRenderer.removeListener(channel, listener);
      };
    } else {
      console.warn(`History Preload: Invalid 'on' channel attempted: ${channel}`);
      return () => {}; // No-op function
    }
  },
});

console.log('Preload script for HISTORY window finished execution. historyAPI exposed.');
