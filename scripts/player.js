async function loadAlbumList() {
    const catalogUrl = "catalog.json";
    
    try {
        const response = await fetch(catalogUrl);
        if (!response.ok) throw new Error(`Failed to fetch catalog.json`);
        
        const albums = await response.json();
        const albumList = document.getElementById("album-list");
        albumList.innerHTML = ""; // Clear loading message
        
        // Load each album's manifest to get cover and metadata
        for (const album of albums) {
            try {
                const manifestUrl = `https://arweave.net/${album.id}`;
                const manifestResponse = await fetch(manifestUrl);
                const manifestData = await manifestResponse.json();
                
                const cassette = document.createElement("a");
                cassette.href = `#album=${album.id}`;
                cassette.className = "cassette";
                
                // Create cassette structure
                cassette.innerHTML = `
                    <div class="cassette-body ${manifestData.type === 'video' ? 'video-cassette' : 'audio-cassette'}">
                        <div class="cassette-window">
                            <img src="https://arweave.net/${manifestData.cover}" alt="${manifestData.band} - ${manifestData.title}">
                            ${manifestData.type === 'video' ? 
                                '<div class="media-icon video-icon">🎥</div>' : 
                                '<div class="media-icon audio-icon">🎵</div>'
                            }
                        </div>
                        <div class="cassette-label">
                            <div class="cassette-band">${manifestData.band}</div>
                            <div class="cassette-title">${manifestData.title}</div>
                            <div class="cassette-date">${manifestData.date}</div>
                        </div>
                        <div class="cassette-reels"></div>
                    </div>
                `;
                
                albumList.appendChild(cassette);

                // Modal player logic
                cassette.addEventListener('click', function(e) {
                    e.preventDefault();
                    openPlayerModal(album.id);
                });
            } catch (error) {
                console.error(`Error loading album ${album.id}:`, error);
            }
        }
    } catch (error) {
        console.error("Error loading catalog:", error.message);
    }
}

// Modal player functions
let modalTracks = [];
let modalCurrentTrackIndex = 0;
let modalAudioPlayer, modalAudioSource, modalCurrentTrackTitle;
let modalOriginalTitle = document.title;

