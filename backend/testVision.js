// backend/testVision.js
// Simple Node.js script to test the /api/ask vision endpoint.
// Usage: TOKEN=<your_jwt> node testVision.js <path_to_image>

const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function main() {
  const [,, imagePath] = process.argv;
  let token = process.env.TOKEN;
  if (!imagePath) {
    console.error('Usage: TOKEN=<your_jwt> node testVision.js <path_to_image>');
    process.exit(1);
  }
  if (!token) {
    console.log("No TOKEN environment variable set. Attempting login with default test credentials...");
    try {
      const loginResp = await axios.post('http://localhost:3000/api/auth/login', {
        email: 'test@example.com',
        password: 'test1234'
      });
      token = loginResp.data.token;
      console.log("Obtained JWT from login.");
    } catch (err) {
      console.error("Automatic login failed. Please set TOKEN env var manually.", err.message);
      process.exit(1);
    }
  }

  const ext = path.extname(imagePath).substring(1) || 'png';
  const mimeType = `image/${ext}`;
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const payload = {
    question: 'Describe what you see in this image.',
    screenshotDataUrl: dataUrl
  };

  try {
    const res = await axios({
      method: 'post',
      url: 'http://localhost:3000/api/ask',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      data: payload,
      responseType: 'stream'
    });

    console.log('--- Response Stream ---');
    res.data.on('data', chunk => process.stdout.write(chunk.toString()));
    res.data.on('end', () => console.log('\n--- Stream Ended ---'));
  } catch (error) {
    console.error('Error during request:', error.message);
  }
}

main(); 