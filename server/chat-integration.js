// server/chat-integration.js
const { EventEmitter } = require('events');
const tmi = require('tmi.js'); // For Twitch chat
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ChatIntegration extends EventEmitter {
  constructor() {
    super();
    this.sources = {
      twitch: {
        enabled: false,
        client: null,
        channelName: '',
        connected: false,
        lastError: ''
      },
      youtube: {
        enabled: false,
        channelId: '',
        videoId: '',
        apiKey: '',
        liveChatId: '',
        connected: false,
        lastError: '',
        pollingInterval: null,
        nextPageToken: null
      }
    };
    
    this.configFile = path.join(__dirname, 'chat-sources.json');
    this.loadConfig();
  }
  
  // Load configuration from file
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        
        // Update Twitch config
        if (config.twitch) {
          this.sources.twitch.enabled = config.twitch.enabled || false;
          this.sources.twitch.channelName = config.twitch.channelName || '';
        }
        
        // Update YouTube config
        if (config.youtube) {
          this.sources.youtube.enabled = config.youtube.enabled || false;
          this.sources.youtube.channelId = config.youtube.channelId || '';
          this.sources.youtube.videoId = config.youtube.videoId || '';
          this.sources.youtube.apiKey = config.youtube.apiKey || '';
        }
        
        console.log('Chat sources configuration loaded');
      } else {
        console.log('No chat sources configuration file found, using defaults');
        this.saveConfig();
      }
    } catch (error) {
      console.error('Error loading chat sources configuration:', error);
    }
  }
  
  // Save configuration to file
  saveConfig() {
    try {
      // Create a sanitized config (without clients/connections)
      const config = {
        twitch: {
          enabled: this.sources.twitch.enabled,
          channelName: this.sources.twitch.channelName
        },
        youtube: {
          enabled: this.sources.youtube.enabled,
          channelId: this.sources.youtube.channelId,
          videoId: this.sources.youtube.videoId,
          apiKey: this.sources.youtube.apiKey
        }
      };
      
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      console.log('Chat sources configuration saved');
    } catch (error) {
      console.error('Error saving chat sources configuration:', error);
    }
  }
  
  // Get current status of all chat sources
  getStatus() {
    return {
      twitch: {
        enabled: this.sources.twitch.enabled,
        channelName: this.sources.twitch.channelName,
        connected: this.sources.twitch.connected,
        lastError: this.sources.twitch.lastError
      },
      youtube: {
        enabled: this.sources.youtube.enabled,
        channelId: this.sources.youtube.channelId,
        videoId: this.sources.youtube.videoId,
        connected: this.sources.youtube.connected,
        lastError: this.sources.youtube.lastError
      }
    };
  }
  
  // Update configuration
  updateConfig(config) {
    // Update YouTube config
    if (config.youtube) {
      const youtubeChanged = 
        this.sources.youtube.enabled !== config.youtube.enabled ||
        config.youtube.url !== undefined || // URL changed
        this.sources.youtube.apiKey !== config.youtube.apiKey;
      
      this.sources.youtube.enabled = config.youtube.enabled;
      
      // Process YouTube URL if provided, with proper resetting of previous values
      if (config.youtube.url) {
        // Reset all previous IDs whenever a new URL is provided
        this.sources.youtube.channelId = null;
        this.sources.youtube.videoId = null;
        this.sources.youtube.channelUsername = null;
        this.sources.youtube.liveChatId = null;
        
        // Process the new URL
        this.processYouTubeUrl(config.youtube.url);
      }
      
      // Update API key if provided
      if (config.youtube.apiKey) {
        this.sources.youtube.apiKey = config.youtube.apiKey;
      }
      
      // Reconnect if needed
      if (youtubeChanged) {
        if (this.sources.youtube.enabled && 
            this.sources.youtube.apiKey) {
          this.connectYouTube();
        } else {
          this.disconnectYouTube();
        }
      }
    }
    
    // Update Twitch config (keep existing code for Twitch)
    if (config.twitch) {
      const twitchChanged = 
        this.sources.twitch.enabled !== config.twitch.enabled ||
        this.sources.twitch.channelName !== config.twitch.channelName;
      
      this.sources.twitch.enabled = config.twitch.enabled;
      this.sources.twitch.channelName = config.twitch.channelName;
      
      // Reconnect if needed
      if (twitchChanged) {
        if (this.sources.twitch.enabled && this.sources.twitch.channelName) {
          this.connectTwitch();
        } else {
          this.disconnectTwitch();
        }
      }
    }
    
    // Save the updated configuration
    this.saveConfig();
    
    // Return current status
    return this.getStatus();
  }

  // Add this new method here
  getTwitchBadgeId(type, version) {
    // Common badge IDs mapping
    const badgeIds = {
      'broadcaster': '5527c58c-fb7d-422d-b71b-f309dcb85cc1',
      'moderator': '3267646d-33f0-4b17-b3df-f923a41db1d0',
      'vip': 'b817aba4-fad8-49e2-b88a-7cc744dfa6ec',
      'subscriber': '5d9f2208-5dd8-11e7-8513-2ff4adfae661',
      'premium': 'premium/1',
      'partner': '29f0e68e-2010-407a-a80a-5bc656928936',
      'glhf-pledge': '3158e758-3cb4-43c5-94b3-7639810451c5',
      'bits': 'bits',
      'bits-leader': 'bits-leader',
      'turbo': '6c549a3e-18a3-488b-b753-5728b6ed9b1d'
    };
    
    // Return the mapped ID if available, or fall back to a generic format
    return badgeIds[type] || `${type}/${version}`;
  }
  
  // Also enhance the processYouTubeUrl function to handle @username URLs better
  processYouTubeUrl(url) {
    try {
      console.log(`Processing YouTube URL: ${url}`);
      
      // Check if it's a live chat popup URL
      const liveChatMatch = url.match(/youtube\.com\/live_chat.*[?&]v=([^&]+)/);
      if (liveChatMatch && liveChatMatch[1]) {
        this.sources.youtube.videoId = liveChatMatch[1];
        console.log(`Extracted YouTube video ID from live chat URL: ${this.sources.youtube.videoId}`);
        return;
      }
      
      // Check if it's a video URL
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?]+)/);
      if (videoIdMatch && videoIdMatch[1]) {
        this.sources.youtube.videoId = videoIdMatch[1];
        console.log(`Extracted YouTube video ID: ${this.sources.youtube.videoId}`);
        return;
      }
      
      // Check if it's a custom channel URL (@username format)
      const atUsernameMatch = url.match(/(?:youtube\.com\/@)([^\/\?]+)/);
      if (atUsernameMatch && atUsernameMatch[1]) {
        this.sources.youtube.channelUsername = atUsernameMatch[1];
        console.log(`Found YouTube @username: ${this.sources.youtube.channelUsername}`);
        return;
      }
      
      // Check if it's a standard channel URL
      const channelIdMatch = url.match(/(?:youtube\.com\/channel\/)([^\/\?]+)/);
      if (channelIdMatch && channelIdMatch[1]) {
        this.sources.youtube.channelId = channelIdMatch[1];
        console.log(`Extracted YouTube channel ID: ${this.sources.youtube.channelId}`);
        return;
      }
      
      // Check if it's a user URL (c/ or user/ format)
      const usernameMatch = url.match(/(?:youtube\.com\/)(?:c\/|user\/)([^\/\?]+)/);
      if (usernameMatch && usernameMatch[1]) {
        this.sources.youtube.channelUsername = usernameMatch[1];
        console.log(`Found YouTube username: ${this.sources.youtube.channelUsername}`);
        return;
      }
      
      console.log(`Unable to extract YouTube video or channel ID from URL: ${url}`);
    } catch (error) {
      console.error(`Error processing YouTube URL: ${error.message}`);
    }
  }
  
  // Connect to Twitch chat
  connectTwitch() {
    // Disconnect existing client if any
    this.disconnectTwitch();
    
    if (!this.sources.twitch.enabled || !this.sources.twitch.channelName) {
      this.sources.twitch.lastError = 'Channel name is required';
      this.emit('status-updated', this.getStatus());
      return;
    }
    
    try {
      // Get current time to filter out historical messages
      this.sources.twitch.connectionTimestamp = new Date();
      console.log(`Twitch connection established at: ${this.sources.twitch.connectionTimestamp.toISOString()}`);
      
      // Create a new TMI client
      this.sources.twitch.client = new tmi.Client({
        options: { debug: false },
        connection: {
          reconnect: true,
          secure: true
        },
        channels: [this.sources.twitch.channelName]
      });
      
      // Connect to Twitch
      this.sources.twitch.client.connect()
        .then(() => {
          console.log(`Connected to Twitch channel: ${this.sources.twitch.channelName}`);
          this.sources.twitch.connected = true;
          this.sources.twitch.lastError = '';
          this.emit('status-updated', this.getStatus());
        })
        .catch(error => {
          console.error(`Error connecting to Twitch: ${error.message}`);
          this.sources.twitch.connected = false;
          this.sources.twitch.lastError = error.message;
          this.emit('status-updated', this.getStatus());
        });
      
      // Listen for Twitch chat messages - improved badge handling
this.sources.twitch.client.on('message', (channel, tags, message, self) => {
    // Skip messages from the bot itself
    if (self) return;
    
    // Check if the message is from before our connection time
    const messageTimestamp = new Date(parseInt(tags['tmi-sent-ts']));
    if (messageTimestamp < this.sources.twitch.connectionTimestamp) {
      console.log(`Skipping historical Twitch message from ${tags['display-name']}`);
      return;
    }
    
    // Extract badge information - improved to handle more badge types
    const badges = [];
if (tags.badges) {
  for (const [type, version] of Object.entries(tags.badges)) {
    // Use a more direct approach with known badge URLs
    if (type === 'broadcaster') {
      badges.push('https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3');
    } else if (type === 'moderator') {
      badges.push('https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3');
    } else if (type === 'subscriber') {
      badges.push('https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/3');
    } else if (type === 'premium') {
      badges.push('https://static-cdn.jtvnw.net/badges/v1/1711e5d4-5d4d-458e-b6b8-e2a895729d37/3');
    } else if (type === 'vip') {
      badges.push('https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3');
    } else {
      // For other badges, log them to help debug
      console.log(`Unknown badge type: ${type}, version: ${version}`);
      // Use a fallback approach
      badges.push(`https://static-cdn.jtvnw.net/badges/v1/${type}/3`);
    }
  }
}
    
    // Create standardized message object
    const chatMessage = {
      platform: 'twitch',
      username: tags['display-name'] || tags.username,
      content: message,
      color: tags.color || this.getColorFromUsername(tags.username),
      badges: badges,
      timestamp: messageTimestamp.toISOString(),
      id: `twitch-${tags.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Emit message event
    console.log(`Processing Twitch message from ${chatMessage.username} with ${badges.length} badges`);
    this.emit('chat-message', chatMessage);
  });
      
      // Listen for disconnection
      this.sources.twitch.client.on('disconnected', (reason) => {
        console.log(`Disconnected from Twitch: ${reason}`);
        this.sources.twitch.connected = false;
        this.sources.twitch.lastError = reason;
        this.emit('status-updated', this.getStatus());
      });
    } catch (error) {
      console.error(`Error initializing Twitch client: ${error.message}`);
      this.sources.twitch.connected = false;
      this.sources.twitch.lastError = error.message;
      this.emit('status-updated', this.getStatus());
    }
  }
  
  // Disconnect from Twitch chat
  disconnectTwitch() {
    if (this.sources.twitch.client) {
      try {
        this.sources.twitch.client.disconnect();
      } catch (error) {
        console.error(`Error disconnecting from Twitch: ${error.message}`);
      }
      this.sources.twitch.client = null;
    }
    
    this.sources.twitch.connected = false;
    this.emit('status-updated', this.getStatus());
  }
  
  // Connect to YouTube Live Chat with enhanced channel handling
async connectYouTube() {
    // Disconnect existing connection if any
    this.disconnectYouTube();
    
    if (!this.sources.youtube.enabled || !this.sources.youtube.apiKey) {
      this.sources.youtube.lastError = 'API key is required';
      this.emit('status-updated', this.getStatus());
      return;
    }
    
    try {
      // If we have a username but no channel ID, resolve it first
      if (this.sources.youtube.channelUsername && !this.sources.youtube.channelId) {
        await this.resolveChannelId();
      }
      
      // If we have a channel ID but no video ID, find the active livestream
      if (this.sources.youtube.channelId && !this.sources.youtube.videoId) {
        await this.findActiveLiveStream();
      }
      
      // If we have a video ID, get the live chat ID
      if (this.sources.youtube.videoId) {
        await this.getLiveChatId();
      } else {
        this.sources.youtube.lastError = 'No video ID found and no active livestream detected';
        this.sources.youtube.connected = false;
        this.emit('status-updated', this.getStatus());
        return;
      }
      
      // Start polling for chat messages if we have a live chat ID
      if (this.sources.youtube.liveChatId) {
        this.startYouTubeChatPolling();
      } else {
        this.sources.youtube.lastError = 'No active live chat found';
        this.sources.youtube.connected = false;
        this.emit('status-updated', this.getStatus());
      }
    } catch (error) {
      console.error(`Error connecting to YouTube: ${error.message}`);
      this.sources.youtube.connected = false;
      this.sources.youtube.lastError = error.message;
      this.emit('status-updated', this.getStatus());
    }
  }

  // Resolve a channel username to a channel ID
  async resolveChannelId() {
    try {
      console.log(`Resolving channel username: ${this.sources.youtube.channelUsername}`);
      
      // For modern @username format, use a search query
      if (this.sources.youtube.channelUsername) {
        // Using search to find the channel
        console.log(`Searching for channel with username: ${this.sources.youtube.channelUsername}`);
        
        const searchQuery = this.sources.youtube.channelUsername.startsWith('@') ? 
          this.sources.youtube.channelUsername : 
          `@${this.sources.youtube.channelUsername}`;
        
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(searchQuery)}&maxResults=1&key=${this.sources.youtube.apiKey}`;
        console.log(`Making API request to: ${searchUrl}`);
        
        const response = await axios.get(searchUrl);
        console.log(`Got search response with ${response.data.items?.length || 0} items`);
        
        if (response.data.items && response.data.items.length > 0) {
          // Extract channel ID from search results
          this.sources.youtube.channelId = response.data.items[0].snippet.channelId;
          console.log(`Found channel ID from search: ${this.sources.youtube.channelId}`);
          return true;
        }
        
        console.error('No channels found in search results');
      }
      
      console.log('Could not resolve channel username to ID');
      this.sources.youtube.lastError = 'Could not resolve channel username to ID';
      return false;
    } catch (error) {
      console.error(`Error resolving channel ID: ${error.message}`);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Data: ${JSON.stringify(error.response.data)}`);
      }
      this.sources.youtube.lastError = `Error resolving channel ID: ${error.message}`;
      throw error;
    }
  }
  
  // Improved active live stream finder function
async findActiveLiveStream() {
    try {
      console.log(`Finding active livestreams for channel ID: ${this.sources.youtube.channelId}`);
      
      // Use search endpoint with type=video, eventType=live filter
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId=${this.sources.youtube.channelId}&eventType=live&type=video&maxResults=1&key=${this.sources.youtube.apiKey}`;
      console.log(`Making API request to: ${searchUrl}`);
      
      const response = await axios.get(searchUrl);
      console.log(`Got search response with ${response.data.items?.length || 0} items`);
      
      if (response.data.items && response.data.items.length > 0) {
        this.sources.youtube.videoId = response.data.items[0].id.videoId;
        console.log(`Found active YouTube live stream: ${this.sources.youtube.videoId}`);
        return true;
      }
      
      console.log('No active live stream found for the provided channel');
      this.sources.youtube.lastError = 'No active live stream found for this channel';
      return false;
    } catch (error) {
      console.error(`Error finding active YouTube live stream: ${error.message}`);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Data: ${JSON.stringify(error.response.data)}`);
      }
      this.sources.youtube.lastError = `Error finding live stream: ${error.message}`;
      throw error;
    }
  }
  
  // Get live chat ID for a YouTube video
  async getLiveChatId() {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${this.sources.youtube.videoId}&key=${this.sources.youtube.apiKey}`
      );
      
      if (response.data.items && response.data.items.length > 0) {
        const video = response.data.items[0];
        if (video.liveStreamingDetails && video.liveStreamingDetails.activeLiveChatId) {
          this.sources.youtube.liveChatId = video.liveStreamingDetails.activeLiveChatId;
          console.log(`Found YouTube live chat ID: ${this.sources.youtube.liveChatId}`);
          return true;
        }
      }
      
      console.log('No active live chat found for the provided video ID');
      return false;
    } catch (error) {
      console.error(`Error getting YouTube live chat ID: ${error.message}`);
      throw error;
    }
  }
  
  // Find active live stream for a YouTube channel
  async findActiveLiveStream() {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${this.sources.youtube.channelId}&eventType=live&type=video&key=${this.sources.youtube.apiKey}`
      );
      
      if (response.data.items && response.data.items.length > 0) {
        this.sources.youtube.videoId = response.data.items[0].id.videoId;
        console.log(`Found active YouTube live stream: ${this.sources.youtube.videoId}`);
        
        // Now get the live chat ID
        return await this.getLiveChatId();
      }
      
      console.log('No active live stream found for the provided channel');
      return false;
    } catch (error) {
      console.error(`Error finding active YouTube live stream: ${error.message}`);
      throw error;
    }
  }
  
  // Start polling for YouTube chat messages
  // For YouTube, modify the startYouTubeChatPolling function
startYouTubeChatPolling() {
    // Clear existing polling interval
    if (this.sources.youtube.pollingInterval) {
      clearInterval(this.sources.youtube.pollingInterval);
    }
    
    // Get the current time to filter out historical messages
    this.sources.youtube.connectionTimestamp = new Date().toISOString();
    console.log(`YouTube connection established at: ${this.sources.youtube.connectionTimestamp}`);
    
    // Reset next page token - important to only receive the most recent messages
    this.sources.youtube.nextPageToken = null;
    
    // Mark as connected
    this.sources.youtube.connected = true;
    this.sources.youtube.lastError = '';
    this.emit('status-updated', this.getStatus());
    
    // Function to poll for chat messages
    const pollChatMessages = async () => {
      try {
        // Construct the URL with or without page token
        let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet,authorDetails&liveChatId=${this.sources.youtube.liveChatId}&key=${this.sources.youtube.apiKey}`;
        
        if (this.sources.youtube.nextPageToken) {
          url += `&pageToken=${this.sources.youtube.nextPageToken}`;
        }
        
        const response = await axios.get(url);
        
        // Update next page token
        this.sources.youtube.nextPageToken = response.data.nextPageToken;
        
        // Process chat messages
        if (response.data.items && response.data.items.length > 0) {
          response.data.items.forEach(item => {
            // Skip deleted messages
            if (item.snippet.hasOwnProperty('isDeleted') && item.snippet.isDeleted) {
              return;
            }
            
            // Skip historical messages (before our connection time)
            const messageTimestamp = new Date(item.snippet.publishedAt).toISOString();
            if (messageTimestamp < this.sources.youtube.connectionTimestamp) {
              console.log(`Skipping historical message from ${item.authorDetails.displayName}`);
              return;
            }
            
            // Create standardized message object
            const chatMessage = {
              platform: 'youtube',
              username: item.authorDetails.displayName,
              content: item.snippet.displayMessage,
              color: this.getColorFromUsername(item.authorDetails.displayName),
              badges: [],
              timestamp: messageTimestamp,
              id: `youtube-${item.id}-${Math.random().toString(36).substr(2, 9)}`
            };
            
            // Add badges based on user roles
            if (item.authorDetails.isChatOwner) {
              chatMessage.badges.push('https://www.gstatic.com/youtube/img/creator_badges/owner.png');
            }
            if (item.authorDetails.isChatModerator) {
              chatMessage.badges.push('https://www.gstatic.com/youtube/img/creator_badges/moderator.png');
            }
            if (item.authorDetails.isChatSponsor) {
              chatMessage.badges.push('https://www.gstatic.com/youtube/img/creator_badges/sponsor.png');
            }
            
            // Emit message event
            console.log(`Processing YouTube message from ${chatMessage.username}`);
            this.emit('chat-message', chatMessage);
          });
        }
      } catch (error) {
        console.error(`Error polling YouTube chat: ${error.message}`);
        this.sources.youtube.connected = false;
        this.sources.youtube.lastError = error.message;
        this.emit('status-updated', this.getStatus());
        
        // Clear the polling interval if there's an error
        clearInterval(this.sources.youtube.pollingInterval);
        this.sources.youtube.pollingInterval = null;
      }
    };
    
    // Initial poll after a short delay (give time for connection setup)
    setTimeout(pollChatMessages, 1000);
    
    // Set up interval polling (adjust the interval as needed)
    this.sources.youtube.pollingInterval = setInterval(pollChatMessages, 5000);
  }
  
  // Disconnect from YouTube Live Chat
  disconnectYouTube() {
    if (this.sources.youtube.pollingInterval) {
      clearInterval(this.sources.youtube.pollingInterval);
      this.sources.youtube.pollingInterval = null;
    }
    
    this.sources.youtube.connected = false;
    this.sources.youtube.liveChatId = '';
    this.sources.youtube.nextPageToken = null;
    this.emit('status-updated', this.getStatus());
  }
  
  // Generate consistent color based on username
  getColorFromUsername(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#FF0000', // Red
      '#0000FF', // Blue
      '#00FF00', // Green
      '#FFFF00', // Yellow
      '#FF00FF', // Magenta
      '#00FFFF', // Cyan
      '#FF7F00', // Orange
      '#7F00FF', // Purple
      '#007FFF', // Sky Blue
      '#FF007F', // Pink
      '#7FFF00', // Lime
      '#00FF7F'  // Spring Green
    ];
    
    return colors[Math.abs(hash) % colors.length];
  }
  
  // Connect to all enabled chat sources
  connectAll() {
    if (this.sources.twitch.enabled && this.sources.twitch.channelName) {
      this.connectTwitch();
    }
    
    if (this.sources.youtube.enabled && this.sources.youtube.apiKey &&
        (this.sources.youtube.videoId || this.sources.youtube.channelId)) {
      this.connectYouTube();
    }
  }
  
  // Disconnect from all chat sources
  disconnectAll() {
    this.disconnectTwitch();
    this.disconnectYouTube();
  }
}

module.exports = ChatIntegration;