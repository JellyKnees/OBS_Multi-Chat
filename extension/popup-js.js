// Popup script for the OBS Multi-Platform Chat Overlay extension

document.addEventListener('DOMContentLoaded', function() {
    const connectButton = document.getElementById('connect-button');
    const serverUrlInput = document.getElementById('server-url');
    const connectionStatus = document.getElementById('connection-status');
    const serverIndicator = document.getElementById('server-indicator');
    const overlayStatus = document.getElementById('overlay-status');
    const overlayIndicator = document.getElementById('overlay-indicator');
    const youtubeStatus = document.getElementById('youtube-status');
    const twitchStatus = document.getElementById('twitch-status');
    
    // Load saved server URL
    chrome.storage.sync.get(['serverUrl'], function(result) {
        if (result.serverUrl) {
            serverUrlInput.value = result.serverUrl;
        }
    });
    
    // Check connection status when popup opens
    checkConnectionStatus();
    
    // Check for active chat tabs
    checkActiveChatTabs();
    
    // Connect to server button click
    if (connectButton) {
        connectButton.addEventListener('click', function() {
            const serverUrl = serverUrlInput.value.trim();
            if (!serverUrl) return;
            
            // Save the URL to storage
            chrome.storage.sync.set({ serverUrl: serverUrl });
            
            // Send connect message to background script
            chrome.runtime.sendMessage({
                type: 'CONNECT_SERVER',
                serverUrl: serverUrl
            }, function(response) {
                if (response && response.success) {
                    updateConnectionStatus(response.connected);
                    
                    // Check overlay status after a short delay
                    setTimeout(function() {
                        checkOverlayStatus(serverUrl);
                    }, 1000);
                }
            });
        });
    }
    
    // Function to check connection status
    function checkConnectionStatus() {
        chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' }, function(response) {
            if (response) {
                updateConnectionStatus(response.connected);
                
                // If connected, also check if overlay is available
                if (response.connected) {
                    checkOverlayStatus(response.serverUrl || serverUrlInput.value);
                }
            }
        });
    }
    
    // Function to update connection status UI
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
    
    // Function to check if overlay is available
    function checkOverlayStatus(serverUrl) {
        // Simple fetch to see if the overlay is responding
        fetch(`${serverUrl}/settings`, { method: 'GET' })
            .then(response => {
                if (response.ok) {
                    return response.json()
                        .then(data => {
                            overlayStatus.textContent = 'Connected';
                            overlayIndicator.classList.remove('disconnected');
                            overlayIndicator.classList.add('connected');
                        })
                        .catch(error => {
                            console.error('Error parsing overlay response:', error);
                            overlayStatus.textContent = 'Error';
                            overlayIndicator.classList.remove('connected');
                            overlayIndicator.classList.add('disconnected');
                        });
                } else {
                    throw new Error('Overlay not available');
                }
            })
            .catch(error => {
                console.error('Overlay check error:', error);
                overlayStatus.textContent = 'Not detected';
                overlayIndicator.classList.remove('connected');
                overlayIndicator.classList.add('disconnected');
            });
    }
    
    // Function to check for active chat tabs
    function checkActiveChatTabs() {
        // Query for YouTube and Twitch tabs
        chrome.tabs.query({ 
            url: [
                '*://*.youtube.com/*',
                '*://*.twitch.tv/*'
            ]
        }, function(tabs) {
            let foundYoutube = false;
            let foundTwitch = false;
            
            tabs.forEach(tab => {
                if (tab.url.includes('youtube.com')) {
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
});