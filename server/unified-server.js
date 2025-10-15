const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ChatIntegration = require('./chat-integration');

// Initialize Express app
const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../overlay')));
app.use('/audio', express.static(path.join(__dirname, 'audio')));
app.use(express.static(path.join(__dirname, '../customization')));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with namespaces
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Chat message storage
let chatMessages = [];

// Settings storage with defaults
let settings = {
  messageLimit: 50,
  highlightTimeout: 10000,
  highlightColor: "#ff5500",
  enableSound: true,
  soundVolume: 0.5,

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
    showPlatforms: true,
    showMessageBackground: true
  },

  streamerView: {
    fontSize: 16,
    textColor: "#ffffff",
    backgroundColor: "#181818",
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
  }
};

// Highlighted message storage
let highlightedMessage = null;

// Load settings from file if exists
const settingsPath = path.join(__dirname, 'settings.json');
try {
  if (fs.existsSync(settingsPath)) {
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    const savedSettings = JSON.parse(settingsData);
    settings = { ...settings, ...savedSettings };
    console.log('Settings loaded from file');
  }
} catch (error) {
  console.error('Error loading settings:', error);
}

// Initialize Chat Integration
const chatIntegration = new ChatIntegration();

// Handle chat messages from integration
chatIntegration.on('chat-message', (message) => {
  chatMessages.push(message);

  if (chatMessages.length > settings.messageLimit) {
    chatMessages = chatMessages.slice(-settings.messageLimit);
  }

  // Broadcast to main chat namespace
  io.of('/').emit('chat-message', message);
});

// Handle status updates
chatIntegration.on('status-updated', (status) => {
  io.of('/dashboard').emit('chat-sources-status', status);
});

// Connect all chat sources on startup
chatIntegration.connectAll();

