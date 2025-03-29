const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const io = require('socket.io-client');

// Initialize Express app for main chat
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../overlay')));

// Create HTTP server for main chat
const server = http.createServer(app);

// Initialize Socket.IO for main chat
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
  // Common settings (for backward compatibility)
  messageLimit: 50,
  highlightTimeout: 10000,
  highlightColor: "#ff5500",
  
  // OBS View specific settings
  obsView: {
    fontSize: 16,
    textColor: "#ffffff",
    backgroundColor: "#222222",
    messageBackgroundColor: "#222222",
    messageOpacity: 0.7,
    messageBorderRadius: 4,
    messagePadding: 8,
    chatWidth: "100%",
    chatHeight: "400px",
    enableDropShadow: true,
    theme: "dark",
    showBadges: true,
    showTimestamps: false,
    showPlatforms: true
  },
  
  // Streamer View specific settings
  streamerView: {
    fontSize: 16,
    textColor: "#ffffff",
    backgroundColor: "#222222",
    messageBackgroundColor: "#222222",
    messageOpacity: 0.7,
    messageBorderRadius: 4,
    messagePadding: 8,
    chatWidth: "100%",
    chatHeight: "400px",
    enableDropShadow: true,
    theme: "dark",
    showBadges: true,
    showTimestamps: false,
    showPlatforms: true
  },
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
  // Update settings
  settings = { ...settings, ...newSettings };
  console.log('Received settings update:', settings);
  
  // Broadcast all settings to main chat clients
  chatIo.emit('settings-updated', settings);
  
  // Forward ONLY the highlightTimeout to highlight server
  highlightSocket.emit('settings-updated', { 
    highlightTimeout: settings.highlightTimeout 
  });
});

// Handle disconnection
socket.on('disconnect', () => {
  console.log('Client disconnected from main chat:', socket.id);
});
});