async function openPlayerModal(albumId) {
    window.location.hash = `album=${albumId}`;
    document.body.classList.add('modal-open');
    const modal = document.getElementById('player-modal');
    modal.style.opacity = '0';
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.style.opacity = '1');
    const modalContent = document.querySelector('.player-modal-content');
    const modalInner = document.getElementById('player-modal-inner');
    modalInner.innerHTML = '<div style="text-align:center;padding:2em;">Loading...</div>';
    // Fetch album manifest
    try {
        const manifestUrl = `https://arweave.net/${albumId}`;
        const manifestResponse = await fetch(manifestUrl);
        const albumData = await manifestResponse.json();
        // Prepare tracks
        const mediaList = albumData.type === 'video' ? albumData.reels : albumData.tracks;
        modalTracks = mediaList.map(item => ({
            title: item.title,
            url: `https://arweave.net/${item.id}`,
            number: item.number,
            type: albumData.type || 'audio'
        }));
        modalCurrentTrackIndex = 0;
        // Render player UI
        if (albumData.type === 'video') {
            modalContent.classList.add('video-mode');
            modalInner.classList.add('video-mode');
            modalInner.innerHTML = `
                <div class="modal-video-container">
                    <video id="modal-video-player" controls style="width:100%; max-height:50vh; background:black;" poster="https://arweave.net/${albumData.cover}"></video>
                    <div class="album-info">
                        <h1 id="modal-album-band">${albumData.band}</h1>
                        <h2 id="modal-album-title">${albumData.title}</h2>
                        <p id="modal-date-value">${albumData.date || ''}</p>
                        <p><strong>Source:</strong> <span id="modal-source-value">${albumData.source || ''}</span></p>
                    </div>
                    <div class="modal-current-track-title" id="modal-current-track-title">Select a Reel</div>
                    <div class="controls">
                        <button id="modal-prev-button">&lt;&lt;</button>
                        <button id="modal-play-button">&gt;</button>
                        <button id="modal-next-button">&gt;&gt;</button>
                        <button id="modal-eject-button">⏏</button>
                        <button id="modal-info-button">i</button>
                    </div>
                    <div class="tracklist" style="overflow-y:auto; flex-grow:1; margin-top:1em;">
                        <table style="width:100%">
                            <thead><tr><th style="width:2.5em;">#</th><th style="width:auto;">Title</th></tr></thead>
                            <tbody id="modal-tracklist-body"></tbody>
                        </table>
                    </div>
                </div>
            `;
            setupModalVideoPlayer();
        } else {
            modalContent.classList.remove('video-mode');
            modalInner.classList.remove('video-mode');
            modalInner.innerHTML = `
                <div class="modal-cassette-left">
                    <div class="modal-album-top">
                        <div class="cassette-window"><img id="modal-album-cover" src="https://arweave.net/${albumData.cover}" alt="${albumData.band} - ${albumData.title}"></div>
                        <div class="album-info">
                            <h1 class="band" id="modal-album-band">${albumData.band}</h1>
                            <h2 class="title" id="modal-album-title">${albumData.title}</h2>
                            <p class="date" id="modal-date-value">${albumData.date || ''}</p>
                            <p class="source"><strong>Source:</strong> <span id="modal-source-value">${albumData.source || ''}</span></p>
                        </div>
                    </div>
                    <div class="modal-album-bottom">
                        <div class="modal-current-track-title" id="modal-current-track-title">Select a Track</div>
                        <div class="media-player">
                            <audio id="modal-audio-player" controls style="width: 100%; max-width: 440px;">
                                <source id="modal-audio-source" src="" type="audio/mpeg">
                            </audio>
                        </div>
                        <div class="controls">
                            <button id="modal-prev-button" title="Back">&lt;&lt;</button>
                            <button id="modal-play-button" title="Play/Pause">&gt;</button>
                            <button id="modal-next-button" title="Forward">&gt;&gt;</button>
                            <button id="modal-eject-button" title="Eject">⏏</button>
                            <button id="modal-info-button" title="Album Info">i</button>
                        </div>
                    </div>
                </div>
                <div class="modal-cassette-right">
                    <button id="collapse-tracklist-btn" title="Collapse tracklist" class="collapse-tracklist-btn">«</button>
                    <div class="tracklist" style="margin-top:0;">
                        <table style="width:100%">
                            <thead><tr><th style="width:2.5em;">#</th><th style="width:auto;">Title</th></tr></thead>
                            <tbody id="modal-tracklist-body"></tbody>
                        </table>
                    </div>
                </div>
            `;
            // Wire up player logic
            setupModalPlayer();
        }
        if (albumData.info) {
            document.getElementById("modal-info-button").style.display = "inline-block";
            document.getElementById("modal-info-button").onclick = () => window.open(`https://arweave.net/${albumData.info}`, "_blank");
        } else {
            document.getElementById("modal-info-button").style.display = "none";
        }
    } catch (error) {
        modalInner.innerHTML = '<div style="color:#ff4500;">Failed to load album.</div>';
    }
    // Add modal for fullscreen cover if not present
    if (!document.getElementById('modal-cover-modal')) {
        const coverModal = document.createElement('div');
        coverModal.id = 'modal-cover-modal';
        coverModal.className = 'modal';
        coverModal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <img id="modal-cover-image" src="" alt="Full size album cover">
            </div>
        `;
        coverModal.querySelector('.close-modal').onclick = () => coverModal.style.display = 'none';
        coverModal.onclick = (e) => { if (e.target === coverModal) coverModal.style.display = 'none'; };
        document.body.appendChild(coverModal);
    }
    // Add click handler to album cover
    const modalAlbumCover = document.getElementById('modal-album-cover');
    if (modalAlbumCover) {
        modalAlbumCover.onclick = () => {
            const coverModal = document.getElementById('modal-cover-modal');
            const modalImg = document.getElementById('modal-cover-image');
            modalImg.src = modalAlbumCover.src;
            coverModal.style.display = 'block';
        };
    }
    const cassetteRight = document.querySelector('.modal-cassette-right');
    const collapseBtn = document.getElementById('collapse-tracklist-btn');
    if (cassetteRight && collapseBtn && modalContent) {
        collapseBtn.onclick = function() {
            const isCollapsed = cassetteRight.classList.toggle('collapsed');
            if (isCollapsed) {
                modalContent.classList.add('centered-when-collapsed');
                collapseBtn.textContent = '»';
                collapseBtn.title = 'Expand tracklist';
            } else {
                modalContent.classList.remove('centered-when-collapsed');
                collapseBtn.textContent = '«';
                collapseBtn.title = 'Collapse tracklist';
            }
        };
    }
}

function setupModalPlayer() {
    modalAudioPlayer = document.getElementById("modal-audio-player");
    modalAudioSource = document.getElementById("modal-audio-source");
    modalCurrentTrackTitle = document.getElementById("modal-current-track-title");
        // Populate tracklist
    const tracklistBody = document.getElementById("modal-tracklist-body");
        tracklistBody.innerHTML = "";
    modalTracks.forEach((track, index) => {
            const row = document.createElement("tr");
            row.className = "track";
            row.innerHTML = `<td>${track.number}</td><td>${track.title}</td>`;
            row.onclick = () => {
            loadModalTrack(index);
            playModalCurrentTrack();
            };
            tracklistBody.appendChild(row);
    });
    // Controls
    document.getElementById("modal-play-button").onclick = () => {
        if (modalAudioPlayer.paused) {
            triggerCoverPop();
            playModalCurrentTrack();
        } else {
            modalAudioPlayer.pause();
            const playButton = document.getElementById("modal-play-button");
            if (playButton) playButton.textContent = ">";
        }
    };
    document.getElementById("modal-prev-button").onclick = () => {
        if (modalAudioPlayer.currentTime > 2) {
            modalAudioPlayer.currentTime = 0;
        } else if (modalCurrentTrackIndex > 0) {
            const wasPaused = modalAudioPlayer.paused;
            triggerCoverPop();
            loadModalTrack(--modalCurrentTrackIndex);
            if (!wasPaused) playModalCurrentTrack();
        }
    };
    document.getElementById("modal-next-button").onclick = () => {
        if (modalCurrentTrackIndex < modalTracks.length - 1) {
            const wasPaused = modalAudioPlayer.paused;
            triggerCoverPop();
            loadModalTrack(++modalCurrentTrackIndex);
            if (!wasPaused) playModalCurrentTrack();
        }
    };
    document.getElementById("modal-eject-button").onclick = closePlayerModal;
    // Audio event listeners for animation and UI
    modalAudioPlayer.addEventListener('play', () => {
        // update play button and add glow
        const playButton = document.getElementById("modal-play-button");
        if (playButton) playButton.textContent = "||";
        const cover = document.getElementById("modal-album-cover");
        if (cover) {
            // Force remove any existing inline styles that might interfere
            cover.style.animation = '';
            cover.style.background = '';
            cover.style.backgroundSize = '';
            cover.style.boxShadow = '';
            cover.style.transform = '';
            // Add the playing class
            cover.classList.add("is-playing");
        }
    });
    modalAudioPlayer.addEventListener('pause', () => {
        // update pause button and remove glow
        const playButton = document.getElementById("modal-play-button");
        if (playButton) playButton.textContent = ">";
        const cover = document.getElementById("modal-album-cover");
        if (cover) {
            // Remove the playing class
            cover.classList.remove("is-playing");
            // Reset any inline styles
            cover.style.animation = '';
            cover.style.background = '';
            cover.style.backgroundSize = '';
            cover.style.boxShadow = '';
            cover.style.transform = '';
        }
    });
    // Auto-advance to next track when one finishes
    modalAudioPlayer.addEventListener('ended', () => {
        if (modalCurrentTrackIndex < modalTracks.length - 1) {
            triggerCoverPop();
            loadModalTrack(++modalCurrentTrackIndex);
            playModalCurrentTrack();
        }
    });
    // Load first track
    loadModalTrack(0);
}

function loadModalTrack(index) {
    modalCurrentTrackIndex = index;
    const track = modalTracks[modalCurrentTrackIndex];
    // Remove active class from all rows
    document.querySelectorAll('#modal-tracklist-body tr').forEach(row => {
        row.classList.remove('active');
    });
    // Add active class to current track row
    document.querySelector(`#modal-tracklist-body tr:nth-child(${index + 1})`).classList.add('active');
    modalCurrentTrackTitle.textContent = track.title;
    modalAudioSource.src = track.url;
    if (!modalAudioSource.parentNode) {
        modalAudioPlayer.appendChild(modalAudioSource);
    }
    modalAudioPlayer.load();
}