// ==========================================
// MAIN CHAT NAMESPACE (/)
// ==========================================
io.of('/').on('connection', (socket) => {
  console.log('Client connected to main chat:', socket.id);

  socket.emit('settings', settings);

  socket.on('get-settings', () => {
    socket.emit('settings', settings);
  });

  if (chatMessages.length > 0) {
    socket.emit('chat-history', chatMessages.slice(-settings.messageLimit));
  }

  socket.on('chat-message', (message) => {
    if (!message || !message.platform || !message.username || !message.content) {
      console.error('Invalid message format:', message);
      return;
    }

    console.log(`Received ${message.platform} message from ${message.username}`);

    if (!message.id) {
      message.id = Date.now() + Math.random().toString(36).substring(2, 9);
    }

    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }

    chatMessages.push(message);

    if (chatMessages.length > settings.messageLimit) {
      chatMessages = chatMessages.slice(-settings.messageLimit);
    }

    io.of('/').emit('chat-message', message);
  });

  socket.on('highlight-message', (messageId) => {
    console.log('Highlight requested for message:', messageId);

    const message = chatMessages.find(msg => msg.id === messageId);

    if (message) {
      highlightedMessage = message;
      io.of('/highlight').emit('highlight-message', message);
      console.log('Message sent to highlight namespace');
    } else {
      console.error('Message not found for highlighting:', messageId);
    }
  });

  socket.on('clear-highlight', () => {
    console.log('Clearing highlighted message');
    highlightedMessage = null;
    io.of('/highlight').emit('clear-highlight');
  });

  socket.on('settings-updated', (newSettings) => {
    console.log('Received settings update:', JSON.stringify(newSettings));
    settings = { ...settings, ...newSettings };

    io.of('/').emit('settings-updated', settings);
    io.of('/highlight').emit('settings-updated', {
      highlightTimeout: settings.highlightTimeout,
      enableSound: settings.enableSound,
      soundVolume: settings.soundVolume
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected from main chat:', socket.id);
  });
});

// ==========================================
// HIGHLIGHT NAMESPACE (/highlight)
// ==========================================
io.of('/highlight').on('connection', (socket) => {
  console.log('Client connected to highlight server:', socket.id);

  socket.emit('settings', {
    highlightTimeout: settings.highlightTimeout,
    enableSound: settings.enableSound,
    soundVolume: settings.soundVolume
  });

  socket.on('get-settings', () => {
    socket.emit('settings', {
      highlightTimeout: settings.highlightTimeout,
      enableSound: settings.enableSound,
      soundVolume: settings.soundVolume
    });
  });

  if (highlightedMessage) {
    socket.emit('highlight-message', highlightedMessage);
  }

  socket.on('clear-highlight', () => {
    highlightedMessage = null;
    io.of('/highlight').emit('clear-highlight');
    console.log('Highlight cleared');
  });

  socket.on('settings-updated', (newSettings) => {
    if (newSettings.highlightTimeout !== undefined) {
      settings.highlightTimeout = newSettings.highlightTimeout;
    }

    if (newSettings.enableSound !== undefined) {
      settings.enableSound = newSettings.enableSound;
    }

    if (newSettings.soundVolume !== undefined) {
      settings.soundVolume = newSettings.soundVolume;
    }

    console.log('Updated highlight settings:', settings);

    io.of('/highlight').emit('settings-updated', {
      highlightTimeout: settings.highlightTimeout,
      enableSound: settings.enableSound,
      soundVolume: settings.soundVolume
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected from highlight server:', socket.id);
  });
});

// ==========================================
// DASHBOARD NAMESPACE (/dashboard)
// ==========================================
io.of('/dashboard').on('connection', (socket) => {
  console.log('Client connected to dashboard:', socket.id);

  socket.emit('settings', settings);
  socket.emit('chat-sources-status', chatIntegration.getStatus());

  socket.on('get-settings', () => {
    socket.emit('settings', settings);
  });

  socket.on('get-chat-sources', () => {
    socket.emit('chat-sources-status', chatIntegration.getStatus());
  });

  socket.on('update-chat-sources', (config) => {
    console.log('Updating chat sources:', config);
    const status = chatIntegration.updateConfig(config);
    socket.emit('chat-sources-status', status);
    io.of('/dashboard').emit('chat-sources-status', status);
  });

  socket.on('save-settings', (newSettings) => {
    console.log('Saving settings from dashboard');
    settings = { ...settings, ...newSettings };

    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('Settings saved to file');
    } catch (error) {
      console.error('Error saving settings:', error);
    }

    io.of('/').emit('settings-updated', settings);
    io.of('/highlight').emit('settings-updated', {
      highlightTimeout: settings.highlightTimeout,
      enableSound: settings.enableSound,
      soundVolume: settings.soundVolume
    });
    io.of('/dashboard').emit('settings-updated', settings);

    socket.emit('settings-saved', { success: true });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected from dashboard:', socket.id);
  });
});

// ==========================================
// ROUTES
// ==========================================

// Main chat routes
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const textShadow = settings.enableDropShadow ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none';

  res.send(generateMainChatHTML(settings, textShadow));
});

app.get('/obs-view', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.send(generateOBSViewHTML(settings));
});

app.get('/streamer-view', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.send(generateStreamerViewHTML(settings));
});

// Highlight route
app.get('/highlight', (req, res) => {
  res.send(generateHighlightHTML(settings));
});

// Dashboard route - serve the customization HTML
app.get('/dashboard', (req, res) => {
  const dashboardPath = path.join(__dirname, '../customization/index.html');
  if (fs.existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else {
    res.status(404).send('Dashboard not found');
  }
});

// Settings endpoints
app.get('/settings', (req, res) => {
  res.json(settings);
});

// API endpoints for dashboard
app.get('/api/settings', (req, res) => {
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  console.log('Settings update received via API:', req.body);

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid settings object' });
  }

  settings = { ...settings, ...req.body };

  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('Settings saved to file');
  } catch (error) {
    console.error('Error saving settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to save settings to file' });
  }

  io.of('/').emit('settings-updated', settings);
  io.of('/highlight').emit('settings-updated', {
    highlightTimeout: settings.highlightTimeout,
    enableSound: settings.enableSound,
    soundVolume: settings.soundVolume
  });
  io.of('/dashboard').emit('settings-updated', settings);

  res.json({ success: true });
});

app.get('/api/chat-sources', (req, res) => {
  res.json(chatIntegration.getStatus());
});

app.post('/api/chat-sources', (req, res) => {
  console.log('Chat sources update received via API:', req.body);

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid config object' });
  }

  const status = chatIntegration.updateConfig(req.body);
  res.json({ success: true, status });
});

