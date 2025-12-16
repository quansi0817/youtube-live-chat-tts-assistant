/**
 * Background Service Worker
 * Handles messages from content scripts and communicates with main app
 */

// Store messages temporarily
let messageQueue = [];

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'YOUTUBE_CHAT_MESSAGE') {
        const messageData = message.data;
        
        // Store message
        messageQueue.push({
            ...messageData,
            timestamp: Date.now()
        });
        
        // Keep only last 100 messages
        if (messageQueue.length > 100) {
            messageQueue.shift();
        }
        
        // Store message in chrome.storage (this triggers onChanged event)
        const storageData = {
            lastChatMessage: {
                type: 'YOUTUBE_CHAT_MESSAGE',
                data: messageData,
                timestamp: Date.now()
            }
        };
        
        chrome.storage.local.set(storageData);
        
        // Send to all tabs that might be listening
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                // Skip YouTube pages (they're the source)
                if (tab.url && (tab.url.includes('youtube.com') || tab.url.includes('youtu.be'))) {
                    return;
                }
                
                // Try to send message via content script
                chrome.tabs.sendMessage(tab.id, {
                    type: 'YOUTUBE_CHAT_MESSAGE',
                    data: messageData
                }).catch(() => {
                    // Tab might not have content script, that's OK
                });
            });
        });
        
        sendResponse({ success: true });
    } else if (message.type === 'YOUTUBE_CHAT_ERROR') {
        // Broadcast error to all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'YOUTUBE_CHAT_ERROR',
                    error: message.error
                }).catch(() => {
                    // Tab might not have listener, ignore errors
                });
            });
        });
        
        sendResponse({ success: true });
    }
    
    return true; // Keep channel open for async response
});

chrome.runtime.onConnect.addListener((port) => {
    messageQueue.forEach(msg => {
        port.postMessage({
            type: 'YOUTUBE_CHAT_MESSAGE',
            data: msg
        });
    });
    messageQueue = [];
});

