/**
 * Main Application Logic
 * Optimized for Chinese TTS with Speed control and Custom Voice IDs.
 */

class App {
    constructor() {
        this.initEventListeners();
        this.initExtensionListener();
        this.loadSettings();
    }

    initEventListeners() {
        const settings = ['ttsVolume', 'ttsProvider', 'ttsApiKey', 'ttsVoice', 'ttsSpeed'];
        settings.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const event = (el.type === 'range' || el.type === 'password') ? 'input' : 'change';
                el.addEventListener(event, (e) => {
                    localStorage.setItem(id, e.target.value);
                    if (id === 'ttsVolume') document.getElementById('volumeValue').textContent = e.target.value;
                    if (id === 'ttsSpeed') document.getElementById('speedValue').textContent = (e.target.value / 100).toFixed(1);
                    if (id === 'ttsProvider') this.updateVoiceOptions();
                });
            }
        });

        const testBtn = document.getElementById('testTtsBtn');
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                this.speakText("你好，这是中文语音测试。Hello, this is a test.");
            });
        }

        // Initialize voice options on load
        this.updateVoiceOptions();
    }

    updateVoiceOptions() {
        const provider = document.getElementById('ttsProvider').value;
        const voiceSelect = document.getElementById('ttsVoice');
        const currentValue = voiceSelect.value;

        // Store original options if not already stored
        if (!voiceSelect.dataset.originalOptions) {
            voiceSelect.dataset.originalOptions = voiceSelect.innerHTML;
        }

        // Clear and rebuild options
        voiceSelect.innerHTML = '';

        // Parse and filter options
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = voiceSelect.dataset.originalOptions;
        const allOptions = tempDiv.querySelectorAll('option[data-provider]');
        let hasMatchingOption = false;

        allOptions.forEach(option => {
            if (option.getAttribute('data-provider') === provider) {
                voiceSelect.appendChild(option.cloneNode(true));
                if (option.value === currentValue) hasMatchingOption = true;
            }
        });

        // If current selection doesn't match new provider, select first available
        if (!hasMatchingOption && voiceSelect.options.length > 0) {
            voiceSelect.value = voiceSelect.options[0].value;
            localStorage.setItem('ttsVoice', voiceSelect.value);
        }
    }

    initExtensionListener() {
        if (window.chrome && chrome.storage) {
            chrome.storage.onChanged.addListener((changes) => {
                if (changes.SELECTED_CHAT_MESSAGE) {
                    const msg = changes.SELECTED_CHAT_MESSAGE.newValue;
                    if (msg) {
                        const cleanContent = msg.content.replace(/<[^>]*>/g, '').trim();
                        const textToRead = `${msg.author}说：${cleanContent}`;
                        this.speakText(textToRead);
                    }
                }
            });
        }
    }

    async speakText(text) {
        if (!text) return;

        const provider = localStorage.getItem('ttsProvider') || 'openai';
        const apiKey = localStorage.getItem('ttsApiKey') || '';
        const voice = localStorage.getItem('ttsVoice') || '';
        const volume = (localStorage.getItem('ttsVolume') || 100) / 100;
        const speed = (localStorage.getItem('ttsSpeed') || 100) / 100;

        console.log(`[TTS] ${provider} | Voice: ${voice} | Speed: ${speed}`);

        switch(provider) {
            case 'system':
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.volume = volume;
                utterance.rate = speed;
                utterance.lang = 'zh-CN';
                window.speechSynthesis.speak(utterance);
                break;
            case 'openai':
                this.playOpenAITTS(text, apiKey, voice || 'nova', volume, speed);
                break;
            case 'elevenlabs':
                this.playElevenLabsTTS(text, apiKey, voice || '21m00Tcm4TlvDq8ikWAM', volume, speed);
                break;
            case 'google':
                this.playGoogleTTS(text, apiKey, voice || 'zh-CN-Neural2-A', volume, speed);
                break;
        }
    }

    /**
     * OpenAI TTS (Note: OpenAI doesn't have 'gpt-4o-mini-tts' model.
     * This uses the standard 'tts-1' model for high-quality voice synthesis)
     */
    async playOpenAITTS(text, apiKey, voice, volume, speed) {
        if (!apiKey) return alert("Missing OpenAI API Key");
        try {
            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'tts-1', // OpenAI's highest quality TTS model (not gpt-4o-mini-tts)
                    input: text,
                    voice: voice,
                    speed: speed
                })
            });
            this.playAudioFromResponse(response, volume);
        } catch (err) { console.error("OpenAI Error:", err); }
    }

    /**
     * ElevenLabs TTS (Optimized for Chinese Multilingual V2)
     */
    async playElevenLabsTTS(text, apiKey, voiceId, volume, speed) {
        if (!apiKey) return alert("Missing ElevenLabs API Key");
        try {
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: text, 
                    model_id: 'eleven_multilingual_v2' // Best for Chinese
                })
            });
            this.playAudioFromResponse(response, volume);
        } catch (err) { console.error("ElevenLabs Error:", err); }
    }

    /**
     * Google Cloud TTS (Neural2 Optimized)
     */
    async playGoogleTTS(text, apiKey, voiceName, volume, speed) {
        if (!apiKey) return alert("Missing Google API Key");
        try {
            const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text: text },
                    voice: { languageCode: 'zh-CN', name: voiceName }, // e.g. zh-CN-Neural2-A
                    audioConfig: { 
                        audioEncoding: 'MP3',
                        speakingRate: speed // 0.25 - 4.0
                    }
                })
            });
            const data = await response.json();
            if (data.audioContent) {
                const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
                audio.volume = volume;
                audio.play();
            }
        } catch (err) { console.error("Google Error:", err); }
    }

    async playAudioFromResponse(response, volume) {
        if (!response.ok) {
            const err = await response.json();
            alert(`API Error: ${err.error?.message || 'Check your API Key'}`);
            return;
        }
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audio.volume = volume;
        audio.play();
    }

    loadSettings() {
        ['ttsVolume', 'ttsProvider', 'ttsApiKey', 'ttsVoice', 'ttsSpeed'].forEach(id => {
            const val = localStorage.getItem(id);
            const el = document.getElementById(id);
            if (val && el) {
                el.value = val;
                if (id === 'ttsVolume') document.getElementById('volumeValue').textContent = val;
                if (id === 'ttsSpeed') document.getElementById('speedValue').textContent = (val / 100).toFixed(1);
            }
        });

        // Initialize voice options after settings are loaded
        this.updateVoiceOptions();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
