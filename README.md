# ar://playdead

A permanent media player and catalog built for Arweave, focused on preserving audience recordings, videos, and public domain content forever.

## Features

- 🎵 Music streaming from the permaweb
- 📹 Video playback support
- 🎨 Retro-cyberpunk themed interface
- 🌈 Interactive laser light show with multiple visualization modes
- 📱 Responsive design that works on desktop and mobile
- ⌨️ Keyboard controls for playback
- 🎼 Support for custom album catalogs
- 🔄 Gateway-aware content loading

## Usage

### Playing Media
1. Browse the curated catalog on the homepage
2. Click any album or video to load it in the player
3. Use the player controls or keyboard shortcuts to control playback

### Loading Custom Content
1. Get the TXID of an album/video uploaded to Arweave
2. Enter the TXID in the "Load Tape" field
3. Click the cassette/recorder icon to load and play

### Keyboard Controls
- `Space` - Play/Pause
- `←` - Previous track/video
- `→` - Next track/video

### Laser Show
Click the "Laser Show" button to cycle through visualization modes:
- Wave mode: Circular wave patterns that respond to audio/video intensity
- Classic mode: Moving laser beams with dynamic color transitions
- Spotlight mode: Simulated stage lighting with fog effects

## Contributing

Want to add content to ar://playdead? Check out the [contribution guide](contribute.html) for:
- Audio/Video format specifications
- File structure requirements
- Upload instructions

## Tools

### Album Setup Tool
A Python utility to help prepare albums for ar://playdead:
- Creates complete album structures from scratch
- Manages album.json files and metadata
- Automatically formats track/reel filenames
- Supports all media formats (.mp3, .flac, .wav, .mp4, .webm)
- Shows preview before making changes
- Located in `tools/album-setup-tool/`

### Album Templates
Reference templates for creating new albums:
- Audio album structure and metadata
- Video album structure and metadata
- Example `album.json` configurations
- Located in `templates/`

## Technical Details

Built with vanilla web technologies:
- HTML5 Audio/Video
- CSS3
- JavaScript
- Web Audio API (for visualizations)
- Canvas API (for laser effects)

### Developer Testing

Add `#dev` to the URL to enable testing features:
- On player.html, adds a simulation toggle button to the interface which allows testing laser show effects without audio playback

## Version History

See [changelog.txt](changelog.txt) for detailed version history.

## Credits

Created by @JonnieSparkles with assistance from all the chatbots.

## License

[CC0 1.0 Universal](LICENSE) 