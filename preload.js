// preload.js
// Exposes specific Electron/Node APIs to the renderer process securely
// using the contextBridge.

const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of valid channels for IPC communication
const validSendChannels = ['close-popup'];
const validInvokeChannels = ['ask-question'];
const validOnChannels = ['screenshot-captured'];

console.log('Preload script executing...');

contextBridge.exposeInMainWorld('electronAPI', {
  // Send: Renderer -> Main (one-way)
  send: (channel, data) => {
    if (validSendChannels.includes(channel)) {
      console.log(`Preload: Sending on channel "${channel}"`);
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
          const result = await ipcRenderer.invoke(channel, ...args);
          console.log(`Preload: Received invoke result for "${channel}"`);
          return result;
      } catch (error) {
           console.error(`Preload: Error invoking channel "${channel}":`, error);
           throw error; // Re-throw error to be caught in renderer
      }

    } else {
      console.warn(`Preload: Invalid invoke channel attempted: ${channel}`);
      // It's often better to throw an error for invalid channels
      throw new Error(`Invalid invoke channel: ${channel}`);
    }
  },
  // On: Main -> Renderer
  on: (channel, func) => {
    if (validOnChannels.includes(channel)) {
      // Wrap the listener to ensure the 'event' object isn't exposed directly
      // and provide a way to remove the specific listener later.
      const listener = (event, ...args) => func(...args);
      console.log(`Preload: Registering listener for channel "${channel}"`);
      ipcRenderer.on(channel, listener);

      // Return a function to remove this specific listener
      return () => {
         console.log(`Preload: Removing listener for channel "${channel}"`);
         ipcRenderer.removeListener(channel, listener);
      };
    } else {
      console.warn(`Preload: Invalid 'on' channel attempted: ${channel}`);
      // Return a no-op function or throw an error
      return () => {}; // No-op function
    }
  },
  // Note: A generic removeListener isn't directly exposed here.
  // Instead, the 'on' method returns a function to remove *that specific* listener.
  // This is generally safer than exposing ipcRenderer.removeListener directly.
});

console.log('Preload script finished execution. electronAPI exposed.');
