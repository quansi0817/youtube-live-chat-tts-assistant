/**
 * Bridge Script - Injected into pages to enable extension API access
 * This script is injected via content script to provide chrome.storage access
 */

(function() {
    'use strict';
    
    // Only inject if not already injected
    if (window.YouTubeChatTTSBridge) {
        return;
    }
    
    window.YouTubeChatTTSBridge = {
        // Proxy chrome.storage calls
        storage: {
            local: {
                get: function(keys, callback) {
                    if (typeof chrome !== 'undefined' && chrome.storage) {
                        chrome.storage.local.get(keys, callback);
                    } else {
                        if (callback) callback({});
                    }
                },
                set: function(items, callback) {
                    if (typeof chrome !== 'undefined' && chrome.storage) {
                        chrome.storage.local.set(items, callback);
                    } else {
                        if (callback) callback();
                    }
                },
                onChanged: {
                    addListener: function(callback) {
                        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
                            chrome.storage.onChanged.addListener(callback);
                        }
                    }
                }
            }
        },
        runtime: {
            onMessage: {
                addListener: function(callback) {
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
                        chrome.runtime.onMessage.addListener(callback);
                    }
                }
            },
            sendMessage: function(message, callback) {
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    chrome.runtime.sendMessage(message, callback);
                }
            }
        }
    };
    
})();

