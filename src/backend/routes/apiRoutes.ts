// routes/apiRoutes.js (v2) - Handles streaming response back to client

import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import authenticateToken from '../middleware/authMiddleware';
// Import the streaming functions from aiService
import { getVisionResponseStream, getLanguageResponseStream, transcribeAudio } from '../services/aiService';
// TODO: Replace with actual import from zod schema
// import type { AskPayload } from '../shared/schemas';
import { AskPayloadSchema, AskPayload } from '../../shared/schemas';
import * as fs from 'fs';
import * as path from 'path';

const router = express.Router();

// --- Protected '/ask' Endpoint (Streaming) ---
const askHandler: RequestHandler = async (req, res, next) => {
  const userId = (req as any).user.id;
  console.log(`Received /ask request from user ID: ${userId}`);

  // Runtime validation with zod
  try {
    req.body = AskPayloadSchema.parse(req.body);
  } catch (err: any) {
    res.status(400).json({ error: 'Invalid request payload', details: err.errors });
    return;
  }

  try {
    const { prompt, img, audio, detail } = req.body;

    // Model router logic
    let model = 'gpt-4o-mini';
    if ((prompt && prompt.length > 120) || detail === true) {
      model = 'gpt-4o';
    }

    const startTime = Date.now();

    // --- Whisper Cloud integration ---
    let transcribedText = prompt;
    if (audio) {
      try {
        transcribedText = await transcribeAudio(audio);
        console.log('Audio transcribed:', transcribedText);
      } catch (err: any) {
        res.status(400).json({ error: 'Audio transcription failed', details: err.message });
        return;
      }
    }

    // --- Set Headers for Server-Sent Events (SSE) ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Flush headers immediately

    let stream;
    let usage = null;

    // Get the appropriate stream from the AI service
    if (img) {
      if (typeof img !== 'string' || !img.startsWith('data:image/')) {
        res.status(400).json({ error: 'Invalid image data format.' });
        return;
      }
      console.log("API Route: Getting vision stream...");
      stream = await getVisionResponseStream(transcribedText, img, userId, model);
    } else {
      console.log("API Route: Getting language stream...");
      stream = await getLanguageResponseStream(transcribedText, userId, model);
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
      // Try to capture usage if present (usually only at end)
      if (chunk.usage) {
        usage = chunk.usage;
      }
      // Check for finish reason (optional, but good practice)
      if (chunk.choices[0]?.finish_reason) {
          console.log("Stream finished with reason:", chunk.choices[0].finish_reason);
          break; // Exit loop once stream is finished
      }
    }

    const latency_ms = Date.now() - startTime;
    // Write usage log
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
      const logPath = path.join(logDir, 'usage.jsonl');
      const logEntry = {
        timestamp: new Date().toISOString(),
        userId,
        model,
        tokens_in: usage?.prompt_tokens ?? null,
        tokens_out: usage?.completion_tokens ?? null,
        latency_ms
      };
      fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    } catch (logErr) {
      console.error('Failed to write usage log:', logErr);
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

  } catch (error: any) {
    console.error(`Error processing /ask stream request for user ${(req as any).user?.id}:`, error);
    // If headers haven't been sent, we can send a normal error response
    if (!res.headersSent) {
        next(error); // Pass to error handler
    } else {
        // If headers were already sent (stream started), we can't send a JSON error.
        // We can try sending an error event via SSE.
        try {
             res.write(`data: ${JSON.stringify({ event: "error", message: error.message || 'An error occurred during streaming.' })}\n\n`);
             res.write(`data: ${JSON.stringify({ finished: true })}\n\n`); // Signal end even on error
        } catch (writeError) {
            console.error("Error writing SSE error message:", writeError);
        }
        res.end(); // Ensure the connection is closed
    }
  }
};

router.post('/ask', authenticateToken as RequestHandler, askHandler);

export default router;
