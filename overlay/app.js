document.addEventListener('DOMContentLoaded', () => {
    // Apply custom styling
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
            margin-bottom: 8px !important;
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
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
        }
        .message-content a {
            color: white !important;
            text-decoration: none !important;
            pointer-events: none !important;
        }
        .platform-icon {
            width: 16px !important;
            height: 16px !important;
            margin-right: 6px !important;
            display: inline-block !important;
            vertical-align: middle !important;
            background-size: contain !important;
            background-repeat: no-repeat !important;
            background-position: center !important;
        }
        .youtube .platform-icon {
            background-image: url('https://www.youtube.com/favicon.ico') !important;
        }
        .twitch .platform-icon {
            background-image: url('https://www.twitch.tv/favicon.ico') !important;
        }
        .message-content img, 
        .message-content span[role="img"],
        .message-content .emoji,
        .message-content em img,
        .message-content em span {
            vertical-align: middle !important;
            height: 1.2em !important;
            width: auto !important;
            max-height: 1.2em !important;
            max-width: 1.5em !important;
            margin: 0 0.1em !important;
            display: inline-flex !important;
            font-size: inherit !important;
        }
        
        img.emoji {
            height: 1.2em !important;
            width: auto !important;
        }
        #settings-panel, #toggle-settings {
            display: none !important;
        }
    `;
    document.head.appendChild(style);

    // Get elements
    const chatContainer = document.getElementById('chat-container');
    
    // Track manual scrolling
    let userScrolled = false;
    
    // Create Socket.io connection
    const socket = io();
    
    // Handle chat messages
    socket.on('chat-message', (message) => {
        addChatMessage(message);
    });
    
    // Track scroll position more accurately
    chatContainer.addEventListener('scroll', () => {
        const scrollBottom = chatContainer.scrollHeight - chatContainer.clientHeight;
        // Consider the user as "not scrolled" if they're close to the bottom
        userScrolled = scrollBottom - chatContainer.scrollTop > 30;
    });
    
    // Improved scroll to bottom function
    function scrollToBottom() {
        // Force a layout calculation
        chatContainer.offsetHeight;
        
        // First scroll attempt
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Multiple delayed attempts to ensure all content renders
        const scrollAttempts = [10, 50, 100, 300];
        scrollAttempts.forEach(delay => {
            setTimeout(() => {
                if (!userScrolled) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }, delay);
        });
    }
    
    // Function to add a chat message
    function addChatMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        messageElement.classList.add(message.platform.toLowerCase());
        messageElement.dataset.id = message.id;
        
        // Create badges HTML
        let badgesHtml = '';
        if (message.badges && message.badges.length > 0) {
            badgesHtml = '<div class="badges">';
            badgesHtml += message.badges.map(badge => 
                `<span class="badge" style="background-image: url('${badge}')"></span>`
            ).join('');
            badgesHtml += '</div>';
        }
        
        // Create message content
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="platform-icon"></span>
                <span class="username">${message.username}</span>
                ${badgesHtml}
            </div>
            <div class="message-content">${message.content}</div>
        `;
        
        // Add click event to highlight message
        messageElement.addEventListener('click', () => {
            socket.emit('highlight-message', message.id);
        });
        
        // Add to chat container
    chatContainer.appendChild(messageElement);
    
    // Keep only the last 50 messages in the DOM
    const messages = chatContainer.getElementsByClassName('chat-message');
    while (messages.length > 50) {
        chatContainer.removeChild(messages[0]);
    }
    
    // Clear chat container if there are more than 50 messages
    if (messages.length > 50) {
        // Remove all messages and re-add only the last 50
        while (chatContainer.firstChild) {
            chatContainer.removeChild(chatContainer.firstChild);
        }
        
        // Get the last 50 messages from the backend
        const lastMessages = chatMessages.slice(-50);
        lastMessages.forEach(msg => addMessage(msg));
    }
    
        
        // Set up a mutation observer to catch emoji rendering
        const messageObserver = new MutationObserver(() => {
            if (!userScrolled) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        });
        
        // Observe the message element for changes
        messageObserver.observe(messageElement, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true
        });
        
        // Auto-scroll if not manually scrolled up
        if (!userScrolled) {
            scrollToBottom();
        }
    }
});