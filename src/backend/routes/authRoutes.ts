// routes/authRoutes.js (v2) - Implemented Registration & Login Logic

import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10; // Standard cost factor for bcrypt

// !!! WARNING: In-memory storage is for DEMO/TESTING ONLY !!!
// Replace with a proper database (e.g., PostgreSQL, MongoDB) for production.
const users: any[] = []; // Example: [{ id: 1, email: 'test@example.com', passwordHash: '$2b$10$...' }]
let userIdCounter = 1;

// --- Registration Endpoint ---
router.post('/register', (async (req: any, res: any, next: any) => {
  try {
    const { email, password } = req.body;

    // --- Input Validation ---
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    // Add more robust validation (email format, password length/complexity)
    if (typeof password !== 'string' || password.length < 6) { // Example: min length 6
         return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
     // Basic email format check (consider using a library for better validation)
    if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }


    // --- Check for Existing User ---
    // Use case-insensitive email check for robustness
    const existingUser = users.find(user => user.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      console.log(`Registration attempt failed: Email already exists - ${email}`);
      return res.status(409).json({ error: 'User with this email already exists.' }); // 409 Conflict
    }

    // --- Hash Password ---
    console.log(`Registering user: ${email}. Hashing password...`);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    console.log(`Password hashed for: ${email}`);

    // --- Store New User (In-Memory) ---
    const newUser = {
      id: userIdCounter++,
      email: email, // Store original case or lowercase consistently
      passwordHash: passwordHash,
      createdAt: new Date().toISOString() // Add timestamp
    };
    users.push(newUser);
    console.log(`User registered successfully: ${email}, ID: ${newUser.id}`);
    // Avoid logging sensitive info like the hash itself in production logs

    // --- Respond ---
    // Don't send password hash or sensitive info back
    res.status(201).json({ message: 'User registered successfully.', userId: newUser.id });

  } catch (error) {
    console.error("Registration Error:", error);
    // Pass error to the central error handler in server.js
    next(new Error('Failed to register user due to a server error.'));
  }
}) as any);

// --- Login Endpoint ---
router.post('/login', (async (req: any, res: any, next: any) => {
  try {
    const { email, password } = req.body;

    // --- Input Validation ---
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // --- Find User ---
    // Use case-insensitive email lookup
    const user = users.find(user => user.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      console.log(`Login attempt failed: User not found for email ${email}`);
      // Return 401 Unauthorized - Use a generic message for security
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // --- Compare Passwords ---
    console.log(`Login attempt: Comparing password for ${email}`);
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      console.log(`Login attempt failed: Incorrect password for email ${email}`);
      // Return 401 Unauthorized - Use a generic message
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // --- Check JWT Secret ---
     if (!JWT_SECRET) {
        console.error("Login error: JWT_SECRET environment variable is not set.");
        // Don't expose this specific error to the client
        return res.status(500).json({ error: 'Login failed due to server configuration.' });
     }

    // --- Generate JWT ---
    console.log(`Password verified for ${email}. Generating JWT...`);
    // Payload contains claims about the user. Keep it minimal.
    const payload = {
      id: user.id,
      email: user.email // Include email if needed by frontend/middleware
      // DO NOT include sensitive info like password hash here!
    };

    // Sign the token with the secret and set expiration
    const token = jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: '1d' } // Example: token expires in 1 day
    );
    console.log(`JWT generated for user ID: ${user.id}`);

    // --- Respond with Token ---
    res.json({
        message: 'Login successful',
        token: token,
        // Optionally send back some non-sensitive user info
        user: { id: user.id, email: user.email }
    });

  } catch (error) {
    console.error("Login Error:", error);
    next(new Error('Login failed due to a server error.'));
  }
}) as any);

export default router;
