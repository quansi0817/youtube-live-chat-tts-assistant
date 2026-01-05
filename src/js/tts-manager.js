/**
 * TTS Manager
 * Handles text-to-speech functionality with multiple provider support
 */

class TTSManager {
    constructor() {
        this.provider = 'system';
        this.apiKey = '';
        this.voice = 'alloy';
        this.volume = 1.0;
        this.audioContext = null;
        this.audioQueue = [];
        this.isPlaying = false;
        this.currentAudio = null;
    }

    /**
     * Initialize audio context
     */
    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        return this.audioContext;
    }

    /**
     * Configure TTS settings
     */
    configure(settings) {
        this.provider = settings.provider || 'system';
        this.apiKey = settings.apiKey || '';
        this.voice = settings.voice || 'alloy';
        this.volume = settings.volume !== undefined ? settings.volume : 1.0;
    }

    /**
     * Speak text
     * @param {string} text - Text to speak
     * @param {Object} options - Additional options
     */
    async speak(text, options = {}) {
        if (!text || !text.trim()) {
            return;
        }

        // Clean text
        text = this.cleanText(text);

        if (!text) {
            return;
        }

        // Add to queue
        this.audioQueue.push({ text, options });

        // Process queue
        this.processQueue();
    }

    /**
     * Clean text for TTS
     */
    cleanText(text) {
        // Remove URLs
        text = text.replace(/https?:\/\/[^\s]+/g, '[Link]');
        
        // Remove excessive punctuation
        text = text.replace(/[.]{2,}/g, '.');
        text = text.replace(/[!]{2,}/g, '!');
        text = text.replace(/[?]{2,}/g, '?');
        
        // Remove emojis (optional, can be kept)
        // text = text.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
        
        return text.trim();
    }

    /**
     * Process audio queue
     */
    async processQueue() {
        if (this.isPlaying || this.audioQueue.length === 0) {
            return;
        }

        this.isPlaying = true;
        const { text, options } = this.audioQueue.shift();

        try {
            await this.playAudio(text, options);
        } catch (error) {
            console.error('TTS error:', error);
        } finally {
            this.isPlaying = false;
            // Process next in queue
            if (this.audioQueue.length > 0) {
                setTimeout(() => this.processQueue(), 100);
            }
        }
    }

    /**
     * Play audio based on provider
     */
    async playAudio(text, options) {
        switch (this.provider) {
            case 'openai':
                await this.openAITTS(text);
                break;
            case 'elevenlabs':
                await this.elevenLabsTTS(text);
                break;
            case 'google':
                await this.googleTTS(text);
                break;
            case 'system':
            default:
                this.systemTTS(text);
                break;
        }
    }

    /**
     * System TTS (browser built-in)
     */
    systemTTS(text) {
        if (!window.speechSynthesis) {
            console.error('Speech synthesis not supported');
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = this.volume;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Try to find a good voice
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            // Prefer English voices
            const englishVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
            utterance.voice = englishVoice;
            utterance.lang = englishVoice.lang;
        }

        utterance.onend = () => {
            this.isPlaying = false;
        };

        utterance.onerror = (error) => {
            console.error('TTS error:', error);
            this.isPlaying = false;
        };

        window.speechSynthesis.speak(utterance);
    }

    /**
     * OpenAI TTS
     */
    async openAITTS(text) {
        if (!this.apiKey) {
            console.error('OpenAI API key not set');
            this.systemTTS(text); // Fallback to system TTS
            return;
        }

        try {
            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    input: text,
                    voice: this.voice
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI TTS error: ${response.status}`);
            }

            const audioBlob = await response.blob();
            await this.playAudioBlob(audioBlob);
        } catch (error) {
            console.error('OpenAI TTS error:', error);
            this.systemTTS(text); // Fallback
        }
    }

    /**
     * ElevenLabs TTS
     */
    async elevenLabsTTS(text) {
        if (!this.apiKey) {
            console.error('ElevenLabs API key not set');
            this.systemTTS(text);
            return;
        }

        try {
            // Default voice ID (you can change this)
            const voiceId = 'VR6AewLTigWG4xSOukaG';
            
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
                method: 'POST',
                headers: {
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_flash_v2_5',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`ElevenLabs TTS error: ${response.status}`);
            }

            const audioBlob = await response.blob();
            await this.playAudioBlob(audioBlob);
        } catch (error) {
            console.error('ElevenLabs TTS error:', error);
            this.systemTTS(text);
        }
    }

    /**
     * Google Cloud TTS
     */
    async googleTTS(text) {
        if (!this.apiKey) {
            console.error('Google API key not set');
            this.systemTTS(text);
            return;
        }

        try {
            const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input: { text: text },
                    voice: {
                        languageCode: 'en-US',
                        name: 'en-US-Standard-A',
                        ssmlGender: 'FEMALE'
                    },
                    audioConfig: {
                        audioEncoding: 'MP3'
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Google TTS error: ${response.status}`);
            }

            const data = await response.json();
            const audioData = data.audioContent;
            
            // Convert base64 to blob
            const byteCharacters = atob(audioData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const audioBlob = new Blob([byteArray], { type: 'audio/mp3' });
            
            await this.playAudioBlob(audioBlob);
        } catch (error) {
            console.error('Google TTS error:', error);
            this.systemTTS(text);
        }
    }

    /**
     * Play audio blob
     */
    async playAudioBlob(blob) {
        return new Promise((resolve, reject) => {
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            
            audio.volume = this.volume;
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                this.isPlaying = false;
                resolve();
            };
            
            audio.onerror = (error) => {
                URL.revokeObjectURL(audioUrl);
                this.isPlaying = false;
                reject(error);
            };
            
            this.currentAudio = audio;
            this.initAudioContext();
            audio.play().catch(reject);
        });
    }

    /**
     * Stop current TTS
     */
    stop() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        
        this.audioQueue = [];
        this.isPlaying = false;
    }
}

// Export for use in other scripts
window.TTSManager = TTSManager;



