// server.js - Main backend server setup

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Import route handlers
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');

// Create the Express app
const app = express();

// --- Middleware ---

// Enable CORS for requests from your Electron app (adjust origin in production)
// For development, allowing all origins might be okay, but be more specific later.
app.use(cors());

// Parse incoming JSON requests
app.use(express.json({ limit: '10mb' })); // Increase limit for potential image data URLs

// --- Routes ---

// Mount authentication routes (register, login)
app.use('/api/auth', authRoutes);

// Mount protected API routes (ask query)
app.use('/api', apiRoutes);

// Basic root route (optional)
app.get('/', (req, res) => {
  res.send('AI Assistant Backend is running!');
});

// --- Error Handling Middleware (Basic Example) ---
// Add more robust error handling later
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});


// --- Start Server ---
const PORT = process.env.PORT || 3000; // Use port from .env or default to 3000

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  // Check if essential environment variables are loaded
  if (!process.env.OPENAI_API_KEY) {
    console.warn('WARNING: OPENAI_API_KEY environment variable is not set.');
  }
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET environment variable is not set.');
  }
});
