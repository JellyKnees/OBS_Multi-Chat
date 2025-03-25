document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const fontSizeInput = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const textColorInput = document.getElementById('textColor');
    const chatWidthInput = document.getElementById('chatWidth');
    const chatHeightInput = document.getElementById('chatHeight');
    const messageLimitInput = document.getElementById('messageLimit');
    const highlightTimeoutInput = document.getElementById('highlightTimeout');
    const highlightTimeoutValue = document.getElementById('highlightTimeoutValue');
    const saveButton = document.getElementById('saveSettings');
    const resetButton = document.getElementById('resetSettings');
    const statusMessage = document.getElementById('status-message');

    // Preview elements
    const previewChat = document.getElementById('preview-chat');
    const previewMessages = document.querySelectorAll('.preview-message');
    const previewContents = document.querySelectorAll('.preview-content');
    const previewHighlight = document.querySelector('.preview-highlight');

    // Default settings
    const defaultSettings = {
        fontSize: 16,
        textColor: "#ffffff",
        chatWidth: "100%",
        chatHeight: "400px",
        messageLimit: 50,
        highlightTimeout: 10000
    };

    // Connect to Socket.IO
    const socket = io();

    // Handle settings received from server
    socket.on('settings', (settings) => {
        updateUIFromSettings(settings);
    });

    // Handle settings updates from other clients
    socket.on('settings-updated', (settings) => {
        updateUIFromSettings(settings);
        showStatus('Settings updated', 'success');
    });

    // Update UI from settings object
    function updateUIFromSettings(settings) {
        // Update form inputs
        fontSizeInput.value = settings.fontSize || defaultSettings.fontSize;
        fontSizeValue.textContent = `${settings.fontSize || defaultSettings.fontSize}px`;
        textColorInput.value = settings.textColor || defaultSettings.textColor;
        chatWidthInput.value = settings.chatWidth || defaultSettings.chatWidth;
        chatHeightInput.value = settings.chatHeight || defaultSettings.chatHeight;
        messageLimitInput.value = settings.messageLimit || defaultSettings.messageLimit;
        
        // Convert milliseconds to seconds for display
        const timeoutInSeconds = (settings.highlightTimeout || defaultSettings.highlightTimeout) / 1000;
        highlightTimeoutInput.value = timeoutInSeconds;
        highlightTimeoutValue.textContent = `${timeoutInSeconds}s`;
        
        // Update preview
        updatePreview(settings);
    }

    // Update live preview
    function updatePreview(settings) {
        // Apply font size to preview content
        previewContents.forEach(element => {
            element.style.fontSize = `${settings.fontSize || defaultSettings.fontSize}px`;
        });

        // Apply text color to preview content
        previewContents.forEach(element => {
            element.style.color = settings.textColor || defaultSettings.textColor;
        });

        // Apply chat dimensions
        if (previewChat) {
            previewChat.style.width = settings.chatWidth || defaultSettings.chatWidth;
            previewChat.style.height = settings.chatHeight || defaultSettings.chatHeight;
        }
    }

    // Get current settings from inputs
    function getSettingsFromUI() {
        return {
            fontSize: parseInt(fontSizeInput.value) || defaultSettings.fontSize,
            textColor: textColorInput.value || defaultSettings.textColor,
            chatWidth: chatWidthInput.value || defaultSettings.chatWidth,
            chatHeight: chatHeightInput.value || defaultSettings.chatHeight,
            messageLimit: parseInt(messageLimitInput.value) || defaultSettings.messageLimit,
            highlightTimeout: parseInt(highlightTimeoutInput.value) * 1000 || defaultSettings.highlightTimeout // Convert to milliseconds
        };
    }

    // Show status message
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = type;
        statusMessage.style.display = 'block';
        
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }

    // Event listeners for real-time preview updates
    fontSizeInput.addEventListener('input', () => {
        fontSizeValue.textContent = `${fontSizeInput.value}px`;
        updatePreview(getSettingsFromUI());
    });

    textColorInput.addEventListener('input', () => {
        updatePreview(getSettingsFromUI());
    });

    chatWidthInput.addEventListener('input', () => {
        updatePreview(getSettingsFromUI());
    });

    chatHeightInput.addEventListener('input', () => {
        updatePreview(getSettingsFromUI());
    });

    highlightTimeoutInput.addEventListener('input', () => {
        highlightTimeoutValue.textContent = `${highlightTimeoutInput.value}s`;
    });

    // Save settings
    saveButton.addEventListener('click', () => {
        const settings = getSettingsFromUI();
        
        // Send settings to server
        fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
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

    // Reset to defaults
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

    // Fetch current settings on load
    fetch('/api/settings')
        .then(response => response.json())
        .then(settings => {
            updateUIFromSettings(settings);
        })
        .catch(error => {
            console.error('Error fetching settings:', error);
            showStatus('Error fetching settings', 'error');
            // Fall back to defaults
            updateUIFromSettings(defaultSettings);
        });
});