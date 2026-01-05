/**
 * Main Application Logic
 * Handles message processing, TTS, and UI updates.
 */

class App {
    constructor() {
        this.messages = [];
        this.maxMessages = 100;
        this.isTTSEnabled = true;
        this.seenMessageIds = new Set();
        
        // Initialize components
        this.initEventListeners();
        this.initExtensionListener();
        
        // Load initial settings
        this.loadSettings();
    }

    initEventListeners() {
        // TTS Settings
        const ttsVolume = document.getElementById('ttsVolume');
        if (ttsVolume) {
            ttsVolume.addEventListener('input', (e) => {
                const vol = e.target.value;
                document.getElementById('volumeValue').textContent = vol;
                localStorage.setItem('ttsVolume', vol);
            });
        }

        const ttsProvider = document.getElementById('ttsProvider');
        if (ttsProvider) {
            ttsProvider.addEventListener('change', (e) => {
                localStorage.setItem('ttsProvider', e.target.value);
            });
        }
    }

    /**
     * Listen for messages from the browser extension
     */
    initExtensionListener() {
        // 1. Listen for direct CustomEvent (dispatched by content-script-app.js)
        window.addEventListener('youtubeChatMessage', (event) => {
            this.handleNewMessage(event.detail);
        });

        // 2. Fallback/Initial load from chrome.storage
        if (window.chrome && chrome.storage) {
            chrome.storage.onChanged.addListener((changes) => {
                if (changes.lastChatMessage) {
                    this.handleNewMessage(changes.lastChatMessage.newValue.data);
                }
            });
        }
    }

    /**
     * Process incoming chat messages
     */
    handleNewMessage(data) {
        if (!data || this.seenMessageIds.has(data.id)) return;
        
        this.seenMessageIds.add(data.id);
        
        // Maintain message history limit
        if (this.seenMessageIds.size > 500) {
            const firstId = this.seenMessageIds.values().next().value;
            this.seenMessageIds.delete(firstId);
        }

        // Trigger TTS if enabled
        if (this.isTTSEnabled) {
            this.speakMessage(data);
        }
    }

    /**
     * Speak message using configured TTS provider
     */
    speakMessage(data) {
        // Clean content for TTS (remove HTML tags/emojis)
        const cleanText = data.content.replace(/<[^>]*>/g, '').trim();
        if (!cleanText) return;

        const provider = localStorage.getItem('ttsProvider') || 'system';
        const volume = (localStorage.getItem('ttsVolume') || 100) / 100;

        console.log(`Speaking (${provider}): ${data.author} says ${cleanText}`);

        if (provider === 'system') {
            const utterance = new SpeechSynthesisUtterance(`${data.author} says ${cleanText}`);
            utterance.volume = volume;
            window.speechSynthesis.speak(utterance);
        } else {
            // Placeholder for Cloud TTS (OpenAI/ElevenLabs)
            // This would call your tts-manager.js logic
        }
    }

    loadSettings() {
        const volume = localStorage.getItem('ttsVolume') || 100;
        const provider = localStorage.getItem('ttsProvider') || 'system';
        
        if (document.getElementById('ttsVolume')) {
            document.getElementById('ttsVolume').value = volume;
            document.getElementById('volumeValue').textContent = volume;
        }
        if (document.getElementById('ttsProvider')) {
            document.getElementById('ttsProvider').value = provider;
        }
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
