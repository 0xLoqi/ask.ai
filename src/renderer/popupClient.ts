// Minimal popup renderer for client-side image resize and WebP conversion
// This file is loaded as a module by popup.html

export {};
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on?: (channel: string, func: (...args: any[]) => void) => void;
    };
  }
}

async function toWebP(dataUrl: string): Promise<string> {
  const img = await createImageBitmap(await fetch(dataUrl).then(r => r.blob()));
  const scale = Math.min(1600 / img.width, 1);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.85);
}

// Example: wire up to a button click for demo
window.addEventListener('DOMContentLoaded', () => {
  const sendBtn = document.getElementById('send-with-screenshot-button');
  const input = document.getElementById('transcription-input') as HTMLTextAreaElement | null;
  const status = document.getElementById('status-indicator');
  const cancelBtn = document.getElementById('cancel-button');
  let listening = false;
  let mediaStream: MediaStream | null = null;
  let recognition: any = null; // webkitSpeechRecognition
  let doubleTapTimeout: number | null = null;
  let lastTap = 0;

  // --- Overlay mode switching ---
  if (window.electronAPI && window.electronAPI.on) {
    window.electronAPI.on('input-mode', (mode: 'typing' | 'listening') => {
      if (!input || !status) return;
      if (mode === 'typing') {
        listening = false;
        status.className = 'status-indicator idle';
        input.placeholder = 'Type your question...';
        input.disabled = false;
        stopListening();
      } else if (mode === 'listening') {
        listening = true;
        status.className = 'status-indicator listening';
        input.placeholder = 'Listening...';
        input.disabled = false;
        startListening();
      }
    });
    // --- Update notifications ---
    window.electronAPI.on('update-available', () => showToast('A new update is available and is being downloaded.'));
    window.electronAPI.on('update-not-available', () => showToast('You are running the latest version.'));
    window.electronAPI.on('update-downloaded', () => showToast('Update downloaded! Restart the app to apply.'));
    window.electronAPI.on('update-error', (msg: string) => showToast('Update error: ' + msg));
  }

  // --- Streaming transcription (Web Speech API fallback) ---
  function startListening() {
    stopListening();
    if (!('webkitSpeechRecognition' in window)) {
      if (status) status.className = 'status-indicator error';
      input!.placeholder = 'Mic unavailable—typing only.';
      input!.disabled = false;
      showToast('Mic unavailable—typing only.');
      listening = false;
      return;
    }
    try {
      // @ts-ignore
      recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      let finalTranscript = '';
      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        input!.value = finalTranscript + interim;
      };
      recognition.onerror = (e: any) => {
        if (status) status.className = 'status-indicator error';
        input!.placeholder = 'Mic unavailable—typing only.';
        input!.disabled = false;
        showToast('Mic unavailable—typing only.');
        listening = false;
        stopListening();
      };
      recognition.onend = () => {
        if (listening) {
          if (status) status.className = 'status-indicator idle';
          input!.placeholder = 'Type your question...';
        }
      };
      recognition.start();
    } catch (e) {
      if (status) status.className = 'status-indicator error';
      input!.placeholder = 'Mic unavailable—typing only.';
      input!.disabled = false;
      showToast('Mic unavailable—typing only.');
      listening = false;
    }
  }
  function stopListening() {
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
      recognition = null;
    }
  }

  // --- Cancel (ESC or double-tap) ---
  function cancelInput() {
    stopListening();
    if (input) {
      input.value = '';
      input.placeholder = 'Type your question...';
      input.disabled = false;
    }
    if (status) status.className = 'status-indicator idle';
    listening = false;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cancelInput();
    }
    // ⌘↵ or Enter to submit
    if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || (e.key === 'Enter' && !listening)) {
      e.preventDefault();
      sendBtn?.click();
    }
  });
  if (cancelBtn) cancelBtn.addEventListener('click', cancelInput);
  if (input) {
    input.addEventListener('touchend', () => {
      const now = Date.now();
      if (now - lastTap < 300) {
        cancelInput();
      }
      lastTap = now;
    });
  }

  // --- Toast helper ---
  function showToast(msg: string) {
    const container = document.getElementById('toast-container');
    if (!container) return alert(msg); // fallback
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.background = 'rgba(32,32,32,0.95)';
    toast.style.color = '#fff';
    toast.style.padding = '12px 24px';
    toast.style.marginTop = '8px';
    toast.style.borderRadius = '8px';
    toast.style.fontSize = '1rem';
    toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    toast.style.opacity = '1';
    toast.style.transition = 'opacity 0.5s';
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    setTimeout(() => { container.removeChild(toast); }, 3000);
  }

  // ... existing send-with-screenshot-button logic ...
  if (!sendBtn) return;
  sendBtn.addEventListener('click', async () => {
    const lastScreenshot = window.electronAPI && (await window.electronAPI.invoke('get-initial-data')).lastScreenshotDataUrl;
    if (!lastScreenshot) {
      alert('No screenshot available.');
      return;
    }
    const webpDataUrl = await toWebP(lastScreenshot);
    const prompt = input?.value || '';
    const payload = { img: webpDataUrl, prompt };
    await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    alert('Image sent as WebP!');
  });

  // --- Global Error Handling ---
  window.onerror = function (message, source, lineno, colno, error) {
    try {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error && error.stack ? error.stack : String(message),
          source: 'renderer',
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) {
      // fallback: log to console
      console.error('[GlobalError] Failed to POST error:', e);
    }
  };
  window.onunhandledrejection = function (event) {
    try {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: event.reason && event.reason.stack ? event.reason.stack : String(event.reason),
          source: 'renderer',
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error('[GlobalError] Failed to POST error:', e);
    }
  };
}); 