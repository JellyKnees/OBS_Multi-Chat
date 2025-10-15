// Modified portions of server.js to support direct browser extension chat integration

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const io = require('socket.io-client');

// Initialize Express app for main chat
const app = express();
app.use(cors({
  origin: '*', // Allow all origins for extension connections
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../overlay')));

// Create HTTP server for main chat
const server = http.createServer(app);

// Initialize Socket.IO for main chat with CORS settings for extension
const chatIo = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Connect to highlight server as a client
const highlightSocket = io('http://localhost:3001');
highlightSocket.on('connect', () => {
  console.log('Connected to highlight server');
});
highlightSocket.on('connect_error', (error) => {
  console.error('Error connecting to highlight server:', error.message);
});

// Chat message storage - limit to message limit from settings
let chatMessages = [];

// Settings storage with defaults
let settings = {
  // Common settings
  messageLimit: 50,
  highlightTimeout: 10000,
  highlightColor: "#ff5500",
  enableSound: true,
  soundVolume: 0.5,
  
  // Rest of settings remain the same...
};

// Socket.IO connection handling for main chat
chatIo.on('connection', (socket) => {
    console.log('Client connected to main chat:', socket.id);
    
    // Send current settings to client
    socket.emit('settings', settings);
    
    // Get settings handler
    socket.on('get-settings', () => {
      console.log('Settings requested by client');
      socket.emit('settings', settings);
    });
    
    // Send only the last N messages to new clients (based on message limit setting)
    if (chatMessages.length > 0) {
      socket.emit('chat-history', chatMessages.slice(-settings.messageLimit));
    }
  
  // Handle new chat messages from extension or other sources
  socket.on('chat-message', (message) => {
    // Validate message structure
    if (!message || !message.platform || !message.username || !message.content) {
      console.error('Invalid message format:', message);
      return;
    }
    
    console.log(`Received ${message.platform} message from ${message.username}`);
    
    // Add timestamp and unique ID if not present
    if (!message.id) {
      message.id = Date.now() + Math.random().toString(36).substring(2, 9);
    }
    
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }
    
    // Store message
    chatMessages.push(message);
    
    // Keep only the most recent messages (based on message limit setting)
    if (chatMessages.length > settings.messageLimit) {
      chatMessages = chatMessages.slice(-settings.messageLimit);
    }
    
    // Broadcast to all chat clients
    chatIo.emit('chat-message', message);
  });

  // Handle message highlighting - send to highlight server
  socket.on('highlight-message', (messageId) => {
    console.log('Highlight requested for message:', messageId);
    
    // Find the message by ID
    const message = chatMessages.find(msg => msg.id === messageId);
    
    if (message) {
      // When sending to highlight server, only send the highlightTimeout setting
      // We don't want to override other highlight server settings
      highlightSocket.emit('highlight-message', message);
      console.log('Message sent to highlight server');
    } else {
      console.error('Message not found for highlighting:', messageId);
    }
  });

  // Handle clearing highlighted message
  socket.on('clear-highlight', () => {
    console.log('Clearing highlighted message');
    highlightSocket.emit('clear-highlight');
  });

  // Handle settings update
  socket.on('settings-updated', (newSettings) => {
      console.log('Received settings update:', JSON.stringify(newSettings));
      
      // Update settings (with proper deep merge)
      settings = { ...settings, ...newSettings };
      
      // Broadcast to all clients
      chatIo.emit('settings-updated', settings);
      
      // Forward only highlightTimeout to highlight server
      highlightSocket.emit('settings-updated', { 
          highlightTimeout: settings.highlightTimeout,
          enableSound: settings.enableSound,
          soundVolume: settings.soundVolume 
        });
    });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected from main chat:', socket.id);
  });
});