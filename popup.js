// popup.js (v2)
// Handles voice input, state changes, optional preview, and two send actions.

// --- DOM Elements ---
const container = document.querySelector('.container');
const closeButton = document.getElementById('close-button');
const screenshotPreviewArea = document.getElementById('screenshot-preview-area');
const screenshotContainer = document.getElementById('screenshot-container');
const screenshotImage = document.getElementById('screenshot-image');
const noScreenshotText = document.getElementById('no-screenshot-text');
const statusIndicator = document.getElementById('status-indicator');
const statusIndicatorIcon = statusIndicator.querySelector('svg'); // Get SVG icon
const transcriptionInput = document.getElementById('transcription-input');
const sendButton = document.getElementById('send-button');
const sendWithScreenshotButton = document.getElementById('send-with-screenshot-button');
const cancelButton = document.getElementById('cancel-button');
const responseArea = document.getElementById('response-area');
const responseContent = document.getElementById('response-content');
const loadingIndicator = document.getElementById('loading-indicator');

// --- State Variables ---
let mediaRecorder;
let audioChunks = [];
let currentStatus = 'idle'; // 'idle', 'listening', 'processing', 'error'
let showScreenshotPreview = true; // Default, updated from main
let lastScreenshotDataUrl = null; // Store last previewed screenshot
let silenceTimer = null; // Timer to detect end of speech (optional)
const SILENCE_TIMEOUT = 1500; // ms of silence before stopping recording (adjust)

// --- Icons (SVG paths for dynamic updates) ---
const micIconPath = '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>';
const micOffIconPath = '<path d="M12 8V4a2 2 0 0 0-4 0v4"/><line x1="16" x2="16" y1="13" y2="17"/><line x1="8" x2="8" y1="17" y2="21"/><path d="M12 12a4 4 0 0 0-4-4v8a4 4 0 0 0 4-4Z"/><path d="M20.43 14.76A8.5 8.5 0 0 0 18 8V4a6 6 0 0 0-12 0v4a8.5 8.5 0 0 0 6.24 8.23"/><line x1="1" x2="23" y1="1" y2="23"/>';
const processingIconPath = '<path d="M12 2v4"/><path d="m16.2 7.8 2.8-2.8"/><path d="M18 12h4"/><path d="m16.2 16.2 2.8 2.8"/><path d="M12 18v4"/><path d="m7.8 16.2-2.8 2.8"/><path d="M6 12H2"/><path d="m7.8 7.8-2.8-2.8"/>'; // Simple spinner/loader path
const errorIconPath = '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'; // Simple alert circle path


// --- Audio Handling ---

/**
 * Starts audio recording using MediaRecorder.
 */
async function startRecording() {
    if (currentStatus !== 'idle' && currentStatus !== 'error') return; // Prevent multiple starts

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = []; // Reset chunks

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
            resetSilenceTimer(); // Reset timer on receiving data
        };

        mediaRecorder.onstop = async () => {
            console.log("Recording stopped.");
            setStatus('processing'); // Switch to processing state
            stream.getTracks().forEach(track => track.stop()); // Stop mic access

            if (audioChunks.length === 0) {
                console.warn("No audio data recorded.");
                setStatus('idle'); // Go back to idle if nothing was recorded
                transcriptionInput.value = ""; // Clear placeholder
                transcriptionInput.placeholder = "Nothing recorded. Press hotkey again.";
                return;
            }

            // ** Option 1: Send audio blob to main for backend transcription **
            // const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Adjust type if needed
            // TODO: Send audioBlob to main process (requires handling Blob in IPC)

            // ** Option 2: Simulate transcription for now **
            // Replace this with actual transcription result from backend later
            const simulatedTranscription = `Simulated transcription of recorded audio (${audioChunks.length} chunks). Replace this logic.`;
            transcriptionInput.value = simulatedTranscription; // Display transcription
            transcriptionInput.disabled = false; // Enable editing/sending
            sendButton.disabled = false;
            sendWithScreenshotButton.disabled = false;
            cancelButton.disabled = false;
            setStatus('idle'); // Ready to send or cancel
            transcriptionInput.focus(); // Focus for potential editing/sending

            clearTimeout(silenceTimer); // Clear any lingering timer
        };

        mediaRecorder.onerror = (event) => {
            console.error("MediaRecorder error:", event.error);
            setStatus('error', 'Error during recording.');
            clearTimeout(silenceTimer);
        };

        mediaRecorder.start();
        setStatus('listening');
        transcriptionInput.value = ""; // Clear previous text
        transcriptionInput.placeholder = "Listening...";
        transcriptionInput.disabled = true; // Disable input while listening
        sendButton.disabled = true;
        sendWithScreenshotButton.disabled = true;
        cancelButton.disabled = false; // Allow cancelling while listening
        startSilenceTimer(); // Start silence detection
        console.log("Recording started...");

    } catch (err) {
        console.error("Error accessing microphone:", err);
        setStatus('error', 'Could not access microphone. Check permissions.');
        transcriptionInput.placeholder = "Microphone access denied or failed.";
    }
}

