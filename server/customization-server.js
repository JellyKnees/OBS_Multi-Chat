const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize Express app for customization dashboard
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../customization')));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Settings storage
let settings = {
  // Visual customization
  fontSize: 16,
  textColor: "#ffffff",
  chatWidth: "100%",
  chatHeight: "400px",
  
  // Functional customization
  messageLimit: 50,
  highlightTimeout: 10000, // milliseconds before auto-dismissing highlighted messages
};

// Load settings from file if exists
const settingsPath = path.join(__dirname, 'settings.json');
try {
  if (fs.existsSync(settingsPath)) {
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    const savedSettings = JSON.parse(settingsData);
    // Merge saved settings with defaults
    settings = { ...settings, ...savedSettings };
    console.log('Settings loaded from file:', settings);
  } else {
    console.log('No settings file found, using defaults');
    // Save default settings
    saveSettings();
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

// Home route - serve the dashboard UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../customization/dashboard.html'));
});

// Settings API endpoint - get current settings
app.get('/api/settings', (req, res) => {
  res.json(settings);
});

// Settings API endpoint - update settings
app.post('/api/settings', (req, res) => {
  // Validate settings
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid settings object' });
  }
  
  // Update settings
  settings = { ...settings, ...req.body };
  
  // Save to file
  saveSettings();
  
  // Broadcast settings update to all connected clients
  io.emit('settings-updated', settings);
  
  // Return success response
  res.json({ success: true, settings });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected to customization server:', socket.id);
  
  // Send current settings to newly connected client
  socket.emit('settings', settings);
  
  // Handle settings update
  socket.on('update-settings', (newSettings) => {
    // Update settings
    settings = { ...settings, ...newSettings };
    
    // Save to file
    saveSettings();
    
    // Broadcast to all clients
    io.emit('settings-updated', settings);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected from customization server:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Customization dashboard running on http://localhost:${PORT}`);
});

module.exports = { io, settings };