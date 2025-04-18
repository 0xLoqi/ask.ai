// history.js
// Renderer process logic for the history window (history.html)

const historyListDiv = document.getElementById('history-list');
const loadingText = document.getElementById('loading-history');
const refreshButton = document.getElementById('refresh-button');
const clearButton = document.getElementById('clear-button');

// Store the function to remove the listener
let removeHistoryUpdateListener = null;

/**
 * Formats an ISO timestamp into a more readable string.
 * @param {string} isoString - The ISO timestamp string.
 * @returns {string} - Formatted date/time string.
 */
function formatTimestamp(isoString) {
    try {
        const date = new Date(isoString);
        // Adjust options as needed for desired format
        const options = {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
        };
        return date.toLocaleString(undefined, options); // Use user's locale
    } catch (e) {
        console.error("Error formatting timestamp:", e);
        return isoString; // Fallback to original string
    }
}

/**
 * Renders the history items in the list div.
 * @param {Array} history - Array of history objects.
 */
function renderHistory(history) {
    console.log("Rendering history:", history);
    // Clear previous content
    historyListDiv.innerHTML = '';

    if (!history || history.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No history recorded yet.';
        p.className = 'empty-history';
        historyListDiv.appendChild(p);
        return;
    }

    // Reverse history to show most recent first
    history.slice().reverse().forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'history-item';

        const timestampP = document.createElement('span');
        timestampP.className = 'timestamp';
        timestampP.textContent = formatTimestamp(item.timestamp);

        const questionP = document.createElement('p');
        questionP.className = 'question';
        questionP.innerHTML = `<strong>Question:</strong> `; // Use innerHTML carefully
        questionP.appendChild(document.createTextNode(item.question)); // Append text safely

        const answerP = document.createElement('p');
        answerP.className = 'answer';
        answerP.innerHTML = `<strong>Answer:</strong> `; // Use innerHTML carefully
        answerP.appendChild(document.createTextNode(item.answer)); // Append text safely

        itemDiv.appendChild(timestampP);
        itemDiv.appendChild(questionP);
        itemDiv.appendChild(answerP);

        historyListDiv.appendChild(itemDiv);
    });
}

/**
 * Fetches and renders the history data.
 */
async function loadAndRenderHistory() {
    loadingText.style.display = 'block'; // Show loading text
    historyListDiv.innerHTML = ''; // Clear previous list
    historyListDiv.appendChild(loadingText);

    try {
        console.log("Requesting history data from main process...");
        const history = await window.historyAPI.invoke('get-history');
        loadingText.style.display = 'none'; // Hide loading text
        renderHistory(history);
    } catch (error) {
        console.error("Error fetching history:", error);
        loadingText.style.display = 'none'; // Hide loading text
        historyListDiv.innerHTML = '<p class="empty-history">Error loading history. Please try refreshing.</p>';
    }
}

/**
 * Handles the clear history button click.
 */
async function handleClearHistory() {
    // Confirmation dialog (important!)
    const confirmed = confirm("Are you sure you want to clear all history? This cannot be undone.");

    if (confirmed) {
        console.log("Requesting to clear history...");
        try {
            const result = await window.historyAPI.invoke('clear-history');
            if (result.success) {
                console.log("History cleared successfully.");
                renderHistory([]); // Re-render with empty list immediately
            } else {
                 alert("Failed to clear history.");
            }
        } catch (error) {
            console.error("Error clearing history:", error);
            alert(`Error clearing history: ${error.message}`);
        }
    }
}


// --- Event Listeners ---

// Load history when the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    console.log("History window DOM loaded.");

    // Initial load
    loadAndRenderHistory();

    // Listen for updates pushed from the main process
    if (removeHistoryUpdateListener) {
        removeHistoryUpdateListener(); // Remove old listener if exists
    }
    removeHistoryUpdateListener = window.historyAPI.on('history-updated', (updatedHistory) => {
        console.log("Received history-updated event from main process.");
        renderHistory(updatedHistory);
    });

    // Add listeners for buttons
    refreshButton.addEventListener('click', loadAndRenderHistory);
    clearButton.addEventListener('click', handleClearHistory);
});

// Clean up listener when window closes
window.addEventListener('beforeunload', () => {
    if (removeHistoryUpdateListener) {
        console.log("History window cleaning up listener.");
        removeHistoryUpdateListener();
    }
});

console.log("history.js loaded");
