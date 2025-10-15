// Background script for the Multi-Platform Chat Overlay extension

// Import Socket.IO directly into the service worker
importScripts('socket.io.min.js');

// Track which tabs have content scripts ready
const readyTabs = new Set();

// Socket Manager class
class SocketManager {
  constructor() {
    this.socket = null;
    this.serverUrl = 'http://localhost:3000';
    this.isConnected = false;
    this.reconnectTimer = null;
    this.messageQueue = [];
  }
  
  // Initialize with a server URL
  initialize(url) {
    if (url) {
      this.serverUrl = url;
    }
    
    this.connect();
  }
  
  // Connect to the WebSocket server
  connect() {
    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Close existing connection if any
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    try {
      console.log(`Connecting to WebSocket server at ${this.serverUrl}`);
      
      // Create Socket.IO CLIENT connection - not server!
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 10000
      });
      
      console.log('Socket.IO client instance created');
      
      // CLIENT-SIDE event handlers
      this.socket.on('connect', () => {
        console.log('Connected to WebSocket server with ID:', this.socket.id);
        this.isConnected = true;
        
        // Notify all content scripts
        this.notifyConnectionStatus(true);
        
        // Send any queued messages
        this.sendQueuedMessages();
      });
      
      this.socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
        this.isConnected = false;
        
        // Notify all content scripts
        this.notifyConnectionStatus(false);
        
        // Try to reconnect after a delay
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        this.isConnected = false;
      });
      
    } catch (error) {
      console.error('Error connecting to WebSocket server:', error);
      this.isConnected = false;
      
      // Try to reconnect after a delay
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }
  }
  
  // Send a chat message
  sendChatMessage(message) {
    if (this.isConnected && this.socket) {
      this.socket.emit('chat-message', message);
      console.log('Message sent:', message);
      return true;
    } else {
      // Queue the message for later
      this.messageQueue.push(message);
      console.log('Message queued for later sending:', message);
      return false;
    }
  }
  
  // Send any queued messages
  sendQueuedMessages() {
    if (!this.isConnected || !this.socket || this.messageQueue.length === 0) {
      return;
    }
    
    console.log(`Sending ${this.messageQueue.length} queued messages`);
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.socket.emit('chat-message', message);
    }
  }
  
  // Notify all content scripts about connection status
  notifyConnectionStatus(connected) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        // Only send to YouTube or Twitch tabs that are ready
        if (tab && tab.url && (tab.url.includes('youtube.com') || tab.url.includes('twitch.tv')) && readyTabs.has(tab.id)) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'SERVER_CONNECTION_CHANGED',
            connected: connected
          }, () => {
            // Handle any errors silently to prevent console errors
            if (chrome.runtime.lastError) {
              console.log(`Tab ${tab.id} not ready for messages yet`);
              // If the tab is not ready, we should remove it from readyTabs
              readyTabs.delete(tab.id);
            }
          });
        }
      });
    });
  }
  
  // Highlight a message
  highlightMessage(messageId) {
    if (this.isConnected && this.socket) {
      this.socket.emit('highlight-message', messageId);
      return true;
    }
    return false;
  }
  
  // Clear highlighted message
  clearHighlightedMessage() {
    if (this.isConnected && this.socket) {
      this.socket.emit('clear-highlight');
      return true;
    }
    return false;
  }
  
  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      serverUrl: this.serverUrl
    };
  }
}

// Socket manager instance
const socketManager = new SocketManager();
let activeTabs = new Map(); // Track which tabs have content scripts active

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  // Load settings from storage
  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (result.serverUrl) {
      socketManager.initialize(result.serverUrl);
    } else {
      socketManager.initialize();
    }
  });
  
  console.log('Multi-Platform Chat Overlay extension installed');
});

// Function to inject the content script
function injectContentScript(tabId, tabUrl) {
  // Check if already injected
  if (activeTabs.has(tabId)) {
    return;
  }
  
  // Check if this is a YouTube or Twitch tab
  const isYouTube = tabUrl.includes('youtube.com');
  const isTwitch = tabUrl.includes('twitch.tv');
  
  if (isYouTube || isTwitch) {
    const platform = isYouTube ? 'youtube' : 'twitch';
    
    // Mark tab as active
    activeTabs.set(tabId, {
      url: tabUrl,
      platform: platform
    });
    
    // Inject the content script
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).then(() => {
      console.log(`Content script injected into ${platform} tab ${tabId}`);
    }).catch(err => {
      console.error(`Error injecting content script into tab ${tabId}:`, err);
      activeTabs.delete(tabId);
    });
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);
  
  if (message.type === 'CHAT_MESSAGE') {
    // Forward the chat message to the WebSocket server
    socketManager.sendChatMessage(message.data);
    sendResponse({ success: true });
  } else if (message.type === 'CONTENT_SCRIPT_INITIALIZED' || message.type === 'CONTENT_SCRIPT_READY') {
    // Track which tabs have content scripts running
    if (sender.tab && sender.tab.id) {
      activeTabs.set(sender.tab.id, {
        url: sender.tab.url,
        platform: message.platform
      });
      
      // Mark tab as ready for messages
      readyTabs.add(sender.tab.id);
      console.log(`Content script ready in tab ${sender.tab.id}`);
    }
    
    const status = socketManager.getStatus();
    sendResponse({ 
      success: true,
      connected: status.connected 
    });
    
    // If already connected, notify this tab
    if (socketManager.isConnected && sender.tab && sender.tab.id) {
      setTimeout(() => {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'SERVER_CONNECTION_CHANGED',
          connected: true
        }, () => {
          // Handle any errors silently
          if (chrome.runtime.lastError) {
            console.log(`Tab ${sender.tab.id} failed to receive connection status`);
          }
        });
      }, 500);
    }
  } else if (message.type === 'CONNECT_SERVER') {
    // Update server URL if provided
    if (message.serverUrl) {
      socketManager.initialize(message.serverUrl);
      chrome.storage.sync.set({ serverUrl: message.serverUrl });
    } else {
      socketManager.connect();
    }
    
    const status = socketManager.getStatus();
    sendResponse({ 
      success: true, 
      connected: status.connected 
    });
  } else if (message.type === 'GET_CONNECTION_STATUS') {
    const status = socketManager.getStatus();
    sendResponse(status);
  } else if (message.type === 'HIGHLIGHT_MESSAGE') {
    socketManager.highlightMessage(message.messageId);
    sendResponse({ success: true });
  } else if (message.type === 'CLEAR_HIGHLIGHT') {
    socketManager.clearHighlightedMessage();
    sendResponse({ success: true });
  }
  
  return true; // Required for async sendResponse
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If the tab has finished loading and has a URL
  if (changeInfo.status === 'complete' && tab.url) {
    injectContentScript(tabId, tab.url);
  }
});

// Handle tab close/remove
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up our tab tracking
  activeTabs.delete(tabId);
  readyTabs.delete(tabId);
});

// Handle tab navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If the URL has changed, we need to reinject if it's a relevant page
  if (changeInfo.url) {
    // Remove old tracking
    activeTabs.delete(tabId);
    readyTabs.delete(tabId);
    
    // Check if we need to inject for this URL
    if (tab.url && (tab.url.includes('youtube.com') || tab.url.includes('twitch.tv'))) {
      injectContentScript(tabId, tab.url);
    }
  }
});