// popup.js
// Renderer process logic for the popup window (popup.html)

// Get references to DOM elements
const screenshotImage = document.getElementById('screenshot-image');
const loadingScreenshotText = document.getElementById('loading-screenshot');
const questionInput = document.getElementById('question-input');
const submitButton = document.getElementById('submit-button');
const responseArea = document.getElementById('response-area');
const responseContent = document.getElementById('response-content');
const loadingIndicator = document.getElementById('loading-indicator');
const closeButton = document.getElementById('close-button');

// Store the function returned by electronAPI.on to remove the listener later
let removeScreenshotListener = null;

// --- Utility Functions ---

/**
 * Resets the UI state, typically when a new screenshot arrives or window opens.
 */
function resetUI() {
    console.log("Resetting UI state.");
    questionInput.value = '';
    responseArea.style.display = 'none';
    responseContent.textContent = '';
    loadingIndicator.style.display = 'none';
    submitButton.disabled = false;
    questionInput.disabled = false;
    // Ensure loading text is hidden and image is potentially shown or hidden based on state
    loadingScreenshotText.style.display = 'block'; // Show loading initially
    screenshotImage.style.display = 'none'; // Hide image initially
    screenshotImage.src = ''; // Clear previous image src
}

/**
 * Shows an error message in the response area.
 * @param {string} message - The error message to display.
 */
function displayError(message) {
    console.error("Displaying error:", message);
    responseArea.style.display = 'block';
    loadingIndicator.style.display = 'none'; // Hide loading indicator
    responseContent.textContent = `Error: ${message}`;
    // Keep inputs enabled so user can potentially try again or close
    submitButton.disabled = false;
    questionInput.disabled = false;
}

// --- Event Listeners ---

/**
 * Handles receiving the screenshot data URL from the main process.
 * @param {string} dataUrl - The data URL of the captured screenshot.
 */
function handleScreenshotCaptured(dataUrl) {
    console.log('Renderer: Received screenshot-captured event.');
    resetUI(); // Reset UI before loading new screenshot

    if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
        screenshotImage.src = dataUrl;
        screenshotImage.onload = () => {
            screenshotImage.style.display = 'block'; // Show image only after it's loaded
            loadingScreenshotText.style.display = 'none'; // Hide loading text
            console.log('Renderer: Screenshot loaded successfully.');
            questionInput.focus(); // Focus input after image loads
        };
        screenshotImage.onerror = () => {
            console.error('Renderer: Failed to load screenshot image from data URL.');
            displayError('Failed to display the captured screenshot.');
            loadingScreenshotText.textContent = 'Error loading image.';
            loadingScreenshotText.style.display = 'block';
            screenshotImage.style.display = 'none';
        };
    } else {
        console.error('Renderer: Received invalid or missing screenshot data URL.');
        displayError('Could not retrieve screenshot data.');
        loadingScreenshotText.textContent = 'Failed to load screenshot.';
        loadingScreenshotText.style.display = 'block';
        screenshotImage.style.display = 'none';
    }
}


/**
 * Handles the click event for the submit button.
 */
async function handleSubmit() {
    const question = questionInput.value.trim();
    if (!question) {
        console.log("Question is empty.");
        questionInput.focus(); // Keep focus on input if empty
        // Optional: Add visual feedback like a border shake
        questionInput.classList.add('input-error');
        setTimeout(() => questionInput.classList.remove('input-error'), 500);
        return;
    }

    console.log(`Renderer: Sending question: "${question}"`);

    // Disable input/button, clear previous response, show loading indicator
    submitButton.disabled = true;
    questionInput.disabled = true;
    responseContent.textContent = ''; // Clear previous response text
    responseArea.style.display = 'block'; // Ensure response area is visible
    loadingIndicator.style.display = 'block'; // Show loading dots

    try {
        // Send question to main process via IPC and wait for the response
        const result = await window.electronAPI.invoke('ask-question', question);

        loadingIndicator.style.display = 'none'; // Hide loading dots

        if (result && result.answer) {
            console.log(`Renderer: Received answer.`);
            responseContent.textContent = result.answer; // Display the answer
        } else {
            // Handle errors returned from the main process
            const errorMessage = result?.error || 'Unknown error occurred.';
            console.error('Renderer: Failed to get answer:', errorMessage);
            displayError(errorMessage); // Show error in the UI
        }
    } catch (error) {
        // Handle errors during the IPC communication itself
        console.error('Renderer: Error invoking ask-question:', error);
        loadingIndicator.style.display = 'none'; // Hide loading dots
        displayError(`Communication error: ${error.message}`);
    } finally {
        // Re-enable input and button regardless of success or failure
        // Allows user to ask another question about the same screenshot or try again
        submitButton.disabled = false;
        questionInput.disabled = false;
        questionInput.focus(); // Set focus back to input for convenience
    }
}

// Add event listener for the submit button
submitButton.addEventListener('click', handleSubmit);

// Add event listener for Enter key in the textarea (Shift+Enter for newline)
questionInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent default newline insertion
        handleSubmit(); // Trigger the submit action
    }
});

// Add event listener for the close button
closeButton.addEventListener('click', () => {
    console.log("Renderer: Close button clicked.");
    window.electronAPI.send('close-popup'); // Send message to main process to hide window
});


// --- Initial Setup ---

// When the window loads, set up the listener for screenshots
window.addEventListener('DOMContentLoaded', () => {
    console.log('Renderer: DOM content loaded.');

    // Remove any existing listener before adding a new one (important for hot-reloading scenarios)
    if (removeScreenshotListener) {
        removeScreenshotListener();
    }
    // Register the listener and store the function to remove it
    removeScreenshotListener = window.electronAPI.on('screenshot-captured', handleScreenshotCaptured);

    // Reset UI and focus input when the window becomes visible/ready
    resetUI(); // Initial reset
    setTimeout(() => {
        questionInput.focus(); // Focus input field shortly after load
    }, 100);
});

// Optional: Clean up listener when the window is about to be unloaded
window.addEventListener('beforeunload', () => {
    if (removeScreenshotListener) {
        console.log("Renderer: Cleaning up screenshot listener before unload.");
        removeScreenshotListener();
    }
});

console.log('Renderer: popup.js script loaded.');

// Add simple CSS class for input error feedback
const style = document.createElement('style');
style.textContent = `
.input-error {
    border-color: red !important;
    animation: shake 0.5s;
}
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    50% { transform: translateX(5px); }
    75% { transform: translateX(-5px); }
}
`;
document.head.appendChild(style);
