// routes/apiRoutes.js - Handles the main '/api/ask' endpoint

const express = require('express');
const authenticateToken = require('../middleware/authMiddleware'); // Import auth middleware
const aiService = require('../services/aiService'); // Import AI service functions

const router = express.Router();

// --- Protected '/ask' Endpoint ---
// Apply the authentication middleware *before* the route handler
router.post('/ask', authenticateToken, async (req, res, next) => {
  try {
    // req.user is populated by authenticateToken middleware
    const userId = req.user.id; // Get user ID from verified token payload
    console.log(`Received /ask request from user ID: ${userId}`);

    const { question, screenshotDataUrl } = req.body;

    // Basic validation
    if (!question || typeof question !== 'string' || question.trim() === '') {
        return res.status(400).json({ error: 'Question text is required.' });
    }

    // --- TODO: Add Speech-to-Text logic here if needed ---
    // If the client sends audio data instead of transcribed text,
    // you would call something like:
    // const transcribedText = await aiService.transcribeAudio(audioData);
    // For now, we assume 'question' contains the transcribed text.
    const transcribedText = question;


    let aiResponseText;

    // Decide which AI function to call based on screenshot presence
    if (screenshotDataUrl) {
        // Validate screenshotDataUrl format (basic check)
        if (typeof screenshotDataUrl !== 'string' || !screenshotDataUrl.startsWith('data:image/')) {
             return res.status(400).json({ error: 'Invalid screenshot data format.' });
        }
        console.log("Calling AI service with vision...");
        aiResponseText = await aiService.getVisionResponse(transcribedText, screenshotDataUrl, userId);
    } else {
        console.log("Calling AI service without vision (language only)...");
        aiResponseText = await aiService.getLanguageResponse(transcribedText, userId);
    }

    // Send the successful response back
    res.json({ answer: aiResponseText });

  } catch (error) {
    // Handle errors from AI service or other issues
    console.error(`Error processing /ask request for user ${req.user?.id}:`, error);
    // Pass error to the central error handler in server.js
    // You might want more specific error handling/status codes here
    next(error);
  }
});

module.exports = router;
