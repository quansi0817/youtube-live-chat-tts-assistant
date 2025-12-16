/**
 * YouTube Chat Scraper
 * Scrapes chat messages from YouTube live chat page using DOM manipulation
 */

class YouTubeChatScraper {
    constructor() {
        this.isConnected = false;
        this.videoId = null;
        this.chatWindow = null;
        this.messageHistory = new Set();
        this.onMessageCallback = null;
        this.checkInterval = null;
        this.lastMessageTime = Date.now();
    }

    /**
     * Connect to YouTube live chat
     * @param {string} videoId - YouTube video ID
     * @param {Function} onMessage - Callback when new message is received
     */
    async connect(videoId, onMessage) {
        if (this.isConnected) {
            this.disconnect();
        }

        this.videoId = videoId;
        this.onMessageCallback = onMessage;
        
        // Open YouTube live chat in a new window
        const chatUrl = `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;
        this.chatWindow = window.open(chatUrl, 'youtube-chat', 'width=400,height=600');
        
        if (!this.chatWindow) {
            throw new Error('Popup blocked. Please allow popups for this site.');
        }

        // Wait for window to load
        await this.waitForWindowLoad();
        
        // Start scraping
        this.isConnected = true;
        this.startScraping();
        
        return true;
    }

    /**
     * Wait for chat window to load
     */
    waitForWindowLoad() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds
            
            const checkLoad = setInterval(() => {
                attempts++;
                
                try {
                    // Check if window is still open
                    if (this.chatWindow.closed) {
                        clearInterval(checkLoad);
                        reject(new Error('Chat window was closed'));
                        return;
                    }

                    // Check if document is accessible
                    const doc = this.chatWindow.document;
                    if (doc && doc.readyState === 'complete') {
                        // Check if chat container exists
                        const chatContainer = doc.querySelector('yt-live-chat-app #items.yt-live-chat-item-list-renderer');
                        if (chatContainer) {
                            clearInterval(checkLoad);
                            resolve();
                            return;
                        }
                    }
                } catch (e) {
                    // Cross-origin error - window might be loading
                    if (attempts >= maxAttempts) {
                        clearInterval(checkLoad);
                        reject(new Error('Timeout waiting for chat window to load'));
                    }
                }
            }, 100);
        });
    }

    /**
     * Start scraping chat messages
     */
    startScraping() {
        // Inject script into chat window to scrape messages
        this.injectScraperScript();
        
        // Also set up polling as fallback
        this.checkInterval = setInterval(() => {
            this.scrapeMessages();
        }, 1000);
    }

    /**
     * Get bookmarklet script for user to install
     */
    getBookmarkletScript() {
        // This script will be injected into YouTube live_chat page
        // User needs to run this script manually in the console or as a bookmarklet
        const script = `
(function() {
    if (window.YouTubeChatScraperInstalled) {
        console.log('YouTube Chat Scraper already installed');
        return;
    }
    window.YouTubeChatScraperInstalled = true;
    
    const messageHistory = new Set();
    const targetWindow = window.opener || window.parent;
    
    function scrapeMessage(element) {
        try {
            const authorElement = element.querySelector('#author-name');
            const messageElement = element.querySelector('#message, .yt-live-chat-text-message-renderer #message');
            
            if (!authorElement || !messageElement) {
                return null;
            }
            
            const messageId = element.id || element.getAttribute('data-message-id') || 
                             authorElement.textContent + '_' + messageElement.textContent.substring(0, 20) + '_' + Date.now();
            
            if (messageHistory.has(messageId)) {
                return null;
            }
            
            messageHistory.add(messageId);
            
            const chatname = authorElement.innerText || authorElement.textContent || '';
            const chatmessage = messageElement.innerText || messageElement.textContent || '';
            
            if (!chatname || !chatmessage) {
                return null;
            }
            
            const timeElement = element.querySelector('#timestamp');
            const timestamp = timeElement ? timeElement.textContent : new Date().toLocaleTimeString();
            
            return {
                id: messageId,
                author: chatname.trim(),
                message: chatmessage.trim(),
                timestamp: timestamp
            };
        } catch (e) {
            console.error('Error scraping message:', e);
            return null;
        }
    }
    
    function sendMessage(data) {
        // Try to send to opener window (main app)
        if (targetWindow && targetWindow !== window) {
            try {
                targetWindow.postMessage({
                    type: 'YOUTUBE_CHAT_MESSAGE',
                    data: data
                }, '*');
            } catch (e) {
                console.error('Error sending message:', e);
            }
        }
        
        // Also log to console for debugging
        console.log('Chat message:', data);
    }
    
    function initScraper() {
        const chatContainer = document.querySelector('yt-live-chat-app #items.yt-live-chat-item-list-renderer');
        
        if (!chatContainer) {
            console.warn('Chat container not found, retrying...');
            setTimeout(initScraper, 1000);
            return;
        }
        
        console.log('YouTube Chat Scraper initialized');
        
        // Process existing messages
        const existingMessages = chatContainer.querySelectorAll('yt-live-chat-text-message-renderer');
        existingMessages.forEach(msg => {
            const data = scrapeMessage(msg);
            if (data) {
                sendMessage(data);
            }
        });
        
        // Watch for new messages
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER') {
                            setTimeout(() => {
                                const data = scrapeMessage(node);
                                if (data) {
                                    sendMessage(data);
                                }
                            }, 100);
                        } else if (node.querySelector && node.querySelector('yt-live-chat-text-message-renderer')) {
                            const target = node.querySelector('yt-live-chat-text-message-renderer');
                            if (target) {
                                setTimeout(() => {
                                    const data = scrapeMessage(target);
                                    if (data) {
                                        sendMessage(data);
                                    }
                                }, 100);
                            }
                        }
                    }
                });
            });
        });
        
        observer.observe(chatContainer, {
            childList: true,
            subtree: true
        });
    }
    
    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScraper);
    } else {
        initScraper();
    }
})();
        `.trim();
        
        return script;
    }

    /**
     * Inject scraper script into YouTube chat window
     * Note: Due to CORS, this will only work if the window is opened from our domain
     * Otherwise, user needs to manually run the script
     */
    injectScraperScript() {
        try {
            const doc = this.chatWindow.document;
            const script = doc.createElement('script');
            script.textContent = this.getBookmarkletScript();
            doc.head.appendChild(script);
        } catch (e) {
            // CORS error - user needs to manually run the script
            console.warn('Cannot inject script due to CORS. Please run the script manually in the YouTube chat window console.');
            this.showManualInstructions();
        }
    }

    /**
     * Show instructions for manual script installation
     */
    showManualInstructions() {
        const script = this.getBookmarkletScript();
        const instructions = `