/**
 * Stops audio recording manually or by silence timer.
 */
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop(); // This triggers the 'onstop' handler
    }
    clearTimeout(silenceTimer);
}

/**
 * Starts/resets the silence detection timer.
 */
function startSilenceTimer() {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(stopRecording, SILENCE_TIMEOUT);
}
function resetSilenceTimer() {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(stopRecording, SILENCE_TIMEOUT);
}


// --- UI & State Management ---

/**
 * Updates the status indicator UI (icon and class).
 * @param {'idle' | 'listening' | 'processing' | 'error'} newStatus
 * @param {string} [tooltipText=''] Optional tooltip text, especially for errors.
 */
function setStatus(newStatus, tooltipText = '') {
    currentStatus = newStatus;
    statusIndicator.className = `status-indicator ${newStatus}`;
    let iconPath = micOffIconPath; // Default to idle/mic-off
    let defaultTooltip = "Status: Idle";

    switch (newStatus) {
        case 'listening':
            iconPath = micIconPath;
            defaultTooltip = "Status: Listening...";
            break;
        case 'processing':
            iconPath = processingIconPath; // Replace with actual SVG path
            defaultTooltip = "Status: Processing...";
            break;
        case 'error':
            iconPath = errorIconPath; // Replace with actual SVG path
            defaultTooltip = `Status: Error - ${tooltipText || 'Unknown error'}`;
            break;
        case 'idle':
        default:
             iconPath = micOffIconPath;
             defaultTooltip = "Status: Idle";
            break;
    }
    statusIndicatorIcon.innerHTML = iconPath; // Update SVG content
    statusIndicator.title = tooltipText || defaultTooltip; // Update tooltip
}

/**
 * Updates the visibility and content of the screenshot preview.
 */
function updateScreenshotPreview() {
    if (showScreenshotPreview && lastScreenshotDataUrl) {
        screenshotImage.src = lastScreenshotDataUrl;
        screenshotImage.style.display = 'block';
        noScreenshotText.style.display = 'none';
        screenshotPreviewArea.style.display = 'flex'; // Use flex display
    } else if (showScreenshotPreview) {
         screenshotImage.style.display = 'none';
         noScreenshotText.style.display = 'block';
         screenshotPreviewArea.style.display = 'flex'; // Show area but with text
    }
     else {
        screenshotPreviewArea.style.display = 'none'; // Hide area completely
    }
}

/**
 * Resets the entire UI to its initial state.
 */
function resetUI() {
    console.log("Resetting UI.");
    stopRecording(); // Ensure recording is stopped
    setStatus('idle');
    transcriptionInput.value = '';
    transcriptionInput.placeholder = "Press hotkey to start speaking...";
    transcriptionInput.disabled = true; // Disabled until hotkey pressed/window shown
    responseArea.style.display = 'none';
    responseContent.textContent = '';
    loadingIndicator.style.display = 'none';
    sendButton.disabled = true;
    sendWithScreenshotButton.disabled = true;
    cancelButton.disabled = true; // Disabled initially
    updateScreenshotPreview(); // Update based on current settings/last screenshot
}

// --- Sending Logic ---

/**
 * Handles sending the query to the main process.
 * @param {boolean} sendWithNewScreenshot - Flag indicating action type.
 */