app.post('/settings', (req, res) => {
  console.log('Settings update received:', req.body);

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid settings object' });
  }

  settings = { ...settings, ...req.body };

  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('Settings saved to file');
  } catch (error) {
    console.error('Error saving settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to save settings to file' });
  }

  io.of('/').emit('settings-updated', settings);
  io.of('/highlight').emit('settings-updated', {
    highlightTimeout: settings.highlightTimeout,
    enableSound: settings.enableSound,
    soundVolume: settings.soundVolume
  });

  res.json({ success: true });
});

// Helper function to generate main chat HTML
function generateMainChatHTML(settings, textShadow) {
  return `<!DOCTYPE html>
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

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div id="chat-container"></div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io('/');
        const chatContainer = document.getElementById('chat-container');
        let userScrolled = false;

        socket.on('settings-updated', () => {
            window.location.reload();
        });

        socket.on('chat-message', (message) => {
            addMessage(message);
        });

        socket.on('chat-history', (messages) => {
            chatContainer.innerHTML = '';
            messages.forEach(addMessage);
        });

        function addMessage(msg) {
            const el = document.createElement('div');
            el.className = 'chat-message ' + msg.platform.toLowerCase();
            el.dataset.id = msg.id;
            el.innerHTML = \`<strong>\${msg.username}:</strong> \${msg.content}\`;
            el.onclick = () => socket.emit('highlight-message', msg.id);
            chatContainer.appendChild(el);

            const msgs = chatContainer.getElementsByClassName('chat-message');
            while (msgs.length > ${settings.messageLimit}) {
                chatContainer.removeChild(msgs[0]);
            }

            if (!userScrolled) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }

        chatContainer.addEventListener('scroll', () => {
            const scrollBottom = chatContainer.scrollHeight - chatContainer.clientHeight;
            userScrolled = scrollBottom - chatContainer.scrollTop > 30;
        });
    </script>
</body>
</html>`;
}

