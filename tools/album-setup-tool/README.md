# ar://playdead Album Setup Tool

A utility to prepare albums for ar://playdead by managing album metadata and filenames.

## Features
- Creates and manages album.json files
- Supports all ar://playdead media formats (.mp3, .flac, .wav, .mp4, .webm)
- Automatically formats filenames with track numbers (01, 02, etc.)
- Shows preview before making changes
- UTF-8 support for international characters

## Setup
Place `setup_album.py` in your album folder root directory.

## Usage
Run: `python setup_album.py`

Choose from four modes:

1. Create complete album structure (start fresh)
   - Creates all necessary directories (Tracks/, Reels/) based on the type of album
   - Generates blank album.json template
   - Creates empty more_info.txt
   - Adds placeholder album_cover.png
   - Adds placeholder media files
   - Perfect for starting a new album from scratch

2. Create blank album.json template
   - Creates a new album.json with empty fields
   - Includes placeholder track/reel entries
   - Won't overwrite existing file without confirmation

3. Generate album.json from files
   - Scans media files in Tracks/ or Reels/
   - Prompts for album metadata
   - Creates album.json with track/reel listings

4. Rename files based on album.json
   - Uses existing album.json to rename files
   - Adds proper track numbers
   - Removes invalid characters
   - Shows preview before making changes

## Notes
- Always backup your files before renaming
- Files should be in Tracks/ (for audio) or Reels/ (for video)
- Invalid characters are automatically removed from filenames
- The script preserves original file extensions
- Trailing spaces are automatically cleaned from filenames