function playModalCurrentTrack() {
    // Just start playback, let event listeners handle UI
    modalAudioPlayer.play().catch(() => {});
}

function closePlayerModal() {
    const modal = document.getElementById('player-modal');
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('player-modal-inner').innerHTML = '';
        window.location.hash = '';
        document.body.classList.remove('modal-open');
    }, 300);
}

document.getElementById('close-player-modal').onclick = closePlayerModal;

// Deep link support
window.addEventListener('hashchange', function() {
    const hash = window.location.hash;
    if (hash.startsWith('#album=')) {
        const albumId = hash.replace('#album=', '');
        openPlayerModal(albumId);
    } else {
        closePlayerModal();
    }
});
// On page load, check hash
window.onload = function() {
    loadAlbumList();
    const hash = window.location.hash;
    if (hash.startsWith('#album=')) {
        const albumId = hash.replace('#album=', '');
        openPlayerModal(albumId);
    }
};

// Add a completely new function for triggering the pop animation
function triggerCoverPop() {
    const cover = document.getElementById("modal-album-cover");
    if (!cover) return;
    
    // Make sure we don't affect the continuous is-playing animation
    // Get the current is-playing state so we can preserve it
    const isCurrentlyPlaying = cover.classList.contains("is-playing");
    
    // Create a clone of the cover for the pop animation
    // This prevents the animation from interfering with the is-playing styles
    const tempCover = cover.cloneNode(false);
    tempCover.style.position = 'absolute';
    tempCover.style.top = `${cover.offsetTop}px`;
    tempCover.style.left = `${cover.offsetLeft}px`;
    tempCover.style.width = `${cover.offsetWidth}px`;
    tempCover.style.height = `${cover.offsetHeight}px`;
    tempCover.style.zIndex = '5000';
    tempCover.style.pointerEvents = 'none';
    tempCover.id = 'temp-pop-cover';
    tempCover.src = cover.src;
    cover.parentNode.appendChild(tempCover);
    
    // Animate the clone instead of the original element
    const animation = tempCover.animate([
        { // start state
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(255,69,0,0)'
        },
        { // mid state (40%)
            transform: 'scale(1.06)', 
            boxShadow: '0 0 15px 3px rgba(255,69,0,0.5)',
            offset: 0.4
        },
        { // bounce back (80%)
            transform: 'scale(0.98)',
            offset: 0.8
        },
        { // end state
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(255,69,0,0)'
        }
    ], {
        duration: 350,
        easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        fill: 'forwards'
    });
    
    // Remove the clone after the animation
    animation.onfinish = () => {
        if (tempCover.parentNode) {
            tempCover.parentNode.removeChild(tempCover);
        }
    };
}

