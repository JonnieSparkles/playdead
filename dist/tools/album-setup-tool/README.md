# ar://playdead Album Setup Tool

A utility to prepare albums for ar://playdead by managing album metadata and filenames.

## Features
- Creates and manages album.json files (v2.0.0 format)
- Supports all ar://playdead media formats (.mp3, .flac, .wav, .mp4, .webm)
- Automatically formats filenames with track numbers (01, 02, etc.)
- Shows preview before making changes
- UTF-8 support for international characters
- TXID management for Arweave uploads

## Setup
Place `setup_album.py` in your album folder root directory.

## Usage
Run: `python setup_album.py`

Choose from four modes:

1. Create complete album structure (start fresh)
   - Creates all necessary directories (Tracks/, Reels/) based on the type of album
   - Generates blank album.json template with TXID fields
   - Creates empty more_info.txt
   - Adds placeholder album_cover.png
   - Adds placeholder media files
   - Perfect for starting a new album from scratch

2. Create blank album.json template
   - Creates a new album.json with empty fields
   - Includes placeholder track/reel entries with TXID fields
   - Won't overwrite existing file without confirmation

3. Generate album.json from files
   - Scans media files in Tracks/ or Reels/
   - Prompts for album metadata
   - Creates album.json with track/reel listings and TXID fields
   - Helps manage TXIDs after Arweave uploads

4. Rename track files based on album.json
   - Uses existing album.json to rename trackfiles
   - Adds proper track numbers
   - Removes invalid characters
   - Shows preview before making changes

## TXID Management
After uploading files to Arweave:
1. Use the tool to update album.json with TXIDs
2. Consider using ArDrive's export feature to manage uploads
3. Or create a manifest file to track TXIDs
4. Leverage AI tools to automate TXID recording

## Notes
- Always backup your files before renaming
- Files should be in Tracks/ (for audio) or Reels/ (for video)
- Invalid characters are automatically removed from filenames
- The script preserves original file extensions
- Trailing spaces are automatically cleaned from filenames
- Keep track of TXIDs after uploading to Arweave
