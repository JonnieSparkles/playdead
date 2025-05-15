# ar://playdead Album Examples

Complete examples of album structures and metadata formats.

## Audio Album Example
Shows a typical audio album structure with multiple tracks:
- `album.json` - Metadata for an audio album in v2 format:
  ```json
  {
      "version": "2.0.0",
      "type": "audio",
      "band": "Band Name",
      "title": "Album Title",
      "date": "YYYY-MM-DD",
      "source": "Source information",
      "cover": "TXID_OF_COVER_IMAGE",
      "info": "TXID_OF_INFO_FILE",
      "tracks": [
          {
              "number": 1,
              "title": "Track Title",
              "id": "TXID_OF_TRACK"
          }
      ]
  }
  ```
- `more_info.txt` - Detailed album information
- `Tracks/` - Directory containing audio files
- Example manifest structure

## Video Album Example
Shows a typical video album structure with multiple reels:
- `album.json` - Metadata for a video album in v2 format:
  ```json
  {
      "version": "2.0.0",
      "type": "video",
      "band": "Band Name",
      "title": "Album Title",
      "date": "YYYY-MM-DD",
      "source": "Source information",
      "cover": "TXID_OF_COVER_IMAGE",
      "info": "TXID_OF_INFO_FILE",
      "reels": [
          {
              "number": 1,
              "title": "Video Title",
              "id": "TXID_OF_VIDEO"
          }
      ]
  }
  ```
- `more_info.txt` - Detailed show information
- `Reels/` - Directory containing video files
- Example manifest structure

## Notes
- These are reference examples only
- For creating new albums, use the Album Setup Tool
- All example TXIDs in manifests are placeholders
- The v2 format combines all metadata and file references into a single album.json file 