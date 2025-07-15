const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const authRoutes = require('./routes/auth');
const analyzeRoutes = require('./routes/analyze');
const geminiRoutes = require('./routes/gemini');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Verify JWT_SECRET is loaded
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in .env file');
  process.exit(1);
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/gemini', geminiRoutes);

// MongoDB Connection (commented out for S3 migration)
// mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kinabot', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
// .then(() => console.log('Connected to MongoDB'))
// .catch((err) => console.error('MongoDB connection error:', err));
//
// All persistent storage is now handled by AWS S3.

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 