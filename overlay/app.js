document.addEventListener('DOMContentLoaded', () => {
    // Force all styling with inline CSS
    const style = document.createElement('style');
    style.textContent = `
        #chat-container {
            height: 400px !important;
            overflow-y: scroll !important;
            scroll-behavior: smooth !important;
        }
        .chat-message {
            cursor: pointer !important; 
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8) !important;
        }
        .youtube .username {
            color: #ff0000 !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: 18px !important;
        }
        .twitch .username {
            color: #9146FF !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: bold !important;
            font-size: 18px !important;
        }
        .message-content {
            color: white !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 18px !important;
            /* Fix for long unbroken text */
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
        }
        .message-content a {
            color: white !important;
            text-decoration: none !important;
            pointer-events: none !important;
        }
        #settings-panel, #toggle-settings {
            display: none !important;
        }
    `;
    document.head.appendChild(style);

    // Get DOM elements
    const chatContainer = document.getElementById('chat-container');
    const highlightedContainer = document.getElementById('highlighted-message-container');
    
    // Socket connection
    const socket = io();
    
    // Platform icons
    const platformIcons = {
        youtube: '🔴',
        twitch: '💜',
        test: '🔧'
    };
    
    // Message cache
    let chatMessages = [];
    
    // Create a reliable auto-scroll function
    function scrollToBottom() {
        // Use setTimeout to ensure the DOM has updated
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 0);
    }
    
    // Handle incoming messages
    socket.on('chat-message', (message) => {
        chatMessages.push(message);
        addMessage(message);
        
        // Auto-scroll unless user has manually scrolled up
        const nearBottom = chatContainer.scrollHeight - chatContainer.clientHeight - chatContainer.scrollTop < 50;
        if (nearBottom) {
            scrollToBottom();
        }
    });
    
    // Handle chat history
    socket.on('chat-history', (messages) => {
        chatContainer.innerHTML = '';
        chatMessages = messages;
        messages.forEach(msg => addMessage(msg, false)); // Don't scroll for each history message
        scrollToBottom(); // Scroll once at the end
    });
    
    // Handle highlighted message
    socket.on('highlight-message', (message) => {
        showHighlighted(message);
    });
    
    // Handle clearing highlighted message
    socket.on('clear-highlight', () => {
        highlightedContainer.style.display = 'none';
    });
    
    // Add message to display
    function addMessage(message, scroll = true) {
        const msgElement = document.createElement('div');
        msgElement.classList.add('chat-message');
        msgElement.classList.add(message.platform.toLowerCase());
        msgElement.dataset.id = message.id;
        
        // Sanitize message content to handle emojis better
        const sanitizedContent = message.content || '';
        
        msgElement.innerHTML = `
            <div class="message-header">
                <span class="platform-icon">${platformIcons[message.platform.toLowerCase()] || '❓'}</span>
                <span class="username">${message.username}</span>
            </div>
            <div class="message-content">${sanitizedContent}</div>
        `;
        
        chatContainer.appendChild(msgElement);
        
        // Only scroll if requested (and not as part of loading history)
        if (scroll) {
            scrollToBottom();
        }
    }
    
    // Show highlighted message
    function showHighlighted(message) {
        highlightedContainer.style.display = 'block';
        highlightedContainer.className = message.platform.toLowerCase();
        
        const sanitizedContent = message.content || '';
        
        highlightedContainer.innerHTML = `
            <div class="message-header">
                <span class="platform-icon">${platformIcons[message.platform.toLowerCase()] || '❓'}</span>
                <span class="username">${message.username}</span>
            </div>
            <div class="message-content">${sanitizedContent}</div>
        `;
        
        highlightedContainer.addEventListener('click', () => {
            socket.emit('clear-highlight');
        });
    }
    
    // Click on message to highlight
    chatContainer.addEventListener('click', (event) => {
        const msgElement = event.target.closest('.chat-message');
        if (msgElement && msgElement.dataset.id) {
            const messageId = msgElement.dataset.id;
            socket.emit('highlight-message', messageId);
        }
    });
    
    // Manual scroll detection
    chatContainer.addEventListener('scroll', () => {
        // Nothing specific needed here, auto-scroll is handled when messages arrive
    });
});