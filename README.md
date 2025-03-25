# Multi-Platform Chat Overlay for OBS

A customizable chat overlay system that combines YouTube and Twitch chat messages into a single display for OBS Studio. It also supports highlighting individual messages on stream with animation effects.

## Features

- Display chat messages from both YouTube and Twitch in a single overlay
- Highlight specific chat messages separately with animation effects
- Customizable appearance and behavior through a dedicated dashboard
- Browser extension that captures chat messages from YouTube and Twitch
- Compatible with OBS Studio as a Browser Source

## System Requirements

- Node.js 14.x or higher
- Chrome/Chromium-based browser for the extension
- OBS Studio 27.x or higher

## Installation

1. Clone this repository to your local machine:
```
git clone https://github.com/yourusername/multi-platform-chat-overlay.git
cd multi-platform-chat-overlay
```

2. Install the required Node.js dependencies:
```
npm install
```

3. Install the browser extension:
   - Open Chrome or a Chromium-based browser (Edge, Opera, Brave, etc.)
   - Go to `chrome://extensions/`
   - Enable "Developer mode" in the top-right corner
   - Click "Load unpacked" and select the `extension` folder from this repository

4. Start the server:
```
node server/server.js
```

5. In a separate terminal, start the customization server:
```
node server/customization-server.js
```

## Usage

### Setting Up OBS

1. In OBS Studio, add two Browser Sources:
   - **Main Chat Overlay**: Set URL to `http://localhost:3000`
   - **Highlighted Messages**: Set URL to `http://localhost:3001`

2. Configure each Browser Source:
   - Set width and height according to your stream layout
   - Enable "Control audio via OBS" if you don't want sound effects
   - Check "Refresh browser when scene becomes active"

### Customizing the Overlay

1. Open your web browser and navigate to `http://localhost:3002`
2. Use the dashboard to customize:
   - **Font Size**: Adjust text size for better readability
   - **Text Color**: Change the color of chat message text
   - **Chat Container Dimensions**: Adjust width and height
   - **Message Limit**: Control how many messages are displayed at once
   - **Highlight Timeout**: Set how long highlighted messages remain visible

3. Click "Save Settings" to apply your changes across all components

### Connecting to Chat

1. Open the chat pages you want to capture:
   - YouTube: Open a YouTube livestream chat in a separate tab
   - Twitch: Open a Twitch channel chat in a separate tab

2. The extension icon should indicate it's connected and capturing chat messages

3. Click on any chat message in the overlay to highlight it on stream

## Server Ports

- **3000**: Main chat overlay
- **3001**: Highlighted messages
- **3002**: Customization dashboard

## Troubleshooting

### Chat Not Appearing

- Ensure the browser extension is installed and enabled
- Check that you have the chat pages open in separate tabs
- Verify the extension popup shows "Connected" status
- Check that the server is running without errors

### Customization Not Working

- Make sure the customization server is running (`node server/customization-server.js`)
- Try refreshing the browser sources in OBS
- Check browser console for any JavaScript errors

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License. See the LICENSE file for details.