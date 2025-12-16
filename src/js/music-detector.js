/**
 * Music Detector
 * Detects currently playing music using Media Session API or manual input
 */

class MusicDetector {
    constructor() {
        this.currentTrack = {
            title: null,
            artist: null
        };
        this.onTrackChangeCallback = null;
        this.checkInterval = null;
        this.isMonitoring = false;
    }

    /**
     * Start monitoring for music
     * @param {Function} onTrackChange - Callback when track changes
     */
    startMonitoring(onTrackChange) {
        this.onTrackChangeCallback = onTrackChange;
        this.isMonitoring = true;
        
        // Check immediately
        this.checkMusic();
        
        // Check every 2 seconds
        this.checkInterval = setInterval(() => {
            this.checkMusic();
        }, 2000);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        this.isMonitoring = false;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Check for music using Media Session API
     */
    checkMusic() {
        if (!this.isMonitoring) {
            return;
        }

        try {
            // Check Media Session API
            if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
                const metadata = navigator.mediaSession.metadata;
                const title = metadata.title || null;
                const artist = metadata.artist || null;

                // Check if track changed
                if (title && (title !== this.currentTrack.title || artist !== this.currentTrack.artist)) {
                    this.currentTrack = { title, artist };
                    if (this.onTrackChangeCallback) {
                        this.onTrackChangeCallback(this.currentTrack);
                    }
                }
            } else {
                // No music detected via Media Session API
                if (this.currentTrack.title) {
                    // Clear previous track
                    this.currentTrack = { title: null, artist: null };
                    if (this.onTrackChangeCallback) {
                        this.onTrackChangeCallback(this.currentTrack);
                    }
                }
            }
        } catch (e) {
            console.error('Error checking music:', e);
        }
    }

    /**
     * Set track manually
     * @param {string} title - Song title
     * @param {string} artist - Artist name
     */
    setTrackManually(title, artist) {
        this.currentTrack = {
            title: title || null,
            artist: artist || null
        };
        
        if (this.onTrackChangeCallback) {
            this.onTrackChangeCallback(this.currentTrack);
        }
    }

    /**
     * Get current track
     */
    getCurrentTrack() {
        return { ...this.currentTrack };
    }
}

// Export for use in other scripts
window.MusicDetector = MusicDetector;

