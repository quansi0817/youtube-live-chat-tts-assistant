/**
 * Background Service Worker
 * Acts as a central hub for message relaying between YouTube and the App pages.
 */

// Temporarily store the latest messages
let messageQueue = [];

// Listen for messages from content scripts (YouTube pages)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'YOUTUBE_CHAT_MESSAGE') {
        const messageData = message.data;
        
        // Push to local queue
        messageQueue.push({
            ...messageData,
            receivedAt: Date.now()
        });
        
        // Limit queue size to 100
        if (messageQueue.length > 100) {
            messageQueue.shift();
        }
        
        // Persist to chrome.storage for cross-page access
        chrome.storage.local.set({
            lastChatMessage: {
                type: 'YOUTUBE_CHAT_MESSAGE',
                data: messageData,
                timestamp: Date.now()
            }
        });
        
        // Broadcast directly to all open tabs (excluding YouTube itself)
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url && !tab.url.includes('youtube.com')) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'YOUTUBE_CHAT_MESSAGE',
                        data: messageData
                    }).catch(() => {
                        // Ignore tabs without listeners
                    });
                }
            });
        });
        
        sendResponse({ success: true });
    }
    return true; // Keep channel open for async response
});
