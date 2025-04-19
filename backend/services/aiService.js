// services/aiService.js (v4) - Enable Streaming from OpenAI

const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("FATAL ERROR: OPENAI_API_KEY environment variable is not set.");
}

const openai = new OpenAI({ apiKey: apiKey });

// --- Speech-to-Text (Placeholder) ---
async function transcribeAudio(audioData) {
  console.warn("AI Service: transcribeAudio function not implemented.");
  return "Placeholder: Audio transcription not implemented.";
}

// --- Vision Model Call (Streaming) ---
async function getVisionResponseStream(text, imageUrl, userId) { // Renamed slightly for clarity
  console.log(`AI Service: Requesting VISION stream for user ${userId}...`);
  try {
    // Request a stream instead of waiting for the full response
    const stream = await openai.chat.completions.create({
      model: "gpt-4-turbo",
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
  } catch (error) {
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
async function getLanguageResponseStream(text, userId) { // Renamed slightly for clarity
  console.log(`AI Service: Requesting LANGUAGE stream for user ${userId}...`);
  try {
    // Request a stream
    const stream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
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
  } catch (error) {
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

// --- Non-streaming Language Model Call ---
async function getLanguageResponse(text) {
  console.log(`AI Service: Requesting LANGUAGE (non-stream) ...`);
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "user", content: text }
      ],
      max_tokens: 400,
      stream: false
    });
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error("Error in non-streaming language response:", error.message);
    throw error;
  }
}

// --- Non-streaming Vision Model Call ---
async function getVisionResponse(text, imageUrl) {
  console.log(`AI Service: Requesting VISION (non-stream) ...`);
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: text },
            { type: "image_url", image_url: { "url": imageUrl, "detail": "auto" } }
          ]
        }
      ],
      max_tokens: 500,
      stream: false
    });
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error("Error in non-streaming vision response:", error.message);
    throw error;
  }
}

module.exports = {
  transcribeAudio, // Still placeholder
  getVisionResponseStream, // Export streaming version
  getLanguageResponseStream, // Export streaming version
  getLanguageResponse,
  getVisionResponse,
};
