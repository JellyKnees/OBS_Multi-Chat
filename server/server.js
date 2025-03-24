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

// Main chat routes
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
            text-shadow: 2px 2px 0px rgba(0,0,0,0.5);
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
            
            // Platform icons
            const platformIcons = {
                youtube: '🔴',
                twitch: '💜',
                test: '🔧'
            };
            
            // Auto-scroll flag
            let autoScroll = true;
            
            // Socket connection
            const socket = io();
            
            // Handle new chat messages
            socket.on('chat-message', (message) => {
                addMessage(message);
                
                // Auto-scroll if needed
                if (autoScroll) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            });
            
            // Handle scroll
            chatContainer.addEventListener('scroll', () => {
                const isAtBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 30;
                autoScroll = isAtBottom;
            });
            
            // Add message to chat
            function addMessage(message) {
                const messageElement = document.createElement('div');
                messageElement.classList.add('chat-message');
                messageElement.classList.add(message.platform.toLowerCase());
                messageElement.dataset.id = message.id;
                
                // Create platform icon
                const icon = platformIcons[message.platform.toLowerCase()] || '❓';
                
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
                        <span class="platform-icon">\${icon}</span>
                        <span class="username">\${message.username}</span>
                        \${badgesHtml}
                    </div>
                    <div class="message-content">\${message.content || ''}</div>
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

// Settings endpoint
app.get('/settings', (req, res) => {
  res.json(settings);
});

// Save settings endpoint
app.post('/settings', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid settings object' });
  }
  
  settings = { ...settings, ...req.body };
  saveSettings();
  io.emit('settings-updated', settings);
  
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
            text-align: center;
            align-self: flex-end;
        }
        
        .youtube .username {
            color: #ff0000 !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: 22px !important;
        }
        
        .twitch .username {
            color: #9146FF !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: 22px !important;
        }
        
        .message-header {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
        }
        
        .platform-icon {
            margin-right: 10px;
            font-size: 24px;
        }
        
        .message-content {
            color: white !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 18px !important;
            line-height: 1.5;
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
        // Platform icons
        const platformIcons = {
            youtube: '🔴',
            twitch: '💜',
            test: '🔧'
        };
        
        // Get the highlighted message container
        const highlightedContainer = document.getElementById('highlighted-message');
        
        // Connect to Socket.IO
        const socket = io();
        
        // Log connection status
        socket.on('connect', () => {
            console.log('Connected to highlight server');
        });
        
        // Handle highlighted messages
        socket.on('highlight-message', (message) => {
            console.log('Received highlighted message:', message);
            
            // Set platform class
            highlightedContainer.className = '';
            highlightedContainer.classList.add(message.platform.toLowerCase());
            
            // Create message HTML
            highlightedContainer.innerHTML = \`
                <div class="message-header">
                    <span class="platform-icon">\${platformIcons[message.platform.toLowerCase()] || '❓'}</span>
                    <span class="username">\${message.username}</span>
                </div>
                <div class="message-content">\${message.content || ''}</div>
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