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
     * Enhanced to capture all message types including membership messages with badges
     */
    function scrapeMessage(element) {
        try {
            const tagName = element.tagName.toLowerCase();
            const messageType = tagName.replace('yt-live-chat-', '').replace('-renderer', '');

            // Author name - try multiple selectors
            const authorElement = element.querySelector('#author-name, [id*="author-name"], yt-live-chat-author-chip #author-name');
            const authorPhotoElement = element.querySelector('#author-photo img, #img, yt-img-shadow img, img[src*="ytimg"]');
            const timeElement = element.querySelector('#timestamp');

            const author = authorElement ? (authorElement.innerText || authorElement.textContent || '').trim() : '';
            const authorPhoto = authorPhotoElement ? authorPhotoElement.src : '';
            const timestamp = timeElement ? timeElement.textContent : new Date().toLocaleTimeString();
            
            // Enhanced content extraction - try multiple strategies
            let messageContent = '';
            
            // Special handling for paid messages (Super Chat)
            // Keep full content including amount and message text, just like YouTube displays it
            if (messageType.includes('paid') || tagName.includes('paid-message')) {
                // Strategy: Clone the entire element and remove only author/timestamp
                // This preserves the complete structure including amount and message
                const cloned = element.cloneNode(true);
                // Only remove author info and timestamp, keep everything else (amount, message, etc.)
                cloned.querySelectorAll('#author-name, #timestamp, #header-author-name, yt-live-chat-author-chip, #author-photo').forEach(n => n.remove());
                
                // Try to get content from the main content area first
                const contentArea = cloned.querySelector('#content, #message, #content-text');
                if (contentArea) {
                    messageContent = contentArea.innerHTML?.trim() || contentArea.textContent?.trim() || '';
                }
                
                // If no content from specific area, get everything from cloned element
                if (!messageContent || messageContent.length === 0) {
                    messageContent = cloned.innerHTML?.trim() || cloned.textContent?.trim() || '';
                }
                
                // Ensure we have the purchase amount if it exists separately
                if (messageContent) {
                    const amountEl = element.querySelector('#purchase-amount-column, #purchase-amount, [class*="purchase-amount"], [id*="amount"]');
                    if (amountEl) {
                        const amountText = amountEl.textContent?.trim() || '';
                        const amountHtml = amountEl.innerHTML?.trim() || '';
                        // Check if amount is already in the content
                        if (amountText && !messageContent.includes(amountText) && !messageContent.includes(amountHtml)) {
                            // Prepend amount to message content
                            messageContent = `${amountHtml || amountText} ${messageContent}`;
                        }
                    }
                }
            }
            
            // Strategy 1: Standard message selectors (for non-paid messages)
            if (!messageContent) {
                const messageSelectors = [
                    '#message',
                    '#content-text',
                    '#header-subtext',
                    'yt-live-chat-text-message-renderer #message',
                    'yt-live-chat-membership-item-renderer #header-subtext'
                ];
                
                for (const selector of messageSelectors) {
                    const msgEl = element.querySelector(selector);
                    if (msgEl) {
                        messageContent = msgEl.innerHTML?.trim() || msgEl.textContent?.trim() || '';
                        if (messageContent) break;
                    }
                }
            }
            
            // Strategy 2: Try #content as fallback
            if (!messageContent) {
                const contentNode = element.querySelector('#content');
                if (contentNode) {
                    messageContent = contentNode.innerHTML?.trim() || contentNode.textContent?.trim() || '';
                }
            }
            
            // Strategy 3: Clone and remove non-content elements, then get all HTML
            if (!messageContent) {
                const cloned = element.cloneNode(true);
                // Remove author, timestamp, and other non-content elements
                // But be careful not to remove message content for paid messages
                const elementsToRemove = ['#author-name', '#timestamp', '#header-subtext', '#header-author-name', 'yt-live-chat-author-chip', '#author-photo'];
                if (!messageType.includes('paid')) {
                    elementsToRemove.push('#purchase-amount-column', '#purchase-amount');
                }
                cloned.querySelectorAll(elementsToRemove.join(',')).forEach(n => n.remove());
                // Get innerHTML to preserve badges, emojis, etc.
                messageContent = cloned.innerHTML?.trim() || cloned.textContent?.trim() || '';
            }
            
            // Strategy 4: For membership messages, try to get the full message area
            if (!messageContent && messageType.includes('membership')) {
                const membershipContent = element.querySelector('yt-live-chat-membership-item-renderer, [class*="membership"]');
                if (membershipContent) {
                    const cloned = membershipContent.cloneNode(true);
                    cloned.querySelectorAll('#author-name, #timestamp, yt-live-chat-author-chip').forEach(n => n.remove());
                    messageContent = cloned.innerHTML?.trim() || cloned.textContent?.trim() || '';
                }
            }
            
            // Strategy 5: Last resort - get all text content but preserve structure
            if (!messageContent) {
                const allTextNodes = [];
                const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                let node;
                while (node = walker.nextNode()) {
                    const text = node.textContent.trim();
                    if (text && !text.match(/^\d+:\d+$/)) { // Skip timestamps
                        allTextNodes.push(text);
                    }
                }
                messageContent = allTextNodes.join(' ').trim();
            }
            
            // Skip empty messages - allow emoji-only messages (images)
            if (!messageContent || messageContent.length === 0) {
                return null; // Don't send empty messages
            }
            
            // Check if content has actual content (text, emoji/images, or both)
            // Create a temporary element to check for images and text
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = messageContent;
            const hasText = tempDiv.textContent.trim().length > 0;
            const hasImages = tempDiv.querySelectorAll('img').length > 0;
            
            // Allow messages with text, emoji (images), or both
            if (!hasText && !hasImages) {
                return null; // Don't send truly empty messages
            }
            
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

        // Simple send with error handling
        try {
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    type: 'YOUTUBE_CHAT_MESSAGE',
                    data: data
                }, function() {
                    // Ignore chrome.runtime.lastError to suppress console warnings
                    void chrome.runtime.lastError;
                });
            }
        } catch (e) {
            // Silently ignore - extension might be reloading
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
            try {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        try {
                            if (node.nodeType === 1) {
                                const tagName = node.tagName.toLowerCase();
                                // Check for all YouTube live chat message types
                                if (tagName.startsWith('yt-live-chat-')) {
                                    const data = scrapeMessage(node);
                                    if (data) sendMessage(data);
                                } else if (node.querySelectorAll) {
                                    // Also check for nested messages (membership, paid messages, etc.)
                                    const allMessageTypes = [
                                        'yt-live-chat-text-message-renderer',
                                        'yt-live-chat-membership-item-renderer',
                                        'yt-live-chat-paid-message-renderer',
                                        'yt-live-chat-paid-sticker-renderer',
                                        'yt-live-chat-legacy-paid-message-renderer'
                                    ];
                                    
                                    allMessageTypes.forEach(msgType => {
                                        const messages = node.querySelectorAll(msgType);
                                        messages.forEach(msg => {
                                            const data = scrapeMessage(msg);
                                            if (data) sendMessage(data);
                                        });
                                    });
                                    
                                    // Fallback: catch any yt-live-chat elements
                                    const subMessages = node.querySelectorAll('[class*="yt-live-chat-"]');
                                    subMessages.forEach(msg => {
                                        const data = scrapeMessage(msg);
                                        if (data) sendMessage(data);
                                    });
                                }
                            }
                        } catch (e) {
                            // Ignore individual node errors
                        }
                    });
                });
            } catch (e) {
                // Ignore mutation callback errors
            }
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
