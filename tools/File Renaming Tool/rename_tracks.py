import os
import re
from pathlib import Path

def clean_filename(filename):
    # Remove invalid characters from filename
    return re.sub(r'[<>:"/\\|?*]', '', filename)

def get_media_files(directory):
    # Get all supported media files
    extensions = ('.mp3', '.flac', '.wav', '.mp4', '.webm')
    return sorted([f for f in os.listdir(directory) if f.lower().endswith(extensions)])

def main():
    print("ar://playdead File Renaming Tool")
    print("================================\n")

    # Read the track names from tracks.txt
    try:
        with open('tracks.txt', 'r', encoding='utf-8') as f:
            new_names = []
            for line in f:
                # Remove line numbers and pipe symbols if present
                clean_line = line.split('|')[-1].strip()
                if clean_line:
                    new_names.append(clean_line)
    except FileNotFoundError:
        print("Error: tracks.txt not found!")
        print("Please create tracks.txt with one track name per line.")
        return

    # Get current media files
    current_files = get_media_files('.')
    
    if not current_files:
        print("No media files found!")
        print("Supported formats: .mp3, .flac, .wav, .mp4, .webm")
        return

    if len(current_files) != len(new_names):
        print(f"Warning: Number of files ({len(current_files)}) doesn't match")
        print(f"number of tracks in tracks.txt ({len(new_names)})")
        proceed = input("Continue anyway? (yes/no): ")
        if proceed.lower() != 'yes':
            return

    # Preview changes
    print("\nProposed changes:")
    print("----------------")
    for old, new in zip(current_files, new_names):
        ext = Path(old).suffix
        new_filename = clean_filename(f"{new}{ext}")
        print(f"{old} -> {new_filename}")

    # Ask for confirmation
    response = input("\nProceed with renaming? (yes/no): ")

    if response.lower() == 'yes':
        for old_name, new_name in zip(current_files, new_names):
            try:
                ext = Path(old_name).suffix
                new_filename = clean_filename(f"{new_name}{ext}")
                os.rename(old_name, new_filename)
                print(f"Renamed: {old_name} -> {new_filename}")
            except Exception as e:
                print(f"Error renaming {old_name}: {e}")
    else:
        print("Operation cancelled")

if __name__ == "__main__":
    main() 