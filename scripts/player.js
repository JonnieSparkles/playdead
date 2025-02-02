// player.js - Handles player-specific functionality

let currentTrackIndex = 0;
let tracks = [];
let audioPlayer, audioSource, currentTrackTitle;

// Load and set the current media
function loadTrack(index) {
    currentTrackIndex = index;
    const track = tracks[currentTrackIndex];
    
    // Show loading state
    const albumCover = document.getElementById('album-cover');
    albumCover.classList.add('loading');
    
    // Remove active class from all rows
    document.querySelectorAll('.tracklist tbody tr').forEach(row => {
        row.classList.remove('active');
    });
    
    // Add active class to current track row
    document.querySelector(`.tracklist tbody tr:nth-child(${index + 1})`).classList.add('active');
    
    currentTrackTitle.classList.add('changing');
    setTimeout(() => {
        currentTrackTitle.textContent = track.title;
        currentTrackTitle.classList.remove('changing');
    }, 300);

    // Handle video vs audio content
    if (track.type === 'video') {
        // Hide album cover for video content
        const albumCover = document.getElementById('album-cover');
        albumCover.style.display = 'none';
        
        // Switch to video player if not already present
        if (!document.getElementById('video-player')) {
            const videoPlayer = document.createElement('video');
            videoPlayer.id = 'video-player';
            videoPlayer.controls = true;
            videoPlayer.style.maxWidth = '100%';
            // Add event listeners immediately after creating video player
            videoPlayer.addEventListener('play', updatePlayButton);
            videoPlayer.addEventListener('pause', updatePauseButton);
            audioPlayer.parentNode.replaceChild(videoPlayer, audioPlayer);
            audioPlayer = videoPlayer;
        }
        audioPlayer.src = track.url;
        document.dispatchEvent(new Event('mediaTypeChanged'));
    } else {
        // Show album cover for audio content
        const albumCover = document.getElementById('album-cover');
        albumCover.style.display = 'block';
        
        // Switch back to audio player if needed
        if (document.getElementById('video-player')) {
            const audioElement = document.createElement('audio');
            audioElement.id = 'audio-player';
            audioElement.controls = true;
            const videoPlayer = document.getElementById('video-player');
            videoPlayer.parentNode.replaceChild(audioElement, videoPlayer);
            audioPlayer = audioElement;
            // Add event listeners for audio player after it's created
            audioPlayer.addEventListener('play', updatePlayButton);
            audioPlayer.addEventListener('pause', updatePauseButton);
        }
        audioSource = audioPlayer.querySelector('source') || document.createElement('source');
        audioSource.src = track.url;
        if (!audioSource.parentNode) {
            audioPlayer.appendChild(audioSource);
        }
        document.dispatchEvent(new Event('mediaTypeChanged'));
    }

    audioPlayer.load();
    
    // Remove loading state when media is ready
    audioPlayer.addEventListener('canplay', () => {
        albumCover.classList.remove('loading');
    }, { once: true });
}

// Play the current track
function playCurrentTrack() {
    audioPlayer.play();
    document.getElementById("play-button").textContent = "||";
    if (document.getElementById("album-cover")) {
        document.getElementById("album-cover").classList.add("is-playing");
    }
}

