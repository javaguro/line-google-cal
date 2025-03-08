const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const line = require('@line/bot-sdk');
const { handleLineWebhook } = require('./handlers/lineHandler');
const { handleGoogleCallback } = require('./handlers/authHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// LINE Bot configuration
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// Middleware for logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Middleware
app.use('/webhook', line.middleware(lineConfig));

// Routes
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', JSON.stringify(req.body, null, 2));
  handleLineWebhook(req, res);
});

app.get('/auth/google/callback', handleGoogleCallback);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});