const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize Express app for highlights only
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use('/audio', express.static(path.join(__dirname, 'audio')));
app.use('/static', express.static(path.join(__dirname, 'static')));

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

// Global variable to store highlighted message
let highlightedMessage = null;

// Settings storage with defaults
let settings = {
  // Visual customization
  fontSize: 16,
  textColor: "#ffffff",
  
  // Functional customization
  highlightTimeout: 10000, // milliseconds
  enableSound: true,       // Whether to play sound when highlighting
  soundVolume: 0.5,        // Volume level (0-1)
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
  }
} catch (error) {
  console.error('Error loading settings:', error);
}

// Home route - serve highlight HTML
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Highlighted Message</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: transparent;
            font-family: 'Inter', sans-serif;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: flex-end;
            height: 100vh;
            padding-bottom: 20px;
        }
        
        #highlighted-message {
            padding: 20px;
            background-color: #1a1a1a;
            border-radius: 12px;
            display: none;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            min-width: 200px;
            max-width: 80%;
            text-align: left;
            align-self: flex-end;
            /* Table layout fixes both short and long message display */
            display: none; /* Will be changed to table when visible */
            table-layout: auto;
        }
        
        .message-row {
            display: table-row;
        }
        
        .message-container {
            display: table-cell;
        }
        
        .youtube .username {
            color: #ff0000 !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: ${settings.fontSize + 4}px !important;
        }
        
        .twitch .username {
            color: #9146FF !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: ${settings.fontSize + 4}px !important;
        }
        
        .platform-icon {
            margin-right: 5px;
            vertical-align: middle;
            width: 20px;
            height: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        
        svg.platform-icon {
            display: inline;
            vertical-align: middle;
        }
        
        .message-content {
            color: ${settings.textColor} !important;
            font-family: 'Inter', sans-serif !important;
            font-size: ${settings.fontSize + 2}px !important;
            line-height: 1.5;
            overflow-wrap: break-word !important;
            word-wrap: break-word !important;
            word-break: break-word !important;
        }
        
        /* Make hyperlinks look like normal text */
        .message-content a, #highlighted-message .message-content a {
            color: ${settings.textColor} !important;
            text-decoration: none !important;
            pointer-events: none !important;
        }
        
        /* New emoji fixes */
        .message-content img, 
        .message-content span[role="img"],
        .message-content .emoji,
        .message-content em img,
        .message-content em span {
            vertical-align: middle !important;
            height: 1.2em !important;
            width: auto !important;
            max-height: 1.2em !important;
            max-width: 1.5em !important;
            margin: 0 0.1em !important;
            display: inline-flex !important;
            font-size: inherit !important;
        }
        
        img.emoji {
            height: 1.2em !important;
            width: auto !important;
        }
        
        /* Profile picture styling */
        .profile-picture {
            width: 24px !important;
            height: 24px !important;
            border-radius: 50% !important;
            margin-right: 8px !important;
            vertical-align: middle !important;
            object-fit: cover !important;
        }
        
        /* Hide profile pictures for YouTube specifically */
        .youtube .profile-picture {
            display: none !important;
        }
        
        /* Badge styling */
        .badges {
            display: inline-flex !important;
            align-items: center !important;
            margin-right: 6px !important;
        }
        
        /* Hide badges for YouTube specifically */
        .youtube .badges {
            display: none !important;
        }
        
        .badges:empty {
            display: none !important;
            margin: 0 !important;
        }
        
        .badge {
            display: inline-block !important;
            width: 18px !important;
            height: 18px !important;
            margin-right: 4px !important;
            background-size: contain !important;
            background-repeat: no-repeat !important;
            background-position: center !important;
            vertical-align: middle !important;
        }
        
        @keyframes slideInFromRight {
            from { opacity: 0; transform: translateX(50px); }
            to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes slideOutToLeft {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(-50px); }
        }
    </style>
