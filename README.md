# YouTube Live Chat TTS Assistant

A specialized assistant tool designed for YouTube live streaming with the following core features:

1. **Real-time YouTube Live Chat Stream Monitoring** - Fetch and display live chat messages
2. **Click-to-Speak TTS Functionality** - Click chat messages to read them aloud using AI TTS
3. **Song Information Display** - Display currently playing song name on screen (supports local player detection)

## Features

- ✅ Real-time YouTube live chat stream
- ✅ Click messages to read with TTS (supports multiple TTS providers)
- ✅ Auto-detect music playing in browser tabs
- ✅ Manual song name input option
- ✅ Clean and beautiful interface design
- ✅ Support for OBS Studio and other streaming software

## Tech Stack

- Pure frontend implementation (HTML/CSS/JavaScript)
- YouTube Data API v3
- Media Session API (music detection)
- Multiple TTS API support (OpenAI, ElevenLabs, Google Cloud, System TTS)

## Project Structure

```
youtube-live-chat-tts-assistant/
├── docs/                    # Documentation directory
│   └── DEVELOPMENT_REQUIREMENTS.md
├── src/                     # Source code directory
│   ├── js/                  # JavaScript files
│   ├── css/                 # Stylesheet files
│   └── html/                # HTML files
├── assets/                  # Resource files (icons, images, etc.)
├── README.md               # Project documentation
└── .gitignore             # Git ignore file
```

## Quick Start

1. Clone or download this repository
2. Open `src/html/index.html` in your browser
3. Configure YouTube OAuth and TTS API keys
4. Start using!

## Configuration

### YouTube API
YouTube OAuth 2.0 credentials are required to access live chat streams.

### TTS Providers
The following TTS providers are supported (choose at least one):
- OpenAI TTS (Recommended)
- ElevenLabs
- Google Cloud TTS
- System TTS (browser built-in, no API key needed)

### Music Detection
- **Auto-detect**: Use browser Media Session API to detect music playing in browser tabs
- **Manual Input**: If auto-detect is unavailable, you can manually enter song names

## Use Cases

- YouTube streamers need to view chat in real-time and read messages aloud
- Display currently playing songs on the live stream
- Enhance live streaming interaction experience

## Development Status

🚧 Under Development - See `docs/DEVELOPMENT_REQUIREMENTS.md` for details

## License

MIT License