// New functions for video album playback
function setupModalVideoPlayer() {
    const modalVideoPlayer = document.getElementById("modal-video-player");
    modalCurrentTrackTitle = document.getElementById("modal-current-track-title");
    // Populate tracklist
    const tracklistBody = document.getElementById("modal-tracklist-body");
    tracklistBody.innerHTML = "";
    modalTracks.forEach((track, index) => {
        const row = document.createElement("tr");
        row.className = "track";
        row.innerHTML = `<td>${track.number}</td><td>${track.title}</td>`;
        row.onclick = () => {
            loadVideoTrack(index);
            playVideoTrack();
        };
        tracklistBody.appendChild(row);
    });
    // Controls
    document.getElementById("modal-play-button").onclick = () => {
        if (modalVideoPlayer.paused) {
            modalVideoPlayer.play();
            document.getElementById("modal-play-button").textContent = "||";
        } else {
            modalVideoPlayer.pause();
            document.getElementById("modal-play-button").textContent = ">";
        }
    };
    document.getElementById("modal-prev-button").onclick = () => {
        if (modalVideoPlayer.currentTime > 2) modalVideoPlayer.currentTime = 0;
        else if (modalCurrentTrackIndex > 0) {
            loadVideoTrack(--modalCurrentTrackIndex);
            playVideoTrack();
        }
    };
    document.getElementById("modal-next-button").onclick = () => {
        if (modalCurrentTrackIndex < modalTracks.length - 1) {
            loadVideoTrack(++modalCurrentTrackIndex);
            playVideoTrack();
        }
    };
    document.getElementById("modal-eject-button").onclick = closePlayerModal;
    // Video event listeners
    modalVideoPlayer.addEventListener('play', () => document.getElementById("modal-play-button").textContent = "||");
    modalVideoPlayer.addEventListener('pause', () => document.getElementById("modal-play-button").textContent = ">");
    modalVideoPlayer.addEventListener('ended', () => {
        if (modalCurrentTrackIndex < modalTracks.length - 1) {
            loadVideoTrack(++modalCurrentTrackIndex);
            playVideoTrack();
        }
    });
    // Load first video
    loadVideoTrack(0);
}

function loadVideoTrack(index) {
    modalCurrentTrackIndex = index;
    const track = modalTracks[modalCurrentTrackIndex];
    document.querySelectorAll('#modal-tracklist-body tr').forEach(row => row.classList.remove('active'));
    document.querySelector(`#modal-tracklist-body tr:nth-child(${index + 1})`).classList.add('active');
    modalCurrentTrackTitle.textContent = track.title;
    const player = document.getElementById('modal-video-player');
    player.src = track.url;
    player.load();
}

function playVideoTrack() {
    const player = document.getElementById('modal-video-player');
    player.play().catch(() => {});
}
