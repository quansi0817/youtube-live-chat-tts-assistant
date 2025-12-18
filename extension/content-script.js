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
     * 提取完整的HTML内容，包括表情、Super Chat等
     */
    function scrapeMessage(element) {
        try {
            // 确定消息类型
            const tagName = element.tagName.toLowerCase();
            const messageType = tagName.replace('yt-live-chat-', '').replace('-renderer', '');

            // 克隆元素以获取完整HTML（包括表情图片）
            const clonedElement = element.cloneNode(true);

            // 获取作者信息
            const authorElement = element.querySelector('#author-name');
            const authorPhotoElement = element.querySelector('#author-photo img, #img');

            // 获取消息内容
            const messageElement = element.querySelector('#message, #content-text, #purchase-amount-column');

            // 获取时间戳
            const timeElement = element.querySelector('#timestamp');
            const timestamp = timeElement ? timeElement.textContent : new Date().toLocaleTimeString();

            // 基础信息
            const author = authorElement ? (authorElement.innerText || authorElement.textContent || '').trim() : '';
            const authorPhoto = authorPhotoElement ? authorPhotoElement.src : '';

            // 生成唯一ID
            const messageId = element.id ||
                             element.getAttribute('data-message-id') ||
                             `${author}_${timestamp}_${Date.now()}_${Math.random()}`;

            // 处理不同类型的消息
            let messageData = {
                id: messageId,
                author: author,
                authorPhoto: authorPhoto,
                timestamp: timestamp,
                type: messageType,
                html: element.innerHTML, // 保存完整HTML
                element: element.outerHTML // 保存完整元素
            };

            // 普通文本消息
            if (tagName === 'yt-live-chat-text-message-renderer') {
                messageData.message = messageElement ? messageElement.innerText : '';
                messageData.messageHtml = messageElement ? messageElement.innerHTML : '';
            }
            // Super Chat (付费消息)
            else if (tagName === 'yt-live-chat-paid-message-renderer') {
                const purchaseAmount = element.querySelector('#purchase-amount');
                const messageContent = element.querySelector('#message, yt-formatted-string');

                messageData.message = messageContent ? messageContent.innerText : '';
                messageData.messageHtml = messageContent ? messageContent.innerHTML : '';
                messageData.purchaseAmount = purchaseAmount ? purchaseAmount.textContent : '';
                messageData.isSuperChat = true;

                // 获取Super Chat的颜色样式
                const cardElement = element.querySelector('#card');
                if (cardElement) {
                    const style = window.getComputedStyle(cardElement);
                    messageData.backgroundColor = style.backgroundColor;
                    messageData.headerColor = style.getPropertyValue('--yt-live-chat-paid-message-header-color');
                }
            }
            // Super Sticker (付费贴纸)
            else if (tagName === 'yt-live-chat-paid-sticker-renderer') {
                const purchaseAmount = element.querySelector('#purchase-amount-chip');
                const stickerImg = element.querySelector('#sticker img');

                messageData.purchaseAmount = purchaseAmount ? purchaseAmount.textContent : '';
                messageData.stickerUrl = stickerImg ? stickerImg.src : '';
                messageData.isSuperSticker = true;
            }
            // 会员消息
            else if (tagName === 'yt-live-chat-membership-item-renderer') {
                const headerPrimary = element.querySelector('#header-primary-text');
                const headerSub = element.querySelector('#header-subtext');
                const messageContent = element.querySelector('#message');

                messageData.headerPrimary = headerPrimary ? headerPrimary.innerText : '';
                messageData.headerSub = headerSub ? headerSub.innerText : '';
                messageData.message = messageContent ? messageContent.innerText : '';
                messageData.messageHtml = messageContent ? messageContent.innerHTML : '';
                messageData.isMembership = true;
            }
            // 其他类型消息也保存
            else {
                const textContent = element.innerText || element.textContent || '';
                messageData.message = textContent.trim();
            }

            return messageData;
        } catch (e) {
            console.error('Error scraping message:', e);
            return null;
        }
    }
    
    /**
     * Send message to background script and all possible receivers
     */
    function sendMessage(data) {
        try {
            // Method 1: Send to background script (如果在扩展环境中)
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    type: 'YOUTUBE_CHAT_MESSAGE',
                    data: data
                }).catch(() => {});
            }
            
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
            // 尝试发送错误消息
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({
                        type: 'YOUTUBE_CHAT_ERROR',
                        error: 'Video may not be live or chat is disabled'
                    }).catch(() => {});
                }
            } catch (e) {
                console.warn('无法发送错误消息:', e);
            }
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
                // 尝试发送错误消息
                try {
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage({
                            type: 'YOUTUBE_CHAT_ERROR',
                            error: 'Chat container not found. Video may not be live or chat is disabled.'
                        }).catch(() => {});
                    }
                } catch (e) {
                    console.warn('无法发送错误消息:', e);
                }
                return;
            }
            setTimeout(initScraper, 1000);
            return;
        }
        
            window.scraperRetryCount = 0;
        
        // 所有要监听的消息类型
        const messageSelectors = [
            'yt-live-chat-text-message-renderer',        // 普通消息
            'yt-live-chat-paid-message-renderer',        // Super Chat
            'yt-live-chat-paid-sticker-renderer',        // Super Sticker
            'yt-live-chat-membership-item-renderer',     // 会员消息
            'yt-live-chat-legacy-paid-message-renderer'  // 旧版付费消息
        ];

        // 处理已存在的消息
        messageSelectors.forEach(selector => {
            const existingMessages = chatContainer.querySelectorAll(selector);
            existingMessages.forEach(msg => {
                const data = scrapeMessage(msg);
                if (data) {
                    sendMessage(data);
                }
            });
        });

        // 使用MutationObserver监听新消息
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        const tagName = node.tagName;

                        // 检查是否是消息元素
                        const isMessageElement = messageSelectors.some(selector =>
                            tagName === selector.toUpperCase()
                        );

                        if (isMessageElement) {
                            setTimeout(() => {
                                const data = scrapeMessage(node);
                                if (data) {
                                    sendMessage(data);
                                }
                            }, 100);
                        } else if (node.querySelector) {
                            // 检查子元素中是否包含消息元素
                            messageSelectors.forEach(selector => {
                                const target = node.querySelector(selector);
                                if (target) {
                                    setTimeout(() => {
                                        const data = scrapeMessage(target);
                                        if (data) {
                                            sendMessage(data);
                                        }
                                    }, 100);
                                }
                            });
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

