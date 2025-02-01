# ar://playdead File Renaming Tool

A Python script to help prepare media files for ar://playdead albums by batch renaming them according to a track listing.

## Features
- Supports audio (.mp3, .flac, .wav) and video (.mp4, .webm) files
- Preserves file extensions
- Validates filenames for compatibility
- Shows preview before making changes
- UTF-8 support for international characters

## Setup
1. Place `rename_tracks.py` in the folder with your media files
2. Create `tracks.txt` in the same folder with your track names
3. One track name per line in `tracks.txt`, for example:

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
