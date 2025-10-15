// Content script for the Multi-Platform Chat Overlay extension
console.log("Content script loaded");

// Global variables - only declare these once
const platform = window.location.href.includes('youtube.com') ? 'youtube' : 
                window.location.href.includes('twitch.tv') ? 'twitch' : 'unknown';
let initialized = false;
let observingChat = false;
let serverConnected = false;
let messageSendInterval = null;
let messageQueue = [];
let chatObserver = null;

// Initialize the content script
function initialize(detectedPlatform, isServerConnected) {
  console.log(`Initializing content script for ${detectedPlatform}, serverConnected: ${isServerConnected}`);
  
  // Don't reassign platform, use the detected value
  serverConnected = isServerConnected;
  
  // Notify background script that we're ready
  chrome.runtime.sendMessage({
    type: 'CONTENT_SCRIPT_INITIALIZED',
    platform: platform
  }, response => {
    if (response && response.success) {
      initialized = true;
      console.log(`Initialization confirmed, server connected: ${response.connected}`);
      serverConnected = response.connected;
      setupChatObserver();
      startMessageSendInterval();
    } else {
      console.log("Initialization response failed or missing");
    }
  });
}

// Set up the observer for chat messages
function setupChatObserver() {
  if (observingChat) {
    console.log("Already observing chat, skipping setup");
    return;
  }
  
  console.log(`Setting up chat observer for ${platform}`);
  
  if (platform === 'youtube') {
    setupYouTubeObserver();
  } else if (platform === 'twitch') {
    setupTwitchObserver();
  } else {
    console.log(`Unknown platform: ${platform}, cannot setup observer`);
    return;
  }
  
  observingChat = true;
  console.log(`Chat observer setup complete for ${platform}`);
}

