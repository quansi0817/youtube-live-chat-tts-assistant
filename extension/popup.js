// Popup script
document.addEventListener('DOMContentLoaded', () => {
    const openAppBtn = document.getElementById('openApp');
    const statusDiv = document.getElementById('status');
    
    // Check if extension is enabled
    chrome.storage.local.get(['enabled'], (result) => {
        if (result.enabled !== false) {
            statusDiv.textContent = 'Extension Active';
            statusDiv.className = 'status active';
        } else {
            statusDiv.textContent = 'Extension Disabled';
            statusDiv.className = 'status inactive';
        }
    });
    
    // Open main app
    openAppBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('../src/html/index.html')
        });
    });
});

