# Project Structure Documentation

## Directory Structure

```
youtube-live-chat-tts-assistant/
├── docs/                           # Documentation directory
│   └── DEVELOPMENT_REQUIREMENTS.md # Development requirements document
│
├── src/                            # Source code directory
│   ├── js/                         # JavaScript files
│   │   ├── youtube-client.js      # YouTube API client (to be implemented)
│   │   ├── tts-manager.js         # TTS manager (to be implemented)
│   │   ├── music-detector.js      # Music detector (to be implemented)
│   │   └── app.js                 # Main application logic (to be implemented)
│   │
│   ├── css/                        # Stylesheet files
│   │   └── styles.css             # Main stylesheet (to be implemented)
│   │
│   └── html/                       # HTML files
│       ├── index.html              # Main interface (to be implemented)
│       └── overlay.html            # Song display overlay (to be implemented)
│
├── assets/                          # Resource files
│   ├── icons/                      # Icon files (to be added)
│   └── images/                     # Image files (to be added)
│
├── README.md                       # Project documentation
├── .gitignore                      # Git ignore file configuration
└── PROJECT_STRUCTURE.md           # This file - project structure documentation
```

## File Descriptions

### Documentation Files
- `README.md` - Project overview, features, quick start guide
- `docs/DEVELOPMENT_REQUIREMENTS.md` - Detailed development requirements document

### Source Code Files (To Be Implemented)
- `src/html/index.html` - Main application interface
- `src/html/overlay.html` - Song display overlay (for OBS)
- `src/css/styles.css` - Main stylesheet file
- `src/js/youtube-client.js` - YouTube live chat stream client
- `src/js/tts-manager.js` - TTS functionality manager
- `src/js/music-detector.js` - Music detection functionality
- `src/js/app.js` - Main application logic and initialization

## Development Roadmap

1. **Phase 1: Core Infrastructure**
   - Create basic HTML layout
   - Set up CSS styling framework
   - Implement configuration and storage utilities

2. **Phase 2: YouTube Integration**
   - Implement OAuth authentication flow
   - Connect to YouTube live chat stream
   - Display chat messages

3. **Phase 3: TTS Integration**
   - Implement TTS provider abstraction layer
   - Add click-to-speak functionality
   - Audio playback management

4. **Phase 4: Song Display**
   - Implement Media Session API detection
   - Create manual input interface
   - Create overlay display component

5. **Phase 5: Polish & Testing**
   - UI/UX improvements
   - Error handling optimization
   - Performance optimization
   - Cross-browser testing

## Important Notes

- All API keys should be stored in environment variables or configuration files, never commit to Git
- Reference the `social_stream` project for implementation patterns, but maintain code independence
- Use pure JavaScript (Vanilla JS), no external framework dependencies