async function sendQuery(sendWithNewScreenshot) {
    const transcribedText = transcriptionInput.value.trim();

    // Basic validation - ensure there's text (even simulated)
    if (!transcribedText && audioChunks.length === 0) {
        console.warn("No text or audio to send.");
        setStatus('error', 'Nothing to send.');
        transcriptionInput.placeholder = "Please speak first or type a question.";
        transcriptionInput.disabled = false; // Allow typing
        return;
    }

    // Disable inputs during processing
    setStatus('processing');
    transcriptionInput.disabled = true;
    sendButton.disabled = true;
    sendWithScreenshotButton.disabled = true;
    cancelButton.disabled = true;
    responseArea.style.display = 'block'; // Show response area
    responseContent.textContent = ''; // Clear previous response
    loadingIndicator.style.display = 'block'; // Show loading dots

    try {
        // Send data to main process
        const result = await window.electronAPI.invoke('send-query', {
            transcribedText: transcribedText, // Send simulated/actual text
            // TODO: Send audio data if backend handles transcription
            sendWithNewScreenshot: sendWithNewScreenshot
        });

        loadingIndicator.style.display = 'none'; // Hide loading

        if (result && result.answer) {
            console.log(`Renderer: Received answer.`);
            responseContent.textContent = result.answer;
            setStatus('idle'); // Back to idle after success
            // Optionally close window after success? Or wait for user?
            // window.electronAPI.send('close-popup');
        } else {
            const errorMessage = result?.error || 'Unknown error from backend.';
            console.error('Renderer: Failed to get answer:', errorMessage);
            responseContent.textContent = `Error: ${errorMessage}`;
            setStatus('error', errorMessage); // Set error state
        }
    } catch (error) {
        console.error('Renderer: Error invoking send-query:', error);
        loadingIndicator.style.display = 'none';
        responseContent.textContent = `Error: ${error.message}`;
        setStatus('error', error.message);
    } finally {
        // Re-enable relevant controls after processing, unless error state persists
        if (currentStatus !== 'error') {
             transcriptionInput.disabled = false;
             // Keep send buttons disabled until new recording? Or enable? Let's disable.
             // sendButton.disabled = false;
             // sendWithScreenshotButton.disabled = false;
             cancelButton.disabled = false;
        } else {
            // If error, allow cancelling or maybe retrying?
             cancelButton.disabled = false;
             transcriptionInput.disabled = false; // Allow editing/retrying maybe?
        }
    }
}

// --- Event Listeners ---

// Handle initial data load from main process
window.electronAPI.on('initial-load-data', ({ showScreenshotPreview: showPreview, lastScreenshotDataUrl: lastUrl }) => {
    console.log("Renderer: Received initial data.", { showPreview, hasUrl: !!lastUrl });
    showScreenshotPreview = showPreview;
    lastScreenshotDataUrl = lastUrl;
    resetUI(); // Reset UI based on initial settings
    // Automatically start recording when window is shown/triggered by hotkey
    // Use a small delay to ensure UI is ready
    setTimeout(startRecording, 100);
});

// Handle settings updates from main process (e.g., preview toggle)
window.electronAPI.on('settings-updated', ({ showScreenshotPreview: showPreview }) => {
     console.log("Renderer: Received settings update.", { showPreview });
     showScreenshotPreview = showPreview;
     updateScreenshotPreview(); // Update UI immediately
});

// Handle notification that a new screenshot was captured by main process
window.electronAPI.on('screenshot-updated', (newScreenshotUrl) => {
    console.log("Renderer: Received new screenshot update for preview.");
    lastScreenshotDataUrl = newScreenshotUrl;
    updateScreenshotPreview(); // Update preview if visible
});


// Button Clicks
sendButton.addEventListener('click', () => sendQuery(false)); // Send text only
sendWithScreenshotButton.addEventListener('click', () => sendQuery(true)); // Send with new screenshot
cancelButton.addEventListener('click', () => {
    console.log("Cancel button clicked.");
    stopRecording(); // Stop recording if active
    resetUI(); // Reset the UI state
    // Optionally close the window on cancel
    // window.electronAPI.send('close-popup');
});
closeButton.addEventListener('click', () => {
    stopRecording(); // Ensure recording stops if window is closed
    window.electronAPI.send('close-popup');
});

// Keyboard Shortcuts within the textarea
transcriptionInput.addEventListener('keydown', (event) => {
    if (!transcriptionInput.disabled) { // Only handle keys if input is enabled
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent newline
            sendButton.click(); // Trigger "Send" (text only)
        } else if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault(); // Prevent default Shift+Enter behavior (might vary)
            sendWithScreenshotButton.click(); // Trigger "Send with New Screenshot"
        }
    }
     if (event.key === 'Escape') {
         event.preventDefault();
         cancelButton.click(); // Trigger Cancel action
     }
});

// Global key listener for Escape (might be redundant with textarea listener)
// document.addEventListener('keydown', (event) => {
//     if (event.key === 'Escape') {
//         cancelButton.click();
//     }
// });


// --- Initial Setup ---
window.addEventListener('DOMContentLoaded', () => {
    console.log('Renderer: DOM content loaded.');
    // Request initial data from main process
    window.electronAPI.invoke('get-initial-data').then(data => {
         console.log("Renderer: Received initial data via invoke.", data);
         showScreenshotPreview = data.showScreenshotPreview;
         lastScreenshotDataUrl = data.lastScreenshotDataUrl;
         resetUI();
         // Auto-start recording (might be redundant if 'initial-load-data' event is reliable)
         setTimeout(startRecording, 100);
    }).catch(err => {
        console.error("Error getting initial data:", err);
        resetUI(); // Reset even on error
    });
});

// Clean up on unload (optional)
window.addEventListener('beforeunload', () => {
    stopRecording(); // Make sure mic is released
});

console.log("popup.js (v2) loaded");