// YouTube-specific chat extraction
function setupYouTubeObserver() {
  console.log("Setting up YouTube observer...");
  
  // Check if we're in the main page or chat iframe
  const isLiveChatFrame = window.location.pathname.includes('/live_chat');
  console.log("Is live chat frame:", isLiveChatFrame);
  console.log("Current URL:", window.location.href);
  console.log("Current path:", window.location.pathname);

  // If we're in the main page, we need to handle the iframe situation
  if (!isLiveChatFrame) {
    const chatIframe = document.querySelector('#chatframe');
    if (chatIframe) {
      console.log("Found chat iframe, creating notification about direct URL");
      
      // Get the iframe src
      const iframeSrc = chatIframe.src;
      console.log("Chat iframe src:", iframeSrc);
      
      // Create a visual indicator for the user
      const indicator = document.createElement('div');
      indicator.style.position = 'fixed';
      indicator.style.top = '80px';
      indicator.style.right = '10px';
      indicator.style.zIndex = '9999';
      indicator.style.background = '#ffcc00';
      indicator.style.color = 'black';
      indicator.style.padding = '10px';
      indicator.style.borderRadius = '5px';
      indicator.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      indicator.style.maxWidth = '300px';
      indicator.style.fontSize = '14px';
      indicator.innerHTML = `
        <strong>YouTube Chat Notice</strong><br>
        For YouTube chat extraction, open this URL directly:<br>
        <a href="${iframeSrc}" target="_blank" style="color:blue;text-decoration:underline;">${iframeSrc}</a>
      `;
      document.body.appendChild(indicator);
      
      console.log("YouTube chat requires direct iframe access. Please open the chat URL directly.");
      return; // Exit this function since we need to use the iframe directly
    }
  }
  
  // We're in the chat iframe or couldn't find an iframe, proceed with finding message container
  let messageContainer = null;
  
  if (isLiveChatFrame) {
    // Try finding selectors specifically for the chat iframe content
    console.log("In live chat frame, checking for chat containers");
    console.log("yt-live-chat-app:", document.querySelector('yt-live-chat-app'));
    console.log("#item-list:", document.querySelector('#item-list'));
    console.log("#items:", document.querySelector('#items'));
    console.log("#contents:", document.querySelector('#contents'));
    console.log("#chat-messages:", document.querySelector('#chat-messages'));
    
    messageContainer = 
      document.querySelector('#item-list #items') || 
      document.querySelector('#items') ||
      document.querySelector('#contents') ||
      document.querySelector('#chat-messages');
  } else {
    // Look specifically for chat elements, not general #items
    console.log("Looking for YouTube chat elements");
    const chatApp = document.querySelector('yt-live-chat-app');
    
    if (chatApp) {
      console.log("Found yt-live-chat-app, looking for items within it");
      messageContainer = chatApp.querySelector('#items') || chatApp.querySelector('#item-list #items');
    }
  }
  
  if (!messageContainer) {
    console.log('YouTube message container not found, retrying in 2 seconds');
    setTimeout(setupYouTubeObserver, 2000);
    return;
  }

  console.log('Found YouTube message container:', messageContainer);
  
  // Try to find existing messages to validate our selectors
  const existingMessages = document.querySelectorAll('yt-live-chat-text-message-renderer, yt-live-chat-paid-message-renderer');
  console.log(`Found ${existingMessages.length} existing YouTube messages`);
  
  if (existingMessages.length === 0) {
    // This might not be the right container, let's check
    console.log("No existing messages found, this might not be the right container");
    console.log("Container contents:", messageContainer.innerHTML.slice(0, 200) + "...");
    
    // Check for specific YouTube chat elements
    const hasYtElements = messageContainer.querySelector('yt-live-chat-text-message-renderer') != null;
    if (!hasYtElements) {
      console.log("This container doesn't have YouTube chat elements, retrying...");
      setTimeout(setupYouTubeObserver, 2000);
      return;
    }
  }
  
  // Create the observer
  chatObserver = new MutationObserver(mutations => {
    console.log("YouTube mutation detected:", mutations.length, "changes");
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        console.log("Added nodes:", mutation.addedNodes.length);
        
        mutation.addedNodes.forEach(node => {
          // Check for various message types
          const isTextMessage = node.tagName === 'YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER';
          const isPaidMessage = node.tagName === 'YT-LIVE-CHAT-PAID-MESSAGE-RENDERER';
          const hasTextMessage = node.querySelector && node.querySelector('yt-live-chat-text-message-renderer');
          const hasPaidMessage = node.querySelector && node.querySelector('yt-live-chat-paid-message-renderer');
          
          if (isTextMessage || isPaidMessage || hasTextMessage || hasPaidMessage) {
            console.log("Found YouTube chat message:", node);
            
            // Extract the actual message node
            let messageNode = node;
            if (!isTextMessage && !isPaidMessage) {
              messageNode = hasTextMessage ? 
                node.querySelector('yt-live-chat-text-message-renderer') : 
                node.querySelector('yt-live-chat-paid-message-renderer');
            }
            
            if (messageNode) {
              const message = extractYouTubeMessage(messageNode);
              if (message) {
                console.log("Extracted YouTube message:", message);
                messageQueue.push(message);
              }
            }
          }
        });
      }
    });
  });
  
  // Start observing
  chatObserver.observe(messageContainer, {
    childList: true,
    subtree: true
  });
  
  console.log('YouTube chat observer started');
  
  // Process any existing messages
  if (existingMessages.length > 0) {
    console.log("Processing existing messages...");
    
    existingMessages.forEach(node => {
      try {
        const message = extractYouTubeMessage(node);
        if (message) {
          console.log("Extracted message from existing YouTube chat:", message);
          messageQueue.push(message);
        }
      } catch (e) {
        console.error("Error extracting existing message:", e);
      }
    });
  }
}

