const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const io = require('socket.io-client');

// Initialize Express app for customization dashboard
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../customization')));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const dashboardIo = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Connect to the other servers as a client
const mainSocket = io('http://localhost:3000');
const highlightSocket = io('http://localhost:3001');

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

// Connection statuses
let mainConnected = false;
let highlightConnected = false;

// Track connection status
mainSocket.on('connect', () => {
  console.log('Connected to main server');
  mainConnected = true;
});

mainSocket.on('disconnect', () => {
  console.log('Disconnected from main server');
  mainConnected = false;
});

highlightSocket.on('connect', () => {
  console.log('Connected to highlight server');
  highlightConnected = true;
});

highlightSocket.on('disconnect', () => {
  console.log('Disconnected from highlight server');
  highlightConnected = false;
});

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
  dashboardIo.emit('settings-updated', settings);
  
  // Send to main server
  if (mainConnected) {
    mainSocket.emit('settings-updated', settings);
    console.log('Settings sent to main server');
  } else {
    console.warn('Cannot send settings to main server - not connected');
  }
  
  // Send to highlight server
  if (highlightConnected) {
    highlightSocket.emit('settings-updated', settings);
    console.log('Settings sent to highlight server');
  } else {
    console.warn('Cannot send settings to highlight server - not connected');
  }
  
  // Return success response
  res.json({ success: true, settings });
});

// Socket.IO connection handling
dashboardIo.on('connection', (socket) => {
  console.log('Client connected to customization server:', socket.id);
  
  // Send current settings to newly connected client
  socket.emit('settings', settings);
  
  // Send connection statuses
  socket.emit('server-status', { 
    main: mainConnected,
    highlight: highlightConnected
  });
  
  // Handle settings update from client
  socket.on('update-settings', (newSettings) => {
    // Update settings
    settings = { ...settings, ...newSettings };
    
    // Save to file
    saveSettings();
    
    // Broadcast to all dashboard clients
    dashboardIo.emit('settings-updated', settings);
    
    // Send to main server
    if (mainConnected) {
      mainSocket.emit('settings-updated', settings);
      console.log('Settings sent to main server');
    } else {
      console.warn('Cannot send settings to main server - not connected');
    }
    
    // Send to highlight server
    if (highlightConnected) {
      highlightSocket.emit('settings-updated', settings);
      console.log('Settings sent to highlight server');
    } else {
      console.warn('Cannot send settings to highlight server - not connected');
    }
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