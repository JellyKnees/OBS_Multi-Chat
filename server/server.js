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

// Import highlight server functions
const highlightServer = require('./highlight-server');

// Chat message storage - limit to message limit from settings
let chatMessages = [];

// Settings storage with defaults
let settings = {
  // Visual customization
  fontSize: 16,
  textColor: "#ffffff",
  chatWidth: "100%",
  chatHeight: "400px",
  
  // Functional customization
  messageLimit: 50,
  highlightTimeout: 10000, // milliseconds
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

// Socket.IO connection handling for main chat
io.on('connection', (socket) => {
  console.log('Client connected to main chat:', socket.id);
  
  // Send current settings to client
  socket.emit('settings', settings);
  
  // Send only the last N messages to new clients (based on message limit setting)
  if (chatMessages.length > 0) {
    socket.emit('chat-history', chatMessages.slice(-settings.messageLimit));
  }
  
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
    
    // Keep only the most recent messages (based on message limit setting)
    if (chatMessages.length > settings.messageLimit) {
      chatMessages = chatMessages.slice(-settings.messageLimit);
    }
    
    // Broadcast to all chat clients
    io.emit('chat-message', message);
  });

  // Handle message highlighting - send to highlight server
  socket.on('highlight-message', (messageId) => {
    console.log('Highlight requested for message:', messageId);
    
    // Find the message by ID
    const message = chatMessages.find(msg => msg.id === messageId);
    
    if (message) {
      // Send to highlight server
      highlightServer.highlightMessage(message);
      console.log('Message sent to highlight server');
    } else {
      console.error('Message not found for highlighting:', messageId);
    }
  });

  // Handle clearing highlighted message
  socket.on('clear-highlight', () => {
    console.log('Clearing highlighted message');
    highlightServer.clearHighlightMessage();
  });

  // Handle settings update
  socket.on('settings-updated', (newSettings) => {
    // Update settings
    settings = { ...settings, ...newSettings };
    console.log('Received settings update:', settings);
    
    // Broadcast to all clients
    io.emit('settings-updated', settings);
    
    // Forward to highlight server
    highlightServer.io.emit('settings-updated', settings);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected from main chat:', socket.id);
  });
});

// Main chat HTML route with dynamic settings included
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
            color: ${settings.textColor};
            overflow: hidden;
            --font-size: ${settings.fontSize}px;
            --text-color: ${settings.textColor};
        }
        
        #chat-container {
            width: ${settings.chatWidth};
            height: ${settings.chatHeight};
            overflow-y: scroll;
            scroll-behavior: smooth;
            padding: 10px;
        }
        
        .chat-message {
            margin-bottom: 8px;
            padding: 8px 10px;
            border-radius: 4px;
            background-color: rgba(34, 34, 34, 0.7);
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
            color: var(--text-color) !important;
            font-family: 'Inter', sans-serif !important;
            font-size: var(--font-size) !important;
            line-height: 1.5;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
        }
        
        .message-content a {
            color: var(--text-color) !important;
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
            
            // Handle settings updates
            socket.on('settings-updated', (newSettings) => {
                console.log('Received settings update:', newSettings);
                applySettings(newSettings);
            });
            
            // Apply settings
            function applySettings(settings) {
                // Update font size
                document.documentElement.style.setProperty('--font-size', \`\${settings.fontSize}px\`);
                
                // Update text color
                document.documentElement.style.setProperty('--text-color', settings.textColor);
                
                // Update chat dimensions
                chatContainer.style.width = settings.chatWidth;
                chatContainer.style.height = settings.chatHeight;
            }
            
            // Handle new chat messages
            socket.on('chat-message', (message) => {
                addMessage(message);
            });
            
            // Add chat history handling
            socket.on('chat-history', (messages) => {
                // Clear any existing messages first
                while (chatContainer.firstChild) {
                    chatContainer.removeChild(chatContainer.firstChild);
                }
                
                // Add each message from history
                messages.forEach(message => {
                    addMessage(message);
                });
            });
            
            // Handle scroll with fixed logic
            chatContainer.addEventListener('scroll', () => {
                const scrollBottom = chatContainer.scrollHeight - chatContainer.clientHeight;
                // The user is not considered scrolled away if they're at or near the bottom
                userScrolled = scrollBottom - chatContainer.scrollTop > 30;
            });
            
            // Improved scroll to bottom function
            function scrollToBottom() {
                // Force a layout calculation
                chatContainer.offsetHeight;
                
                // First scroll attempt
                chatContainer.scrollTop = chatContainer.scrollHeight;
                
                // Multiple delayed attempts to ensure all content renders
                const scrollAttempts = [10, 50, 100, 300];
                scrollAttempts.forEach(delay => {
                    setTimeout(() => {
                        if (!userScrolled) {
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                    }, delay);
                });
            }
            
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
                
                // Keep only the most recent messages (based on message limit from settings)
                const messages = chatContainer.getElementsByClassName('chat-message');
                while (messages.length > ${settings.messageLimit}) {
                    chatContainer.removeChild(messages[0]);
                }
                
                // Set up a mutation observer to catch emoji rendering
                const messageObserver = new MutationObserver(() => {
                    if (!userScrolled) {
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }
                });
                
                // Observe the message element for changes
                messageObserver.observe(messageElement, {
                    subtree: true,
                    childList: true,
                    characterData: true,
                    attributes: true
                });
                
                // Auto-scroll if not manually scrolled up
                if (!userScrolled) {
                    scrollToBottom();
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
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('Settings saved to file');
  } catch (error) {
    console.error('Error saving settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to save settings to file' });
  }
  
  // Notify clients of settings change
  io.emit('settings-updated', settings);
  highlightServer.io.emit('settings-updated', settings);
  console.log('Settings updated and broadcasted to clients');
  
  res.json({ success: true });
});

// Start main server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Main chat server running on http://localhost:${PORT}`);
});