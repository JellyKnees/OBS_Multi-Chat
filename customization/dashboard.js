document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard initialized');
  
  // Safely get DOM elements with null checks
  const getElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with ID '${id}' not found`);
    }
    return element;
  };

  // OBS View elements
  const obsFontSizeInput = getElement('obs-fontSize');
  const obsFontSizeValue = getElement('obs-fontSizeValue');
  const obsTextColorInput = getElement('obs-textColor');
  const obsBackgroundColorInput = getElement('obs-backgroundColor');
  const obsChatWidthInput = getElement('obs-chatWidth');
  const obsChatHeightInput = getElement('obs-chatHeight');
  const obsEnableDropShadowInput = getElement('obs-enableDropShadow');
  const obsShowMessageBackgroundInput = getElement('obs-showMessageBackground');
  const obsMsgOpacityInput = getElement('obs-messageOpacity');
  const obsMsgOpacityValue = getElement('obs-messageOpacityValue');
  const obsMsgBorderRadiusInput = getElement('obs-messageBorderRadius');
  const obsMsgBorderRadiusValue = getElement('obs-messageBorderRadiusValue');
  const obsMsgPaddingInput = getElement('obs-messagePadding');
  const obsMsgPaddingValue = getElement('obs-messagePaddingValue');
  const obsShowTimestampsInput = getElement('obs-showTimestamps');
  const obsShowPlatformsInput = getElement('obs-showPlatforms');
  
  // Streamer View elements
  const streamerFontSizeInput = getElement('streamer-fontSize');
  const streamerFontSizeValue = getElement('streamer-fontSizeValue');
  const streamerTextColorInput = getElement('streamer-textColor');
  const streamerBackgroundColorInput = getElement('streamer-backgroundColor');
  const streamerChatWidthInput = getElement('streamer-chatWidth');
  const streamerChatHeightInput = getElement('streamer-chatHeight');
  const streamerEnableDropShadowInput = getElement('streamer-enableDropShadow');
  const streamerShowMessageBackgroundInput = getElement('streamer-showMessageBackground');
  const streamerMsgOpacityInput = getElement('streamer-messageOpacity');
  const streamerMsgOpacityValue = getElement('streamer-messageOpacityValue');
  const streamerMsgBorderRadiusInput = getElement('streamer-messageBorderRadius');
  const streamerMsgBorderRadiusValue = getElement('streamer-messageBorderRadiusValue');
  const streamerMsgPaddingInput = getElement('streamer-messagePadding');
  const streamerMsgPaddingValue = getElement('streamer-messagePaddingValue');
  const streamerShowTimestampsInput = getElement('streamer-showTimestamps');
  const streamerShowPlatformsInput = getElement('streamer-showPlatforms');
  
  // Common elements
  const messageLimitInput = getElement('messageLimit');
  const highlightTimeoutInput = getElement('highlightTimeout');
  const highlightTimeoutValue = getElement('highlightTimeoutValue');
  const highlightColorInput = getElement('highlightColor');
  const enableSoundInput = getElement('enableSound');
  const soundVolumeInput = getElement('soundVolume');
  const soundVolumeValue = getElement('soundVolumeValue');
  const testSoundButton = getElement('testSound');
  
  const saveButton = getElement('saveSettings');
  const resetButton = getElement('resetSettings');
  const statusMessage = getElement('status-message');

  // Chat sources elements
  const youtubeUrlInput = getElement('youtube-channel-url');
  const youtubeEnabledInput = getElement('youtube-enabled');
  const youtubeStatusIndicator = getElement('youtube-status-indicator');
  const youtubeStatus = getElement('youtube-status');
  const youtubeApiKeyInput = getElement('youtube-api-key');

  const twitchChannelInput = getElement('twitch-channel-name');
  const twitchEnabledInput = getElement('twitch-enabled');
  const twitchStatusIndicator = getElement('twitch-status-indicator');
  const twitchStatus = getElement('twitch-status');

  const connectChatButton = getElement('connect-chat-sources');

  // Create audio element for testing
  let testSound = null;
  function createAudioElement() {
    if (!testSound) {
      testSound = new Audio('/audio/whoosh.mp3');
      testSound.preload = 'auto';
      document.body.appendChild(testSound);
    }
  }

  // Get tab buttons
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Add tab switching functionality
  if (tabButtons && tabButtons.length > 0) {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        console.log('Tab clicked:', button.dataset.tab);
        // Remove active class from all tabs
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab
        button.classList.add('active');
        const tabId = button.dataset.tab;
        if (tabId && getElement(tabId)) {
          getElement(tabId).classList.add('active');
        }
      });
    });
  }

  // Default settings
  const defaultSettings = {
    messageLimit: 50,
    highlightTimeout: 10000,
    highlightColor: "#ff5500",
    enableSound: true,
    soundVolume: 0.5,
    
    obsView: {
      fontSize: 16,
      textColor: "#ffffff",
      backgroundColor: "#222222",
      messageOpacity: 0.7,
      messageBorderRadius: 4,
      messagePadding: 8,
      chatWidth: "100%",
      chatHeight: "400px",
      enableDropShadow: true,
      showMessageBackground: true,
      showTimestamps: false,
      showPlatforms: true
    },
    
    streamerView: {
      fontSize: 16,
      textColor: "#ffffff",
      backgroundColor: "#181818",
      messageOpacity: 0.7,
      messageBorderRadius: 4,
      messagePadding: 8,
      chatWidth: "100%",
      chatHeight: "400px",
      enableDropShadow: true,
      showTimestamps: false,
      showPlatforms: true,
      showMessageBackground: true
    }
  };

  // Current settings
  let settings = JSON.parse(JSON.stringify(defaultSettings));

  // Connect to Socket.IO
  let socket;
  try {
    console.log("Connecting to Socket.IO server...");
    socket = io('/dashboard');
    
    socket.on('connect', () => {
      console.log("Connected to Socket.IO server");
    });
    
    socket.on('connect_error', (err) => {
      console.error("Socket.IO connection error:", err);
      showStatus('Socket connection error, please refresh page', 'error');
    });
  } catch (error) {
    console.error("Error initializing Socket.IO:", error);
    showStatus('Failed to connect to server', 'error');
  }

  // Handle settings received from server
  if (socket) {
    socket.on('settings', (receivedSettings) => {
      console.log("Received settings from server:", receivedSettings);
      
      // Validate the received settings
      if (!receivedSettings || typeof receivedSettings !== 'object') {
        console.error("Invalid settings object received:", receivedSettings);
        return;
      }
      
      // Check if streamerView exists and has the expected structure
      if (!receivedSettings.streamerView) {
        console.error("Missing streamerView in settings:", receivedSettings);
        receivedSettings.streamerView = {}; // Create it to avoid errors
      }
      
      // Ensure showMessageBackground has a default if missing
      if (receivedSettings.streamerView.showMessageBackground === undefined) {
        console.log("showMessageBackground not found in settings, using default true");
        receivedSettings.streamerView.showMessageBackground = true;
      } else {
        console.log("Found showMessageBackground in settings:", 
                   receivedSettings.streamerView.showMessageBackground);
      }
      
      // Update the local settings object
      settings = receivedSettings;
      
      // Update the UI with the processed settings
      updateUIFromSettings(settings);
    });

    // Handle settings updates from other clients
    socket.on('settings-updated', (receivedSettings) => {
      console.log("Settings updated from server:", receivedSettings);
      if (receivedSettings && typeof receivedSettings === 'object') {
        settings = receivedSettings;
        updateUIFromSettings(settings);
        showStatus('Settings updated', 'success');
      } else {
        console.error("Invalid settings update received:", receivedSettings);
      }
    });

    // Handle chat source status updates
    socket.on('chat-source-status', (status) => {
      console.log('Received chat source status update:', status);
      updateChatSourceStatus(status);
    });
  }

  // Update UI from settings object
  function updateUIFromSettings(settings) {
    console.log("Updating UI with settings:", settings);
    
    // Update OBS View form inputs
    if (settings.obsView) {
      if (obsFontSizeInput && obsFontSizeValue) {
        obsFontSizeInput.value = settings.obsView.fontSize || defaultSettings.obsView.fontSize;
        obsFontSizeValue.textContent = `${settings.obsView.fontSize || defaultSettings.obsView.fontSize}px`;
      }
      
      if (obsTextColorInput) {
        obsTextColorInput.value = settings.obsView.textColor || defaultSettings.obsView.textColor;
      }
      
      if (obsBackgroundColorInput) {
        obsBackgroundColorInput.value = settings.obsView.backgroundColor || defaultSettings.obsView.backgroundColor;
      }
      
      if (obsChatWidthInput) {
        obsChatWidthInput.value = settings.obsView.chatWidth || defaultSettings.obsView.chatWidth;
      }
      
      if (obsChatHeightInput) {
        obsChatHeightInput.value = settings.obsView.chatHeight || defaultSettings.obsView.chatHeight;
      }
      
      if (obsEnableDropShadowInput) {
        obsEnableDropShadowInput.checked = settings.obsView.enableDropShadow !== undefined ? 
          settings.obsView.enableDropShadow : defaultSettings.obsView.enableDropShadow;
      }
      
      if (obsShowMessageBackgroundInput) {
        obsShowMessageBackgroundInput.checked = settings.obsView.showMessageBackground !== undefined ? 
          settings.obsView.showMessageBackground : defaultSettings.obsView.showMessageBackground;
      }
      
      if (obsMsgOpacityInput && obsMsgOpacityValue) {
        const opacity = settings.obsView.messageOpacity !== undefined ? 
          settings.obsView.messageOpacity : defaultSettings.obsView.messageOpacity;
        
        obsMsgOpacityInput.value = opacity;
        obsMsgOpacityValue.textContent = opacity;
      }
      
      if (obsMsgBorderRadiusInput && obsMsgBorderRadiusValue) {
        const borderRadius = settings.obsView.messageBorderRadius || defaultSettings.obsView.messageBorderRadius;
        obsMsgBorderRadiusInput.value = borderRadius;
        obsMsgBorderRadiusValue.textContent = `${borderRadius}px`;
      }
      
      if (obsMsgPaddingInput && obsMsgPaddingValue) {
        const padding = settings.obsView.messagePadding || defaultSettings.obsView.messagePadding;
        obsMsgPaddingInput.value = padding;
        obsMsgPaddingValue.textContent = `${padding}px`;
      }
      
      if (obsShowTimestampsInput) {
        obsShowTimestampsInput.checked = settings.obsView.showTimestamps !== undefined ? 
          settings.obsView.showTimestamps : defaultSettings.obsView.showTimestamps;
      }
      
      if (obsShowPlatformsInput) {
        obsShowPlatformsInput.checked = settings.obsView.showPlatforms !== undefined ? 
          settings.obsView.showPlatforms : defaultSettings.obsView.showPlatforms;
      }
    }

    // Update Streamer View form inputs
    if (settings.streamerView) {
      if (streamerFontSizeInput && streamerFontSizeValue) {
        streamerFontSizeInput.value = settings.streamerView.fontSize || defaultSettings.streamerView.fontSize;
        streamerFontSizeValue.textContent = `${settings.streamerView.fontSize || defaultSettings.streamerView.fontSize}px`;
      }
      
      if (streamerTextColorInput) {
        streamerTextColorInput.value = settings.streamerView.textColor || defaultSettings.streamerView.textColor;
      }
      
      if (streamerBackgroundColorInput) {
        streamerBackgroundColorInput.value = settings.streamerView.backgroundColor || defaultSettings.streamerView.backgroundColor;
      }
      
      if (streamerChatWidthInput) {
        streamerChatWidthInput.value = settings.streamerView.chatWidth || defaultSettings.streamerView.chatWidth;
      }
      
      if (streamerChatHeightInput) {
        streamerChatHeightInput.value = settings.streamerView.chatHeight || defaultSettings.streamerView.chatHeight;
      }
      
      if (streamerEnableDropShadowInput) {
        streamerEnableDropShadowInput.checked = settings.streamerView.enableDropShadow !== undefined ? 
          settings.streamerView.enableDropShadow : defaultSettings.streamerView.enableDropShadow;
      }

      if (streamerShowMessageBackgroundInput) {
        console.log("Current showMessageBackground value:", settings.streamerView.showMessageBackground);
        // Explicitly check if the value is false to handle both undefined and false cases
        streamerShowMessageBackgroundInput.checked = settings.streamerView.showMessageBackground !== false;
        console.log("Checkbox set to:", streamerShowMessageBackgroundInput.checked);
      }
      
      if (streamerMsgOpacityInput && streamerMsgOpacityValue) {
        const opacity = settings.streamerView.messageOpacity !== undefined ? 
          settings.streamerView.messageOpacity : defaultSettings.streamerView.messageOpacity;
        
        streamerMsgOpacityInput.value = opacity;
        streamerMsgOpacityValue.textContent = opacity;
      }
      
      if (streamerMsgBorderRadiusInput && streamerMsgBorderRadiusValue) {
        const borderRadius = settings.streamerView.messageBorderRadius || defaultSettings.streamerView.messageBorderRadius;
        streamerMsgBorderRadiusInput.value = borderRadius;
        streamerMsgBorderRadiusValue.textContent = `${borderRadius}px`;
      }
      
      if (streamerMsgPaddingInput && streamerMsgPaddingValue) {
        const padding = settings.streamerView.messagePadding || defaultSettings.streamerView.messagePadding;
        streamerMsgPaddingInput.value = padding;
        streamerMsgPaddingValue.textContent = `${padding}px`;
      }
      
      if (streamerShowTimestampsInput) {
        streamerShowTimestampsInput.checked = settings.streamerView.showTimestamps !== undefined ? 
          settings.streamerView.showTimestamps : defaultSettings.streamerView.showTimestamps;
      }
      
      if (streamerShowPlatformsInput) {
        streamerShowPlatformsInput.checked = settings.streamerView.showPlatforms !== undefined ? 
          settings.streamerView.showPlatforms : defaultSettings.streamerView.showPlatforms;
      }
    }
    
    // Update Common form inputs
    if (messageLimitInput) {
      messageLimitInput.value = settings.messageLimit || defaultSettings.messageLimit;
    }
    
    if (highlightTimeoutInput && highlightTimeoutValue) {
      // Convert milliseconds to seconds for display
      const timeoutInSeconds = (settings.highlightTimeout || defaultSettings.highlightTimeout) / 1000;
      highlightTimeoutInput.value = timeoutInSeconds;
      highlightTimeoutValue.textContent = `${timeoutInSeconds}s`;
    }
    
    if (highlightColorInput) {
      highlightColorInput.value = settings.highlightColor || defaultSettings.highlightColor;
    }
    
    // Update sound settings
    if (enableSoundInput) {
      enableSoundInput.checked = settings.enableSound !== undefined ? 
        settings.enableSound : defaultSettings.enableSound;
    }
    
    if (soundVolumeInput && soundVolumeValue) {
      const volume = settings.soundVolume !== undefined ? 
        settings.soundVolume : defaultSettings.soundVolume;
      
      soundVolumeInput.value = volume;
      soundVolumeValue.textContent = volume;
    }
    
    // Reset all changed-value classes
    document.querySelectorAll('.changed-value').forEach(el => {
      el.classList.remove('changed-value');
    });
  }

  // Get current settings from inputs
  function getSettingsFromUI() {
    const newSettings = {
      messageLimit: messageLimitInput ? parseInt(messageLimitInput.value) || defaultSettings.messageLimit : defaultSettings.messageLimit,
      highlightTimeout: highlightTimeoutInput ? parseInt(highlightTimeoutInput.value) * 1000 || defaultSettings.highlightTimeout : defaultSettings.highlightTimeout,
      highlightColor: highlightColorInput ? highlightColorInput.value || defaultSettings.highlightColor : defaultSettings.highlightColor,
      enableSound: enableSoundInput ? enableSoundInput.checked : defaultSettings.enableSound,
      soundVolume: soundVolumeInput ? parseFloat(soundVolumeInput.value) || defaultSettings.soundVolume : defaultSettings.soundVolume,
      
      obsView: {
        fontSize: obsFontSizeInput ? parseInt(obsFontSizeInput.value) || defaultSettings.obsView.fontSize : defaultSettings.obsView.fontSize,
        textColor: obsTextColorInput ? obsTextColorInput.value || defaultSettings.obsView.textColor : defaultSettings.obsView.textColor,
        backgroundColor: obsBackgroundColorInput ? obsBackgroundColorInput.value || defaultSettings.obsView.backgroundColor : defaultSettings.obsView.backgroundColor,
        messageOpacity: obsMsgOpacityInput ? parseFloat(obsMsgOpacityInput.value) || defaultSettings.obsView.messageOpacity : defaultSettings.obsView.messageOpacity,
        messageBorderRadius: obsMsgBorderRadiusInput ? parseInt(obsMsgBorderRadiusInput.value) || defaultSettings.obsView.messageBorderRadius : defaultSettings.obsView.messageBorderRadius,
        messagePadding: obsMsgPaddingInput ? parseInt(obsMsgPaddingInput.value) || defaultSettings.obsView.messagePadding : defaultSettings.obsView.messagePadding,
        chatWidth: obsChatWidthInput ? obsChatWidthInput.value || defaultSettings.obsView.chatWidth : defaultSettings.obsView.chatWidth,
        chatHeight: obsChatHeightInput ? obsChatHeightInput.value || defaultSettings.obsView.chatHeight : defaultSettings.obsView.chatHeight,
        enableDropShadow: obsEnableDropShadowInput ? obsEnableDropShadowInput.checked : defaultSettings.obsView.enableDropShadow,
        showMessageBackground: obsShowMessageBackgroundInput ? obsShowMessageBackgroundInput.checked : defaultSettings.obsView.showMessageBackground,
        showTimestamps: obsShowTimestampsInput ? obsShowTimestampsInput.checked : defaultSettings.obsView.showTimestamps,
        showPlatforms: obsShowPlatformsInput ? obsShowPlatformsInput.checked : defaultSettings.obsView.showPlatforms
      },
      
      streamerView: {
        fontSize: streamerFontSizeInput ? parseInt(streamerFontSizeInput.value) || defaultSettings.streamerView.fontSize : defaultSettings.streamerView.fontSize,
        textColor: streamerTextColorInput ? streamerTextColorInput.value || defaultSettings.streamerView.textColor : defaultSettings.streamerView.textColor,
        backgroundColor: streamerBackgroundColorInput ? streamerBackgroundColorInput.value || defaultSettings.streamerView.backgroundColor : defaultSettings.streamerView.backgroundColor,
        messageOpacity: streamerMsgOpacityInput ? parseFloat(streamerMsgOpacityInput.value) || defaultSettings.streamerView.messageOpacity : defaultSettings.streamerView.messageOpacity,
        messageBorderRadius: streamerMsgBorderRadiusInput ? parseInt(streamerMsgBorderRadiusInput.value) || defaultSettings.streamerView.messageBorderRadius : defaultSettings.streamerView.messageBorderRadius,
        messagePadding: streamerMsgPaddingInput ? parseInt(streamerMsgPaddingInput.value) || defaultSettings.streamerView.messagePadding : defaultSettings.streamerView.messagePadding,
        chatWidth: streamerChatWidthInput ? streamerChatWidthInput.value || defaultSettings.streamerView.chatWidth : defaultSettings.streamerView.chatWidth,
        chatHeight: streamerChatHeightInput ? streamerChatHeightInput.value || defaultSettings.streamerView.chatHeight : defaultSettings.streamerView.chatHeight,
        enableDropShadow: streamerEnableDropShadowInput ? streamerEnableDropShadowInput.checked : defaultSettings.streamerView.enableDropShadow,
        showMessageBackground: streamerShowMessageBackgroundInput ? streamerShowMessageBackgroundInput.checked : true,
        showTimestamps: streamerShowTimestampsInput ? streamerShowTimestampsInput.checked : defaultSettings.streamerView.showTimestamps,
        showPlatforms: streamerShowPlatformsInput ? streamerShowPlatformsInput.checked : defaultSettings.streamerView.showPlatforms
      }
    };
    
    return newSettings;
  }

  // Show status message
  function showStatus(message, type) {
    if (!statusMessage) return;
    
    statusMessage.textContent = message;
    statusMessage.className = type;
    statusMessage.style.display = 'block';
    
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }
  
  // Update chat sources configuration and connections
  function updateChatSources() {
    const config = {
      twitch: {
        enabled: twitchEnabledInput ? twitchEnabledInput.checked : false,
        channelName: twitchChannelInput ? twitchChannelInput.value.trim() : ''
      },
      youtube: {
        enabled: youtubeEnabledInput ? youtubeEnabledInput.checked : false,
        url: youtubeUrlInput ? youtubeUrlInput.value.trim() : '',
        apiKey: youtubeApiKeyInput ? youtubeApiKeyInput.value.trim() : ''
      }
    };
    
    // Validate inputs
    if (config.twitch.enabled && !config.twitch.channelName) {
      showStatus('Twitch channel name is required', 'error');
      return;
    }
    
    if (config.youtube.enabled) {
      if (!config.youtube.url) {
        showStatus('YouTube channel or video URL is required', 'error');
        return;
      }

      // API key is optional - extension can be used instead
      // if (!config.youtube.apiKey) {
      //   showStatus('YouTube API key is required', 'error');
      //   return;
      // }
    }
    
    // Send configuration to server
    fetch('/api/chat-sources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        showStatus('Chat sources updated successfully', 'success');
        updateChatSourceStatus(data.status);
      } else {
        showStatus('Error updating chat sources: ' + (data.error || 'Unknown error'), 'error');
      }
    })
    .catch(error => {
      console.error('Error updating chat sources:', error);
      showStatus('Error updating chat sources: ' + error.message, 'error');
    });
  }

  // Update chat source status indicators
  function updateChatSourceStatus(status) {
    if (!status) return;
    
    // Update Twitch status
    if (status.twitch) {
      if (twitchStatus) {
        twitchStatus.textContent = status.twitch.connected ? 'Connected' : 'Disconnected';
        
        if (status.twitch.lastError) {
          twitchStatus.textContent += ` (${status.twitch.lastError})`;
        }
      }
      
      if (twitchStatusIndicator) {
        twitchStatusIndicator.classList.remove('connected', 'disconnected');
        twitchStatusIndicator.classList.add(status.twitch.connected ? 'connected' : 'disconnected');
      }
      
      if (twitchChannelInput && !twitchChannelInput.value && status.twitch.channelName) {
        twitchChannelInput.value = status.twitch.channelName;
      }
      
      if (twitchEnabledInput) {
        twitchEnabledInput.checked = status.twitch.enabled;
      }
    }
    
    // Update YouTube status
    if (status.youtube) {
      if (youtubeStatus) {
        youtubeStatus.textContent = status.youtube.connected ? 'Connected' : 'Disconnected';
        
        if (status.youtube.lastError) {
          youtubeStatus.textContent += ` (${status.youtube.lastError})`;
        }
      }
      
      if (youtubeStatusIndicator) {
        youtubeStatusIndicator.classList.remove('connected', 'disconnected');
        youtubeStatusIndicator.classList.add(status.youtube.connected ? 'connected' : 'disconnected');
      }
      
      if (youtubeEnabledInput) {
        youtubeEnabledInput.checked = status.youtube.enabled;
      }
    }
  }
  
  // Set up event listeners only if elements exist
  // OBS View sliders
  if (obsFontSizeInput && obsFontSizeValue) {
    obsFontSizeInput.addEventListener('input', function() {
      obsFontSizeValue.textContent = `${this.value}px`;
    });
  }
  
  if (obsMsgOpacityInput && obsMsgOpacityValue) {
    obsMsgOpacityInput.addEventListener('input', function() {
      obsMsgOpacityValue.textContent = this.value;
    });
  }
  
  if (obsMsgBorderRadiusInput && obsMsgBorderRadiusValue) {
    obsMsgBorderRadiusInput.addEventListener('input', function() {
      obsMsgBorderRadiusValue.textContent = `${this.value}px`;
    });
  }
  
  if (obsMsgPaddingInput && obsMsgPaddingValue) {
    obsMsgPaddingInput.addEventListener('input', function() {
      obsMsgPaddingValue.textContent = `${this.value}px`;
    });
  }
  
  // Streamer View sliders
  if (streamerFontSizeInput && streamerFontSizeValue) {
    streamerFontSizeInput.addEventListener('input', function() {
      streamerFontSizeValue.textContent = `${this.value}px`;
    });
  }
  
  if (streamerMsgOpacityInput && streamerMsgOpacityValue) {
    streamerMsgOpacityInput.addEventListener('input', function() {
      streamerMsgOpacityValue.textContent = this.value;
    });
  }
  
  if (streamerMsgBorderRadiusInput && streamerMsgBorderRadiusValue) {
    streamerMsgBorderRadiusInput.addEventListener('input', function() {
      streamerMsgBorderRadiusValue.textContent = `${this.value}px`;
    });
  }
  
  if (streamerMsgPaddingInput && streamerMsgPaddingValue) {
    streamerMsgPaddingInput.addEventListener('input', function() {
      streamerMsgPaddingValue.textContent = `${this.value}px`;
    });
  }
  
  // Common settings
  if (highlightTimeoutInput && highlightTimeoutValue) {
    highlightTimeoutInput.addEventListener('input', function() {
      highlightTimeoutValue.textContent = `${this.value}s`;
    });
  }

  if (soundVolumeInput && soundVolumeValue) {
    soundVolumeInput.addEventListener('input', function() {
      soundVolumeValue.textContent = this.value;
    });
  }

  if (testSoundButton) {
    testSoundButton.addEventListener('click', () => {
      createAudioElement();
      if (testSound) {
        const volume = soundVolumeInput ? parseFloat(soundVolumeInput.value) : 0.5;
        testSound.volume = volume;
        testSound.currentTime = 0; // Reset to beginning
        testSound.play().catch(err => {
          console.error("Error playing test sound:", err);
          showStatus('Error playing test sound: ' + err.message, 'error');
        });
      }
    });
  }

  // Connect chat sources button
  if (connectChatButton) {
    connectChatButton.addEventListener('click', () => {
      updateChatSources();
    });
  }

  // Save settings
if (saveButton) {
  saveButton.addEventListener('click', async () => {
    try {
      // Get current settings from UI
      const newSettings = getSettingsFromUI();
      console.log('Saving settings:', JSON.stringify(newSettings, null, 2));
      
      // Show "Saving..." message
      showStatus('Saving settings...', 'info');
      
      // Send settings via both methods in parallel
      const promises = [];
      
      // 1. Socket.IO method
      if (socket && socket.connected) {
        promises.push(
          new Promise(resolve => {
            socket.emit('update-settings', newSettings);
            // Consider the socket emit successful
            resolve();
          })
        );
      }
      
      // 2. REST API method
      promises.push(
        fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newSettings)
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
      );
      
      // Wait for both methods to complete (or fail)
      const results = await Promise.allSettled(promises);
      
      // Check if at least one method succeeded
      const success = results.some(result => result.status === 'fulfilled');
      
      if (success) {
        showStatus('Settings saved successfully', 'success');
      } else {
        // Get error from the REST API call if available
        const error = results[results.length - 1].reason;
        showStatus('Error saving settings: ' + (error?.message || 'Connection error'), 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus('Error saving settings: ' + error.message, 'error');
    }
  });
}

// Reset to defaults
if (resetButton) {
  resetButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      updateUIFromSettings(defaultSettings);
      
      // Send settings to server
      fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(defaultSettings)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          showStatus('Settings reset to defaults', 'success');
        } else {
          showStatus('Error resetting settings: ' + (data.error || 'Unknown error'), 'error');
        }
      })
      .catch(error => {
        console.error('Error resetting settings:', error);
        showStatus('Error resetting settings: ' + error.message, 'error');
      });
    }
  });
}

// Fetch current settings on load
fetch('/api/settings')
.then(response => {
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
})
.then(fetchedSettings => {
  console.log('Fetched initial settings:', fetchedSettings);
  
  // Validate the fetched settings
  if (!fetchedSettings || typeof fetchedSettings !== 'object') {
    console.error("Invalid settings object received from API:", fetchedSettings);
    throw new Error("Invalid settings format");
  }
  
  // Ensure streamerView exists
  if (!fetchedSettings.streamerView) {
    console.warn("No streamerView in fetched settings, creating it");
    fetchedSettings.streamerView = {};
  }
  
  // Check specifically for showMessageBackground
  if (fetchedSettings.streamerView.showMessageBackground === undefined) {
    console.warn("No showMessageBackground in fetched settings, using default");
    fetchedSettings.streamerView.showMessageBackground = true;
  } else {
    console.log("showMessageBackground value from API:", 
                fetchedSettings.streamerView.showMessageBackground);
  }
  
  // Update settings and UI
  settings = fetchedSettings;
  updateUIFromSettings(settings);
})
.catch(error => {
  console.error('Error fetching settings:', error);
  showStatus('Error fetching settings: ' + error.message, 'error');
  // Fall back to defaults
  updateUIFromSettings(defaultSettings);
});

// Fetch chat sources status on load
fetch('/api/chat-sources')
.then(response => {
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
})
.then(data => {
  console.log('Fetched chat sources status:', data);
  updateChatSourceStatus(data);
})
.catch(error => {
  console.error('Error fetching chat sources status:', error);
});
});