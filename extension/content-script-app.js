/**
 * Content Script for App Pages
 * Injected into local app pages (index.html, chat-view.html) to enable extension communication.
 */

(function() {
    'use strict';
    
    // Check if this is one of our app pages
    const isAppPage = 
        window.location.href.includes('index.html') || 
        window.location.href.includes('chat-view.html') || 
        window.location.href.includes('selected-view.html') ||
        document.querySelector('title')?.textContent.includes('YouTube Live Chat');

    if (!isAppPage) return;

    // Inject bridge.js to provide chrome.storage proxy to the page
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('bridge.js');
    (document.head || document.documentElement).appendChild(script);

    // Listen for storage requests from the page (via bridge.js)
    window.addEventListener('message', (event) => {
        if (event.data.type === 'FROM_PAGE_STORAGE_GET') {
            chrome.storage.local.get(event.data.keys, (result) => {
                window.postMessage({
                    type: 'FROM_CONTENT_STORAGE_GET_RESULT',
                    result: result,
                    requestId: event.data.requestId
                }, '*');
            });
        } else if (event.data.type === 'FROM_PAGE_STORAGE_SET') {
            chrome.storage.local.set(event.data.items);
        }
    });

    // Notify page when storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
        window.postMessage({
            type: 'FROM_CONTENT_STORAGE_CHANGED',
            changes: changes,
            areaName: areaName
        }, '*');
    });

    // Direct message relay from background script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'YOUTUBE_CHAT_MESSAGE') {
            window.dispatchEvent(new CustomEvent('youtubeChatMessage', {
                detail: message.data
            }));
        }
    });
})();
