/**
 * Content Script - Runs in YouTube live_chat page context
 * This script automatically scrapes chat messages and sends them to the main app
 */

(function() {
    'use strict';
    
    if (window.YouTubeChatTTSInstalled) {
        return;
    }
    window.YouTubeChatTTSInstalled = true;
    
    /**
     * Extract message data from DOM element
     */
    function scrapeMessage(element) {
        try {
            const authorElement = element.querySelector('#author-name');
            const messageElement = element.querySelector('#message, .yt-live-chat-text-message-renderer #message');
            
            if (!authorElement || !messageElement) {
                return null;
            }
            
            const messageId = element.id || 
                             element.getAttribute('data-message-id') || 
                             `${authorElement.textContent}_${messageElement.textContent.substring(0, 20)}_${Date.now()}`;
            
            const chatname = authorElement.innerText || authorElement.textContent || '';
            const chatmessage = messageElement.innerText || messageElement.textContent || '';
            
            if (!chatname || !chatmessage) {
                return null;
            }
            
            // Get timestamp
            const timeElement = element.querySelector('#timestamp');
            const timestamp = timeElement ? timeElement.textContent : new Date().toLocaleTimeString();
            
            return {
                id: messageId,
                author: chatname.trim(),
                message: chatmessage.trim(),
                timestamp: timestamp
            };
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Send message to background script and all possible receivers
     */
    function sendMessage(data) {
        try {
            // Method 1: Send to background script
            chrome.runtime.sendMessage({
                type: 'YOUTUBE_CHAT_MESSAGE',
                data: data
            });
            
            // Method 2: Store in localStorage (最可靠的方法，同源页面都能收到)
            try {
                localStorage.setItem('youtubeChatMessage', JSON.stringify({
                    type: 'YOUTUBE_CHAT_MESSAGE',
                    data: data,
                    timestamp: Date.now()
                }));
            } catch (e) {
                // localStorage might be full or disabled
            }
            
            // Method 3: Use BroadcastChannel
            try {
                const channel = new BroadcastChannel('youtube-chat-tts');
                channel.postMessage({
                    type: 'YOUTUBE_CHAT_MESSAGE',
                    data: data
                });
            } catch (e) {
                // BroadcastChannel not available
            }
            
            // Method 4: Post message to all windows
            try {
                window.postMessage({
                    type: 'YOUTUBE_CHAT_MESSAGE',
                    data: data
                }, '*');
                
                if (window.opener && window.opener !== window) {
                    window.opener.postMessage({
                        type: 'YOUTUBE_CHAT_MESSAGE',
                        data: data
                    }, '*');
                }
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        type: 'YOUTUBE_CHAT_MESSAGE',
                        data: data
                    }, '*');
                }
            } catch (e) {
                // Cross-origin, ignore
            }
            
            // Method 5: Dispatch custom event
            window.dispatchEvent(new CustomEvent('youtubeChatMessage', {
                detail: data
            }));
            
        } catch (e) {
            // Ignore
        }
    }
    
    /**
     * Check if page has errors
     */
    function checkForErrors() {
        // Check for YouTube error pages
        const errorIndicators = [
            document.querySelector('yt-error-view-model'),
            document.querySelector('.yt-error-view'),
            document.body.textContent.includes('Something went wrong'),
            document.body.textContent.includes('Video unavailable'),
            document.body.textContent.includes('This video is not available'),
            document.body.textContent.includes('Chat is disabled')
        ];
        
        return errorIndicators.some(indicator => indicator);
    }
    
    /**
     * Initialize chat scraper
     */
    function initScraper() {
        if (checkForErrors()) {
            chrome.runtime.sendMessage({
                type: 'YOUTUBE_CHAT_ERROR',
                error: 'Video may not be live or chat is disabled'
            }).catch(() => {});
            return;
        }
        
        const chatContainer = document.querySelector('yt-live-chat-app #items.yt-live-chat-item-list-renderer');
        
        if (!chatContainer) {
            // Check if we've been waiting too long (might be an error)
            if (!window.scraperRetryCount) {
                window.scraperRetryCount = 0;
            }
            window.scraperRetryCount++;
            
            if (window.scraperRetryCount > 10) {
                chrome.runtime.sendMessage({
                    type: 'YOUTUBE_CHAT_ERROR',
                    error: 'Chat container not found. Video may not be live or chat is disabled.'
                }).catch(() => {});
                return;
            }
            setTimeout(initScraper, 1000);
            return;
        }
        
            window.scraperRetryCount = 0;
        
        const existingMessages = chatContainer.querySelectorAll('yt-live-chat-text-message-renderer');
        existingMessages.forEach(msg => {
            const data = scrapeMessage(msg);
            if (data) {
                sendMessage(data);
            }
        });
        
        // Watch for new messages using MutationObserver
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if it's a chat message element
                        if (node.tagName === 'YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER') {
                            setTimeout(() => {
                                const data = scrapeMessage(node);
                                if (data) {
                                    sendMessage(data);
                                }
                            }, 100);
                        } else if (node.querySelector && node.querySelector('yt-live-chat-text-message-renderer')) {
                            // Check if it contains a chat message
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
        
        // Start observing
        observer.observe(chatContainer, {
            childList: true,
            subtree: true
        });
        
        // Store observer for cleanup if needed
        window.youtubeChatObserver = observer;
    }
    
    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScraper);
    } else {
        initScraper();
    }
    
    // Also listen for dynamic content loading
    const checkInterval = setInterval(() => {
        const chatContainer = document.querySelector('yt-live-chat-app #items.yt-live-chat-item-list-renderer');
        if (chatContainer && !chatContainer.hasAttribute('data-tts-scraper-initialized')) {
            chatContainer.setAttribute('data-tts-scraper-initialized', 'true');
            initScraper();
        }
    }, 2000);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        clearInterval(checkInterval);
        if (window.youtubeChatObserver) {
            window.youtubeChatObserver.disconnect();
        }
    });
    
})();

