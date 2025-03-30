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
// Function to add a chat message
function addChatMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
    messageElement.classList.add(message.platform.toLowerCase());
    messageElement.dataset.id = message.id;
    
    // Create the message header container
    const messageHeader = document.createElement('div');
    messageHeader.className = 'message-header';
    
    // Add platform icon
    const platformIcon = document.createElement('span');
    platformIcon.className = 'platform-icon';
    messageHeader.appendChild(platformIcon);
    
    // Add badges BEFORE username (creating as actual elements)
    if (message.badges && message.badges.length > 0) {
        const badgesContainer = document.createElement('div');
        badgesContainer.className = 'badges';
        
        message.badges.forEach(badge => {
            const badgeImg = document.createElement('img');
            badgeImg.className = 'badge';
            badgeImg.src = badge;
            badgeImg.alt = 'Badge';
            badgesContainer.appendChild(badgeImg);
        });
        
        messageHeader.appendChild(badgesContainer);
    }
    
    // Add username AFTER badges
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.textContent = message.username;
    messageHeader.appendChild(usernameSpan);
    
    // Create message content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = message.content;
    
    // Add all elements to the message
    messageElement.appendChild(messageHeader);
    messageElement.appendChild(contentDiv);
    
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
    
    // Auto-scroll if not manually scrolled up
    if (!userScrolled) {
        scrollToBottom();
    }
}
});