function extractYouTubeMessage(messageNode) {
  try {
    console.log("Extracting YouTube message from:", messageNode.tagName);
    
    // Author name - try multiple selectors
    const authorElement = 
      messageNode.querySelector('#author-name') ||
      messageNode.querySelector('.yt-live-chat-author-chip') ||
      messageNode.querySelector('[id*="author"]');
    
    if (!authorElement) {
      console.log("Couldn't find author element");
      return null;
    }
    
    // Message content - try multiple selectors
    const messageElement = 
      messageNode.querySelector('#message') ||
      messageNode.querySelector('#content') ||
      messageNode.querySelector('.yt-live-chat-text-message-renderer-0') ||
      messageNode.querySelector('[id*="message"]');
    
    if (!messageElement) {
      console.log("Couldn't find message element");
      return null;
    }
    
    // Extract username text
    const username = authorElement.textContent.trim();
    
    // Generate color for YouTube users
    const color = getColorFromUsername(username);
    
    // Try to get author color if available
    let authorColor = window.getComputedStyle(authorElement).color;
    if (authorColor === 'rgb(0, 0, 0)' || authorColor === 'rgba(0, 0, 0, 0)') {
      authorColor = color; // Use generated color if no real color found
    }
    
    // Badges
    const badges = [];
    const badgeElements = messageNode.querySelectorAll('#author-badges yt-live-chat-author-badge-renderer, .yt-live-chat-author-badge-renderer');
    badgeElements.forEach(badge => {
      const img = badge.querySelector('img');
      if (img && img.src) {
        badges.push(img.src);
      }
    });
    
    // Get timestamp
    const timestampElement = messageNode.querySelector('#timestamp, .timestamp');
    let timestamp = new Date().toISOString();
    if (timestampElement) {
      timestamp = timestampElement.textContent.trim();
    }
    
    // Create message object
    const message = {
      platform: 'youtube',
      username: username,
      content: messageElement.innerHTML,
      color: authorColor,
      badges: badges,
      timestamp: timestamp,
      id: 'youtube-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    };
    
    return message;
  } catch (error) {
    console.error('Error extracting YouTube message:', error);
    return null;
  }
}

// Twitch-specific chat extraction
function setupTwitchObserver() {
  console.log("Setting up Twitch observer...");
  
  // Check if we're on a Twitch page with chat
  console.log("Current URL:", window.location.href);
  console.log("Current path:", window.location.pathname);
  
  // Log all potential chat containers
  console.log("Checking for .chat-scrollable-area__message-container:", 
    document.querySelector('.chat-scrollable-area__message-container'));
  console.log("Checking for .chat-list--default:", 
    document.querySelector('.chat-list--default'));
  console.log("Checking for .chat-list:", 
    document.querySelector('.chat-list'));
  console.log("Checking for [data-test-selector='chat-scrollable-area-container']:", 
    document.querySelector('[data-test-selector="chat-scrollable-area-container"]'));
  
  // Try to find the chat container with different selectors
  const chatContainer = 
    document.querySelector('.chat-scrollable-area__message-container') || 
    document.querySelector('.chat-list--default') || 
    document.querySelector('.chat-list') ||
    document.querySelector('[data-test-selector="chat-scrollable-area-container"]');
  
  if (!chatContainer) {
    console.log('Twitch chat container not found, retrying in 2 seconds');
    setTimeout(setupTwitchObserver, 2000);
    return;
  }

  console.log('Found Twitch chat container:', chatContainer);
  
  // Create the observer
  chatObserver = new MutationObserver(mutations => {
    console.log("Twitch mutation detected:", mutations.length, "changes");
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        console.log("Added nodes:", mutation.addedNodes.length);
        
        mutation.addedNodes.forEach(node => {
          // Debug log all added nodes
          console.log("Added node:", node, "classList:", node.classList ? [...node.classList] : "no classes");
          
          // Check if this is a chat message - try multiple selectors
          const isChatLine = 
            (node.classList && node.classList.contains('chat-line__message')) ||
            (node.classList && node.classList.contains('chat-line')) ||
            (node.querySelector && node.querySelector('.chat-line__message')) ||
            (node.querySelector && node.querySelector('[data-a-target="chat-line-message"]'));
          
          if (isChatLine) {
            console.log("Found Twitch chat message:", node);
            const message = extractTwitchMessage(node);
            if (message) {
              console.log("Extracted Twitch message:", message);
              messageQueue.push(message);
            } else {
              console.log("Failed to extract Twitch message from node:", node);
            }
          }
        });
      }
    });
  });
  
  // Start observing with more complete options
  chatObserver.observe(chatContainer, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
  
  console.log('Twitch chat observer started successfully');
  
  // As a test, also try to find existing messages
  const existingMessages = chatContainer.querySelectorAll('.chat-line__message');
  console.log(`Found ${existingMessages.length} existing Twitch chat messages`);
  
  if (existingMessages.length > 0) {
    const sampleMessage = extractTwitchMessage(existingMessages[existingMessages.length - 1]);
    console.log("Sample extraction from existing message:", sampleMessage);
  }
}

