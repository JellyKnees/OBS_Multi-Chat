# Railway Deployment Guide

This guide explains how to deploy your OBS Multi-Platform Chat Overlay to Railway.

## Changes Made for Railway

The project has been updated to run on a **single port** with different URL paths:

### Local Development (localhost)
- Main Chat (OBS/Streamer): `http://localhost:3000/`
- OBS View: `http://localhost:3000/obs-view`
- Streamer View: `http://localhost:3000/streamer-view`
- Highlight Messages: `http://localhost:3000/highlight`
- Customization Dashboard: `http://localhost:3000/dashboard`

### Railway Deployment
Once deployed, replace `localhost:3000` with your Railway URL (e.g., `https://your-app.up.railway.app`):
- Main Chat: `https://your-app.up.railway.app/`
- OBS View: `https://your-app.up.railway.app/obs-view`
- Streamer View: `https://your-app.up.railway.app/streamer-view`
- Highlight Messages: `https://your-app.up.railway.app/highlight`
- Customization Dashboard: `https://your-app.up.railway.app/dashboard`

## Setup Steps

### 1. Add Environment Variables in Railway

Go to your Railway project's **Variables** tab and add these:

```
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_ACCESS_TOKEN=your_access_token
TWITCH_REFRESH_TOKEN=your_refresh_token
```

*(Optional)* If you want to use YouTube Data API:
```
YOUTUBE_API_KEY=your_youtube_api_key
```

**Note**: Railway automatically provides the `PORT` variable, so you don't need to set it.

### 2. Verify Start Command

Railway should auto-detect the start command from `package.json`. Verify it's set to:
```
npm start
```

This runs `server/unified-server.js` which combines all three servers on one port.

### 3. Deploy

Railway will automatically deploy when you push to your connected GitHub repository.

### 4. Update Browser Extension (Important!)

After deployment, you need to update your browser extension to point to your Railway URL:

1. Open `extension/manifest.json`
2. Add your Railway URL to `host_permissions`:
   ```json
   "host_permissions": [
     "https://www.youtube.com/*",
     "https://*.youtube.com/*",
     "https://www.twitch.tv/*",
     "https://your-app.up.railway.app/*"
   ]
   ```

3. Find where the extension connects to the server (likely in `extension/background.js` or `extension/content.js`)
4. Update the hardcoded `localhost:3000` URL to your Railway URL

5. Reload the extension in Chrome:
   - Go to `chrome://extensions/`
   - Click "Reload" on your extension

### 5. Add to OBS

Add these URLs as Browser Sources in OBS:

1. **Main Chat Overlay** (for stream):
   - URL: `https://your-app.up.railway.app/obs-view`
   - Width: 500, Height: 1064 (or your preference)

2. **Highlighted Messages**:
   - URL: `https://your-app.up.railway.app/highlight`
   - Width: 800, Height: 200 (or your preference)

3. **Streamer View** (for your monitor):
   - Open in browser: `https://your-app.up.railway.app/streamer-view`

4. **Dashboard** (for customization):
   - Open in browser: `https://your-app.up.railway.app/dashboard`

## Testing Locally

Before deploying, test the unified server locally:

```bash
npm start
```

Then visit:
- http://localhost:3000/obs-view
- http://localhost:3000/highlight
- http://localhost:3000/dashboard

## Troubleshooting

### Extension Not Connecting
- Make sure you updated the extension's server URL
- Check the extension console for errors (right-click extension icon → Inspect)
- Verify your Railway app is running (check Railway dashboard)

### Twitch Chat Not Working
- Verify your Twitch API credentials are correct in Railway variables
- Check Railway logs for token refresh errors

### Settings Not Saving
- Railway uses ephemeral filesystem - settings are stored in memory
- Consider adding a database (PostgreSQL) for persistent settings in the future

## Optional: Add PostgreSQL

For persistent settings storage:

1. Add PostgreSQL database in Railway
2. Update `unified-server.js` to use database instead of JSON files
3. Store messages and settings in database tables

## Switching Back to Multi-Port Setup

If you need to run locally with the old 3-port setup:

```bash
npm run start:old
```

This runs the original `start-servers.js` file.
