// utils.js - Contains utility functions for the app

// Add at the top of utils.js
window.DEV_MODE = window.location.hash === '#dev';
window.DEV_SIMULATING = false;

// Add dev mode UI if enabled
if (window.DEV_MODE) {
    window.addEventListener('DOMContentLoaded', () => {
        const devControls = document.createElement('div');
        devControls.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 5px;
        `;
        
        const simulateButton = document.createElement('button');
        simulateButton.textContent = '▶️ Simulate';
        simulateButton.style.cssText = `
            background: #444;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
        `;
        
        let isSimulatingPlay = false;
        let simulationStartTime;
        
        // Add simulation timer
        window.getSimulatedIntensity = () => {
            if (!isSimulatingPlay) return 0;
            const time = (Date.now() - simulationStartTime) / 1000;
            // Create a complex wave pattern
            return (
                0.5 + // base intensity
                Math.sin(time * 1.5) * 0.3 + // main wave
                Math.sin(time * 0.5) * 0.2 + // slow variation
                Math.sin(time * 3.0) * 0.1   // fast variation
            ) * 0.8; // scale to reasonable range
        };

        simulateButton.onclick = () => {
            isSimulatingPlay = !isSimulatingPlay;
            simulateButton.textContent = isSimulatingPlay ? '⏸️ Pause' : '▶️ Simulate';
            
            if (isSimulatingPlay) {
                simulationStartTime = Date.now();
            }
            
            // Create a fake media element if none exists
            if (!document.getElementById('audio-player')) {
                window.mediaElement = {
                    paused: true,
                    currentTime: 0,
                    duration: 300,
                    addEventListener: () => {},
                    removeEventListener: () => {}
                };
            } else {
                window.mediaElement = document.getElementById('audio-player');
            }
            
            // Toggle simulated playback and dispatch event
            window.mediaElement.paused = !isSimulatingPlay;
            window.dispatchEvent(new CustomEvent('simulatedPlaybackChange', {
                detail: { isPlaying: isSimulatingPlay }
            }));
        };
        
        devControls.appendChild(simulateButton);
        document.body.appendChild(devControls);
        
        console.log('🛠️ Dev mode enabled');
    });
}

// Detects the gateway domain dynamically
function detectGatewayDomain() {
    const hostname = window.location.hostname;

    // Split the hostname into parts
    const parts = hostname.split(".");

    // Determine gateway domain (everything after the first dot)
    let gateway = parts.length > 1
        ? `${window.location.protocol}//${parts.slice(1).join(".")}`
        : window.location.origin;

    // Exception: If gateway is "ar.io", default to "arweave.net"
    if (gateway.includes("ar.io")) {
        gateway = "https://arweave.net";
    }

    return gateway;
}

// Device detection utility
function isMobileDevice() {
    // Check if device has touch AND small screen
    const hasTouchAndSmallScreen = (
        ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
        window.innerWidth <= 768
    );
    
    // Check for common mobile user agents
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
    
    return hasTouchAndSmallScreen || isMobileUA;
}
