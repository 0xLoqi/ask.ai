// services/aiService.js (v3) - Updated OpenAI model for Vision

const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("FATAL ERROR: OPENAI_API_KEY environment variable is not set.");
}

const openai = new OpenAI({ apiKey: apiKey });

// --- Speech-to-Text (Placeholder - Requires audio data handling) ---
async function transcribeAudio(audioData) {
  console.warn("AI Service: transcribeAudio function not implemented.");
  // When implemented:
  // - Receive audio data (e.g., buffer, stream).
  // - Use openai.audio.transcriptions.create({ file: audioData, model: "whisper-1" }).
  // - Return transcription.text.
  return "Placeholder: Audio transcription not implemented.";
}

// --- Vision Model Call ---
async function getVisionResponse(text, imageUrl, userId) {
  console.log(`AI Service: Calling Vision Model for user ${userId}...`);
  try {
    const response = await openai.chat.completions.create({
      // ***** UPDATED MODEL IDENTIFIER *****
      model: "gpt-4-turbo", // Use the current model that supports vision
      // *************************************
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: text },
            {
              type: "image_url",
              image_url: {
                "url": imageUrl, // Pass the data URL directly
                "detail": "auto" // Or "low" / "high"
              },
            },
          ],
        },
      ],
      max_tokens: 500, // Adjust token limit as needed
      // user: `user-${userId}` // Optional tracking
    });

    console.log("AI Service: Vision response received successfully.");
    const responseContent = response.choices[0]?.message?.content;

    if (!responseContent) {
        console.warn("AI Service: Vision response content was empty.");
        return "Sorry, I couldn't generate a response for that image and question.";
    }
    return responseContent;

  } catch (error) {
    console.error("Error calling OpenAI Vision API:", error.message);
    if (error.response) {
        console.error("API Error Details:", error.response.data);
        // Improved error message extraction
        const apiErrorMessage = error.response.data?.error?.message || 'An API error occurred';
        throw new Error(`Vision API request failed: ${apiErrorMessage}`);
    } else {
        throw new Error(`Vision API request failed: ${error.message}`);
    }
  }
}

// --- Language Model Call ---
async function getLanguageResponse(text, userId) {
  console.log(`AI Service: Calling Language Model for user ${userId}...`);
  try {
    const response = await openai.chat.completions.create({
      // You might want to use gpt-4-turbo here too for consistency, or keep gpt-3.5-turbo for cost savings
      model: "gpt-3.5-turbo",
      messages: [
        // { role: "system", content: "You are a helpful assistant analyzing user queries." },
        { role: "user", content: text }
      ],
      max_tokens: 400, // Adjust as needed
      // user: `user-${userId}` // Optional tracking
    });

    console.log("AI Service: Language response received successfully.");
    const responseContent = response.choices[0]?.message?.content;

     if (!responseContent) {
        console.warn("AI Service: Language response content was empty.");
        return "Sorry, I couldn't generate a response for that question.";
    }
    return responseContent;

  } catch (error) {
    console.error("Error calling OpenAI Language API:", error.message);
     if (error.response) {
        console.error("API Error Details:", error.response.data);
        const apiErrorMessage = error.response.data?.error?.message || 'An API error occurred';
        throw new Error(`Language API request failed: ${apiErrorMessage}`);
    } else {
        throw new Error(`Language API request failed: ${error.message}`);
    }
  }
}

module.exports = {
  transcribeAudio,
  getVisionResponse,
  getLanguageResponse,
};
