# Implementation Details

This document provides technical details about how the Multi-Platform Chat Overlay system works.

## Architecture Overview

The system consists of the following components:

1. **Browser Extension**: Captures chat messages from YouTube and Twitch
2. **Main Server (port 3000)**: Serves the main chat overlay and handles chat message broadcasting
3. **Highlight Server (port 3001)**: Handles highlighted messages display as a separate standalone server
4. **Customization Dashboard (port 3002)**: Provides a UI for customizing the appearance and behavior

### Communication Flow

```
[Browser Extension] → [Main Server] → [Highlight Server]
                      ↑             ↓
                      └─ [Customization Dashboard] ─┘
```

- The browser extension captures chat messages and sends them to the main server
- The main server broadcasts messages to all connected chat overlay clients
- When a user clicks on a message, the main server forwards it to the highlight server
- The customization dashboard updates settings on both the main and highlight servers

## Key Components

### Server Components

1. **server.js**: Main server for chat overlay
   - Handles WebSocket connections for chat messages
   - Routes highlighted messages to the highlight server
   - Applies settings from customization dashboard

2. **highlight-server.js**: Standalone server for highlighted messages
   - Serves HTML for highlighted message display
   - Manages highlight animations and timeouts
   - Applies settings from customization dashboard

3. **customization-server.js**: Server for customization dashboard
   - Serves the customization UI
   - Manages settings storage and retrieval
   - Broadcasts setting changes to main and highlight servers

4. **start-servers.js**: Utility to start all servers
   - Launches all three servers with a single command
   - Provides console output with color coding
   - Handles graceful shutdown

### Client Components

1. **Main Chat Overlay**: Displays all chat messages
   - Styles messages based on platform (YouTube/Twitch)
   - Supports customizable appearance through settings
   - Allows clicking to highlight messages

2. **Highlight Display**: Shows highlighted messages
   - Animated entrance and exit
   - Auto-dismissal based on timeout setting
   - Click to dismiss manually

3. **Customization Dashboard**: UI for settings
   - Live preview of chat appearance
   - Sync settings across all components
   - Save/restore settings functionality

## Settings Management

The system uses a shared settings file (`server/settings.json`) to maintain consistent settings across all components. The settings include:

1. **Visual Customization**:
   - `fontSize`: Size of text in chat messages
   - `textColor`: Color of chat message text
   - `chatWidth`: Width of chat container
   - `chatHeight`: Height of chat container

2. **Functional Customization**:
   - `messageLimit`: Maximum number of messages to display/store
   - `highlightTimeout`: Time in milliseconds before auto-dismissing highlighted messages

When settings are updated in the dashboard:
1. They are saved to the `settings.json` file
2. Changes are broadcast to all connected components via WebSockets
3. Components apply the new settings in real-time

## WebSocket Events

The system uses the following Socket.IO events for communication:

- `chat-message`: New chat message from extension to main server
- `chat-history`: Bulk message history from server to client
- `highlight-message`: Message to highlight from main server to highlight server
- `clear-highlight`: Signal to clear the highlighted message
- `settings`: Initial settings from server to client
- `settings-updated`: Changed settings broadcast to all clients
- `update-settings`: Settings update from dashboard to server

## File Structure

```
/
├── server/
│   ├── server.js                  # Main chat server
│   ├── highlight-server.js        # Highlighted messages server
│   ├── customization-server.js    # Customization dashboard server
│   └── settings.json              # Shared settings file
├── overlay/
│   ├── index.html                 # Main chat overlay HTML
│   ├── app.js                     # Main chat overlay JavaScript
│   └── style.css                  # Main chat overlay styles
├── customization/
│   ├── dashboard.html             # Customization dashboard HTML
│   └── dashboard.js               # Customization dashboard JavaScript
├── extension/
│   ├── manifest.json              # Browser extension manifest
│   ├── background.js              # Extension background script
│   ├── content.js                 # Extension content script
│   ├── popup.html                 # Extension popup HTML
│   └── popup.js                   # Extension popup JavaScript
├── start-servers.js               # Server starter utility
├── setup-directories.js           # Directory setup utility
├── package.json                   # Project dependencies
└── README.md                      # Installation and usage instructions
```

## Extension Details

The browser extension works by:
1. Injecting a content script into YouTube and Twitch chat pages
2. Using DOM manipulation to extract chat messages
3. Establishing a WebSocket connection to the main server
4. Transmitting extracted messages in real-time

The extension supports:
- User badges and emotes
- Platform-specific styling
- Connection status monitoring
- Message buffering during disconnections

## Customization Integration

The customization settings flow through the system as follows:

1. User changes settings in the dashboard UI
2. Settings are saved to `settings.json` on the server
3. The customization server broadcasts the changes via WebSockets
4. Both main and highlight servers apply the changes to their HTML templates
5. Connected clients receive the updated settings and apply them via CSS and JavaScript

## Performance Considerations

- The system limits the number of messages stored and displayed to prevent memory issues
- WebSocket connections are used for real-time updates with minimal overhead
- CSS animations are hardware-accelerated where possible
- The highlight server operates independently to avoid affecting main chat performance