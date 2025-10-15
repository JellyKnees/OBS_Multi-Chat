const { EventEmitter } = require('events');
const tmi = require('tmi.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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
  
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        
        if (config.twitch) {
          this.sources.twitch.enabled = config.twitch.enabled || false;
          this.sources.twitch.channelName = config.twitch.channelName || '';
        }
        
        if (config.youtube) {
          this.sources.youtube.enabled = config.youtube.enabled || false;
          this.sources.youtube.channelId = config.youtube.channelId || '';
          this.sources.youtube.videoId = config.youtube.videoId || '';
          this.sources.youtube.channelUsername = config.youtube.channelUsername || '';
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
  
  saveConfig() {
    try {
      // Only save non-sensitive configuration data
      const config = {
        twitch: {
          enabled: this.sources.twitch.enabled,
          channelName: this.sources.twitch.channelName
        },
        youtube: {
          enabled: this.sources.youtube.enabled,
          channelId: this.sources.youtube.channelId,
          videoId: this.sources.youtube.videoId,
          channelUsername: this.sources.youtube.channelUsername
        }
      };
      
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      console.log('Chat sources configuration saved');
    } catch (error) {
      console.error('Error saving chat sources configuration:', error);
    }
  }
  
  getStatus() {
    return {
      twitch: {
        enabled: this.sources.twitch.enabled,
        channelName: this.sources.twitch.channelName,
        connected: this.sources.twitch.connected,
        lastError: this.sources.twitch.lastError,
        connectionSource: this.sources.twitch.connectionSource || 'api'
      },
      youtube: {
        enabled: this.sources.youtube.enabled,
        channelId: this.sources.youtube.channelId,
        videoId: this.sources.youtube.videoId,
        connected: this.sources.youtube.connected,
        lastError: this.sources.youtube.lastError,
        connectionSource: this.sources.youtube.connectionSource || 'extension',
        apiKeyConfigured: !!process.env.YOUTUBE_API_KEY
      }
    };
  }
  
  updateConfig(config) {
    // Update YouTube config
    if (config.youtube) {
      const youtubeEnabled = config.youtube.enabled !== undefined ? 
        config.youtube.enabled : this.sources.youtube.enabled;
        
      const youtubeChanged = 
        this.sources.youtube.enabled !== youtubeEnabled ||
        config.youtube.url !== undefined;
      
      this.sources.youtube.enabled = youtubeEnabled;
      
      // Process YouTube URL if provided (for UI display only)
      if (config.youtube.url) {
        // Reset all previous IDs whenever a new URL is provided (for display in dashboard)
        this.sources.youtube.channelId = null;
        this.sources.youtube.videoId = null;
        this.sources.youtube.channelUsername = null;
        this.sources.youtube.liveChatId = null;
        
        // Process the URL to extract info for the dashboard
        this.processYouTubeUrl(config.youtube.url);
      }
      
      // Save configuration to file
      this.saveConfig();
      
      // Update connection status if needed
      if (youtubeChanged) {
        if (this.sources.youtube.enabled) {
          // Mark as connected - actual connection is handled by extension
          this.sources.youtube.connected = true;
          this.sources.youtube.lastError = '';
          this.sources.youtube.connectionSource = 'extension';
          this.emit('status-updated', this.getStatus());
        } else {
          // Disable YouTube integration
          this.disconnectYouTube();
        }
      }
    }
    
    // Update Twitch config (keep this part as is)
    if (config.twitch) {
      const twitchEnabled = config.twitch.enabled !== undefined ?
        config.twitch.enabled : this.sources.twitch.enabled;
        
      const twitchChannelName = config.twitch.channelName !== undefined ?
        config.twitch.channelName : this.sources.twitch.channelName;
        
      const twitchChanged = 
        this.sources.twitch.enabled !== twitchEnabled ||
        this.sources.twitch.channelName !== twitchChannelName;
      
      this.sources.twitch.enabled = twitchEnabled;
      this.sources.twitch.channelName = twitchChannelName;
      
      if (twitchChanged) {
        if (this.sources.twitch.enabled && this.sources.twitch.channelName) {
          this.connectTwitch();
        } else {
          this.disconnectTwitch();
        }
      }
    }
    
    this.saveConfig();
    return this.getStatus();
  }

  processYouTubeUrl(url) {
    try {
      console.log(`Processing YouTube URL: ${url}`);
      
      // Handle live chat URLs 
      const liveChatMatch = url.match(/youtube\.com\/live_chat.*[?&]v=([^&]+)/);
      if (liveChatMatch && liveChatMatch[1]) {
        this.sources.youtube.videoId = liveChatMatch[1];
        console.log(`Extracted YouTube video ID from live chat URL: ${this.sources.youtube.videoId}`);
        return;
      }
      
      // Handle video URLs
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?]+)/);
      if (videoIdMatch && videoIdMatch[1]) {
        this.sources.youtube.videoId = videoIdMatch[1];
        console.log(`Extracted YouTube video ID: ${this.sources.youtube.videoId}`);
        return;
      }
      
      // Handle @username URLs
      const atUsernameMatch = url.match(/(?:youtube\.com\/@)([^\/\?#]+)/);
      if (atUsernameMatch && atUsernameMatch[1]) {
        this.sources.youtube.channelUsername = atUsernameMatch[1];
        console.log(`Found YouTube @username: ${this.sources.youtube.channelUsername}`);
        return;
      }
      
      // Handle channel ID URLs
      const channelIdMatch = url.match(/(?:youtube\.com\/channel\/)([^\/\?#]+)/);
      if (channelIdMatch && channelIdMatch[1]) {
        this.sources.youtube.channelId = channelIdMatch[1];
        console.log(`Extracted YouTube channel ID: ${this.sources.youtube.channelId}`);
        return;
      }
      
      // Handle traditional username URLs
      const usernameMatch = url.match(/(?:youtube\.com\/)(?:c\/|user\/)([^\/\?#]+)/);
      if (usernameMatch && usernameMatch[1]) {
        this.sources.youtube.channelUsername = usernameMatch[1];
        console.log(`Found YouTube username: ${this.sources.youtube.channelUsername}`);
        return;
      }
      
      // Handle simple channel names (e.g., youtube.com/LEC)
      const simpleChannelMatch = url.match(/youtube\.com\/([^\/\?#]+)/);
      if (simpleChannelMatch && simpleChannelMatch[1] && 
          !['watch', 'channel', 'c', 'user', 'live_chat'].includes(simpleChannelMatch[1])) {
        this.sources.youtube.channelUsername = simpleChannelMatch[1];
        console.log(`Found YouTube simple channel name: ${this.sources.youtube.channelUsername}`);
        return;
      }
      
      console.log(`Unable to extract YouTube video or channel ID from URL: ${url}`);
    } catch (error) {
      console.error(`Error processing YouTube URL: ${error.message}`);
    }
  }

  async refreshTwitchToken() {
    try {
      // Verify required env variables exist
      if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET || !process.env.TWITCH_REFRESH_TOKEN) {
        throw new Error('Missing required Twitch credentials in environment variables');
      }

      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: process.env.TWITCH_REFRESH_TOKEN,
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET
        }
      });
  
      // Update environment variables with new tokens
      process.env.TWITCH_ACCESS_TOKEN = response.data.access_token;
      process.env.TWITCH_REFRESH_TOKEN = response.data.refresh_token;
  
      // Update .env file if it exists in development
      if (fs.existsSync('.env')) {
        try {
          const dotenv = require('dotenv');
          const env = dotenv.parse(fs.readFileSync('.env'));
          env.TWITCH_ACCESS_TOKEN = response.data.access_token;
          env.TWITCH_REFRESH_TOKEN = response.data.refresh_token;
      
          const envString = Object.keys(env)
            .map(key => `${key}=${env[key]}`)
            .join('\n');
          
          fs.writeFileSync('.env', envString);
          console.log('Updated Twitch tokens in .env file');
        } catch (envError) {
          console.error('Error updating .env file:', envError);
          // Continue even if .env update fails
        }
      }
  
      return response.data.access_token;
    } catch (error) {
      console.error('Error refreshing Twitch token:', error);
      throw error;
    }
  }
  
  async connectTwitch() {
    try {
      // Check if required environment variables exist
      if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_ACCESS_TOKEN) {
        this.sources.twitch.lastError = 'Missing Twitch credentials in environment variables';
        this.emit('status-updated', this.getStatus());
        return;
      }

      // Check if token is about to expire or is invalid
      try {
        await axios.get('https://id.twitch.tv/oauth2/validate', {
          headers: {
            'Authorization': `OAuth ${process.env.TWITCH_ACCESS_TOKEN}`
          }
        });
      } catch (error) {
        console.log('Twitch token invalid or expired, refreshing...');
        await this.refreshTwitchToken();
      }

      // Disconnect existing client if any
      this.disconnectTwitch();
      
      if (!this.sources.twitch.enabled || !this.sources.twitch.channelName) {
        this.sources.twitch.lastError = 'Channel name is required';
        this.emit('status-updated', this.getStatus());
        return;
      }
      
      const channelBadgeMap = {};
      
      try {
        // Fetch global badges
        const globalBadgesResponse = await axios.get('https://api.twitch.tv/helix/chat/badges/global', {
          headers: {
            'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID
          }
        });
    
        // Map global badges
        globalBadgesResponse.data.data.forEach(badgeSet => {
          badgeSet.versions.forEach(version => {
            channelBadgeMap[`global_${badgeSet.set_id}/${version.id}`] = version.image_url_1x;
          });
        });
    
        // Fetch broadcaster's user ID
        const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
          params: { login: this.sources.twitch.channelName },
          headers: {
            'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID
          }
        });
    
        const broadcasterId = userResponse.data.data[0].id;
    
        // Fetch channel-specific badges
        const badgesResponse = await axios.get(`https://api.twitch.tv/helix/chat/badges`, {
          params: { broadcaster_id: broadcasterId },
          headers: {
            'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID
          }
        });
    
        // Map channel-specific badges
        badgesResponse.data.data.forEach(badgeSet => {
          badgeSet.versions.forEach(version => {
            channelBadgeMap[`channel_${badgeSet.set_id}/${version.id}`] = version.image_url_1x;
          });
        });
      } catch (error) {
        console.error('Detailed Twitch API error:', error.response ? error.response.data : error);
        this.sources.twitch.lastError = 'Error fetching Twitch badges';
        this.emit('status-updated', this.getStatus());
      }
    
      // Store connection timestamp to filter historical messages
      this.sources.twitch.connectionTimestamp = new Date();
      
      // Existing client connection logic
      this.sources.twitch.client = new tmi.Client({
        options: { debug: false },
        connection: {
          reconnect: true,
          secure: true
        },
        channels: [this.sources.twitch.channelName]
      });
      
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
      
      this.sources.twitch.client.on('message', (channel, tags, message, self) => {
        if (self) return;
        
        const messageTimestamp = new Date(parseInt(tags['tmi-sent-ts']));
        if (messageTimestamp < this.sources.twitch.connectionTimestamp) {
          console.log(`Skipping historical Twitch message from ${tags['display-name']}`);
          return;
        }
        
        const badges = [];
        if (tags.badges) {
          for (const [type, version] of Object.entries(tags.badges)) {
            const globalBadgeKey = `global_${type}/${version}`;
            const channelBadgeKey = `channel_${type}/${version}`;
            
            const badgeUrl = channelBadgeMap[channelBadgeKey] || 
                             channelBadgeMap[globalBadgeKey] || 
                             `https://static-cdn.jtvnw.net/badges/v1/${type}/${version}/3`;
            
            badges.push(badgeUrl);
          }
        }
        
        const chatMessage = {
          platform: 'twitch',
          username: tags['display-name'] || tags.username,
          content: message,
          color: tags.color || this.getColorFromUsername(tags.username),
          badges: badges,
          timestamp: messageTimestamp.toISOString(),
          id: `twitch-${tags.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        
        console.log(`Processing Twitch message from ${chatMessage.username} with ${badges.length} badges`);
        this.emit('chat-message', chatMessage);
      });
    } catch (error) {
      console.error(`Error in connectTwitch:`, error);
      this.sources.twitch.connected = false;
      this.sources.twitch.lastError = error.message;
      this.emit('status-updated', this.getStatus());
    }
  }

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
  
  
  async connectYouTube() {
    // If using extension, mark as extension-based integration
    this.sources.youtube.connected = true;
    this.sources.youtube.lastError = '';
    this.sources.youtube.connectionSource = 'extension';
    this.emit('status-updated', this.getStatus());
    console.log('YouTube integration now using browser extension');
  }

    /*
    this.disconnectYouTube();
    
    // Check if YouTube API key is available in environment
    if (!process.env.YOUTUBE_API_KEY) {
      this.sources.youtube.lastError = 'YouTube API key not found in environment variables';
      this.sources.youtube.connected = false;
      this.emit('status-updated', this.getStatus());
      return;
    }
    
    if (!this.sources.youtube.enabled) {
      this.sources.youtube.lastError = 'YouTube integration is disabled';
      this.sources.youtube.connected = false;
      this.emit('status-updated', this.getStatus());
      return;
    }
    
    try {
      if (this.sources.youtube.channelUsername && !this.sources.youtube.channelId) {
        await this.resolveChannelId();
      }
      
      if (this.sources.youtube.channelId && !this.sources.youtube.videoId) {
        await this.findActiveLiveStream();
      }
      
      if (this.sources.youtube.videoId) {
        await this.getLiveChatId();
      } else {
        this.sources.youtube.lastError = 'No video ID found and no active livestream detected';
        this.sources.youtube.connected = false;
        this.emit('status-updated', this.getStatus());
        return;
      }
      
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
  }*/
  
    /*
  async resolveChannelId() {
    try {
      console.log(`Resolving channel username: ${this.sources.youtube.channelUsername}`);
      
      if (this.sources.youtube.channelUsername) {
        console.log(`Searching for channel with username: ${this.sources.youtube.channelUsername}`);
        
        const searchQuery = this.sources.youtube.channelUsername.startsWith('@') ? 
          this.sources.youtube.channelUsername : 
          `@${this.sources.youtube.channelUsername}`;
        
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(searchQuery)}&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`;
        console.log(`Making API request for channel search`);
        
        const response = await axios.get(searchUrl);
        console.log(`Got search response with ${response.data.items?.length || 0} items`);
        
        if (response.data.items && response.data.items.length > 0) {
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
      this.sources.youtube.lastError = `Error resolving channel ID: ${error.message}`;
      throw error;
    }
  }
    */

  /*
  async findActiveLiveStream() {
    try {
      console.log(`Finding active livestreams for channel ID: ${this.sources.youtube.channelId}`);
      
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId=${this.sources.youtube.channelId}&eventType=live&type=video&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`;
      console.log(`Making API request for active livestreams`);
      
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
      this.sources.youtube.lastError = `Error finding live stream: ${error.message}`;
      throw error;
    }
  }
  
  /*
  async getLiveChatId() {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${this.sources.youtube.videoId}&key=${process.env.YOUTUBE_API_KEY}`
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
    */
  
  startYouTubeChatPolling() {
    // With extension-based integration, no polling is needed
    console.log('YouTube chat polling via API is disabled - using extension instead');

    // Just mark as connected for status reporting
  this.sources.youtube.connected = true;
  this.sources.youtube.lastError = '';
  this.emit('status-updated', this.getStatus());
}

    /*
    
    const pollChatMessages = async () => {
      try {
        let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet,authorDetails&liveChatId=${this.sources.youtube.liveChatId}&key=${process.env.YOUTUBE_API_KEY}`;
        
        if (this.sources.youtube.nextPageToken) {
          url += `&pageToken=${this.sources.youtube.nextPageToken}`;
        }
        
        const response = await axios.get(url);
        
        this.sources.youtube.nextPageToken = response.data.nextPageToken;
        
        if (response.data.items && response.data.items.length > 0) {
          response.data.items.forEach(item => {
            if (item.snippet.hasOwnProperty('isDeleted') && item.snippet.isDeleted) {
              return;
            }
            
            const messageTimestamp = new Date(item.snippet.publishedAt).toISOString();
            if (messageTimestamp < this.sources.youtube.connectionTimestamp) {
              console.log(`Skipping historical message from ${item.authorDetails.displayName}`);
              return;
            }
            
            const chatMessage = {
              platform: 'youtube',
              username: item.authorDetails.displayName,
              content: item.snippet.displayMessage,
              color: this.getColorFromUsername(item.authorDetails.displayName),
              badges: [],
              timestamp: messageTimestamp,
              id: `youtube-${item.id}-${Math.random().toString(36).substr(2, 9)}`
            };
            
            if (item.authorDetails.isChatOwner) {
              chatMessage.badges.push('https://www.gstatic.com/youtube/img/creator_badges/owner.png');
            }
            if (item.authorDetails.isChatModerator) {
              chatMessage.badges.push('https://www.gstatic.com/youtube/img/creator_badges/moderator.png');
            }
            if (item.authorDetails.isChatSponsor) {
              chatMessage.badges.push('https://www.gstatic.com/youtube/img/creator_badges/sponsor.png');
            }
            
            console.log(`Processing YouTube message from ${chatMessage.username}`);
            this.emit('chat-message', chatMessage);
          });
        }
      } catch (error) {
        console.error(`Error polling YouTube chat: ${error.message}`);
        this.sources.youtube.connected = false;
        this.sources.youtube.lastError = error.message;
        this.emit('status-updated', this.getStatus());
        
        clearInterval(this.sources.youtube.pollingInterval);
        this.sources.youtube.pollingInterval = null;
      }
    };
    
    
    setTimeout(pollChatMessages, 1000);
    
    this.sources.youtube.pollingInterval = setInterval(pollChatMessages, 5000);
  }
    */

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
  
  getColorFromUsername(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#FF0000', '#0000FF', '#00FF00', '#FFFF00', 
      '#FF00FF', '#00FFFF', '#FF7F00', '#7F00FF', 
      '#007FFF', '#FF007F', '#7FFF00', '#00FF7F'
    ];
    
    return colors[Math.abs(hash) % colors.length];
  }
  
  connectAll() {
    if (this.sources.twitch.enabled && this.sources.twitch.channelName) {
      this.connectTwitch();
    }
    
    if (this.sources.youtube.enabled && 
        (this.sources.youtube.videoId || this.sources.youtube.channelId || 
         this.sources.youtube.channelUsername)) {
      this.connectYouTube();
    }
  }
  
  disconnectAll() {
    this.disconnectTwitch();
    this.disconnectYouTube();
  }
}

module.exports = ChatIntegration;