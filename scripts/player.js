// player.js - Handles player-specific functionality

let currentTrackIndex = 0;
let tracks = [];
let audioPlayer, audioSource, currentTrackTitle;

// Load and set the current track
function loadTrack(index) {
    // Show loading state
    const albumCover = document.getElementById('album-cover');
    albumCover.classList.add('loading');
    
    currentTrackIndex = index;
    const track = tracks[currentTrackIndex];
    
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

    audioSource.src = track.url;
    audioPlayer.load();
    
    // Remove loading state when audio is ready
    audioPlayer.addEventListener('canplay', () => {
        albumCover.classList.remove('loading');
    }, { once: true });  // Only listen once per load
}

// Play the current track
function playCurrentTrack() {
    audioPlayer.play();
    document.getElementById("play-button").textContent = "||";
    document.getElementById("album-cover").classList.add("is-playing");
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

        const trackEntries = Object.keys(manifest.paths).filter(path => path.startsWith("Tracks/"));
        const manifestTracks = trackEntries.map((path) => {
            const filename = path.split("/").pop();
            const trackNumber = parseInt(filename.match(/^\d+/)); // Extract the leading number
            return {
                title: filename.replace(/^\d+_?-_/g, "").replace(/\.[^/.]+$/, ""),
                url: `${gateway}/${manifest.paths[path].id}`,
                number: trackNumber || 0, // Fallback number
            };
        }).sort((a, b) => a.number - b.number);

        tracks = manifestTracks.map(manifestTrack => {
            const albumTrack = albumData.tracks?.find(t => t.number === manifestTrack.number);
            return {
                title: albumTrack?.title || manifestTrack.title,
                url: manifestTrack.url,
                number: manifestTrack.number,
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

    document.getElementById("play-button").onclick = () => {
        if (audioPlayer.paused) {
            playCurrentTrack();
        } else {
            audioPlayer.pause();
            document.getElementById("play-button").textContent = ">";
            document.getElementById("album-cover").classList.remove("is-playing");
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