// Import HTML generators from existing server files
function generateOBSViewHTML(settings) {
  // Read from server.js lines 826-1180
  const fs = require('fs');
  const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

  // Extract the OBS view HTML generation logic
  const textShadow = settings.obsView.enableDropShadow ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none';
  const showMessageBackground = settings.obsView.showMessageBackground !== undefined ? settings.obsView.showMessageBackground : true;

  const backgroundStyle = showMessageBackground
    ? `background-color: rgba(${parseInt(settings.obsView.backgroundColor.slice(1, 3), 16)},
                          ${parseInt(settings.obsView.backgroundColor.slice(3, 5), 16)},
                          ${parseInt(settings.obsView.backgroundColor.slice(5, 7), 16)},
                          ${settings.obsView.messageOpacity});`
    : 'background-color: transparent;';

  const borderStyles = showMessageBackground
    ? `.yt { border-left: 3px solid #ff0000; } .tw { border-left: 3px solid #9146FF; }`
    : `.yt, .tw { border-left: none; }`;

  return `<!DOCTYPE html>
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

        .yt .name { color: #ff0000; font-weight: bold; font-size: ${parseInt(settings.obsView.fontSize) + 2}px; }
        .tw .name { color: #9146FF; font-weight: bold; font-size: ${parseInt(settings.obsView.fontSize) + 2}px; }
        .content { color: ${settings.obsView.textColor}; font-size: ${settings.obsView.fontSize}px; display: inline; }

        .icon { display: inline-flex !important; vertical-align: middle !important; width: 16px !important; height: 16px !important; }
        .badge { display: inline-block !important; width: 18px !important; height: 18px !important; margin-right: 4px !important; background-size: contain !important; background-repeat: no-repeat !important; background-position: center !important; vertical-align: middle !important; }
        .badges { display: inline-flex !important; align-items: center !important; margin-right: 6px !important; vertical-align: middle !important; }
        .timestamp { font-size: 0.8em; color: #aaa; margin-left: auto; display: ${settings.obsView.showTimestamps ? 'inline-block' : 'none'}; }

        .content img, .content span[role="img"], .content .emoji, .content em img, .content em span {
            vertical-align: middle !important; height: 1.2em !important; width: auto !important; max-height: 1.2em !important; max-width: 1.5em !important; margin: 0 0.1em !important; display: inline-flex !important; font-size: inherit !important;
        }

        img.emoji { height: 1.2em !important; width: auto !important; vertical-align: middle !important; }
        .message-content a, #chat .content a { color: ${settings.obsView.textColor} !important; text-decoration: none !important; pointer-events: none !important; }
        .message-content a:hover, #chat .content a:hover { text-decoration: none !important; }
    </style>
</head>
<body class="${settings.obsView.theme}-theme">
    <div id="chat"></div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const chat = document.getElementById('chat');
        let userScrolled = false;
        const socket = io('/');

        socket.on('settings-updated', () => window.location.reload());
        socket.on('chat-message', addMessage);
        socket.on('chat-history', (messages) => {
            chat.innerHTML = '';
            messages.forEach(addMessage);
        });

        chat.addEventListener('scroll', () => {
            resetActivityTimer();
            const scrollBottom = chat.scrollHeight - chat.clientHeight;
            userScrolled = scrollBottom - chat.scrollTop > 30;
        });

        let activityTimer;
        function resetActivityTimer() {
            clearTimeout(activityTimer);
            activityTimer = setTimeout(() => {
                userScrolled = false;
                smoothScrollToBottom();
            }, 5000);
        }

        chat.addEventListener('mousemove', resetActivityTimer);
        chat.addEventListener('keydown', resetActivityTimer);
        chat.addEventListener('click', resetActivityTimer);
        resetActivityTimer();

        function smoothScrollToBottom() {
            const targetPosition = chat.scrollHeight - chat.clientHeight;
            const startPosition = chat.scrollTop;
            const distance = targetPosition - startPosition;
            const duration = 800;
            let startTime = null;

            function animation(currentTime) {
                if (startTime === null) startTime = currentTime;
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3);
                chat.scrollTop = startPosition + distance * ease;
                if (elapsedTime < duration) requestAnimationFrame(animation);
            }
            requestAnimationFrame(animation);
        }

        function scrollDown() {
            if (Math.abs(chat.scrollHeight - chat.clientHeight - chat.scrollTop) > 300) {
                smoothScrollToBottom();
            } else {
                chat.scrollTop = chat.scrollHeight;
                [10, 50, 100, 300, 500].forEach(delay => {
                    setTimeout(() => {
                        if (!userScrolled) chat.scrollTop = chat.scrollHeight;
                    }, delay);
                });
            }
        }

        function fixEmojiSizes(element) {
            element.querySelectorAll('img').forEach(img => {
                img.style.height = '1.2em';
                img.style.width = 'auto';
                img.style.maxHeight = '1.2em';
                img.style.maxWidth = '1.5em';
                img.style.verticalAlign = 'middle';
            });
            element.querySelectorAll('span[role="img"]').forEach(span => {
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

            let icon = msg.platform.toLowerCase() === 'youtube' ?
                '<svg class="icon" width="16" height="16" viewBox="0 0 24 24"><path d="M23.5 6.2c-.2-1-1-1.8-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5c-1.1.3-1.9 1.1-2.1 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8c.2 1 1 1.8 2.1 2.1 1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5c1.1-.3 1.9-1.1 2.1-2.1.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" fill="#FF0000"/></svg>' :
                '<svg class="icon" width="16" height="16" viewBox="0 0 24 24"><path d="M11.6 4.7h1.7v5.1h-1.7v-5.1zm4.7 0H18v5.1h-1.7v-5.1zM6 0L1.7 4.3v15.4h5.1V24l4.3-4.3h3.4L22.3 12V0H6zm14.6 11.1l-3.4 3.4h-3.4l-3 3v-3H6.9V1.7h13.7v9.4z" fill="#9146FF"/></svg>';

            let badgesHtml = '';
            if (msg.badges && msg.badges.length > 0) {
                badgesHtml = '<span class="badges">';
                badgesHtml += msg.badges.map(badge => \`<span class="badge" style="background-image: url('\${badge}')"></span>\`).join('');
                badgesHtml += '</span>';
            }

            let timestampHtml = '';
            if (msg.timestamp) {
                const timestamp = typeof msg.timestamp === 'string' ? msg.timestamp : new Date(msg.timestamp).toLocaleTimeString();
                timestampHtml = \`<span class="timestamp">\${timestamp}</span>\`;
            }

            el.innerHTML = \`\${icon} \${badgesHtml}<span class="name">\${msg.username}</span>: \${timestampHtml}<span class="content">\${msg.content}</span>\`;

            setTimeout(() => fixEmojiSizes(el), 0);

            const observer = new MutationObserver(() => {
                fixEmojiSizes(el);
                if (!userScrolled) scrollDown();
            });

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
</html>`;
}

