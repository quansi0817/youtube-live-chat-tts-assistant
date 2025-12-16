/**
 * Main Application Logic
 */

// Initialize components
const chatScraper = new YouTubeChatScraper();
const ttsManager = new TTSManager();
const musicDetector = new MusicDetector();

// DOM Elements
const videoIdInput = document.getElementById('videoIdInput');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const chatMessages = document.getElementById('chatMessages');
const connectionStatus = document.getElementById('connectionStatus');

// TTS Controls
const ttsProvider = document.getElementById('ttsProvider');
const ttsApiKey = document.getElementById('ttsApiKey');
const ttsVoice = document.getElementById('ttsVoice');
const ttsVolume = document.getElementById('ttsVolume');
const volumeValue = document.getElementById('volumeValue');
const testTtsBtn = document.getElementById('testTtsBtn');

// Music Controls
const songTitle = document.getElementById('songTitle');
const songArtist = document.getElementById('songArtist');
const refreshSongBtn = document.getElementById('refreshSongBtn');
const manualSongBtn = document.getElementById('manualSongBtn');
const songModal = document.getElementById('songModal');
const manualSongTitle = document.getElementById('manualSongTitle');
const manualSongArtist = document.getElementById('manualSongArtist');
const saveSongBtn = document.getElementById('saveSongBtn');

// Overlay
const songOverlay = document.getElementById('songOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayArtist = document.getElementById('overlayArtist');

// State
let isConnected = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Load saved settings
    loadSettings();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup postMessage listener for chat scraper
    setupPostMessageListener();
    
    // Start music detection
    musicDetector.startMonitoring((track) => {
        updateSongDisplay(track);
    });
}

function setupPostMessageListener() {
    // Listen for messages from YouTube pages (manual script method)
    window.addEventListener('message', (event) => {
        // Accept messages from YouTube domain
        if (event.origin === 'https://www.youtube.com' || event.origin === 'https://youtube.com') {
            if (event.data && event.data.type === 'YOUTUBE_CHAT_MESSAGE') {
                handleNewMessage(event.data.data);
            }
        }
    });
    
    // Listen for messages from browser extension (automatic method)
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
            // Method 1: Listen for runtime messages (if we have content script)
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.type === 'YOUTUBE_CHAT_MESSAGE') {
                    console.log('[App] Received message via runtime:', message.data);
                    handleNewMessage(message.data);
                    sendResponse({ success: true });
                } else if (message.type === 'YOUTUBE_CHAT_ERROR') {
                    // Handle errors from extension
                    console.error('[App] Extension error:', message.error);
                    updateStatus('disconnected', 'Error: ' + message.error);
                    connectBtn.disabled = false;
                    disconnectBtn.disabled = true;
                    isConnected = false;
                    
                    // Show error message
                    if (chatMessages.querySelector('.empty-state')) {
                        chatMessages.innerHTML = `
                            <div class="empty-state">
                                <p style="color: #f56565;">❌ ${message.error}</p>
                                <p class="hint">Please make sure:</p>
                                <ul style="text-align: left; display: inline-block; color: #718096;">
                                    <li>The video is currently live</li>
                                    <li>Chat is enabled for this video</li>
                                    <li>The video ID is correct</li>
                                </ul>
                            </div>
                        `;
                    }
                    sendResponse({ success: true });
                }
                return true;
            });
            
            // Method 2: Listen for storage changes (works for any page)
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local' && changes.lastChatMessage) {
                    const newValue = changes.lastChatMessage.newValue;
                    if (newValue && newValue.type === 'YOUTUBE_CHAT_MESSAGE') {
                        console.log('[App] Received message via storage:', newValue.data);
                        handleNewMessage(newValue.data);
                    }
                }
            });
            
            // Method 3: Poll storage for new messages (fallback)
            let lastMessageTime = 0;
            setInterval(() => {
                chrome.storage.local.get(['lastChatMessage'], (result) => {
                    if (result.lastChatMessage && result.lastChatMessage.timestamp > lastMessageTime) {
                        lastMessageTime = result.lastChatMessage.timestamp;
                        if (result.lastChatMessage.type === 'YOUTUBE_CHAT_MESSAGE') {
                            console.log('[App] Received message via polling:', result.lastChatMessage.data);
                            handleNewMessage(result.lastChatMessage.data);
                        }
                    }
                });
            }, 500); // Check every 500ms
            
            // Also listen for custom events from content script
            window.addEventListener('youtubeChatMessage', (event) => {
                if (event.detail) {
                    console.log('[App] Received message via custom event:', event.detail);
                    handleNewMessage(event.detail);
                }
            });
            
            console.log('[App] Extension message listener initialized');
        } catch (e) {
            console.log('[App] Extension not available, using manual method', e);
        }
    }
}