function extractTwitchMessage(messageNode) {
  try {
    console.log("Extracting Twitch message from:", messageNode);
    
    // If we caught a container element, find the actual message node
    const actualNode = messageNode.classList && messageNode.classList.contains('chat-line__message') ? 
                      messageNode : 
                      messageNode.querySelector('.chat-line__message') ||
                      messageNode.querySelector('[data-a-target="chat-line-message"]') ||
                      messageNode;
    
    if (!actualNode) {
      console.log("Couldn't find actual message node");
      return null;
    }
    
    // Try multiple selectors for author name
    const authorElement = 
      actualNode.querySelector('.chat-author__display-name') ||
      actualNode.querySelector('.chat-author__username') ||
      actualNode.querySelector('[data-a-target="chat-message-username"]') ||
      actualNode.querySelector('[data-a-user]');
    
    if (!authorElement) {
      console.log("Couldn't find author element. Available elements:", actualNode.innerHTML);
      return null;
    }
    
    // Try multiple selectors for message content
    const messageElement = 
      actualNode.querySelector('.message') ||
      actualNode.querySelector('.text-fragment') ||
      actualNode.querySelector('.chat-line__message-container .message') ||
      actualNode.querySelector('[data-a-target="chat-message-text"]');
    
    if (!messageElement) {
      console.log("Couldn't find message element. Available elements:", actualNode.innerHTML);
      return null;
    }
    
    // Get author color
    const authorColor = window.getComputedStyle(authorElement).color;
    console.log("Author color:", authorColor);
    
    // Get badges
    const badges = [];
    const badgeElements = actualNode.querySelectorAll('.chat-badge');
    badgeElements.forEach(badge => {
      console.log("Found badge:", badge);
      // Try to get the image directly
      const img = badge.querySelector('img');
      if (img && img.src) {
        badges.push(img.src);
        return;
      }
      
      // Try to get from background image - FIXED REGEX HERE
      const style = window.getComputedStyle(badge);
      const bgImage = style.backgroundImage;
      
      if (bgImage && bgImage !== 'none') {
        // Fixed regex to properly escape single quotes
        const url = bgImage.replace(/^url\(['"](.+)['"]\)$/, '$1');
        badges.push(url);
      }
    });
    
    console.log("Extracted badges:", badges);
    
    // Create the final message object
    const message = {
      platform: 'twitch',
      username: authorElement.textContent.trim(),
      content: messageElement.innerHTML,
      color: authorColor,
      badges: badges,
      timestamp: new Date().toISOString(),
      id: 'twitch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    };
    
    console.log("Final Twitch message object:", message);
    return message;
  } catch (error) {
    console.error('Error extracting Twitch message:', error);
    return null;
  }
}

// Generate consistent color based on username
function getColorFromUsername(username) {
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

// Set up interval to send messages to avoid flooding
function startMessageSendInterval() {
  if (messageSendInterval) {
    clearInterval(messageSendInterval);
  }
  messageSendInterval = setInterval(sendQueuedMessages, 300);
  console.log(`Message send interval started for ${platform}`);
}

// Send queued messages to the background script
function sendQueuedMessages() {
  console.log("Checking message queue, length:", messageQueue.length, "serverConnected:", serverConnected);
  
  if (messageQueue.length === 0 || !serverConnected) return;
  
  // Get the oldest messages (up to 5 at a time)
  const messagesToSend = messageQueue.splice(0, 5);
  console.log("Sending messages to background:", messagesToSend.length);
  
  // Send each message
  messagesToSend.forEach(message => {
    console.log("Sending message:", message);
    chrome.runtime.sendMessage({
      type: 'CHAT_MESSAGE',
      data: message
    }, response => {
      console.log("Send response:", response);
    });
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.type === 'INITIALIZE') {
    // Don't reassign platform, just use for initialization
    initialize(platform, message.serverConnected);
    sendResponse({ success: true });
  } else if (message.type === 'SERVER_CONNECTION_CHANGED') {
    serverConnected = message.connected;
    console.log(`Server connection changed: ${serverConnected}`);
    sendResponse({ success: true });
  }
  
  return true; // Required for async sendResponse
});

// Send a test message function for debugging
function sendTestMessage() {
  const testMessage = {
    platform: platform || 'test',
    username: 'TestUser',
    content: 'This is a test message from content script',
    color: '#FF0000',
    badges: [],
    timestamp: new Date().toISOString(),
    id: 'test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
  };
  
  console.log("Sending test message:", testMessage);
  
  if (serverConnected) {
    chrome.runtime.sendMessage({
      type: 'CHAT_MESSAGE',
      data: testMessage
    }, response => {
      console.log("Test message send response:", response);
    });
  } else {
    console.log("Can't send test message - not connected to server");
  }
}

// Auto-initialize if not already done
if (!initialized) {
  console.log(`${platform} detected, initializing`);
  initialize(platform, false);
}