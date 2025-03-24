document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const chatContainer = document.getElementById('chat-container');
    const highlightedContainer = document.getElementById('highlighted-message-container');
    const settingsPanel = document.getElementById('settings-panel');
    const toggleSettingsBtn = document.getElementById('toggle-settings');
    const saveSettingsBtn = document.getElementById('save-settings');
    const resetSettingsBtn = document.getElementById('reset-settings');
    
    // Settings elements
    const themeSelect = document.getElementById('theme-select');
    const fontSizeSlider = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    const messageLimitInput = document.getElementById('message-limit');
    const showBadgesCheckbox = document.getElementById('show-badges');
    const showTimestampsCheckbox = document.getElementById('show-timestamps');
    const showPlatformsCheckbox = document.getElementById('show-platforms');
    const bgColorPicker = document.getElementById('background-color');
    const textColorPicker = document.getElementById('text-color');
    const highlightColorPicker = document.getElementById('highlight-color');
    
    // Default settings
    let settings = {
        theme: 'dark',
        fontSize: 16,
        messageLimit: 50,
        showBadges: true,
        showTimestamps: false,
        showPlatforms: true,
        backgroundColor: '#222222',
        textColor: '#ffffff',
        highlightColor: '#ff5500'
    };
    
    // Chat message cache
    let chatMessages = [];
    
    // Socket.io connection
    const socket = io();
    
    // Connect to WebSocket server
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    // Load settings
    fetch('/settings')
        .then(response => response.json())
        .then(data => {
            settings = {...settings, ...data};
            applySettings();
        })
        .catch(error => console.error('Error loading settings:', error));
    
    // Handle chat messages
    socket.on('chat-message', (message) => {
        // Add to local cache
        chatMessages.push(message);
        
        // Limit cache size
        if (chatMessages.length > 200) {
            chatMessages = chatMessages.slice(-200);
        }
        
        // Add to UI
        addChatMessage(message);
        
        // Limit the number of messages in the UI
        const messages = chatContainer.getElementsByClassName('chat-message');
        while (messages.length > settings.messageLimit) {
            if (messages[0]) {
                chatContainer.removeChild(messages[0]);
            } else {
                break;
            }
        }
    });
    
    // Handle chat history
    socket.on('chat-history', (messages) => {
        // Update local cache
        chatMessages = messages.slice(-200);
        
        // Clear existing messages
        chatContainer.innerHTML = '';
        
        // Add messages in order (limited by settings)
        chatMessages.slice(-settings.messageLimit).forEach(message => {
            addChatMessage(message);
        });
    });
    
    // Handle highlighted message
    socket.on('highlight-message', (message) => {
        highlightMessage(message);
    });
    
    // Handle clearing highlighted message
    socket.on('clear-highlight', () => {
        highlightedContainer.style.display = 'none';
    });
    
    // Handle settings updated
    socket.on('settings-updated', (newSettings) => {
        settings = {...settings, ...newSettings};
        applySettings();
    });
    
    // Platform icons
    const platformIcons = {
        youtube: '🔴',
        twitch: '💜',
        test: '🔧'
    };
    
    // Function to add a chat message
    function addChatMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        messageElement.classList.add(message.platform.toLowerCase());
        messageElement.classList.add(`platform-${message.platform.toLowerCase()}`);
        messageElement.dataset.id = message.id;
        
        // Format timestamp
        let formattedTime = '';
        try {
            const timestamp = new Date(message.timestamp);
            formattedTime = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;
        } catch (e) {
            formattedTime = message.timestamp || '';
        }
        
        // Create badges HTML
        let badgesHtml = '';
        if (settings.showBadges && message.badges && message.badges.length > 0) {
            badgesHtml = '<div class="badges">';
            badgesHtml += message.badges.map(badge => 
                `<span class="badge" style="background-image: url('${badge}')"></span>`
            ).join('');
            badgesHtml += '</div>';
        }
        
        // Create platform icon
        let platformIconHtml = '';
        if (settings.showPlatforms) {
            const icon = platformIcons[message.platform.toLowerCase()] || '❓';
            platformIconHtml = `<span class="platform-icon">${icon}</span>`;
        }
        
        // Create timestamp HTML
        let timestampHtml = '';
        if (settings.showTimestamps && formattedTime) {
            timestampHtml = `<span class="timestamp">${formattedTime}</span>`;
        }
        
        // Create message content
        messageElement.innerHTML = `
            <div class="message-header">
                ${platformIconHtml}
                <span class="username" style="color: ${message.color || '#ffffff'}">${message.username}</span>
                ${badgesHtml}
                ${timestampHtml}
            </div>
            <div class="message-content">${message.content}</div>
        `;
        
        // Add double-click event to highlight message
        messageElement.addEventListener('dblclick', () => {
            socket.emit('highlight-message', message.id);
        });
        
        // Add to chat container and scroll to bottom
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    // Function to highlight a message
    function highlightMessage(message) {
        highlightedContainer.style.display = 'block';
        highlightedContainer.style.borderLeftColor = settings.highlightColor;
        
        // Format timestamp
        let formattedTime = '';
        try {
            const timestamp = new Date(message.timestamp);
            formattedTime = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;
        } catch (e) {
            formattedTime = message.timestamp || '';
        }
        
        // Create badges HTML
        let badgesHtml = '';
        if (settings.showBadges && message.badges && message.badges.length > 0) {
            badgesHtml = '<div class="badges">';
            badgesHtml += message.badges.map(badge => 
                `<span class="badge" style="background-image: url('${badge}')"></span>`
            ).join('');
            badgesHtml += '</div>';
        }
        
        // Create platform icon
        const icon = platformIcons[message.platform.toLowerCase()] || '❓';
        
        // Create timestamp HTML
        let timestampHtml = '';
        if (settings.showTimestamps && formattedTime) {
            timestampHtml = `<span class="timestamp">${formattedTime}</span>`;
        }
        
        highlightedContainer.innerHTML = `
            <div class="message-header">
                <span class="platform-icon">${icon}</span>
                <span class="username" style="color: ${message.color || '#ffffff'}">${message.username}</span>
                ${badgesHtml}
                ${timestampHtml}
            </div>
            <div class="message-content">${message.content}</div>
        `;
        
        // Add click event to clear highlight
        highlightedContainer.addEventListener('click', () => {
            socket.emit('clear-highlight');
        });
    }
    
    // Function to apply settings
    function applySettings() {
        // Apply theme
        document.body.classList.remove('light-theme', 'dark-theme', 'custom-theme');
        document.body.classList.add(`${settings.theme}-theme`);
        
        // Apply font size
        document.documentElement.style.setProperty('--font-size', `${settings.fontSize}px`);
        
        // Apply custom colors if in custom theme
        if (settings.theme === 'custom') {
            document.documentElement.style.setProperty('--custom-bg-color', settings.backgroundColor);
            document.documentElement.style.setProperty('--custom-text-color', settings.textColor);
            document.documentElement.style.setProperty('--custom-highlight-color', settings.highlightColor);
        }
        
        // Update settings form
        themeSelect.value = settings.theme;
        fontSizeSlider.value = settings.fontSize;
        fontSizeValue.textContent = `${settings.fontSize}px`;
        messageLimitInput.value = settings.messageLimit;
        showBadgesCheckbox.checked = settings.showBadges;
        showTimestampsCheckbox.checked = settings.showTimestamps;
        showPlatformsCheckbox.checked = settings.showPlatforms;
        bgColorPicker.value = settings.backgroundColor;
        textColorPicker.value = settings.textColor;
        highlightColorPicker.value = settings.highlightColor;
        
        // If message limit changed, trim displayed messages
        const messages = chatContainer.getElementsByClassName('chat-message');
        while (messages.length > settings.messageLimit) {
            if (messages[0]) {
                chatContainer.removeChild(messages[0]);
            } else {
                break;
            }
        }
    }
    
    // Settings form events
    fontSizeSlider.addEventListener('input', () => {
        fontSizeValue.textContent = `${fontSizeSlider.value}px`;
    });
    
    // Show/hide theme-specific color pickers
    themeSelect.addEventListener('change', () => {
        const customColorSection = document.getElementById('custom-colors-section');
        if (customColorSection) {
            customColorSection.style.display = themeSelect.value === 'custom' ? 'block' : 'none';
        }
    });
    
    // Toggle settings panel
    toggleSettingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });
    
    // Save settings
    saveSettingsBtn.addEventListener('click', () => {
        const newSettings = {
            theme: themeSelect.value,
            fontSize: parseInt(fontSizeSlider.value),
            messageLimit: parseInt(messageLimitInput.value),
            showBadges: showBadgesCheckbox.checked,
            showTimestamps: showTimestampsCheckbox.checked,
            showPlatforms: showPlatformsCheckbox.checked,
            backgroundColor: bgColorPicker.value,
            textColor: textColorPicker.value,
            highlightColor: highlightColorPicker.value
        };
        
        // Save settings to server
        fetch('/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newSettings)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                settings = newSettings;
                applySettings();
                settingsPanel.classList.add('hidden');
            }
        })
        .catch(error => console.error('Error saving settings:', error));
    });
    
    // Reset settings
    resetSettingsBtn.addEventListener('click', () => {
        fetch('/settings')
            .then(response => response.json())
            .then(data => {
                settings = data;
                applySettings();
            })
            .catch(error => console.error('Error loading settings:', error));
    });
    
    // Handle automatic scrolling
    chatContainer.addEventListener('scroll', () => {
        // Store current scroll position to determine if auto-scroll should be enabled
        const isScrolledToBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 50;
        chatContainer.dataset.autoScroll = isScrolledToBottom.toString();
    });
    
    // Initialize with settings and load chat history
    applySettings();
});