// WebSocket connection manager for the extension

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
        
        // Create Socket.IO connection
        this.socket = io(this.serverUrl);
        
        // Set up event handlers
        this.socket.on('connect', () => {
          console.log('Connected to WebSocket server');
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
        
        this.socket.on('error', (error) => {
          console.error('WebSocket error:', error);
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
        return true;
      } else {
        // Queue the message for later
        this.messageQueue.push(message);
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
          chrome.tabs.sendMessage(tab.id, {
            type: 'SERVER_CONNECTION_CHANGED',
            connected: connected
          }).catch(() => {
            // Ignore errors from tabs that don't have content scripts
          });
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