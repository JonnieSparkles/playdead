# ar://playdead File Renaming Tool

A utility to prepare media files for ar://playdead albums by automatically formatting filenames to match the required structure.

## Features
- Supports all ar://playdead media formats (.mp3, .flac, .wav, .mp4, .webm)
- Automatically adds track numbers (01, 02, etc.)
- Follows ar://playdead naming convention
- Shows preview before making changes
- UTF-8 support for international characters

## Setup
1. Place `rename_tracks.py` in your album folder
2. Create `tracks.txt` with your track names (one per line)
3. Make sure your media files are in the same folder

Example tracks.txt:

```
Track 1
Track 2
Track 3
```

## Usage
1. Open terminal/command prompt
2. Navigate to folder containing the script and files
3. Run: `python rename_tracks.py`
4. Review the preview
5. Type 'yes' to proceed or 'no' to cancel

## Notes
- Always backup your files before renaming
- Files are matched to track names in alphabetical order
- Invalid characters are automatically removed from filenames
- The script preserves original file extensions
