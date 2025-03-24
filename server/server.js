const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json());
app.use(express.static(path.join(__dirname, '../overlay')));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Chat message storage
let chatMessages = [];
let highlightedMessage = null;

// Settings storage
let settings = {
  theme: 'dark',
  fontSize: 13,
  messageLimit: 10,
  showBadges: true,
  showTimestamps: false,
  showPlatforms: true,
  backgroundColor: '#222222',
  textColor: '#000000',
  highlightColor: '#ff5500'
};

// Load settings from file if exists
const settingsPath = path.join(__dirname, 'settings.json');
try {
  if (fs.existsSync(settingsPath)) {
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    settings = JSON.parse(settingsData);
    console.log('Settings loaded from file:', settings);
  } else {
    console.log('No settings file found, using defaults');
  }
} catch (error) {
  console.error('Error loading settings:', error);
}

// Save settings to file
function saveSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('Settings saved to file');
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, 'from', socket.handshake.headers.origin || 'unknown origin');
  
  // Send existing messages to newly connected clients
  socket.emit('chat-history', chatMessages);
  console.log(`Sent chat history (${chatMessages.length} messages) to client`);
  
  // If there's a highlighted message, send it
  if (highlightedMessage) {
    socket.emit('highlight-message', highlightedMessage);
    console.log('Sent highlighted message to client:', highlightedMessage.id);
  }

  // Handle new chat messages from extension
  socket.on('chat-message', (message) => {
    console.log('New message received:', message.platform, message.username, message.content.substring(0, 50));
    
    // Validate message structure
    if (!message || !message.platform || !message.username || !message.content) {
      console.error('Invalid message format:', message);
      return;
    }
    
    // Add timestamp and unique ID if not present
    if (!message.id) {
      message.id = Date.now() + Math.random().toString(36).substring(2, 9);
    }
    
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }
    
    // Store message
    chatMessages.push(message);
    
    // Keep only the most recent messages
    if (chatMessages.length > 200) {
      chatMessages = chatMessages.slice(-200);
    }
    
    // Broadcast to all clients
    io.emit('chat-message', message);
    console.log('Message broadcasted to all clients');
  });

  // Handle message highlighting
  socket.on('highlight-message', (messageId) => {
    console.log('Highlight requested for message:', messageId);
    
    // Find the message by ID
    const message = chatMessages.find(msg => msg.id === messageId);
    
    if (message) {
      highlightedMessage = message;
      io.emit('highlight-message', message);
      console.log('Message highlighted and broadcasted');
    } else {
      console.error('Message not found for highlighting:', messageId);
    }
  });

  // Handle clearing highlighted message
  socket.on('clear-highlight', () => {
    console.log('Clearing highlighted message');
    highlightedMessage = null;
    io.emit('clear-highlight');
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
  
  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Routes
app.get('/', (req, res) => {
  console.log('Overlay requested from:', req.ip);
  res.sendFile(path.join(__dirname, '../overlay/index.html'));
});

// Settings endpoint for getting settings
app.get('/settings', (req, res) => {
  console.log('Settings requested from:', req.ip);
  res.json(settings);
});

// Settings endpoint for saving settings
app.post('/settings', (req, res) => {
  console.log('Settings update received:', req.body);
  
  // Validate settings
  if (!req.body || typeof req.body !== 'object') {
    console.error('Invalid settings object');
    return res.status(400).json({ success: false, error: 'Invalid settings object' });
  }
  
  // Update settings
  settings = { ...settings, ...req.body };
  
  // Save to file
  saveSettings();
  
  // Notify clients of settings change
  io.emit('settings-updated', settings);
  console.log('Settings updated and broadcasted to clients');
  
  res.json({ success: true });
});

// Add a test route to help verify the server is working
app.get('/test', (req, res) => {
  console.log('Test endpoint called from:', req.ip);
  res.json({
    status: 'Server is running',
    activeConnections: Object.keys(io.sockets.sockets).length,
    messageCount: chatMessages.length
  });
});

// Add a route to simulate a test message for debugging
app.get('/test-message', (req, res) => {
  console.log('Test message requested from:', req.ip);
  
  const testMessage = {
    platform: req.query.platform || 'test',
    username: req.query.username || 'TestUser',
    content: req.query.content || 'This is a test message from the server',
    color: req.query.color || '#FF0000',
    badges: [],
    timestamp: new Date().toISOString(),
    id: 'server-test-' + Date.now()
  };
  
  // Store and broadcast the message
  chatMessages.push(testMessage);
  io.emit('chat-message', testMessage);
  
  res.json({
    success: true,
    message: 'Test message sent',
    messageDetails: testMessage
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Add http://localhost:${PORT} as a browser source in OBS`);
});