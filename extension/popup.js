document.addEventListener('DOMContentLoaded', function() {
    const connectButton = document.getElementById('connect-button');
    const serverUrlInput = document.getElementById('server-url');
    const connectionStatus = document.getElementById('connection-status');
    const serverIndicator = document.getElementById('server-indicator');
    const overlayStatus = document.getElementById('overlay-status');
    const overlayIndicator = document.getElementById('overlay-indicator');
    const youtubeStatus = document.getElementById('youtube-status');
    const twitchStatus = document.getElementById('twitch-status');
    
    // Check connection status
    function checkConnectionStatus() {
      chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' }, (response) => {
        if (response) {
          updateConnectionStatus(response.connected);
          
          // If connected, also check if overlay is available
          if (response.connected) {
            checkOverlayStatus(response.serverUrl || serverUrlInput.value);
          }
        }
      });
    }
    
    // Update connection status UI
    function updateConnectionStatus(connected) {
      if (connected) {
        connectionStatus.textContent = 'Connected';
        serverIndicator.classList.remove('disconnected');
        serverIndicator.classList.add('connected');
      } else {
        connectionStatus.textContent = 'Disconnected';
        serverIndicator.classList.remove('connected');
        serverIndicator.classList.add('disconnected');
        
        // Also update overlay status to disconnected
        overlayStatus.textContent = 'Not detected';
        overlayIndicator.classList.remove('connected');
        overlayIndicator.classList.add('disconnected');
      }
    }
    
    // Check if overlay is available
    function checkOverlayStatus(serverUrl) {
      // Simple fetch to see if the overlay is responding
      fetch(`${serverUrl}/settings`)
        .then(response => {
          if (response.ok) {
            overlayStatus.textContent = 'Connected';
            overlayIndicator.classList.remove('disconnected');
            overlayIndicator.classList.add('connected');
          } else {
            throw new Error('Overlay not available');
          }
        })
        .catch(error => {
          overlayStatus.textContent = 'Not detected';
          overlayIndicator.classList.remove('connected');
          overlayIndicator.classList.add('disconnected');
          console.error('Overlay check error:', error);
        });
    }
    
    // Check for active chat tabs
    function checkActiveChatTabs() {
      // Query for YouTube and Twitch tabs
      chrome.tabs.query({ url: [
        '*://*.youtube.com/live_chat*',
        '*://*.twitch.tv/*'
      ]}, (tabs) => {
        let foundYoutube = false;
        let foundTwitch = false;
        
        tabs.forEach(tab => {
          if (tab.url.includes('youtube.com/live_chat')) {
            foundYoutube = true;
          }
          if (tab.url.includes('twitch.tv')) {
            foundTwitch = true;
          }
        });
        
        youtubeStatus.textContent = foundYoutube ? 'Active' : 'Not detected';
        twitchStatus.textContent = foundTwitch ? 'Active' : 'Not detected';
      });
    }
    
    // Connect to server button
    if (connectButton) {
      connectButton.addEventListener('click', () => {
        const serverUrl = serverUrlInput.value.trim();
        if (!serverUrl) return;
        
        chrome.runtime.sendMessage({
          type: 'CONNECT_SERVER',
          serverUrl: serverUrl
        }, (response) => {
          if (response && response.success) {
            updateConnectionStatus(response.connected);
            
            // Check overlay status after a short delay
            setTimeout(() => {
              checkOverlayStatus(serverUrl);
            }, 1000);
          }
        });
      });
    }
    
    // Check connection status when popup opens
    checkConnectionStatus();
    
    // Check for active chat tabs
    checkActiveChatTabs();
  });