function setupEventListeners() {
    // Connection controls
    connectBtn.addEventListener('click', handleConnect);
    disconnectBtn.addEventListener('click', handleDisconnect);
    
    // TTS controls
    ttsProvider.addEventListener('change', updateTTSSettings);
    ttsApiKey.addEventListener('change', updateTTSSettings);
    ttsVoice.addEventListener('change', updateTTSSettings);
    ttsVolume.addEventListener('input', (e) => {
        volumeValue.textContent = e.target.value;
        updateTTSSettings();
    });
    testTtsBtn.addEventListener('click', testTTS);
    
    // Music controls
    refreshSongBtn.addEventListener('click', () => {
        musicDetector.checkMusic();
    });
    manualSongBtn.addEventListener('click', () => {
        songModal.classList.add('active');
    });
    
    // Modal controls
    const closeModal = document.querySelector('.close');
    closeModal.addEventListener('click', () => {
        songModal.classList.remove('active');
    });
    
    saveSongBtn.addEventListener('click', () => {
        const title = manualSongTitle.value.trim();
        const artist = manualSongArtist.value.trim();
        if (title) {
            musicDetector.setTrackManually(title, artist);
            songModal.classList.remove('active');
            manualSongTitle.value = '';
            manualSongArtist.value = '';
        }
    });
    
    // Click outside modal to close
    songModal.addEventListener('click', (e) => {
        if (e.target === songModal) {
            songModal.classList.remove('active');
        }
    });
    
    // Enter key to connect
    videoIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleConnect();
        }
    });
}

/**
 * Extract YouTube Video ID from URL or return as-is if already an ID
 */
