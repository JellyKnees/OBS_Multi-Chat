/**
 * Auto Open YouTube Live Chat
 * 
 * This script automatically detects and opens the most recent YouTube live chat
 * from a configured channel when the server starts.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Path to settings file
const settingsPath = path.join(__dirname, 'settings.json');
const chatSourcesPath = path.join(__dirname, 'chat-sources.json');

/**
 * Open URL in default browser
 * @param {string} url - The URL to open
 */
function openInBrowser(url) {
  console.log(`Opening URL in browser: ${url}`);
  
  // Platform-specific commands to open URL
  let command;
  switch (process.platform) {
    case 'darwin':  // macOS
      command = `open "${url}"`;
      break;
    case 'win32':   // Windows
      command = `start "" "${url}"`;
      break;
    default:        // Linux and others
      command = `xdg-open "${url}"`;
      break;
  }
  
  exec(command, (error) => {
    if (error) {
      console.error(`Error opening browser: ${error.message}`);
    }
  });
}

/**
 * Get YouTube channel ID from settings
 * @returns {string|null} The channel ID or null if not found
 */
function getYouTubeChannelId() {
  try {
    // Try reading from chat-sources.json first
    if (fs.existsSync(chatSourcesPath)) {
      const chatSources = JSON.parse(fs.readFileSync(chatSourcesPath, 'utf8'));
      if (chatSources.youtube && chatSources.youtube.channelId) {
        return chatSources.youtube.channelId;
      }
      
      if (chatSources.youtube && chatSources.youtube.channelUsername) {
        console.log(`Found channel username: ${chatSources.youtube.channelUsername} but no channel ID.`);
        console.log('Will attempt to use video ID if available instead.');
        
        if (chatSources.youtube.videoId) {
          return null; // We'll use the video ID directly
        }
      }
    }
    
    // Try reading from settings.json as backup
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.youtubeChannelId) {
        return settings.youtubeChannelId;
      }
    }
    
    console.log('No YouTube channel ID found in settings.');
    return null;
  } catch (error) {
    console.error(`Error reading settings: ${error.message}`);
    return null;
  }
}

/**
 * Get specific YouTube video ID from settings
 * @returns {string|null} The video ID or null if not found
 */
function getYouTubeVideoId() {
  try {
    if (fs.existsSync(chatSourcesPath)) {
      const chatSources = JSON.parse(fs.readFileSync(chatSourcesPath, 'utf8'));
      if (chatSources.youtube && chatSources.youtube.videoId) {
        return chatSources.youtube.videoId;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error reading settings: ${error.message}`);
    return null;
  }
}

/**
 * Check if YouTube integration is enabled
 * @returns {boolean} True if enabled
 */
function isYouTubeEnabled() {
  try {
    if (fs.existsSync(chatSourcesPath)) {
      const chatSources = JSON.parse(fs.readFileSync(chatSourcesPath, 'utf8'));
      return chatSources.youtube && chatSources.youtube.enabled === true;
    }
    return false;
  } catch (error) {
    console.error(`Error checking if YouTube is enabled: ${error.message}`);
    return false;
  }
}

/**
 * Get the live chat URL for a specific video
 * @param {string} videoId - The YouTube video ID
 * @returns {string} The live chat URL
 */
function getLiveChatUrl(videoId) {
  return `https://www.youtube.com/live_chat?v=${videoId}`;
}

/**
 * Open YouTube live chat automatically
 */
async function autoOpenYouTubeChat() {
  // Check if YouTube integration is enabled
  if (!isYouTubeEnabled()) {
    console.log('YouTube integration is disabled. Skipping auto-open.');
    return;
  }
  
  // First check for a specific video ID
  const videoId = getYouTubeVideoId();
  if (videoId) {
    console.log(`Using specific video ID from settings: ${videoId}`);
    const chatUrl = getLiveChatUrl(videoId);
    openInBrowser(chatUrl);
    return;
  }
  
  // If no specific video ID, try to get channel ID
  const channelId = getYouTubeChannelId();
  if (!channelId) {
    console.log('No channel ID or video ID found. Cannot auto-open YouTube chat.');
    return;
  }
  
  console.log(`Found YouTube channel ID: ${channelId}`);
  console.log('Searching for active livestreams...');
  
  try {
    // Open the channel page which should redirect to any active livestream
    const channelUrl = `https://www.youtube.com/channel/${channelId}/live`;
    console.log(`Opening channel livestream page: ${channelUrl}`);
    
    // First open the channel livestream page
    openInBrowser(channelUrl);
    
    // Then after a short delay, open the live chat in a separate window
    // This gives time for any redirect to happen
    setTimeout(() => {
      console.log('Opening live chat window separately...');
      openInBrowser(`${channelUrl}/live_chat`);
    }, 3000);
    
  } catch (error) {
    console.error(`Error opening YouTube live chat: ${error.message}`);
  }
}

// Export function to be called when server starts
module.exports = { autoOpenYouTubeChat };

// If this script is run directly, execute the auto-open function
if (require.main === module) {
  autoOpenYouTubeChat();
}