</head>
<body>
    <div id="highlighted-message">
        <!-- Highlighted message will be displayed here -->
    </div>

    <!-- Audio element for the highlight sound -->
    <audio id="highlight-sound" src="/audio/whoosh.mp3" preload="auto"></audio>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        // Get the highlighted message container
        const highlightedContainer = document.getElementById('highlighted-message');
        
        // Get the audio element
        const highlightSound = document.getElementById('highlight-sound');
        
        // Connect to Socket.IO
        const socket = io();
        
        // Current settings
        let currentSettings = {
            highlightTimeout: ${settings.highlightTimeout},
            enableSound: ${settings.enableSound},
            soundVolume: ${settings.soundVolume}
        };
        
        // Handle settings updates
        socket.on('settings-updated', (newSettings) => {
            console.log('Received settings update:', newSettings);
            
            // Update our settings
            if (newSettings.highlightTimeout !== undefined) {
                currentSettings.highlightTimeout = newSettings.highlightTimeout;
            }
            
            if (newSettings.enableSound !== undefined) {
                currentSettings.enableSound = newSettings.enableSound;
            }
            
            if (newSettings.soundVolume !== undefined) {
                currentSettings.soundVolume = newSettings.soundVolume;
                highlightSound.volume = currentSettings.soundVolume;
            }
            
            // Update auto-dismiss timeout if active
            if (dismissTimeout) {
                clearTimeout(dismissTimeout);
                dismissTimeout = null;
                
                // If we still have a message showing, set up new timeout
                if (highlightedContainer.style.display === 'table') {
                    setupDismissTimeout();
                }
            }
        });
        
        // Apply settings
        function applySettings(settings) {
            // Apply font size to username and content
            const usernameElements = document.querySelectorAll('.username');
            usernameElements.forEach(element => {
                element.style.fontSize = \`\${settings.fontSize + 4}px\`;
            });
            
            const contentElements = document.querySelectorAll('.message-content');
            contentElements.forEach(element => {
                element.style.fontSize = \`\${settings.fontSize + 2}px\`;
                element.style.color = settings.textColor;
            });
            
            // Apply sound settings
            highlightSound.volume = currentSettings.soundVolume;
        }
        
        // Auto-dismiss timeout - gets updated when settings change or new highlight appears
        let dismissTimeout = null;
        
        // Setup the dismiss timeout
        function setupDismissTimeout() {
            if (currentSettings.highlightTimeout > 0) {
                dismissTimeout = setTimeout(() => {
                    socket.emit('clear-highlight');
                }, currentSettings.highlightTimeout);
            }
        }
        
        // Handle highlighted messages
        socket.on('highlight-message', (message) => {
            console.log('Received highlighted message:', message);
            
            // Clear any existing auto-dismiss timeout
            if (dismissTimeout) {
                clearTimeout(dismissTimeout);
                dismissTimeout = null;
            }
            
            // Play sound if enabled
            if (currentSettings.enableSound) {
                highlightSound.volume = currentSettings.soundVolume;
                highlightSound.play().catch(err => {
                    console.error('Error playing sound:', err);
                });
            }
            
            // Apply platform class
            highlightedContainer.className = message.platform.toLowerCase();
            
            // Create message HTML with SVG icons
            let iconHtml = '';
            if (message.platform.toLowerCase() === 'youtube') {
                iconHtml = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="platform-icon"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/></svg>';
            } else if (message.platform.toLowerCase() === 'twitch') {
                iconHtml = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="platform-icon"><path d="M11.571 4.714h1.715v5.143H11.57v-5.143zm4.715 0H18v5.143h-1.714v-5.143zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" fill="#9146FF"/></svg>';
            }
            
            // Create badges HTML - only for Twitch
            let badgesHtml = '';
            if (message.platform.toLowerCase() === 'twitch' && message.badges && message.badges.length > 0) {
                badgesHtml = '<div class="badges">';
                message.badges.forEach(badge => {
                    badgesHtml += \`<span class="badge" style="background-image: url('\${badge}')"></span>\`;
                });
                badgesHtml += '</div>';
            }
            
            // Add profile picture if available (for Twitch only)
            let profilePicHtml = '';
            if (message.platform.toLowerCase() === 'twitch' && message.profilePicture) {
                profilePicHtml = \`<img src="\${message.profilePicture}" class="profile-picture">\`;
            }
            
            // Platform-specific message structure
            if (message.platform.toLowerCase() === 'youtube') {
                // YouTube - simpler format without badges or profile picture
                highlightedContainer.innerHTML = \`
                    <div class="message-row">
                        <div class="message-container">
                            \${iconHtml}
                            <span class="username">\${message.username}</span>: 
                            <span class="message-content">\${message.content || ''}</span>
                        </div>
                    </div>
                \`;
            } else {
                // Twitch - include badges and profile picture
                highlightedContainer.innerHTML = \`
                    <div class="message-row">
                        <div class="message-container">
                            \${profilePicHtml}
                            \${iconHtml}
                            \${badgesHtml}
                            <span class="username">\${message.username}</span>: 
                            <span class="message-content">\${message.content || ''}</span>
                        </div>
                    </div>
                \`;
            }
            
            // Apply slide-in animation and show - use table display
            highlightedContainer.style.animation = 'slideInFromRight 0.5s ease-in-out';
            highlightedContainer.style.display = 'table';
            
            // Add click handler to clear
            highlightedContainer.onclick = () => {
                socket.emit('clear-highlight');
            };
            
            // Auto-clear after timeout (if enabled)
            setupDismissTimeout();
        });
        
        // Handle clearing highlighted message
        socket.on('clear-highlight', () => {
            console.log('Clearing highlighted message');
            
            // Clear any existing auto-dismiss timeout
            if (dismissTimeout) {
                clearTimeout(dismissTimeout);
                dismissTimeout = null;
            }
            
            // Apply slide-out animation
            highlightedContainer.style.animation = 'slideOutToLeft 0.5s ease-in-out';
            
            // Hide after animation completes
            setTimeout(() => {
                highlightedContainer.style.display = 'none';
            }, 500);
        });
        
        // Request current settings
        socket.emit('get-settings');
    </script>
</body>
</html>`);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected to highlight server:', socket.id);
  
  // Send current settings to client
  socket.emit('settings', settings);
  
  // Get settings handler
  socket.on('get-settings', () => {
    socket.emit('settings', settings);
  });
  
  // Send current highlight if exists
  if (highlightedMessage) {
    socket.emit('highlight-message', highlightedMessage);
  }
  
  // Handle message highlighting
  socket.on('highlight-message', (message) => {
    console.log('Highlight message received:', message);
    highlightedMessage = message;
    
    // Broadcast to all clients
    io.emit('highlight-message', message);
    
    // Auto-dismiss after timeout if specified in settings
    if (settings.highlightTimeout > 0) {
      setTimeout(() => {
        clearHighlightMessage();
      }, settings.highlightTimeout);
    }
  });
  
  // Handle clear request from highlight client
  socket.on('clear-highlight', () => {
    clearHighlightMessage();
  });
  
  // Handle settings update
  socket.on('settings-updated', (newSettings) => {
    // Apply the relevant settings for the highlight server
    if (newSettings.highlightTimeout !== undefined) {
      settings.highlightTimeout = newSettings.highlightTimeout;
    }
    
    // Handle new sound settings
    if (newSettings.enableSound !== undefined) {
      settings.enableSound = newSettings.enableSound;
    }
    
    if (newSettings.soundVolume !== undefined) {
      settings.soundVolume = newSettings.soundVolume;
    }
    
    console.log('Updated highlight settings:', settings);
    
    // Broadcast updates to clients
    io.emit('settings-updated', {
      highlightTimeout: settings.highlightTimeout,
      enableSound: settings.enableSound,
      soundVolume: settings.soundVolume
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected from highlight server:', socket.id);
  });
});

// Function to clear highlighted message
function clearHighlightMessage() {
  highlightedMessage = null;
  io.emit('clear-highlight');
  console.log('Highlight cleared');
}

// Make sure the audio directory exists
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
  console.log('Created audio directory:', audioDir);
}

// Static directories for badges and other assets
const staticDir = path.join(__dirname, 'static');
if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
  console.log('Created static directory:', staticDir);
  
  // Create subdirectories
  fs.mkdirSync(path.join(staticDir, 'badges'), { recursive: true });
  console.log('Created badges directory');
}

// Export module functions and objects
const highlightServer = {
  io,
  settings,
  clearHighlightMessage,
  highlightMessage: (message) => {
    highlightedMessage = message;
    io.emit('highlight-message', message);
  },
  startServer: () => {
    const PORT = process.env.PORT || 3001;
    return server.listen(PORT, () => {
      console.log(`Highlight server running on http://localhost:${PORT}`);
    });
  }
};

// Only start the server if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Highlight server running on http://localhost:${PORT}`);
  });
}

module.exports = highlightServer;