function generateStreamerViewHTML(settings) {
  // Similar to OBS view but with streamer settings
  const textShadow = settings.streamerView.enableDropShadow ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none';
  const backgroundColor = settings.streamerView.backgroundColor || '#181818';
  const opacity = settings.streamerView.messageOpacity !== undefined ? settings.streamerView.messageOpacity : 0.7;
  const borderRadius = settings.streamerView.messageBorderRadius !== undefined ? settings.streamerView.messageBorderRadius : 4;
  const padding = settings.streamerView.messagePadding !== undefined ? settings.streamerView.messagePadding : 8;
  const showMessageBackground = settings.streamerView.showMessageBackground !== undefined ? settings.streamerView.showMessageBackground : true;

  const backgroundStyle = showMessageBackground
    ? `background: rgba(${parseInt(backgroundColor.slice(1, 3), 16)},
                      ${parseInt(backgroundColor.slice(3, 5), 16)},
                      ${parseInt(backgroundColor.slice(5, 7), 16)},
                      ${opacity});`
    : 'background: transparent;';

  const borderStyles = showMessageBackground
    ? `.yt { border-left: 3px solid #ff0000; } .tw { border-left: 3px solid #9146FF; }`
    : `.yt, .tw { border-left: none; }`;

  return `<!DOCTYPE html>
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
            padding: ${padding}px;
            border-radius: ${borderRadius}px;
            ${backgroundStyle}
            font-size: ${settings.streamerView.fontSize}px;
            color: ${settings.streamerView.textColor};
            cursor: pointer;
            text-shadow: ${textShadow};
            overflow-wrap: break-word;
            word-wrap: break-word;
            word-break: break-word;
        }

        ${borderStyles}

        .yt .name { color: #ff0000; font-weight: bold; font-size: ${parseInt(settings.streamerView.fontSize) + 2}px; }
        .tw .name { color: #9146FF; font-weight: bold; font-size: ${parseInt(settings.streamerView.fontSize) + 2}px; }
        .content { color: ${settings.streamerView.textColor}; font-size: ${settings.streamerView.fontSize}px; display: inline; }
        .content a { color: ${settings.streamerView.textColor} !important; text-decoration: none !important; }
        .content a:hover { text-decoration: underline !important; }

        .icon { display: inline-flex !important; vertical-align: middle !important; width: 16px !important; height: 16px !important; }
        .badge { display: inline-block !important; width: 18px !important; height: 18px !important; margin-right: 4px !important; background-size: contain !important; background-repeat: no-repeat !important; background-position: center !important; vertical-align: middle !important; }
        .badges { display: inline-flex !important; align-items: center !important; margin-right: 6px !important; vertical-align: middle !important; }
        .timestamp { font-size: 0.8em; color: #aaa; margin-left: auto; display: ${settings.streamerView.showTimestamps ? 'inline-block' : 'none'}; }

        .content img, .content span[role="img"], .content .emoji, .content em img, .content em span {
            vertical-align: middle !important; height: 1.2em !important; width: auto !important; max-height: 1.2em !important; max-width: 1.5em !important; margin: 0 0.1em !important; display: inline-flex !important; font-size: inherit !important;
        }

        img.emoji { height: 1.2em !important; width: auto !important; vertical-align: middle !important; }
    </style>
</head>
<body>
    <div id="chat"></div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const chat = document.getElementById('chat');
        let userScrolled = false;
        const socket = io('/');

        socket.on('settings-updated', () => window.location.reload());
        socket.on('chat-message', addMessage);
        socket.on('chat-history', (messages) => {
            chat.innerHTML = '';
            messages.forEach(addMessage);
        });

        chat.onscroll = () => {
            resetActivityTimer();
            const bottom = chat.scrollHeight - chat.clientHeight;
            userScrolled = (bottom - chat.scrollTop) > 30;
        };

        let activityTimer;
        function resetActivityTimer() {
            clearTimeout(activityTimer);
            activityTimer = setTimeout(() => {
                userScrolled = false;
                smoothScrollToBottom();
            }, 5000);
        }

        chat.addEventListener('mousemove', resetActivityTimer);
        chat.addEventListener('keydown', resetActivityTimer);
        chat.addEventListener('click', resetActivityTimer);
        resetActivityTimer();

        function smoothScrollToBottom() {
            const targetPosition = chat.scrollHeight - chat.clientHeight;
            const startPosition = chat.scrollTop;
            const distance = targetPosition - startPosition;
            const duration = 800;
            let startTime = null;

            function animation(currentTime) {
                if (startTime === null) startTime = currentTime;
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3);
                chat.scrollTop = startPosition + distance * ease;
                if (elapsedTime < duration) requestAnimationFrame(animation);
            }
            requestAnimationFrame(animation);
        }

        function scrollDown() {
            if (Math.abs(chat.scrollHeight - chat.clientHeight - chat.scrollTop) > 300) {
                smoothScrollToBottom();
            } else {
                chat.scrollTop = chat.scrollHeight;
                [10, 50, 100, 300, 500].forEach(delay => {
                    setTimeout(() => { if (!userScrolled) chat.scrollTop = chat.scrollHeight; }, delay);
                });
            }
        }

        function fixEmojiSizes(element) {
            element.querySelectorAll('img').forEach(img => {
                img.style.height = '1.2em';
                img.style.width = 'auto';
                img.style.maxHeight = '1.2em';
                img.style.maxWidth = '1.5em';
                img.style.verticalAlign = 'middle';
            });
            element.querySelectorAll('span[role="img"]').forEach(span => {
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

            let icon = msg.platform.toLowerCase() === 'youtube' ?
                '<svg class="icon" width="16" height="16" viewBox="0 0 24 24"><path d="M23.5 6.2c-.2-1-1-1.8-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5c-1.1.3-1.9 1.1-2.1 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8c.2 1 1 1.8 2.1 2.1 1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5c1.1-.3 1.9-1.1 2.1-2.1.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" fill="#FF0000"/></svg>' :
                '<svg class="icon" width="16" height="16" viewBox="0 0 24 24"><path d="M11.6 4.7h1.7v5.1h-1.7v-5.1zm4.7 0H18v5.1h-1.7v-5.1zM6 0L1.7 4.3v15.4h5.1V24l4.3-4.3h3.4L22.3 12V0H6zm14.6 11.1l-3.4 3.4h-3.4l-3 3v-3H6.9V1.7h13.7v9.4z" fill="#9146FF"/></svg>';

            let badgesHtml = '';
            if (msg.badges && msg.badges.length > 0) {
                badgesHtml = '<span class="badges">';
                badgesHtml += msg.badges.map(badge => \`<span class="badge" style="background-image: url('\${badge}')"></span>\`).join('');
                badgesHtml += '</span>';
            }

            let timestampHtml = '';
            if (msg.timestamp) {
                const timestamp = typeof msg.timestamp === 'string' ? msg.timestamp : new Date(msg.timestamp).toLocaleTimeString();
                timestampHtml = \`<span class="timestamp">\${timestamp}</span>\`;
            }

            el.innerHTML = \`\${icon} \${badgesHtml}<span class="name">\${msg.username}</span>: \${timestampHtml}<span class="content">\${msg.content}</span>\`;

            setTimeout(() => fixEmojiSizes(el), 0);

            const observer = new MutationObserver(() => {
                fixEmojiSizes(el);
                if (!userScrolled) scrollDown();
            });

            observer.observe(el, { childList: true, subtree: true, attributes: true });

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
</html>`;
}

