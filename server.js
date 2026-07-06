const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: [
    'http://localhost',
    'http://localhost:8080',
    'http://127.0.0.1',
    'https://loyaldominionnexus.com',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Routes
app.use('/api/mpesa', require('./routes/mpesa'));
app.use('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Loyal Dominion Nexus API is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`LDN Backend running on port ${PORT}`);
});
