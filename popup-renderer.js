// Minimal renderer logic for popup.html

// Get DOM elements
const sendButton = document.getElementById('send-button');
const input = document.getElementById('transcription-input');
const responseArea = document.getElementById('response-area');
const responseContent = document.getElementById('response-content');
const loadingIndicator = document.getElementById('loading-indicator');

let backendUrl = null;

// Get backend URL from main process
window.electronAPI.invoke('get-initial-data').then((data) => {
  backendUrl = data.backendUrl;
});

function showLoading(show) {
  if (loadingIndicator) loadingIndicator.style.display = show ? '' : 'none';
}

function showResponseArea(show) {
  if (responseArea) responseArea.style.display = show ? '' : 'none';
}

async function sendQuestion() {
  const question = input.value.trim();
  if (!question || !backendUrl) return;
  showLoading(true);
  showResponseArea(true);
  responseContent.textContent = '';
  try {
    // const token = await window.electronAPI.invoke('get-auth-token');
    // console.log('Token being sent:', token);
    const headers = { 'Content-Type': 'application/json' };
    // if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${backendUrl}/api/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question })
    });
    if (!res.ok) throw new Error('Backend error');
    const data = await res.json();
    responseContent.textContent = data.answer || JSON.stringify(data);
  } catch (e) {
    responseContent.textContent = 'Error: ' + e.message;
  } finally {
    showLoading(false);
  }
}

if (sendButton) {
  sendButton.addEventListener('click', sendQuestion);
} 