// Load album metadata and tracks
async function loadAlbum() {
    const urlParams = new URLSearchParams(window.location.search);
    const albumTxid = urlParams.get("album");

    if (!albumTxid) {
        console.error("No album specified in the URL.");
        return;
    }

    try {
        const gateway = detectGatewayDomain();
        const manifestUrl = `${gateway}/raw/${albumTxid}/`;
        const manifestResponse = await fetch(manifestUrl);
        const manifest = await manifestResponse.json();

        const albumJsonUrl = `${gateway}/${albumTxid}/album.json`;
        const albumResponse = await fetch(albumJsonUrl);
        const albumData = await albumResponse.json();

        const albumCoverId = manifest.paths["album_cover.png"]?.id;
        const albumCover = document.getElementById("album-cover");
        albumCover.style.animation = 'none';  // Reset animation
        albumCover.offsetHeight;  // Trigger reflow
        albumCover.style.animation = null;  // Re-enable animation
        albumCover.src = albumCoverId
            ? `${gateway}/${albumCoverId}`
            : "./assets/default-cover.png";
        document.getElementById("album-band").textContent = albumData.band || "Unknown Band";
        document.getElementById("album-title").textContent = albumData.title || "Untitled Album";
        document.getElementById("date-value").textContent = albumData.date || "Unknown Date";
        document.getElementById("source-value").textContent = albumData.source || "Unknown Source";

        if (albumData.info) {
            const infoButton = document.getElementById("info-button");
            if (albumData.info.endsWith(".txt")) {
                const infoId = manifest.paths[albumData.info]?.id;
                infoButton.style.display = infoId ? "inline-block" : "none";
                infoButton.onclick = () => window.open(`${gateway}/${infoId}`, "_blank");
            } else {
                infoButton.style.display = "inline-block";
                infoButton.onclick = () => alert(albumData.info);
            }
        }

        // Modified track loading to handle videos
        const mediaEntries = Object.keys(manifest.paths).filter(path => 
            path.startsWith("Tracks/") || path.startsWith("Reels/")
        );
        
        const manifestTracks = mediaEntries.map((path) => {
            const filename = path.split("/").pop();
            const isVideo = path.startsWith("Reels/");
            
            // Improved number parsing for both video and audio files
            let trackNumber;
            if (isVideo) {
                // For video files, try to match "1 - ", "1-", "1.", etc.
                const numberMatch = filename.match(/^(\d+)[\s-_.]/);
                trackNumber = numberMatch ? parseInt(numberMatch[1]) : 1;  // Default to 1 for videos
            } else {
                // For audio files, keep existing logic
                trackNumber = parseInt(filename.match(/^\d+/)) || 0;
            }

            return {
                title: filename
                    .replace(/^\d+[\s-_.]+/, '')  // Remove leading numbers and separators
                    .replace(/\.[^/.]+$/, ''),     // Remove file extension
                url: `${gateway}/${manifest.paths[path].id}`,
                number: trackNumber,
                type: isVideo ? 'video' : 'audio'
            };
        }).sort((a, b) => a.number - b.number);

        tracks = manifestTracks.map(manifestTrack => {
            // Look for matching track in album.json
            const albumTrack = manifestTrack.type === 'video' 
                ? albumData.reels?.find(t => t.number === manifestTrack.number)
                : albumData.tracks?.find(t => t.number === manifestTrack.number);

            console.log('Matching:', manifestTrack, 'with:', albumTrack); // Debug log

            return {
                title: albumTrack?.title || manifestTrack.title,
                url: manifestTrack.url,
                number: albumTrack?.number || manifestTrack.number,
                type: manifestTrack.type,
                duration: albumTrack?.duration
            };
        });

        const tracklistBody = document.getElementById("tracklist-body");
        tracklistBody.innerHTML = "";
        tracks.forEach((track, index) => {
            const row = document.createElement("tr");
            row.className = "track";
            row.innerHTML = `<td>${track.number}</td><td>${track.title}</td>`;
            row.onclick = () => {
                loadTrack(index);
                playCurrentTrack();
            };
            tracklistBody.appendChild(row);
        });

        setupPlayer();
    } catch (error) {
        console.error("Error loading album:", error.message);
    }
}

// Set up the player controls
function setupPlayer() {
    audioPlayer = document.getElementById("audio-player");
    audioSource = document.getElementById("audio-source");
    currentTrackTitle = document.getElementById("current-track-title");

    // Add event listeners to sync play/pause state
    audioPlayer.addEventListener('play', () => {
        document.getElementById("play-button").textContent = "||";
        const albumCover = document.getElementById("album-cover");
        if (albumCover) {
            albumCover.classList.add("is-playing");
        }
    });

    audioPlayer.addEventListener('pause', () => {
        document.getElementById("play-button").textContent = ">";
        const albumCover = document.getElementById("album-cover");
        if (albumCover) {
            albumCover.classList.remove("is-playing");
        }
    });

    document.getElementById("play-button").onclick = () => {
        if (audioPlayer.paused) {
            playCurrentTrack();
        } else {
            audioPlayer.pause();
            document.getElementById("play-button").textContent = ">";
            const albumCover = document.getElementById("album-cover");
            if (albumCover) {
                albumCover.classList.remove("is-playing");
            }
        }
    };

    document.getElementById("prev-button").onclick = () => {
        if (audioPlayer.currentTime > 2) audioPlayer.currentTime = 0;
        else if (currentTrackIndex > 0) {
            loadTrack(--currentTrackIndex);
            playCurrentTrack();
        }
    };

    document.getElementById("next-button").onclick = () => {
        if (currentTrackIndex < tracks.length - 1) {
            loadTrack(++currentTrackIndex);
            playCurrentTrack();
        }
    };

    audioPlayer.onended = () => {
        if (currentTrackIndex < tracks.length - 1) {
            loadTrack(++currentTrackIndex);
            playCurrentTrack();
        }
    };

    document.getElementById("eject-button").onclick = () => {
        window.location.href = "index.html";
    };

    loadTrack(0);

    document.addEventListener('keydown', (e) => {
        // Only handle keyboard events if not typing in an input
        if (e.target.tagName === 'INPUT') return;
        
        switch(e.code) {
            case 'Space':
                e.preventDefault(); // Prevent page scroll
                if (audioPlayer.paused) {
                    playCurrentTrack();
                } else {
                    audioPlayer.pause();
                    document.getElementById("play-button").textContent = ">";
                    document.getElementById("album-cover").classList.remove("is-playing");
                }
                break;
            
            case 'ArrowLeft':
                e.preventDefault();
                if (currentTrackIndex > 0) {
                    loadTrack(currentTrackIndex - 1);
                    playCurrentTrack();
                }
                break;
            
            case 'ArrowRight':
                e.preventDefault();
                if (currentTrackIndex < tracks.length - 1) {
                    loadTrack(currentTrackIndex + 1);
                    playCurrentTrack();
                }
                break;
        }
    });
}

// Initialize the album on page load
window.onload = loadAlbum;

// Add these helper functions
function updatePlayButton() {
    document.getElementById("play-button").textContent = "||";
}

function updatePauseButton() {
    document.getElementById("play-button").textContent = ">";
}
