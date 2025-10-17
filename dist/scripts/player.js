// player.js - Handles player-specific functionality

let currentTrackIndex = 0;
let tracks = [];
let audioPlayer, audioSource, currentTrackTitle;
let originalTitle = document.title;

// Load and set the current media
function loadTrack(index) {
    currentTrackIndex = index;
    const track = tracks[currentTrackIndex];
    
    // Update browser tab title
    const albumBand = document.getElementById("album-band").textContent;
    const trackTitle = track.title;
    document.title = `${albumBand} - ${trackTitle}`;
    
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
        const albumJsonUrl = `${gateway}/${albumTxid}`;
        const albumResponse = await fetch(albumJsonUrl);
        const albumData = await albumResponse.json();

        // Set album cover
        const albumCover = document.getElementById("album-cover");
        albumCover.style.animation = 'none';  // Reset animation
        albumCover.offsetHeight;  // Trigger reflow
        albumCover.style.animation = null;  // Re-enable animation
        albumCover.src = albumData.cover
            ? `${gateway}/${albumData.cover}`
            : "./assets/default-cover.png";

        // Set album metadata
        document.getElementById("album-band").textContent = albumData.band || "Unknown Band";
        document.getElementById("album-title").textContent = albumData.title || "Untitled Album";
        document.getElementById("date-value").textContent = albumData.date || "Unknown Date";
        document.getElementById("source-value").textContent = albumData.source || "Unknown Source";

        // Handle info button
        if (albumData.info) {
            const infoButton = document.getElementById("info-button");
            infoButton.style.display = "inline-block";
            infoButton.onclick = () => window.open(`${gateway}/${albumData.info}`, "_blank");
        }

        // Set up tracks/reels based on album type
        const mediaList = albumData.type === 'video' ? albumData.reels : albumData.tracks;
        tracks = mediaList.map(item => ({
            title: item.title,
            url: `${gateway}/${item.id}`,
            number: item.number,
            type: albumData.type || 'audio' // Use album type or default to audio
        }));

        // Populate tracklist
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
        setupAlbumCoverModal();
        
        // Hide Farcaster splash screen after album is loaded
        if (window.farcasterSDK && window.farcasterSDK.isAvailable()) {
            setTimeout(async () => {
                await window.farcasterSDK.hideSplash();
            }, 100);
        }
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

    // Add event listener to restore title when playback ends
    audioPlayer.addEventListener('ended', () => {
        if (currentTrackIndex === tracks.length - 1) {
            // Restore original title at end of playlist
            document.title = originalTitle;
        }
    });

    // Add event listener to update title on pause
    audioPlayer.addEventListener('pause', () => {
        document.title = originalTitle;
    });

    audioPlayer.addEventListener('play', () => {
        const track = tracks[currentTrackIndex];
        const albumBand = document.getElementById("album-band").textContent;
        document.title = `${albumBand} - ${track.title}`;
    });
}

// Initialize the album on page load
window.onload = async function() {
    loadAlbum();
    
    // Hide Farcaster splash screen after app is fully loaded
    if (window.farcasterSDK && window.farcasterSDK.isAvailable()) {
        // Small delay to ensure everything is rendered
        setTimeout(async () => {
            await window.farcasterSDK.hideSplash();
        }, 500);
    }
};

// Add these helper functions
function updatePlayButton() {
    document.getElementById("play-button").textContent = "||";
}

function updatePauseButton() {
    document.getElementById("play-button").textContent = ">";
}

// Add near the top with other initialization code
function setupAlbumCoverModal() {
    const albumCover = document.getElementById('album-cover');
    
    // Create modal elements if they don't exist
    if (!document.getElementById('cover-modal')) {
        const modal = document.createElement('div');
        modal.id = 'cover-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <img id="modal-cover-image" src="" alt="Full size album cover">
            </div>
        `;
        
        // Add click handlers
        modal.querySelector('.close-modal').onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };
        
        document.body.appendChild(modal);
    }
    
    // Add click handler to album cover
    albumCover.onclick = () => {
        const modal = document.getElementById('cover-modal');
        const modalImg = document.getElementById('modal-cover-image');
        modalImg.src = albumCover.src;
        modal.style.display = 'block';
    };
}
