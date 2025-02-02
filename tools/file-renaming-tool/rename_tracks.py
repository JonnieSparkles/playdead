import os
import re
import json
from pathlib import Path
from datetime import datetime

def clean_filename(filename, index):
    # Remove invalid characters and add track number
    clean_name = re.sub(r'[<>:"/\\|?*]', '', filename)
    # Remove trailing spaces and dots
    clean_name = clean_name.rstrip(' .')
    return f"{index:02d} - {clean_name}"

def get_media_files(directory):
    # Get all supported media files from Tracks/ or Reels/ directory
    extensions = ('.mp3', '.flac', '.wav', '.mp4', '.webm')
    media_dir = 'Reels' if any(f.lower().endswith(('.mp4', '.webm')) for f in os.listdir(directory)) else 'Tracks'
    
    # Create directory if it doesn't exist
    if not os.path.exists(media_dir):
        os.makedirs(media_dir)
        print(f"Created {media_dir}/ directory")
    
    # Get files from the appropriate directory
    return sorted([f for f in os.listdir(media_dir) if f.lower().endswith(extensions)]), media_dir

def load_album_json():
    try:
        if os.path.exists('album.json') and os.path.getsize('album.json') > 0:
            with open('album.json', 'r', encoding='utf-8') as f:
                return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        print("Note: No valid album.json found, will create new one.")
        return None

def create_new_album_json():
    # First determine if we're dealing with audio or video
    media_files, media_dir = get_media_files('.')
    media_type = "video" if media_dir == "Reels" else "audio"
    
    # Try to load existing album.json for defaults
    existing_data = load_album_json() or {}
    
    # Create base album data with defaults from existing file
    album_data = {
        "version": "1.1.0",
        "type": media_type,
        "band": input(f"Band name ({existing_data.get('band', '')}): ") or existing_data.get('band', ''),
        "title": input(f"Album title ({existing_data.get('title', '')}): ") or existing_data.get('title', ''),
        "date": input(f"Date ({existing_data.get('date', '')}): ") or existing_data.get('date', ''),
        "source": input(f"Source ({existing_data.get('source', '')}): ") or existing_data.get('source', ''),
        "info": "more_info.txt"
    }
    
    # Only add the appropriate media list key
    if media_type == "video":
        album_data["reels"] = []
    else:
        album_data["tracks"] = []
    
    return album_data

def create_blank_album_json():
    album_data = {
        "version": "1.1.0",
        "type": "audio",
        "band": "",
        "title": "",
        "date": "",
        "source": "",
        "info": "more_info.txt",
        "tracks": [
            {"number": 1, "title": "Track 1"}
        ],
        "reels": [
            {"number": 1, "title": "Reel 1"}
        ]
    }
    return album_data

def rename_from_files():
    # Get current media files and directory
    current_files, media_dir = get_media_files('.')
    
    if not current_files:
        print(f"No media files found in {media_dir}/!")
        print("Supported formats: .mp3, .flac, .wav, .mp4, .webm")
        return

    # Create new album.json first
    album_data = create_new_album_json()
    
    # Then load it back if it exists, to preserve any existing data
    existing_data = load_album_json()
    if existing_data:
        # Update with existing values if user just pressed enter
        for key in ['band', 'title', 'date', 'source']:
            if not album_data[key]:
                album_data[key] = existing_data.get(key, '')
    
    # Detect media type based on directory
    media_type = "video" if media_dir == "Reels" else "audio"
    album_data["type"] = media_type
    
    # Get track/reel names
    print(f"\nEnter names for each file in {media_dir}/ (press Enter to keep current name):")
    media_list = []
    for i, filename in enumerate(current_files, 1):
        current_name = Path(filename).stem
        # Remove any existing track numbers (fixed regex pattern)
        clean_current = re.sub(r'^\d+[- _\.]+', '', current_name)
        
        new_name = input(f"{filename} -> ({clean_current}): ").strip()
        if not new_name:
            new_name = clean_current
            
        # Add to appropriate list in album.json
        media_entry = {
            "number": i,
            "title": new_name
        }
        media_list.append(media_entry)

    if media_type == "video":
        album_data["reels"] = media_list
    else:
        album_data["tracks"] = media_list

    return album_data, current_files, media_dir, media_list

