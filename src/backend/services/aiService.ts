// services/aiService.js (v4) - Enable Streaming from OpenAI

// @ts-ignore
import OpenAI from 'openai';
const OpenAIAny: any = OpenAI;

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("FATAL ERROR: OPENAI_API_KEY environment variable is not set.");
}

const openai = new OpenAIAny({ apiKey: apiKey });

import { Readable } from 'stream';

// --- Speech-to-Text (Whisper Cloud Integration) ---
export async function transcribeAudio(audioBase64: string): Promise<string> {
  // audioBase64: base64-encoded WAV (data:audio/wav;base64,... or just base64)
  try {
    let base64 = audioBase64;
    // Remove data URL prefix if present
    if (base64.startsWith('data:')) {
      base64 = base64.substring(base64.indexOf(',') + 1);
    }
    const audioBuffer = Buffer.from(base64, 'base64');
    // OpenAI Node SDK expects a file-like object; use a Readable stream
    const audioStream = Readable.from(audioBuffer);
    // Whisper expects .wav or .mp3, so we use .wav
    const response = await openai.audio.transcriptions.create({
      file: audioStream as any,
      filename: 'audio.wav',
      model: 'whisper-1',
      response_format: 'text',
      language: 'en', // Optionally set language
    });
    // response is the transcript string
    return typeof response === 'string' ? response : (response.text || '');
  } catch (err: any) {
    console.error('Whisper transcription failed:', err.message);
    throw new Error('Audio transcription failed');
  }
}

// --- Vision Model Call (Streaming) ---
export async function getVisionResponseStream(text: string, imageUrl: string, userId: string, model: string): Promise<any> {
  console.log(`AI Service: Requesting VISION stream for user ${userId} with model ${model}...`);
  try {
    // Request a stream instead of waiting for the full response
    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: text },
            {
              type: "image_url",
              image_url: { "url": imageUrl, "detail": "auto" },
            },
          ],
        },
      ],
      max_tokens: 500,
      stream: true, // Enable streaming
      // user: `user-${userId}` // Optional tracking
    });
    console.log("AI Service: Vision stream initiated.");
    return stream; // Return the stream object directly
  } catch (error: any) {
    console.error("Error initiating OpenAI Vision stream:", error.message);
    // Handle specific API errors if needed
    if (error.response) {
        console.error("API Error Details:", error.response.data);
        const apiErrorMessage = error.response.data?.error?.message || 'API error during stream initiation';
        throw new Error(`Vision stream initiation failed: ${apiErrorMessage}`);
    } else {
        throw new Error(`Vision stream initiation failed: ${error.message}`);
    }
  }
}

// --- Language Model Call (Streaming) ---
export async function getLanguageResponseStream(text: string, userId: string, model: string): Promise<any> {
  console.log(`AI Service: Requesting LANGUAGE stream for user ${userId} with model ${model}...`);
  try {
    // Request a stream
    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        // { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: text }
      ],
      max_tokens: 400,
      stream: true, // Enable streaming
      // user: `user-${userId}` // Optional tracking
    });
    console.log("AI Service: Language stream initiated.");
    return stream; // Return the stream object directly
  } catch (error: any) {
    console.error("Error initiating OpenAI Language stream:", error.message);
     if (error.response) {
        console.error("API Error Details:", error.response.data);
        const apiErrorMessage = error.response.data?.error?.message || 'API error during stream initiation';
        throw new Error(`Language stream initiation failed: ${apiErrorMessage}`);
    } else {
        throw new Error(`Language stream initiation failed: ${error.message}`);
    }
  }
}
