/**
 * Content Script for Main App Page
 * This script is injected into the main app page to receive messages from background script
 */

(function() {
    'use strict';
    
    // Run on any HTML page in the app
    const url = window.location.href;
    const isAppPage = url.includes('index.html') || 
                      url.includes('chat-display.html') ||
                      url.includes('youtube-live-chat-tts-assistant') ||
                      url.includes('127.0.0.1') ||
                      url.includes('localhost');
    
    if (!isAppPage) {
        return;
    }
    
    // 检查是否在扩展环境中
    const isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

    if (isExtensionContext) {
        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('bridge.js');
            (document.head || document.documentElement).appendChild(script);
        } catch (e) {
            // Ignore
        }
    }

    // Listen for messages from background script (只在扩展环境中)
    if (isExtensionContext && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'YOUTUBE_CHAT_MESSAGE') {
            // Dispatch custom event for app.js to listen
            window.dispatchEvent(new CustomEvent('youtubeChatMessage', {
                detail: message.data
            }));
            
            // Also store in localStorage as backup
            try {
                localStorage.setItem('youtubeChatMessage', JSON.stringify({
                    type: 'YOUTUBE_CHAT_MESSAGE',
                    data: message.data,
                    timestamp: Date.now()
                }));
            } catch (e) {
                // Ignore
            }
            
            sendResponse({ success: true });
        } else if (message.type === 'YOUTUBE_CHAT_ERROR') {
            window.dispatchEvent(new CustomEvent('youtubeChatError', {
                detail: { error: message.error }
            }));
            sendResponse({ success: true });
        }
        return true;
        });
    }

    // Also listen for storage changes (只在扩展环境中)
    if (isExtensionContext && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.lastChatMessage) {
            const newValue = changes.lastChatMessage.newValue;
            if (newValue && newValue.type === 'YOUTUBE_CHAT_MESSAGE') {
                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('youtubeChatMessage', {
                    detail: newValue.data
                }));
                
                // Also store in localStorage as backup
                try {
                    localStorage.setItem('youtubeChatMessage', JSON.stringify({
                        type: 'YOUTUBE_CHAT_MESSAGE',
                        data: newValue.data,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    // Ignore
                }
            }
        }
        });
    }

    // Also poll storage periodically (只在扩展环境中，且添加错误处理)
    if (isExtensionContext && chrome.storage && chrome.storage.local) {
        setInterval(() => {
            try {
                // 检查扩展上下文是否仍然有效
                if (!chrome.runtime || !chrome.runtime.id) {
                    return; // 扩展上下文已失效，停止轮询
                }

                chrome.storage.local.get(['lastChatMessage'], (result) => {
                    if (chrome.runtime.lastError) {
                        // 忽略错误
                        return;
                    }
                    if (result.lastChatMessage && result.lastChatMessage.type === 'YOUTUBE_CHAT_MESSAGE') {
                        window.dispatchEvent(new CustomEvent('youtubeChatMessage', {
                            detail: result.lastChatMessage.data
                        }));
                    }
                });
            } catch (e) {
                // 扩展上下文失效，忽略错误
            }
        }, 500);
    }
    
})();