def rename_from_json():
    # Load existing album.json
    album_data = load_album_json()
    if not album_data:
        print("Error: No valid album.json found!")
        return None

    # Get current media files and directory
    current_files, media_dir = get_media_files('.')
    
    # Get the appropriate media list (tracks or reels)
    media_list = album_data.get('tracks', []) if media_dir == 'Tracks' else album_data.get('reels', [])
    
    if not media_list:
        print(f"No {'tracks' if media_dir == 'Tracks' else 'reels'} found in album.json!")
        return None
        
    if len(current_files) != len(media_list):
        print(f"Error: Number of files in {media_dir}/ ({len(current_files)}) " +
              f"doesn't match number in album.json ({len(media_list)})")
        return None

    return album_data, current_files, media_dir, media_list

def main():
    print("ar://playdead File Renaming Tool")
    print("================================\n")

    # Ask user which mode to use
    print("Choose operation mode:")
    print("1. Generate album.json from files")
    print("2. Rename files based on album.json")
    print("3. Create blank album.json template")
    mode = input("Enter 1, 2, or 3: ").strip()

    if mode == "1":
        result = rename_from_files()
    elif mode == "2":
        result = rename_from_json()
    elif mode == "3":
        if os.path.exists('album.json'):
            response = input("album.json already exists. Override? (yes/no): ")
            if response.lower() != 'yes':
                print("Operation cancelled")
                return
        
        # Create and save blank album.json
        album_data = create_blank_album_json()
        # Format JSON with compact track/reel entries
        json_str = json.dumps(album_data, indent=4, ensure_ascii=False)
        json_str = re.sub(
            r'(\s+){\s+"number":\s+(\d+),\s+"title":\s+"([^"]+)"\s+}',
            r'\1{"number": \2, "title": "\3"}',
            json_str
        )
        
        with open('album.json', 'w', encoding='utf-8') as f:
            f.write(json_str)
        print("Created blank album.json template")
        return
    else:
        print("Invalid mode selected")
        return

    if not result:
        return

    album_data, current_files, media_dir, media_list = result

    # Preview changes
    print("\nProposed changes:")
    print("----------------")
    for i, old in enumerate(current_files, 1):
        ext = Path(old).suffix
        new_name = media_list[i-1]["title"]
        new_filename = clean_filename(new_name, i) + ext
        print(f"{old} -> {new_filename}")

    # Show album.json preview
    print("\nalbum.json preview:")
    print(json.dumps(album_data, indent=4))

    # Ask for confirmation
    if mode == "1":
        response = input("\nSave album.json? (yes/no): ")
    else:
        response = input("\nProceed with renaming files? (yes/no): ")

    if response.lower() == 'yes':
        # Save album.json if in mode 1
        if mode == "1":
            # First create JSON string with standard formatting
            json_str = json.dumps(album_data, indent=4, ensure_ascii=False)
            
            # Then modify the tracks/reels format
            json_str = re.sub(
                r'(\s+){\s+"number":\s+(\d+),\s+"title":\s+"([^"]+)"\s+}',
                r'\1{"number": \2, "title": "\3"}',
                json_str
            )
            
            # Write the modified string
            with open('album.json', 'w', encoding='utf-8') as f:
                f.write(json_str)
            print("Saved album.json")

            # Create more_info.txt if it doesn't exist
            if not os.path.exists('more_info.txt'):
                with open('more_info.txt', 'w', encoding='utf-8') as f:
                    f.write(f"Album information for {album_data['title']} by {album_data['band']}\n")
                print("Created more_info.txt template")

        # Only rename files in mode 2
        if mode == "2":
            for i, (old_name, media_entry) in enumerate(zip(current_files, media_list), 1):
                try:
                    ext = Path(old_name).suffix
                    new_filename = clean_filename(media_entry["title"], i) + ext
                    os.rename(
                        os.path.join(media_dir, old_name),
                        os.path.join(media_dir, new_filename)
                    )
                    print(f"Renamed: {old_name} -> {new_filename}")
                except Exception as e:
                    print(f"Error renaming {old_name}: {e}")

    else:
        print("Operation cancelled")

if __name__ == "__main__":
    main() 