function extractVideoId(input) {
    if (!input) return null;
    
    input = input.trim();
    
    // If it's already just an ID (no special characters except dash and underscore)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
        return input;
    }
    
    // Try to extract from various YouTube URL formats
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/live_chat\?.*[&?]v=([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*[&?]v=([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    // If no pattern matches, try to use the input as-is (might be a valid ID)
    return input.length === 11 ? input : null;
}

async function handleConnect() {
    const input = videoIdInput.value.trim();
    
    if (!input) {
        alert('Please enter a YouTube Video ID or URL');
        return;
    }
    
    // Extract video ID from URL or use as-is
    const videoId = extractVideoId(input);
    
    if (!videoId) {
        alert('Invalid YouTube Video ID or URL. Please enter a valid YouTube video ID or URL.\n\nExample:\n- Video ID: dQw4w9WgXcQ\n- URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        return;
    }
    
    // Update input field with extracted ID
    videoIdInput.value = videoId;
    
    // Check if extension is available
    const hasExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.tabs;
    
    if (hasExtension) {
        // Extension method: Just open the YouTube chat page, extension will handle it
        try {
            connectBtn.disabled = true;
            updateStatus('connecting', 'Connecting...');
            
            // First, try to open the video page to check if it's live
            // Then open live_chat page
            const chatUrl = `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;
            
            chrome.tabs.create({ url: chatUrl }, (tab) => {
                // Monitor tab for errors
                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                    if (tabId === tab.id && changeInfo.status === 'complete') {
                        chrome.tabs.get(tabId, (updatedTab) => {
                            if (updatedTab.url && updatedTab.url.includes('error')) {
                                updateStatus('disconnected', 'Error: Video may not be live or chat disabled');
                                connectBtn.disabled = false;
                                chrome.tabs.onUpdated.removeListener(listener);
                            } else if (updatedTab.url && updatedTab.url.includes('live_chat')) {
                                // Successfully opened live_chat page
                                setTimeout(() => {
                                    isConnected = true;
                                    updateStatus('connected', 'Connected (Extension)');
                                    connectBtn.disabled = true;
                                    disconnectBtn.disabled = false;
                                    
                                    // Clear empty state
                                    if (chatMessages.querySelector('.empty-state')) {
                                        chatMessages.innerHTML = '';
                                    }
                                    
                                    chrome.tabs.onUpdated.removeListener(listener);
                                }, 2000);
                            }
                        });
                    }
                });
            });
        } catch (error) {
            console.error('Extension connection error:', error);
            // Fallback to manual method
            await connectManual(videoId);
        }
    } else {
        // Manual method: Use chat scraper
        await connectManual(videoId);
    }
}

async function connectManual(videoId) {
    try {
        connectBtn.disabled = true;
        updateStatus('connecting', 'Connecting...');
        
        await chatScraper.connect(videoId, (messageData) => {
            handleNewMessage(messageData);
        });
        
        isConnected = true;
        updateStatus('connected', 'Connected (Manual)');
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        
        // Clear empty state
        if (chatMessages.querySelector('.empty-state')) {
            chatMessages.innerHTML = '';
        }
    } catch (error) {
        console.error('Connection error:', error);
        alert('Failed to connect: ' + error.message);
        updateStatus('disconnected', 'Disconnected');
        connectBtn.disabled = false;
    }
}

function handleDisconnect() {
    chatScraper.disconnect();
    isConnected = false;
    updateStatus('disconnected', 'Disconnected');
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    
    // Show empty state
    chatMessages.innerHTML = `
        <div class="empty-state">
            <p>Disconnected. Enter a YouTube Video ID and click Connect to start receiving chat messages</p>
        </div>
    `;
}

function handleNewMessage(messageData) {
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message';
    messageEl.dataset.messageId = messageData.id;
    
    messageEl.innerHTML = `
        <div class="message-header">
            <span class="message-author">${escapeHtml(messageData.author)}</span>
            <span class="message-time">${messageData.timestamp}</span>
        </div>
        <div class="message-content">${escapeHtml(messageData.message)}</div>
    `;
    
    // Add click handler for TTS
    messageEl.addEventListener('click', () => {
        // Highlight clicked message
        document.querySelectorAll('.chat-message.clicked').forEach(el => {
            el.classList.remove('clicked');
        });
        messageEl.classList.add('clicked');
        
        // Speak message
        const textToSpeak = `${messageData.author} says: ${messageData.message}`;
        ttsManager.speak(textToSpeak);
    });
    
    // Add to chat
    chatMessages.appendChild(messageEl);
    
    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Limit message history (keep last 100)
    const messages = chatMessages.querySelectorAll('.chat-message');
    if (messages.length > 100) {
        messages[0].remove();
    }
}

function updateStatus(status, text) {
    connectionStatus.className = `status-badge ${status}`;
    connectionStatus.textContent = text;
}

function updateTTSSettings() {
    ttsManager.configure({
        provider: ttsProvider.value,
        apiKey: ttsApiKey.value,
        voice: ttsVoice.value,
        volume: ttsVolume.value / 100
    });
    
    // Save to localStorage
    saveSettings();
}

function testTTS() {
    const testText = 'This is a test of the text to speech system.';
    ttsManager.speak(testText);
}

function updateSongDisplay(track) {
    if (track.title) {
        songTitle.textContent = track.title;
        songArtist.textContent = track.artist || '-';
        
        // Update overlay
        overlayTitle.textContent = track.title;
        overlayArtist.textContent = track.artist || '';
        songOverlay.classList.add('visible');
    } else {
        songTitle.textContent = 'No music detected';
        songArtist.textContent = '-';
        
        // Hide overlay
        songOverlay.classList.remove('visible');
    }
}

function loadSettings() {
    // Load TTS settings
    const savedProvider = localStorage.getItem('ttsProvider') || 'system';
    const savedApiKey = localStorage.getItem('ttsApiKey') || '';
    const savedVoice = localStorage.getItem('ttsVoice') || 'alloy';
    const savedVolume = localStorage.getItem('ttsVolume') || '100';
    
    ttsProvider.value = savedProvider;
    ttsApiKey.value = savedApiKey;
    ttsVoice.value = savedVoice;
    ttsVolume.value = savedVolume;
    volumeValue.textContent = savedVolume;
    
    updateTTSSettings();
    
    // Load manual song if exists
    const savedSong = localStorage.getItem('manualSong');
    if (savedSong) {
        try {
            const song = JSON.parse(savedSong);
            musicDetector.setTrackManually(song.title, song.artist);
        } catch (e) {
            // Ignore
        }
    }
}

function saveSettings() {
    localStorage.setItem('ttsProvider', ttsProvider.value);
    localStorage.setItem('ttsApiKey', ttsApiKey.value);
    localStorage.setItem('ttsVoice', ttsVoice.value);
    localStorage.setItem('ttsVolume', ttsVolume.value);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Save manual song when set
musicDetector.startMonitoring((track) => {
    updateSongDisplay(track);
    if (track.title) {
        localStorage.setItem('manualSong', JSON.stringify(track));
    }
});

