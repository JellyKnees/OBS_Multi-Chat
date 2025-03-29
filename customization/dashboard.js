document.addEventListener('DOMContentLoaded', () => {
  // Safely get DOM elements with null checks
  const getElement = (id) => document.getElementById(id);

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
  
  const saveButton = getElement('saveSettings');
  const resetButton = getElement('resetSettings');
  const statusMessage = getElement('status-message');

  // Get tab buttons
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Add tab switching functionality
  if (tabButtons && tabButtons.length > 0) {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
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
      showPlatforms: true
    }
  };

  // Current settings
  let settings = JSON.parse(JSON.stringify(defaultSettings));

  // Connect to Socket.IO
  const socket = io();

  // Handle settings received from server
  socket.on('settings', (receivedSettings) => {
    console.log("Received settings:", receivedSettings);
    settings = receivedSettings;
    updateUIFromSettings(settings);
  });

  // Handle settings updates from other clients
  socket.on('settings-updated', (receivedSettings) => {
    console.log("Settings updated from server:", receivedSettings);
    settings = receivedSettings;
    updateUIFromSettings(settings);
    showStatus('Settings updated', 'success');
  });

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
    
    // Reset all changed-value classes
    document.querySelectorAll('.changed-value').forEach(el => {
      el.classList.remove('changed-value');
    });
  }

  // Get current settings from inputs
  function getSettingsFromUI() {
    const settings = {
      messageLimit: messageLimitInput ? parseInt(messageLimitInput.value) || defaultSettings.messageLimit : defaultSettings.messageLimit,
      highlightTimeout: highlightTimeoutInput ? parseInt(highlightTimeoutInput.value) * 1000 || defaultSettings.highlightTimeout : defaultSettings.highlightTimeout,
      highlightColor: highlightColorInput ? highlightColorInput.value || defaultSettings.highlightColor : defaultSettings.highlightColor,
      
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
        showTimestamps: streamerShowTimestampsInput ? streamerShowTimestampsInput.checked : defaultSettings.streamerView.showTimestamps,
        showPlatforms: streamerShowPlatformsInput ? streamerShowPlatformsInput.checked : defaultSettings.streamerView.showPlatforms
      }
    };
    
    return settings;
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

  // Save settings
  if (saveButton) {
    saveButton.addEventListener('click', () => {
      const newSettings = getSettingsFromUI();
      console.log('Saving settings:', JSON.stringify(newSettings, null, 2));
      
      // Send settings to server via Socket.IO
      socket.emit('update-settings', newSettings);
      
      // Also send via REST API for redundancy
      fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettings)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showStatus('Settings saved successfully', 'success');
        } else {
          showStatus('Error saving settings', 'error');
        }
      })
      .catch(error => {
        console.error('Error saving settings:', error);
        showStatus('Error saving settings', 'error');
      });
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
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            showStatus('Settings reset to defaults', 'success');
          } else {
            showStatus('Error resetting settings', 'error');
          }
        })
        .catch(error => {
          console.error('Error resetting settings:', error);
          showStatus('Error resetting settings', 'error');
        });
      }
    });
  }

  // Fetch current settings on load
  fetch('/api/settings')
    .then(response => response.json())
    .then(fetchedSettings => {
      console.log('Fetched initial settings:', fetchedSettings);
      settings = fetchedSettings;
      updateUIFromSettings(settings);
    })
    .catch(error => {
      console.error('Error fetching settings:', error);
      showStatus('Error fetching settings', 'error');
      // Fall back to defaults
      updateUIFromSettings(defaultSettings);
    });
});