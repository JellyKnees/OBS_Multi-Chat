const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize Express app for main chat
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../overlay')));

// Create HTTP server for main chat
const server = http.createServer(app);

// Initialize Socket.IO for main chat
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize Express app for highlights
const highlightApp = express();
highlightApp.use(cors());
highlightApp.use(express.json());

// Create HTTP server for highlights
const highlightServer = http.createServer(highlightApp);

// Initialize Socket.IO for highlights
const highlightIo = socketIo(highlightServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Chat message storage - limit to 50 messages
let chatMessages = [];
let highlightedMessage = null;

// Settings storage
let settings = {
  theme: 'dark',
  fontSize: 13,
  messageLimit: 50,
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

// Socket.IO connection handling for main chat
io.on('connection', (socket) => {
  console.log('Client connected to main chat:', socket.id);
  
  // Don't send existing message history - only new messages will be shown
  
  // Handle new chat messages
  socket.on('chat-message', (message) => {
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
    
    // Keep only the most recent 50 messages
    if (chatMessages.length > 50) {
      chatMessages = chatMessages.slice(-50);
    }
    
    // Broadcast to all chat clients
    io.emit('chat-message', message);
  });

  // Handle message highlighting - only send to highlight server
  socket.on('highlight-message', (messageId) => {
    console.log('Highlight requested for message:', messageId);
    
    // Find the message by ID
    const message = chatMessages.find(msg => msg.id === messageId);
    
    if (message) {
      highlightedMessage = message;
      // Only send to highlight server, not main chat
      highlightIo.emit('highlight-message', message);
      console.log('Message sent to highlight server');
    } else {
      console.error('Message not found for highlighting:', messageId);
    }
  });

  // Handle clearing highlighted message
  socket.on('clear-highlight', () => {
    console.log('Clearing highlighted message');
    highlightedMessage = null;
    // Only send to highlight server, not main chat
    highlightIo.emit('clear-highlight');
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected from main chat:', socket.id);
  });
});

// Socket.IO connection handling for highlight server
highlightIo.on('connection', (socket) => {
  console.log('Client connected to highlight server:', socket.id);
  
  // Don't send any existing highlighted message
  
  // Handle clear request from highlight client
  socket.on('clear-highlight', () => {
    highlightedMessage = null;
    highlightIo.emit('clear-highlight');
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected from highlight server:', socket.id);
  });
});

// Main chat route - inline HTML with styling
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat Overlay</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background-color: transparent;
            color: #ffffff;
            overflow: hidden;
            --font-size: 14px;
            --bg-color: rgba(34, 34, 34, 0.7);
            --text-color: #ffffff;
        }
        
        #chat-container {
            height: 400px;
            overflow-y: scroll;
            scroll-behavior: smooth;
            padding: 10px;
        }
        
        .chat-message {
            margin-bottom: 8px;
            padding: 8px 10px;
            border-radius: 4px;
            background-color: var(--bg-color);
            word-wrap: break-word;
            animation: fadeIn 0.3s ease-in-out;
            position: relative;
            font-size: var(--font-size);
            max-width: 100%;
            font-family: 'Inter', sans-serif;
            color: var(--text-color);
            cursor: pointer;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        }
        
        .youtube {
            border-left: 3px solid #ff0000;
        }
        
        .twitch {
            border-left: 3px solid #9146FF;
        }
        
        .message-header {
            display: flex;
            align-items: center;
            margin-bottom: 4px;
        }
        
        .platform-icon {
            width: 16px;
            height: 16px;
            margin-right: 6px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            vertical-align: middle;
        }
        
        .youtube .username {
            color: #ff0000 !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: 18px !important;
        }
        
        .twitch .username {
            color: #9146FF !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: 18px !important;
        }
        
        .message-content {
            color: white !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 18px !important;
            line-height: 1.5;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
        }
        
        .message-content a {
            color: white !important;
            text-decoration: none !important;
            pointer-events: none !important;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div id="chat-container">
        <!-- Chat messages will be added here -->
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // Get chat container
            const chatContainer = document.getElementById('chat-container');
            
            // Auto-scroll flag
            let userScrolled = false;
            
            // Socket connection
            const socket = io();
            
            // Handle new chat messages
            socket.on('chat-message', (message) => {
                addMessage(message);
                
                // Auto-scroll if not manually scrolled up
                if (!userScrolled) {
                    setTimeout(() => {
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }, 0);
                }
            });
            
            // Handle scroll
            chatContainer.addEventListener('scroll', () => {
                const scrollBottom = chatContainer.scrollHeight - chatContainer.clientHeight;
                const isAtBottom = scrollBottom - chatContainer.scrollTop < 30;
                userScrolled = !isAtBottom;
            });
            
            // Add message to chat
            function addMessage(message) {
                const messageElement = document.createElement('div');
                messageElement.classList.add('chat-message');
                messageElement.classList.add(message.platform.toLowerCase());
                messageElement.dataset.id = message.id;
                
                // Create platform icon as SVG
                let iconHtml = '';
                if (message.platform.toLowerCase() === 'youtube') {
                    iconHtml = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/></svg>';
                } else if (message.platform.toLowerCase() === 'twitch') {
                    iconHtml = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.571 4.714h1.715v5.143H11.57v-5.143zm4.715 0H18v5.143h-1.714v-5.143zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" fill="#9146FF"/></svg>';
                }
                
                // Create badges HTML
                let badgesHtml = '';
                if (message.badges && message.badges.length > 0) {
                    badgesHtml = '<div class="badges">';
                    badgesHtml += message.badges.map(badge => 
                        \`<span class="badge" style="background-image: url('\${badge}')"></span>\`
                    ).join('');
                    badgesHtml += '</div>';
                }
                
                // Format message content
                messageElement.innerHTML = \`
                    <div class="message-header">
                        <span class="platform-icon">\${iconHtml}</span>
                        <span class="username">\${message.username}</span>
                        \${badgesHtml}
                    </div>
                    <div class="message-content">\${message.content}</div>
                \`;
                
                // Click to highlight message
                messageElement.addEventListener('click', () => {
                    socket.emit('highlight-message', message.id);
                });
                
                // Add to chat container
                chatContainer.appendChild(messageElement);
                
                // Keep only the last 50 messages in the DOM
                const messages = chatContainer.getElementsByClassName('chat-message');
                while (messages.length > 50) {
                    chatContainer.removeChild(messages[0]);
                }
            }
        });
    </script>
</body>
</html>`);
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

// Highlight server route - inline HTML with styling
highlightApp.get('/', (req, res) => {
  console.log('Highlight page requested');
  
  // Send inline HTML with styling
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
        }
        
        .youtube .username {
            color: #ff0000 !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: 20px !important;
            display: inline !important;
        }
        
        .twitch .username {
            color: #9146FF !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: 20px !important;
            display: inline !important;
        }
        
        .platform-icon {
            margin-right: 5px;
            vertical-align: middle;
        }
        
        svg.platform-icon {
            display: inline;
            vertical-align: middle;
        }
        
        .message-content {
            color: white !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 20px !important;
            line-height: 1.5;
            display: inline !important;
            /* Fix for long unbroken text */
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
        }
        
        /* Make hyperlinks look like normal text */
        .message-content a, #highlighted-message .message-content a {
            color: white !important;
            text-decoration: none !important;
            pointer-events: none !important;
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

    <script src="/socket.io/socket.io.js"></script>
    <script>
        // Get the highlighted message container
        const highlightedContainer = document.getElementById('highlighted-message');
        
        // Connect to Socket.IO
        const socket = io();
        
        // Handle highlighted messages
        socket.on('highlight-message', (message) => {
            console.log('Received highlighted message:', message);
            
            // Apply platform class
            highlightedContainer.className = message.platform.toLowerCase();
            
            // Create message HTML with SVG icons
            let iconHtml = '';
            if (message.platform.toLowerCase() === 'youtube') {
                iconHtml = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="platform-icon"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/></svg>';
            } else if (message.platform.toLowerCase() === 'twitch') {
                iconHtml = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="platform-icon"><path d="M11.571 4.714h1.715v5.143H11.57v-5.143zm4.715 0H18v5.143h-1.714v-5.143zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" fill="#9146FF"/></svg>';
            }
            
            highlightedContainer.innerHTML = \`
                <div class="message-content">
                    \${iconHtml}
                    <span class="username">\${message.username}</span>: 
                    \${message.content || ''}
                </div>
            \`;
            
            // Apply slide-in animation and show
            highlightedContainer.style.animation = 'slideInFromRight 0.5s ease-in-out';
            highlightedContainer.style.display = 'block';
            
            // Add click handler to clear
            highlightedContainer.onclick = () => {
                socket.emit('clear-highlight');
            };
            
            // Auto-clear after 10 seconds
            setTimeout(() => {
                socket.emit('clear-highlight');
            }, 10000);
        });
        
        // Handle clearing highlighted message
        socket.on('clear-highlight', () => {
            console.log('Clearing highlighted message');
            
            // Apply slide-out animation
            highlightedContainer.style.animation = 'slideOutToLeft 0.5s ease-in-out';
            
            // Hide after animation completes
            setTimeout(() => {
                highlightedContainer.style.display = 'none';
            }, 500);
        });
    </script>
</body>
</html>`);
});

// Start main server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Main chat server running on http://localhost:${PORT}`);
});

// Start highlight server
const HIGHLIGHT_PORT = 3001;
highlightServer.listen(HIGHLIGHT_PORT, () => {
  console.log(`Highlight server running on http://localhost:${HIGHLIGHT_PORT}`);
});