function generateHighlightHTML(settings) {
  return `<!DOCTYPE html>
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
            width: fit-content;
            text-align: left;
            align-self: flex-end;
            table-layout: auto;
        }

        .message-row { display: table-row; }
        .message-container { display: table-cell; }

        .youtube .username { color: #ff0000 !important; font-family: 'Inter', sans-serif !important; font-weight: bold !important; font-size: ${settings.fontSize + 4}px !important; }
        .twitch .username { color: #9146FF !important; font-family: 'Inter', sans-serif !important; font-weight: bold !important; font-size: ${settings.fontSize + 4}px !important; }

        .platform-icon { margin-right: 5px; vertical-align: middle; }
        svg.platform-icon { display: inline; vertical-align: middle; }

        .message-content {
            color: ${settings.textColor} !important;
            font-family: 'Inter', sans-serif !important;
            font-size: ${settings.fontSize + 2}px !important;
            line-height: 1.5;
            overflow-wrap: break-word !important;
            word-wrap: break-word !important;
            word-break: break-word !important;
        }

        .message-content a, #highlighted-message .message-content a {
            color: ${settings.textColor} !important;
            text-decoration: none !important;
            pointer-events: none !important;
        }

        .message-content img, .message-content span[role="img"], .message-content .emoji, .message-content em img, .message-content em span {
            vertical-align: middle !important;
            height: 1.2em !important;
            width: auto !important;
            max-height: 1.2em !important;
            max-width: 1.5em !important;
            margin: 0 0.1em !important;
            display: inline-flex !important;
            font-size: inherit !important;
        }

        img.emoji { height: 1.2em !important; width: auto !important; }

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
    <div id="highlighted-message"></div>
    <audio id="highlight-sound" src="/audio/whoosh.mp3" preload="auto"></audio>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const highlightedContainer = document.getElementById('highlighted-message');
        const highlightSound = document.getElementById('highlight-sound');
        const socket = io('/highlight');

        let currentSettings = {
            highlightTimeout: ${settings.highlightTimeout},
            enableSound: ${settings.enableSound},
            soundVolume: ${settings.soundVolume}
        };

        socket.on('settings-updated', (newSettings) => {
            if (newSettings.highlightTimeout !== undefined) currentSettings.highlightTimeout = newSettings.highlightTimeout;
            if (newSettings.enableSound !== undefined) currentSettings.enableSound = newSettings.enableSound;
            if (newSettings.soundVolume !== undefined) {
                currentSettings.soundVolume = newSettings.soundVolume;
                highlightSound.volume = currentSettings.soundVolume;
            }

            if (dismissTimeout) {
                clearTimeout(dismissTimeout);
                dismissTimeout = null;
                if (highlightedContainer.style.display === 'table') setupDismissTimeout();
            }
        });

        let dismissTimeout = null;

        function setupDismissTimeout() {
            if (currentSettings.highlightTimeout > 0) {
                dismissTimeout = setTimeout(() => {
                    socket.emit('clear-highlight');
                }, currentSettings.highlightTimeout);
            }
        }

        socket.on('highlight-message', (message) => {
            if (dismissTimeout) {
                clearTimeout(dismissTimeout);
                dismissTimeout = null;
            }

            if (currentSettings.enableSound) {
                highlightSound.volume = currentSettings.soundVolume;
                highlightSound.play().catch(err => console.error('Error playing sound:', err));
            }

            highlightedContainer.className = message.platform.toLowerCase();

            let iconHtml = message.platform.toLowerCase() === 'youtube' ?
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="platform-icon"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/></svg>' :
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="platform-icon"><path d="M11.571 4.714h1.715v5.143H11.57v-5.143zm4.715 0H18v5.143h-1.714v-5.143zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" fill="#9146FF"/></svg>';

            highlightedContainer.innerHTML = \`
                <div class="message-row">
                    <div class="message-container">
                        \${iconHtml}
                        <span class="username">\${message.username}</span>:
                        <span class="message-content">\${message.content || ''}</span>
                    </div>
                </div>
            \`;

            highlightedContainer.style.animation = 'slideInFromRight 0.5s ease-in-out';
            highlightedContainer.style.display = 'table';

            highlightedContainer.onclick = () => socket.emit('clear-highlight');

            setupDismissTimeout();
        });

        socket.on('clear-highlight', () => {
            if (dismissTimeout) {
                clearTimeout(dismissTimeout);
                dismissTimeout = null;
            }

            highlightedContainer.style.animation = 'slideOutToLeft 0.5s ease-in-out';
            setTimeout(() => {
                highlightedContainer.style.display = 'none';
            }, 500);
        });

        socket.emit('get-settings');
    </script>
</body>
</html>`;
}

// Ensure audio directory exists
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
  console.log('Created audio directory:', audioDir);
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
==========================================================
  Unified Multi-Platform Chat Server
==========================================================

  Main Chat (OBS/Streamer): http://localhost:${PORT}/
  OBS View:                 http://localhost:${PORT}/obs-view
  Streamer View:            http://localhost:${PORT}/streamer-view
  Highlight Messages:       http://localhost:${PORT}/highlight
  Customization Dashboard:  http://localhost:${PORT}/dashboard

  Press [Ctrl+C] to stop
==========================================================
  `);
});

module.exports = server;
