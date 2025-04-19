// routes/apiRoutes.js (v2) - Handles streaming response back to client

const express = require('express');
const authenticateToken = require('../middleware/authMiddleware');
// Import the streaming functions from aiService
const { getVisionResponseStream, getLanguageResponseStream, getLanguageResponse, getVisionResponse } = require('../services/aiService');

const router = express.Router();

// --- Unprotected '/ask' Endpoint (Non-Streaming, JSON Response) ---
router.post('/ask', async (req, res, next) => {
  console.log(`Received /ask request`);
  try {
    const { question, screenshotDataUrl } = req.body;
    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Question text is required.' });
    }
    const transcribedText = question;
    let answer;
    if (screenshotDataUrl) {
      answer = await getVisionResponse(transcribedText, screenshotDataUrl);
    } else {
      answer = await getLanguageResponse(transcribedText);
    }
    res.json({ answer });
  } catch (error) {
    console.error(`Error processing /ask request:`, error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;
