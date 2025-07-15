const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { getJsonFromS3, uploadJsonToS3 } = require('../middleware/s3');

// Load environment variables
dotenv.config();

// Verify JWT_SECRET is available
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in .env file');
  process.exit(1);
}

const USERS_KEY = 'users.json';

// Signup route
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    let users = [];
    try {
      users = await getJsonFromS3(USERS_KEY);
    } catch (e) {
      users = [];
    }
    // Check if user already exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 8);
    const user = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      name,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await uploadJsonToS3(USERS_KEY, users);
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let users = [];
    try {
      users = await getJsonFromS3(USERS_KEY);
    } catch (e) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

module.exports = router; 