⚠️ Manual Script Installation Required

Due to browser security restrictions, you need to manually run a script in the YouTube chat window.

Steps:
1. The YouTube chat window should have opened
2. Open the browser console in that window (F12 or Right-click > Inspect)
3. Copy and paste this script into the console and press Enter:

${script}

Alternatively, you can create a bookmarklet:
1. Create a new bookmark
2. Set the URL to: javascript:${encodeURIComponent(script)}
3. Click the bookmark when on the YouTube chat page
        `;
        
        alert(instructions);
        console.log('Manual script:', script);
    }

    /**
     * Scrape messages using polling (fallback method)
     */
    scrapeMessages() {
        if (!this.isConnected || !this.chatWindow || this.chatWindow.closed) {
            this.disconnect();
            return;
        }

        try {
            const doc = this.chatWindow.document;
            const chatContainer = doc.querySelector('yt-live-chat-app #items.yt-live-chat-item-list-renderer');
            
            if (!chatContainer) {
                return;
            }

            const messages = chatContainer.querySelectorAll('yt-live-chat-text-message-renderer');
            
            messages.forEach((msgElement) => {
                try {
                    const messageId = msgElement.id || msgElement.getAttribute('data-message-id') || 
                                     msgElement.querySelector('#author-name')?.textContent + '_' + 
                                     msgElement.querySelector('#message')?.textContent?.substring(0, 20);
                    
                    if (!messageId || this.messageHistory.has(messageId)) {
                        return;
                    }
                    
                    this.messageHistory.add(messageId);
                    
                    const authorElement = msgElement.querySelector('#author-name');
                    const messageElement = msgElement.querySelector('#message, .yt-live-chat-text-message-renderer #message');
                    const timeElement = msgElement.querySelector('#timestamp');
                    
                    if (!authorElement || !messageElement) {
                        return;
                    }
                    
                    const chatname = authorElement.innerText || authorElement.textContent || '';
                    const chatmessage = messageElement.innerText || messageElement.textContent || '';
                    
                    if (!chatname || !chatmessage) {
                        return;
                    }
                    
                    const messageData = {
                        id: messageId,
                        author: chatname.trim(),
                        message: chatmessage.trim(),
                        timestamp: timeElement ? timeElement.textContent : new Date().toLocaleTimeString()
                    };
                    
                    if (this.onMessageCallback) {
                        this.onMessageCallback(messageData);
                    }
                } catch (e) {
                    console.error('Error processing message:', e);
                }
            });
        } catch (e) {
            // Cross-origin error - use postMessage listener instead
            // The injected script will send messages via postMessage
        }
    }

    /**
     * Listen for messages from injected script via postMessage
     */
    setupPostMessageListener() {
        window.addEventListener('message', (event) => {
            // Security: Only accept messages from YouTube domain
            if (event.origin !== 'https://www.youtube.com' && 
                event.origin !== 'https://youtube.com') {
                return;
            }
            
            if (event.data && event.data.type === 'YOUTUBE_CHAT_MESSAGE') {
                const messageData = event.data.data;
                
                if (!this.messageHistory.has(messageData.id)) {
                    this.messageHistory.add(messageData.id);
                    
                    if (this.onMessageCallback) {
                        this.onMessageCallback(messageData);
                    }
                }
            }
        });
    }

    /**
     * Disconnect from chat
     */
    disconnect() {
        this.isConnected = false;
        
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        if (this.chatWindow && !this.chatWindow.closed) {
            // Don't close window automatically, let user close it
            // this.chatWindow.close();
        }
        
        this.messageHistory.clear();
        this.videoId = null;
    }

    /**
     * Get connection status
     */
    getStatus() {
        if (!this.isConnected) {
            return 'disconnected';
        }
        
        if (this.chatWindow && this.chatWindow.closed) {
            return 'disconnected';
        }
        
        return 'connected';
    }
}

// Export for use in other scripts
window.YouTubeChatScraper = YouTubeChatScraper;

