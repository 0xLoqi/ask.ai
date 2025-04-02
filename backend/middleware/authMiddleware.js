// middleware/authMiddleware.js - Verifies JWT token

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
  // Get token from the Authorization header (format: "Bearer TOKEN")
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    console.log("Auth middleware: No token provided.");
    // Use 401 Unauthorized if no token is present
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  if (!JWT_SECRET) {
     console.error("Auth middleware: JWT_SECRET is not set in environment variables.");
     return res.status(500).json({ error: 'Server configuration error.' });
  }

  // Verify the token
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log("Auth middleware: Token verification failed.", err.message);
      // Use 403 Forbidden if token is invalid or expired
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    // Token is valid, attach user payload to the request object
    // The 'user' object here contains whatever payload you put in the JWT when signing
    // Typically includes user ID, possibly username/email
    req.user = user;
    console.log("Auth middleware: Token verified successfully for user:", user.id || user.username || 'Unknown User'); // Log user identifier if available
    next(); // Proceed to the next middleware or route handler
  });
}

module.exports = authenticateToken;
