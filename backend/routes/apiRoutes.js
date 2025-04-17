// routes/apiRoutes.js (v2) - Handles streaming response back to client

const express = require('express');
const authenticateToken = require('../middleware/authMiddleware');
// Import the streaming functions from aiService
const { getVisionResponseStream, getLanguageResponseStream } = require('../services/aiService');

const router = express.Router();

// --- Protected '/ask' Endpoint (Streaming) ---
router.post('/ask', authenticateToken, async (req, res, next) => {
  const userId = req.user.id;
  console.log(`Received /ask request from user ID: ${userId}`);

  try {
    const { question, screenshotDataUrl } = req.body;

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Question text is required.' });
    }

    // --- TODO: Add Speech-to-Text logic here if needed ---
    const transcribedText = question;

    // --- Set Headers for Server-Sent Events (SSE) ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Flush headers immediately

    let stream;

    // Get the appropriate stream from the AI service
    if (screenshotDataUrl) {
      if (typeof screenshotDataUrl !== 'string' || !screenshotDataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid screenshot data format.' }); // Should ideally not happen with SSE headers set, but good practice
      }
      console.log("API Route: Getting vision stream...");
      stream = await getVisionResponseStream(transcribedText, screenshotDataUrl, userId);
    } else {
      console.log("API Route: Getting language stream...");
      stream = await getLanguageResponseStream(transcribedText, userId);
    }

    console.log("API Route: Processing stream...");
    let fullResponse = ""; // Keep track of the full response for history

    // Process the stream from OpenAI
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        // Accumulate content for history
        fullResponse += content;
        // Send chunk to client in SSE format: data: {...}\n\n
        // We send a simple JSON object with a 'content' key
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
      // Check for finish reason (optional, but good practice)
      if (chunk.choices[0]?.finish_reason) {
          console.log("Stream finished with reason:", chunk.choices[0].finish_reason);
          break; // Exit loop once stream is finished
      }
    }

    console.log("API Route: Stream finished.");
    // Send a final SSE event to signal completion (optional)
    res.write(`data: ${JSON.stringify({ finished: true })}\n\n`);

    // End the response connection
    res.end();

    // --- TODO: Save history AFTER stream is complete ---
    // We need the full response text here.
    // Consider how/where to save history now. Maybe the client sends it back?
    // Or maybe we accumulate 'fullResponse' and save it here.
    // For now, history saving is removed from this immediate flow.

  } catch (error) {
    console.error(`Error processing /ask stream request for user ${req.user?.id}:`, error);
    // If headers haven't been sent, we can send a normal error response
    if (!res.headersSent) {
        next(error); // Pass to error handler
    } else {
        // If headers were already sent (stream started), we can't send a JSON error.
        // We can try sending an error event via SSE.
        try {
             res.write(`data: ${JSON.stringify({ error: error.message || 'An error occurred during streaming.' })}\n\n`);
             res.write(`data: ${JSON.stringify({ finished: true })}\n\n`); // Signal end even on error
        } catch (writeError) {
            console.error("Error writing SSE error message:", writeError);
        }
        res.end(); // Ensure the connection is closed
    }
  }
});

module.exports = router;