// Main chat HTML route with dynamic settings included
// Complete replacement for the main route in server.js
app.get('/', (req, res) => {
  // Force cache prevention
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Determine text shadow based on enableDropShadow setting
  const textShadow = settings.enableDropShadow 
    ? '1px 1px 2px rgba(0,0,0,0.8)' 
    : 'none';
  
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
        
        html, body {
            background-color: #181818 !important;
            font-family: 'Inter', sans-serif;
            color: ${settings.textColor};
            overflow: hidden;
            width: 100%;
            height: 100%;
        }
        
        #chat-container {
            width: ${settings.chatWidth} !important;
            height: ${settings.chatHeight} !important;
            overflow-y: auto !important;
            scroll-behavior: smooth !important;
            padding: 10px !important;
        }
        
        .chat-message {
            margin-bottom: 8px !important;
            padding: 8px 10px !important;
            border-radius: 4px !important;
            background-color: rgba(${parseInt(settings.backgroundColor.slice(1, 3), 16)}, 
                                  ${parseInt(settings.backgroundColor.slice(3, 5), 16)}, 
                                  ${parseInt(settings.backgroundColor.slice(5, 7), 16)}, 0.7) !important;
            word-wrap: break-word !important;
            animation: fadeIn 0.3s ease-in-out !important;
            position: relative !important;
            font-size: ${settings.fontSize}px !important;
            color: ${settings.textColor} !important;
            cursor: pointer !important;
            text-shadow: ${textShadow} !important;
            max-width: 100% !important;
            font-family: 'Inter', sans-serif !important;
        }
        
        .youtube {
            border-left: 3px solid #ff0000 !important;
        }
        
        .twitch {
            border-left: 3px solid #9146FF !important;
        }
        
        .youtube .username {
            color: #ff0000 !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: ${settings.fontSize + 2}px !important;
            display: inline !important;
        }
        
        .twitch .username {
            color: #9146FF !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: ${settings.fontSize + 2}px !important;
            display: inline !important;
        }
        
        .message-content {
            color: ${settings.textColor} !important;
            font-family: 'Inter', sans-serif !important;
            font-size: ${settings.fontSize}px !important;
            line-height: 1.5 !important;
            display: block !important;
            margin-top: 3px !important;
        }
        
        .platform-icon {
            display: ${settings.showPlatforms ? 'inline-flex' : 'none'} !important;
            width: 16px !important;
            height: 16px !important;
            margin-right: 6px !important;
            vertical-align: middle !important;
        }
        
        .badges {
            display: ${settings.showBadges ? 'flex' : 'none'} !important;
            align-items: center !important;
            margin-right: 6px !important;
        }
        
        .timestamp {
            display: ${settings.showTimestamps ? 'inline-block' : 'none'} !important;
            font-size: 0.8em !important;
            color: #aaa !important;
            margin-left: auto !important;
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
            
            // Force reload on settings change
            socket.on('settings-updated', () => {
                console.log('Settings updated, reloading page');
                window.location.reload();
            });
            
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
                userScrolled = scrollBottom - chatContainer.scrollTop > 30;
            });
            
            // Improved scroll to bottom function
            function scrollToBottom() {
                chatContainer.scrollTop = chatContainer.scrollHeight;
                
                // Multiple delayed attempts to ensure all content renders
                [50, 200].forEach(delay => {
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
                messageElement.style.fontSize = '${settings.fontSize}px';
                messageElement.style.color = '${settings.textColor}';
                
                // Create platform icon
                let iconHtml = '';
                if (message.platform.toLowerCase() === 'youtube') {
                    iconHtml = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="platform-icon"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/></svg>';
                } else if (message.platform.toLowerCase() === 'twitch') {
                    iconHtml = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="platform-icon"><path d="M11.571 4.714h1.715v5.143H11.57v-5.143zm4.715 0H18v5.143h-1.714v-5.143zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" fill="#9146FF"/></svg>';
                }
                
                // Create badges HTML
                let badgesHtml = '';
                if (message.badges && message.badges.length > 0) {
                    badgesHtml = '<div class="badges" style="display: ${settings.showBadges ? 'flex' : 'none'}">';
                    badgesHtml += message.badges.map(badge => 
                        \`<span class="badge" style="background-image: url('\${badge}')"></span>\`
                    ).join('');
                    badgesHtml += '</div>';
                }
                
                // Create timestamp HTML
                let timestampHtml = '';
                if (message.timestamp) {
                    const timestamp = typeof message.timestamp === 'string' ? message.timestamp : new Date(message.timestamp).toLocaleTimeString();
                    timestampHtml = \`<span class="timestamp" style="display: ${settings.showTimestamps ? 'inline-block' : 'none'}">\${timestamp}</span>\`;
                }
                
                // Build message HTML with inline styles
                messageElement.innerHTML = \`
                    <div class="message-header">
                        <span class="platform-icon" style="display: ${settings.showPlatforms ? 'inline-flex' : 'none'}">\${iconHtml}</span>
                        <span class="username" style="font-size: ${settings.fontSize + 2}px; color: \${message.platform.toLowerCase() === 'youtube' ? '#ff0000' : '#9146FF'};">\${message.username}</span>
                        \${badgesHtml}
                        \${timestampHtml}
                    </div>
                    <div class="message-content" style="font-size: ${settings.fontSize}px; color: ${settings.textColor};">\${message.content}</div>
                \`;
                
                // Click to highlight message
                messageElement.addEventListener('click', () => {
                    socket.emit('highlight-message', message.id);
                });
                
                // Add to chat container
                chatContainer.appendChild(messageElement);
                
                // Keep only the most recent messages
                const messages = chatContainer.getElementsByClassName('chat-message');
                while (messages.length > ${settings.messageLimit}) {
                    chatContainer.removeChild(messages[0]);
                }
                
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

// Add this new route to server.js
// Streamer View Route
// Find the '/streamer-view' route in server.js and modify it as follows:
app.get('/streamer-view', (req, res) => {
    // Force cache prevention
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.send(`<!DOCTYPE html>
  <html>
  <head>
      <meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
      <title>Streamer View</title>
      <style>
          body {
              background-color: ${settings.streamerView.backgroundColor};
              font-family: 'Inter', sans-serif;
              margin: 0;
              padding: 0;
          }
          
          #chat {
              width: ${settings.streamerView.chatWidth};
              height: ${settings.streamerView.chatHeight};
              overflow-y: auto;
              padding: 10px;
          }
          
          .msg {
              margin-bottom: 8px;
              padding: 8px;
              border-radius: 4px;
              background: rgba(40, 40, 40, 0.7);
              font-size: ${settings.streamerView.fontSize}px;
              color: ${settings.streamerView.textColor};
              cursor: pointer;
              text-shadow: ${settings.streamerView.enableDropShadow ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none'};
              overflow-wrap: break-word;
              word-wrap: break-word;
              word-break: break-word;
          }
          
          .yt { border-left: 3px solid #ff0000; }
          .tw { border-left: 3px solid #9146FF; }
          
          .yt .name { color: #ff0000; font-weight: bold; font-size: ${parseInt(settings.streamerView.fontSize) + 2}px; }
          .tw .name { color: #9146FF; font-weight: bold; font-size: ${parseInt(settings.streamerView.fontSize) + 2}px; }
          
          .content { 
              color: ${settings.streamerView.textColor}; 
              font-size: ${settings.streamerView.fontSize}px;
              display: inline;
          }
          
          .icon {
              display: ${settings.streamerView.showPlatforms ? 'inline' : 'none'};
              width: 16px;
              height: 16px;
              margin-right: 5px;
              vertical-align: middle;
          }
  
          .badge {
              display: ${settings.streamerView.showBadges ? 'inline-block' : 'none'};
              width: 18px;
              height: 18px;
              margin-right: 4px;
              background-size: contain;
              background-repeat: no-repeat;
              background-position: center;
          }
  
          .timestamp {
              font-size: 0.8em;
              color: #aaa;
              margin-left: auto;
              display: ${settings.streamerView.showTimestamps ? 'inline-block' : 'none'};
          }
          
          /* Fix for emojis */
          .content img, 
          .content span[role="img"],
          .content .emoji,
          .content em img,
          .content em span {
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
              vertical-align: middle !important;
          }
      </style>
  </head>
  <body>
      <div id="chat"></div>
      <script src="/socket.io/socket.io.js"></script>
      <script>
          const chat = document.getElementById('chat');
          let userScrolled = false;
          
          const socket = io();
          
          // Force reload on settings change
          socket.on('settings-updated', () => window.location.reload());
          
          socket.on('chat-message', addMessage);
          
          socket.on('chat-history', (messages) => {
              chat.innerHTML = '';
              messages.forEach(addMessage);
          });
          
          // Handle scroll with activity detection
chat.onscroll = () => {
    resetActivityTimer();
    const bottom = chat.scrollHeight - chat.clientHeight;
    userScrolled = (bottom - chat.scrollTop) > 30;
};

// Auto-scroll after inactivity
let activityTimer;
function resetActivityTimer() {
    clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
        userScrolled = false;
        smoothScrollToBottom();
        console.log("Auto-scrolling after 5 seconds of inactivity");
    }, 5000); // 5 seconds
}

// Add mouse and keyboard activity detection
chat.addEventListener('mousemove', resetActivityTimer);
chat.addEventListener('keydown', resetActivityTimer);
chat.addEventListener('click', resetActivityTimer);

// Initialize the activity timer
resetActivityTimer();

// Smooth scroll to bottom function
function smoothScrollToBottom() {
    const targetPosition = chat.scrollHeight - chat.clientHeight;
    const startPosition = chat.scrollTop;
    const distance = targetPosition - startPosition;
    const duration = 800; // milliseconds
    let startTime = null;
    
    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Easing function (ease-out cubic)
        const ease = 1 - Math.pow(1 - progress, 3);
        
        chat.scrollTop = startPosition + distance * ease;
        
        if (elapsedTime < duration) {
            requestAnimationFrame(animation);
        }
    }
    
    requestAnimationFrame(animation);
}

// Update regular scrollDown function to use the smooth version when appropriate
function scrollDown() {
    if (Math.abs(chat.scrollHeight - chat.clientHeight - chat.scrollTop) > 300) {
        // If we're far from the bottom, use smooth scrolling
        smoothScrollToBottom();
    } else {
        // If we're close to the bottom, use instant scrolling
        chat.scrollTop = chat.scrollHeight;
        
        // Multiple delayed attempts to ensure all content renders
        [10, 50, 100, 300, 500].forEach(delay => {
            setTimeout(() => {
                if (!userScrolled) {
                    chat.scrollTop = chat.scrollHeight;
                }
            }, delay);
        });
    }
}
          
          // Function to fix emoji sizes
          function fixEmojiSizes(element) {
              // Find all images in the element
              const images = element.querySelectorAll('img');
              images.forEach(img => {
                  img.style.height = '1.2em';
                  img.style.width = 'auto';
                  img.style.maxHeight = '1.2em';
                  img.style.maxWidth = '1.5em';
                  img.style.verticalAlign = 'middle';
              });
              
              // Find all emoji spans
              const emojiSpans = element.querySelectorAll('span[role="img"]');
              emojiSpans.forEach(span => {
                  span.style.fontSize = 'inherit';
                  span.style.display = 'inline-flex';
                  span.style.height = '1.2em';
                  span.style.verticalAlign = 'middle';
              });
          }
          
          function addMessage(msg) {
              const el = document.createElement('div');
              el.className = 'msg ' + (msg.platform.toLowerCase() === 'youtube' ? 'yt' : 'tw');
              el.dataset.id = msg.id;
              
              let icon = '';
              if (msg.platform.toLowerCase() === 'youtube') {
                  icon = '<svg class="icon" viewBox="0 0 24 24"><path d="M23.5 6.2c-.2-1-1-1.8-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5c-1.1.3-1.9 1.1-2.1 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8c.2 1 1 1.8 2.1 2.1 1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5c1.1-.3 1.9-1.1 2.1-2.1.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" fill="#FF0000"/></svg>';
              } else {
                  icon = '<svg class="icon" viewBox="0 0 24 24"><path d="M11.6 4.7h1.7v5.1h-1.7v-5.1zm4.7 0H18v5.1h-1.7v-5.1zM6 0L1.7 4.3v15.4h5.1V24l4.3-4.3h3.4L22.3 12V0H6zm14.6 11.1l-3.4 3.4h-3.4l-3 3v-3H6.9V1.7h13.7v9.4z" fill="#9146FF"/></svg>';
              }
  
              // Create badges HTML
              let badgesHtml = '';
              if (msg.badges && msg.badges.length > 0) {
                  badgesHtml = '<span class="badges">';
                  badgesHtml += msg.badges.map(badge => 
                      \`<span class="badge" style="background-image: url('\${badge}')"></span>\`
                  ).join('');
                  badgesHtml += '</span>';
              }
              
              // Create timestamp HTML
              let timestampHtml = '';
              if (msg.timestamp) {
                  const timestamp = typeof msg.timestamp === 'string' ? msg.timestamp : new Date(msg.timestamp).toLocaleTimeString();
                  timestampHtml = \`<span class="timestamp">\${timestamp}</span>\`;
              }
              
              el.innerHTML = \`
                  \${icon}
                  <span class="name">\${msg.username}</span>: 
                  \${badgesHtml}
                  \${timestampHtml}
                  <span class="content">\${msg.content}</span>
              \`;
              
              // Fix emoji sizes
              setTimeout(() => {
                  fixEmojiSizes(el);
              }, 0);
              
              // Set up a mutation observer to catch when emojis load
              const observer = new MutationObserver(() => {
                  fixEmojiSizes(el);
                  
                  // Only scroll if not manually scrolled up
                  if (!userScrolled) {
                      scrollDown();
                  }
              });
              
              // Observe the message for changes
              observer.observe(el, {
                  childList: true,
                  subtree: true,
                  attributes: true
              });
              
              el.onclick = () => socket.emit('highlight-message', msg.id);
              
              chat.appendChild(el);
              
              const msgs = chat.getElementsByClassName('msg');
              while (msgs.length > ${settings.messageLimit}) {
                  chat.removeChild(msgs[0]);
              }
              
              if (!userScrolled) scrollDown();
          }
      </script>
  </body>
  </html>`);
  });

// Add this to server.js - a dedicated endpoint for a simple, reliable chat display
// OBS View Route
// In server.js - find the '/obs-view' route and modify it as follows:

app.get('/obs-view', (req, res) => {
    // Force cache prevention
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Determine text shadow based on enableDropShadow setting
    const textShadow = settings.obsView.enableDropShadow 
      ? '1px 1px 2px rgba(0,0,0,0.8)' 
      : 'none';
    
    // Get the showMessageBackground setting with fallback to true if not defined
    const showMessageBackground = settings.obsView.showMessageBackground !== undefined 
      ? settings.obsView.showMessageBackground 
      : true;
    
    // Build background style based on showMessageBackground setting
    const backgroundStyle = showMessageBackground
      ? `background-color: rgba(${parseInt(settings.obsView.backgroundColor.slice(1, 3), 16)}, 
                            ${parseInt(settings.obsView.backgroundColor.slice(3, 5), 16)}, 
                            ${parseInt(settings.obsView.backgroundColor.slice(5, 7), 16)}, 
                            ${settings.obsView.messageOpacity});`
      : 'background-color: transparent;';
    
    // Build border styles based on showMessageBackground setting
    const borderStyles = showMessageBackground 
      ? `
          .yt {
              border-left: 3px solid #ff0000;
          }
          
          .tw {
              border-left: 3px solid #9146FF;
          }
      `
      : `
          .yt, .tw {
              border-left: none;
          }
      `;
    
    res.send(`<!DOCTYPE html>
  <html>
  <head>
      <meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
      <title>OBS View</title>
      <style>
          body {
              background-color: ${settings.obsView.backgroundColor};
              font-family: 'Inter', sans-serif;
              margin: 0;
              padding: 0;
              color: ${settings.obsView.textColor};
          }
          
          #chat {
              width: ${settings.obsView.chatWidth};
              height: ${settings.obsView.chatHeight};
              overflow-y: auto;
              padding: 10px;
          }
          
          .msg {
              margin-bottom: 8px;
              padding: ${settings.obsView.messagePadding}px;
              border-radius: ${settings.obsView.messageBorderRadius}px;
              ${backgroundStyle}
              font-size: ${settings.obsView.fontSize}px;
              color: ${settings.obsView.textColor};
              cursor: pointer;
              text-shadow: ${textShadow};
              overflow-wrap: break-word;
              word-wrap: break-word;
              word-break: break-word;
          }
          
          ${borderStyles}
          
          .yt .name { 
              color: #ff0000; 
              font-weight: bold; 
              font-size: ${parseInt(settings.obsView.fontSize) + 2}px;
          }
          
          .tw .name { 
              color: #9146FF; 
              font-weight: bold; 
              font-size: ${parseInt(settings.obsView.fontSize) + 2}px;
          }
          
          .content { 
              color: ${settings.obsView.textColor}; 
              font-size: ${settings.obsView.fontSize}px;
              display: inline;
          }
          
          .icon {
              display: ${settings.obsView.showPlatforms ? 'inline' : 'none'};
              width: 16px;
              height: 16px;
              margin-right: 5px;
              vertical-align: middle;
          }
  
          .badge {
              display: ${settings.obsView.showBadges ? 'inline-block' : 'none'};
              width: 18px;
              height: 18px;
              margin-right: 4px;
              background-size: contain;
              background-repeat: no-repeat;
              background-position: center;
          }
  
          .timestamp {
              font-size: 0.8em;
              color: #aaa;
              margin-left: auto;
              display: ${settings.obsView.showTimestamps ? 'inline-block' : 'none'};
          }
          
          /* Fix for emojis */
          .content img, 
          .content span[role="img"],
          .content .emoji,
          .content em img,
          .content em span {
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
              vertical-align: middle !important;
          }
      </style>
  </head>
  <body class="${settings.obsView.theme}-theme">
      <div id="chat"></div>
      <script src="/socket.io/socket.io.js"></script>
      <script>
          const chat = document.getElementById('chat');
          let userScrolled = false;
          
          const socket = io();
          
          // Force reload on settings change
          socket.on('settings-updated', () => window.location.reload());
          
          socket.on('chat-message', addMessage);
          
          socket.on('chat-history', (messages) => {
              chat.innerHTML = '';
              messages.forEach(addMessage);
          });
          
          // Handle scroll with fixed logic
chat.addEventListener('scroll', () => {
    resetActivityTimer();
    const scrollBottom = chat.scrollHeight - chat.clientHeight;
    userScrolled = scrollBottom - chat.scrollTop > 30;
});

// Auto-scroll after inactivity
let activityTimer;
function resetActivityTimer() {
    clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
        userScrolled = false;
        smoothScrollToBottom();
        console.log("Auto-scrolling after 5 seconds of inactivity");
    }, 5000); // 5 seconds
}

// Add mouse and keyboard activity detection
chat.addEventListener('mousemove', resetActivityTimer);
chat.addEventListener('keydown', resetActivityTimer);
chat.addEventListener('click', resetActivityTimer);

// Initialize the activity timer
resetActivityTimer();

// Smooth scroll to bottom function
function smoothScrollToBottom() {
    const targetPosition = chat.scrollHeight - chat.clientHeight;
    const startPosition = chat.scrollTop;
    const distance = targetPosition - startPosition;
    const duration = 800; // milliseconds
    let startTime = null;
    
    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Easing function (ease-out cubic)
        const ease = 1 - Math.pow(1 - progress, 3);
        
        chat.scrollTop = startPosition + distance * ease;
        
        if (elapsedTime < duration) {
            requestAnimationFrame(animation);
        }
    }
    
    requestAnimationFrame(animation);
}

// Update regular scrollDown function to use the smooth version when appropriate
function scrollDown() {
    if (Math.abs(chat.scrollHeight - chat.clientHeight - chat.scrollTop) > 300) {
        // If we're far from the bottom, use smooth scrolling
        smoothScrollToBottom();
    } else {
        // If we're close to the bottom, use instant scrolling
        chat.scrollTop = chat.scrollHeight;
        
        // Multiple delayed attempts to ensure all content renders
        [10, 50, 100, 300, 500].forEach(delay => {
            setTimeout(() => {
                if (!userScrolled) {
                    chat.scrollTop = chat.scrollHeight;
                }
            }, delay);
        });
    }
}
          
          // Function to fix emoji sizes
          function fixEmojiSizes(element) {
              // Find all images in the element
              const images = element.querySelectorAll('img');
              images.forEach(img => {
                  img.style.height = '1.2em';
                  img.style.width = 'auto';
                  img.style.maxHeight = '1.2em';
                  img.style.maxWidth = '1.5em';
                  img.style.verticalAlign = 'middle';
              });
              
              // Find all emoji spans
              const emojiSpans = element.querySelectorAll('span[role="img"]');
              emojiSpans.forEach(span => {
                  span.style.fontSize = 'inherit';
                  span.style.display = 'inline-flex';
                  span.style.height = '1.2em';
                  span.style.verticalAlign = 'middle';
              });
          }
          
          function addMessage(msg) {
              const el = document.createElement('div');
              el.className = 'msg ' + (msg.platform.toLowerCase() === 'youtube' ? 'yt' : 'tw');
              el.dataset.id = msg.id;
              
              let icon = '';
              if (msg.platform.toLowerCase() === 'youtube') {
                  icon = '<svg class="icon" viewBox="0 0 24 24"><path d="M23.5 6.2c-.2-1-1-1.8-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5c-1.1.3-1.9 1.1-2.1 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8c.2 1 1 1.8 2.1 2.1 1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5c1.1-.3 1.9-1.1 2.1-2.1.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" fill="#FF0000"/></svg>';
              } else {
                  icon = '<svg class="icon" viewBox="0 0 24 24"><path d="M11.6 4.7h1.7v5.1h-1.7v-5.1zm4.7 0H18v5.1h-1.7v-5.1zM6 0L1.7 4.3v15.4h5.1V24l4.3-4.3h3.4L22.3 12V0H6zm14.6 11.1l-3.4 3.4h-3.4l-3 3v-3H6.9V1.7h13.7v9.4z" fill="#9146FF"/></svg>';
              }
  
              // Create badges HTML
              let badgesHtml = '';
              if (msg.badges && msg.badges.length > 0) {
                  badgesHtml = '<span class="badges">';
                  badgesHtml += msg.badges.map(badge => 
                      \`<span class="badge" style="background-image: url('\${badge}')"></span>\`
                  ).join('');
                  badgesHtml += '</span>';
              }
              
              // Create timestamp HTML
              let timestampHtml = '';
              if (msg.timestamp) {
                  const timestamp = typeof msg.timestamp === 'string' ? msg.timestamp : new Date(msg.timestamp).toLocaleTimeString();
                  timestampHtml = \`<span class="timestamp">\${timestamp}</span>\`;
              }
              
              el.innerHTML = \`
                  \${icon}
                  <span class="name">\${msg.username}</span>: 
                  \${badgesHtml}
                  \${timestampHtml}
                  <span class="content">\${msg.content}</span>
              \`;
              
              // Fix emoji sizes
              setTimeout(() => {
                  fixEmojiSizes(el);
              }, 0);
              
              // Set up a mutation observer to catch when emojis load
              const observer = new MutationObserver(() => {
                  fixEmojiSizes(el);
                  
                  // Only scroll if not manually scrolled up
                  if (!userScrolled) {
                      scrollDown();
                  }
              });
              
              // Observe the message for changes
              observer.observe(el, {
                  childList: true,
                  subtree: true,
                  attributes: true
              });
              
              el.onclick = () => socket.emit('highlight-message', msg.id);
              
              chat.appendChild(el);
              
              const msgs = chat.getElementsByClassName('msg');
              while (msgs.length > ${settings.messageLimit}) {
                  chat.removeChild(msgs[0]);
              }
              
              if (!userScrolled) scrollDown();
          }
      </script>
  </body>
  </html>`);
  });

app.get('/dynamic-styles.css', (req, res) => {
  // Set cache control headers to prevent caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'text/css');
  
  // Generate CSS from current settings
  const css = `
    #chat-container {
      width: ${settings.chatWidth} !important;
      height: ${settings.chatHeight} !important;
    }
    
    .chat-message {
      font-size: ${settings.fontSize}px !important;
      color: ${settings.textColor} !important;
      text-shadow: ${settings.enableDropShadow ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none'} !important;
    }
    
    .username {
      font-size: ${parseInt(settings.fontSize) + 2}px !important;
    }
    
    .message-content {
      font-size: ${settings.fontSize}px !important;
      color: ${settings.textColor} !important;
    }
    
    .badges {
      display: ${settings.showBadges ? 'flex' : 'none'} !important;
    }
    
    .timestamp {
      display: ${settings.showTimestamps ? 'inline-block' : 'none'} !important;
    }
    
    .platform-icon {
      display: ${settings.showPlatforms ? 'inline-flex' : 'none'} !important;
    }
  `;
  
  res.send(css);
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
chatIo.emit('settings-updated', settings);

// Only send highlight timeout to highlight server
highlightSocket.emit('settings-updated', { 
  highlightTimeout: settings.highlightTimeout 
});

console.log('Settings updated and broadcasted to clients');

res.json({ success: true });
});

// Start main server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
console.log(`Main chat server running on http://localhost:${PORT}`);
});