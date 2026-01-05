/**
 * Content Script - Scraper
 * Runs in YouTube live_chat page context to capture messages.
 */

(function() {
    'use strict';
    
    if (window.YouTubeChatTTSScraperLoaded) return;
    window.YouTubeChatTTSScraperLoaded = true;
    
    let lastSentContent = '';
    let lastSentTimestamp = 0;

    /**
     * Extracts chat data from a DOM element
     */
    function scrapeMessage(element) {
        try {
            const tagName = element.tagName.toLowerCase();
            const messageType = tagName.replace('yt-live-chat-', '').replace('-renderer', '');

            const authorElement = element.querySelector('#author-name');
            const authorPhotoElement = element.querySelector('#author-photo img, #img');
            const messageElement = element.querySelector('#message, #content-text, #purchase-amount-column');
            const timeElement = element.querySelector('#timestamp');

            const author = authorElement ? (authorElement.innerText || '').trim() : '';
            const authorPhoto = authorPhotoElement ? authorPhotoElement.src : '';
            const timestamp = timeElement ? timeElement.textContent : new Date().toLocaleTimeString();
            const messageContent = messageElement ? messageElement.innerHTML : '';
            const messageId = element.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            return {
                id: messageId,
                author: author,
                authorPhoto: authorPhoto,
                content: messageContent,
                timestamp: timestamp,
                type: messageType,
                rawType: tagName
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Sends data to background script
     */
    function sendMessage(data) {
        if (!data) return;
        
        const now = Date.now();
        const signature = `${data.author}_${data.content}_${data.timestamp}`;
        
        // Deduplication: Avoid sending exact same content within 1 second
        if (signature === lastSentContent && (now - lastSentTimestamp) < 1000) return;
        
        lastSentContent = signature;
        lastSentTimestamp = now;

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                type: 'YOUTUBE_CHAT_MESSAGE',
                data: data
            }).catch(() => {});
        }
    }

    /**
     * Initialize the observer to watch for new messages
     */
    function initScraper() {
        const chatContainer = document.querySelector('yt-live-chat-app #items.yt-live-chat-item-list-renderer');
        if (!chatContainer) {
            setTimeout(initScraper, 1000);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // ELEMENT_NODE
                        const tagName = node.tagName.toLowerCase();
                        if (tagName.startsWith('yt-live-chat-')) {
                            const data = scrapeMessage(node);
                            if (data) sendMessage(data);
                        } else {
                            // Check children if the container itself isn't the message
                            const subMessages = node.querySelectorAll('[class*="yt-live-chat-"]');
                            subMessages.forEach(msg => {
                                const data = scrapeMessage(msg);
                                if (data) sendMessage(data);
                            });
                        }
                    }
                });
            });
        });

        observer.observe(chatContainer, { childList: true, subtree: true });
    }

    // Start scraping when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScraper);
    } else {
        initScraper();
    }
})();
