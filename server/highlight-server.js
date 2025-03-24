// Create a standalone highlight server file called highlight-server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Initialize Express app for highlights only
const app = express();
app.use(cors());

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

// Serve an inline HTML file for the highlight display
app.get('/', (req, res) => {
  console.log('Highlight overlay requested');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Highlight Only</title>
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
            align-items: center;
            height: 100vh;
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
</html>`;

  res.send(html);
});

// Global variable to store highlighted message
let highlightedMessage = null;

// Main server will need to send messages to this server
function sendHighlightMessage(message) {
  highlightedMessage = message;
  io.emit('highlight-message', message);
  console.log('Highlight message sent to clients');
}

function clearHighlightMessage() {
  highlightedMessage = null;
  io.emit('clear-highlight');
  console.log('Highlight cleared');
}

// Socket connection handler
io.on('connection', (socket) => {
  console.log('Client connected to highlight server:', socket.id);
  
  // Send current highlight if exists
  if (highlightedMessage) {
    socket.emit('highlight-message', highlightedMessage);
  }
  
  // Handle clear request
  socket.on('clear-highlight', () => {
    clearHighlightMessage();
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected from highlight server:', socket.id);
  });
});

// Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Highlight server running on http://localhost:${PORT}`);
  console.log(`Add http://localhost:${PORT} as a browser source in OBS for highlights`);
});

module.exports = {
  sendHighlightMessage,
  clearHighlightMessage
};