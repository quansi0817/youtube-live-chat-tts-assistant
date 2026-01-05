/**
 * Bridge script injected into the page to proxy chrome.storage calls
 */
(function() {
    const storageProxy = {
        local: {
            get: function(keys, callback) {
                const requestId = 'get_' + Math.random();
                window.postMessage({ type: 'FROM_PAGE_STORAGE_GET', keys: keys, requestId: requestId }, '*');
                
                const handler = function(event) {
                    if (event.data.type === 'FROM_CONTENT_STORAGE_GET_RESULT' && event.data.requestId === requestId) {
                        window.removeEventListener('message', handler);
                        if (callback) callback(event.data.result);
                    }
                };
                window.addEventListener('message', handler);
            },
            set: function(items, callback) {
                window.postMessage({ type: 'FROM_PAGE_STORAGE_SET', items: items }, '*');
                if (callback) callback();
            },
            onChanged: {
                addListener: function(callback) {
                    window.addEventListener('message', function(event) {
                        if (event.data.type === 'FROM_CONTENT_STORAGE_CHANGED') {
                            callback(event.data.changes, event.data.areaName);
                        }
                    });
                }
            }
        }
    };

    // Expose proxy to the page's window object
    window.chrome = window.chrome || {};
    window.chrome.storage = storageProxy;
})();
