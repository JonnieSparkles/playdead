const canvas = document.getElementById("laser-visualizer");
const ctx = canvas.getContext("2d");
const toggleButton = document.getElementById("toggle-visualizer");
const audioElement = document.getElementById('audio-player');

let isVisualizerActive = false;
let currentModeIndex = -1; // Start with off (-1)
const modes = ["wave", "classic", "spotlights"];
let lasers = [];

// Timing-based animation parameters
let animationTime = 0;
const animationSpeed = 0.05;

// Intensity multiplier for all modes
const intensityMultiplier = 0.75;

// Add status indicator
const statusIndicator = document.createElement('div');
statusIndicator.style.display = 'none';  // Hide it instead of showing status
document.body.appendChild(statusIndicator);

// Enhanced tracking without Web Audio API
let lastIntensity = 0;
const smoothingFactor = 0.15;
let lastAudioTime = 0;
let intensityHistory = new Array(15).fill(0);
let lastDelta = 0;
let peakThreshold = 0.1;

// Remove unused frequency analysis code since we're not using Web Audio API
const getFrequencyData = () => {
    return { bass: 0, mids: 0, highs: 0 };
};

// Classic Laser Class with improved dynamics
class Laser {
    constructor(minSpeed, maxSpeed) {
        this.x1 = random(0, canvas.width);
        this.y1 = random(0, canvas.height);
        this.x2 = random(0, canvas.width);
        this.y2 = random(0, canvas.height);
        this.vx1 = random(-maxSpeed, maxSpeed);
        this.vy1 = random(-maxSpeed, maxSpeed);
        this.vx2 = random(-maxSpeed, maxSpeed);
        this.vy2 = random(-maxSpeed, maxSpeed);
        this.baseSpeed = random(minSpeed, maxSpeed);
        this.color = `hsl(${random(0, 360)}, 100%, 50%)`;
        this.baseWidth = random(1, 2);
        this.lineWidth = this.baseWidth;
        this.startColor = this.color;
        this.endColor = this.color;
        this.targetSpeedMultiplier = 1;
        this.currentSpeedMultiplier = 1;
        this.targetAlpha = 1;
        this.currentAlpha = 1;
    }

    update(intensity, intensityDelta) {
        const progressFactor = (audioElement.currentTime / audioElement.duration) || 0;
        const progressVariation = Math.sin(progressFactor * Math.PI * 2) * 0.3;
        
        // Smoothly transition speed multiplier
        this.targetSpeedMultiplier = audioElement.paused ? 
            0.3 : // Target slower movement when paused
            Math.min(1.2 + (intensity * intensityMultiplier * 2) + progressVariation, 2.5);
        
        // Lerp current speed to target
        this.currentSpeedMultiplier += (this.targetSpeedMultiplier - this.currentSpeedMultiplier) * 0.1;
        
        const isPeak = Math.abs(intensityDelta) > peakThreshold;
        
        if (isPeak && !audioElement.paused) {
            const burstMultiplier = 1.2;
            this.vx1 *= burstMultiplier;
            this.vy1 *= burstMultiplier;
            this.vx2 *= burstMultiplier;
            this.vy2 *= burstMultiplier;
        }

        const maxVelocity = 8;
        this.vx1 = Math.max(Math.min(this.vx1, maxVelocity), -maxVelocity);
        this.vy1 = Math.max(Math.min(this.vy1, maxVelocity), -maxVelocity);
        this.vx2 = Math.max(Math.min(this.vx2, maxVelocity), -maxVelocity);
        this.vy2 = Math.max(Math.min(this.vy2, maxVelocity), -maxVelocity);

        // Apply smoothed speed multiplier
        this.x1 += this.vx1 * this.currentSpeedMultiplier;
        this.y1 += this.vy1 * this.currentSpeedMultiplier;
        this.x2 += this.vx2 * this.currentSpeedMultiplier;
        this.y2 += this.vy2 * this.currentSpeedMultiplier;

        const margin = 50;
        
        if (this.x1 < -margin) { this.x1 = -margin; this.vx1 *= -0.8; }
        if (this.x1 > canvas.width + margin) { this.x1 = canvas.width + margin; this.vx1 *= -0.8; }
        if (this.y1 < -margin) { this.y1 = -margin; this.vy1 *= -0.8; }
        if (this.y1 > canvas.height + margin) { this.y1 = canvas.height + margin; this.vy1 *= -0.8; }
        
        if (this.x2 < -margin) { this.x2 = -margin; this.vx2 *= -0.8; }
        if (this.x2 > canvas.width + margin) { this.x2 = canvas.width + margin; this.vx2 *= -0.8; }
        if (this.y2 < -margin) { this.y2 = -margin; this.vy2 *= -0.8; }
        if (this.y2 > canvas.height + margin) { this.y2 = canvas.height + margin; this.vy2 *= -0.8; }

        const dampening = 0.99;
        this.vx1 *= dampening;
        this.vy1 *= dampening;
        this.vx2 *= dampening;
        this.vy2 *= dampening;

        // Smoothly transition alpha
        this.targetAlpha = audioElement.paused ? 0.6 : 1;
        this.currentAlpha += (this.targetAlpha - this.currentAlpha) * 0.1;

        // Update colors with smooth transitions
        const hue = (animationTime * 20) % 360;
        const saturation = 100;
        const lightness = audioElement.paused ?
            50 : // Fixed brightness when paused
            50 + (intensity * 30);
        
        this.startColor = `hsla(${hue}, ${saturation}%, ${lightness}%, ${this.currentAlpha})`;
        this.endColor = `hsla(${(hue + 30) % 360}, ${saturation}%, ${lightness}%, ${this.currentAlpha * 0.5})`;
    }

    draw() {
        ctx.beginPath();
        const gradient = ctx.createLinearGradient(this.x1, this.y1, this.x2, this.y2);
        gradient.addColorStop(0, this.startColor);
        gradient.addColorStop(1, this.endColor);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.lineWidth;
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();
    }
}

// Laser Modes
const laserModes = {
    wave: {
        init: () => ({
            waves: Array.from({ length: 5 }, (_, i) => ({
                radius: i * 50,
                opacity: 1 - (i * 0.2),
                speed: 3 + (i * 0.5),  // Increased base speed
                hue: (i * 60) % 360
            }))
        }),
        animate: (state) => {
            const intensity = getAudioIntensity();
            const isAudioPlaying = !audioElement.paused;
            
            ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const maxRadius = Math.max(canvas.width, canvas.height) * 0.8;
            
            state.waves.forEach(wave => {
                // Update radius
                wave.radius += wave.speed * (isAudioPlaying ? (1 + intensity) : 0.5);
                
                // Reset wave when it gets too large
                if (wave.radius > maxRadius) {
                    wave.radius = 0;
                    wave.hue = (wave.hue + 60) % 360;
                }
                
                // Draw wave
                ctx.beginPath();
                ctx.arc(centerX, centerY, wave.radius, 0, Math.PI * 2);
                
                const alpha = wave.opacity * (isAudioPlaying ? (0.5 + intensity * 0.5) : 0.3);
                const brightness = isAudioPlaying ? (50 + intensity * 30) : 50;
                
                ctx.strokeStyle = `hsla(${wave.hue}, 100%, ${brightness}%, ${alpha})`;
                ctx.lineWidth = isAudioPlaying ? (2 + intensity * 3) : 2;
                ctx.stroke();
            });
            
            animationTime += animationSpeed * (isAudioPlaying ? (1 + intensity) : 0.3);
        }
    },
    classic: {
        init: () => Array.from({ length: 15 }, () => new Laser(2, 4)),
        animate: (lasers, ctx, canvas, getAudioIntensity, audioElement, animationTime) => {
            const intensity = getAudioIntensity();
            const intensityDelta = intensity - lastIntensity;
            const isAudioPlaying = !audioElement.paused;

            // Smooth transition for fade effect
            const fadeAlpha = isAudioPlaying ? 0.15 : 0.05;
            ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            lasers.forEach(laser => {
                laser.update(intensity, intensityDelta);
                laser.draw();
            });

            lastIntensity = intensity;
            animationTime += animationSpeed * 0.3;
        }
    },
    spotlights: {
        init: () => ({
            spotlights: Array.from({ length: 5 }, () => ({
                x: Math.random() * window.innerWidth,
                y: 0, // Start from the top
                angle: Math.random() * Math.PI * 0.5 + Math.PI * 0.25,
                sweepSpeed: Math.random() * 0.02 + 0.01,
                sweepAngle: 0,
                sweepRange: Math.PI * 0.3,
                hue: Math.random() * 360,
                beamLength: Math.max(window.innerWidth, window.innerHeight),
                beamWidth: Math.random() * 50 + 30,
                pulsePhase: Math.random() * Math.PI * 2,
                currentAlpha: 0.3,
                currentWidth: 0
            }))
        }),
        animate: (state, ctx, canvas, getAudioIntensity, audioElement, animationTime) => {
            const intensity = getAudioIntensity();
            const isAudioPlaying = !audioElement.paused;
            const transitionSpeed = 0.05;

            ctx.fillStyle = `rgba(0, 0, 0, ${isAudioPlaying ? 0.15 : 0.08})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            state.spotlights.forEach((spotlight, index) => {
                spotlight.sweepSpeed += ((isAudioPlaying ? (0.01 + intensity * 0.03) : 0.01) - spotlight.sweepSpeed) * transitionSpeed;
                spotlight.sweepAngle += spotlight.sweepSpeed;

                const targetAlpha = isAudioPlaying ? (0.3 + intensity * 0.7) : 0.2;
                spotlight.currentAlpha += (targetAlpha - spotlight.currentAlpha) * transitionSpeed;

                const currentAngle = spotlight.angle + Math.sin(spotlight.sweepAngle) * spotlight.sweepRange * (isAudioPlaying ? (1 + intensity) : 0.5);

                const endX = spotlight.x + Math.cos(currentAngle) * spotlight.beamLength;
                const endY = spotlight.y + Math.sin(currentAngle) * spotlight.beamLength;

                const gradient = ctx.createLinearGradient(spotlight.x, spotlight.y, endX, endY);
                gradient.addColorStop(0, `hsla(${spotlight.hue}, 100%, 50%, ${spotlight.currentAlpha})`);
                gradient.addColorStop(1, `hsla(${spotlight.hue}, 100%, 50%, 0)`);

                spotlight.pulsePhase += isAudioPlaying ? (0.1 + intensity * 0.1) : 0.05;
                const pulseAmount = Math.sin(spotlight.pulsePhase) * 0.5 + 0.5;
                const targetWidth = spotlight.beamWidth * (1 + (isAudioPlaying ? (pulseAmount * intensity) : pulseAmount * 0.2));
                spotlight.currentWidth += (targetWidth - spotlight.currentWidth) * transitionSpeed;

                ctx.beginPath();
                ctx.moveTo(spotlight.x, spotlight.y);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = gradient;
                ctx.lineWidth = spotlight.currentWidth;
                ctx.lineCap = 'round';
                ctx.stroke();

                const glowSize = isAudioPlaying ? (5 + intensity * 5) : 5;
                const glowAlpha = isAudioPlaying ? (0.5 + intensity * 0.5) : 0.3;

                ctx.beginPath();
                ctx.arc(spotlight.x, spotlight.y, glowSize * 2, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${spotlight.hue}, 100%, 50%, ${glowAlpha * 0.3})`;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(spotlight.x, spotlight.y, glowSize, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${spotlight.hue}, 100%, 50%, ${glowAlpha})`;
                ctx.fill();

                if (isAudioPlaying && intensity > 0.7 && Math.random() > 0.92) {
                    spotlight.hue = (spotlight.hue + Math.random() * 60) % 360;
                }

                const moveSpeed = isAudioPlaying ? (2 + intensity * 3) : 1;
                spotlight.x += Math.sin(animationTime * 0.5 + index) * moveSpeed;
                if (spotlight.x < 0) spotlight.x = canvas.width;
                if (spotlight.x > canvas.width) spotlight.x = 0;
            });

            return animationTime + (isAudioPlaying ? 0.015 : 0.01);
        }
    }
};

// Animation Loop
function animate() {
    if (!isVisualizerActive) return;
    
    const currentMode = modes[currentModeIndex].toLowerCase();
    laserModes[currentMode].animate(lasers, ctx, canvas, getAudioIntensity, audioElement, animationTime);
    requestAnimationFrame(animate);
}

// Update toggle function with debug logs
function toggleMode() {
    currentModeIndex = (currentModeIndex + 1) % (modes.length + 1);
    console.log(`Switching to mode index: ${currentModeIndex}`); // Debug log
    
    animationTime = 0;
    
    if (currentModeIndex === modes.length) {
        console.log("Turning off visualizer"); // Debug log
        isVisualizerActive = false;
        canvas.style.display = "none";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    isVisualizerActive = true;
    resizeCanvas();
    const currentMode = modes[currentModeIndex].toLowerCase();
    console.log(`Initializing ${currentMode} mode`); // Debug log
    lasers = laserModes[currentMode].init();
    canvas.style.display = "block";
    animate();
}

toggleButton.addEventListener("click", toggleMode);

// Resize Canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
}

// Helper Function
function random(min, max) {
    return Math.random() * (max - min) + min;
}

// Clean up getAudioIntensity function - remove unused frequency components
function getAudioIntensity() {
    if (!audioElement.paused) {
        const timeGap = Math.abs(audioElement.currentTime - lastAudioTime) > 0.1;
        lastAudioTime = audioElement.currentTime;
        
        if (timeGap) {
            return lastIntensity;
        }
        
        // Simplified time components
        const bassTime = (audioElement.currentTime % 0.2) * Math.PI * 10;
        const midTime = (audioElement.currentTime % 0.1) * Math.PI * 20;
        
        // Combine different frequencies
        const bassComponent = Math.abs(Math.sin(bassTime)) * 0.6;
        const midComponent = Math.abs(Math.sin(midTime)) * 0.4;
        
        const rawIntensity = (bassComponent + midComponent) * intensityMultiplier;
        
        intensityHistory.shift();
        intensityHistory.push(rawIntensity);
        
        const localAverage = intensityHistory.slice(0, -1).reduce((a, b) => a + b) / (intensityHistory.length - 1);
        const variance = Math.abs(rawIntensity - localAverage);
        
        const peakEnhanced = variance > 0.1 ? 
            rawIntensity * 2.5 : 
            rawIntensity * 0.8;
        
        const smoothedIntensity = lastIntensity * (1 - smoothingFactor) + peakEnhanced * smoothingFactor;
        
        // Simplified status display
        if (statusIndicator.style.display !== 'none') {
            statusIndicator.textContent = `🎵 Intensity: ${Math.round(smoothedIntensity * 100)}%`;
            statusIndicator.style.backgroundColor = smoothedIntensity > 0.7 ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 255, 0, 0.3)';
        }
        
        return Math.max(0, Math.min(1, smoothedIntensity));
    }
    
    return (Math.sin(animationTime) * 0.3 + 0.5) * intensityMultiplier;
}

// Initial resize
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Separate mode logic into individual functions or files
function initClassicMode(canvas) {
    return Array.from({ length: 15 }, () => new Laser(canvas, 2, 4));
}

function animateClassicMode(lasers, ctx, canvas, getAudioIntensity, audioElement, animationTime) {
    const intensity = getAudioIntensity();
    const intensityDelta = intensity - lastIntensity;
    const isAudioPlaying = !audioElement.paused;

    ctx.fillStyle = `rgba(0, 0, 0, ${isAudioPlaying ? 0.15 : 0.05})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    lasers.forEach(laser => {
        const transitionedDelta = isAudioPlaying ? intensityDelta : intensityDelta * 0.3;
        laser.update(intensity, transitionedDelta, audioElement, animationTime);
        laser.draw(ctx);
    });

    lastIntensity = intensity;
    return animationTime + (isAudioPlaying ? 0.015 : 0.008);
}

// Example of a more modular approach for lights mode
function initLightsMode() {
    return {
        lights: Array.from({ length: 8 }, () => ({
            x: Math.random() * window.innerWidth,
            y: -20,
            angle: Math.random() * Math.PI * 0.5 + Math.PI * 0.25,
            sweepSpeed: Math.random() * 0.02 + 0.01,
            sweepAngle: 0,
            sweepRange: Math.PI * 0.4,
            hue: Math.random() * 360,
            beamLength: Math.max(window.innerWidth, window.innerHeight) * 1.5,
            beamWidth: Math.random() * 40 + 20,
            pulsePhase: Math.random() * Math.PI * 2,
            currentAlpha: 0.3,
            currentWidth: 0
        }))
    };
}

function animateLightsMode(state, ctx, canvas, getAudioIntensity, audioElement, animationTime) {
    const intensity = getAudioIntensity();
    const isAudioPlaying = !audioElement.paused;
    const transitionSpeed = 0.05;

    ctx.fillStyle = `rgba(0, 0, 0, ${isAudioPlaying ? 0.15 : 0.08})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    state.lights.forEach((light, index) => {
        light.sweepSpeed += ((isAudioPlaying ? (0.01 + intensity * 0.03) : 0.01) - light.sweepSpeed) * transitionSpeed;
        light.sweepAngle += light.sweepSpeed;

        const targetAlpha = isAudioPlaying ? (0.3 + intensity * 0.7) : 0.2;
        light.currentAlpha += (targetAlpha - light.currentAlpha) * transitionSpeed;

        const currentAngle = light.angle + Math.sin(light.sweepAngle) * light.sweepRange * (isAudioPlaying ? (1 + intensity) : 0.5);

        const endX = light.x + Math.cos(currentAngle) * light.beamLength;
        const endY = light.y + Math.sin(currentAngle) * light.beamLength;

        const gradient = ctx.createLinearGradient(light.x, light.y, endX, endY);
        gradient.addColorStop(0, `hsla(${light.hue}, 100%, 50%, ${light.currentAlpha})`);
        gradient.addColorStop(1, `hsla(${light.hue}, 100%, 50%, 0)`);

        light.pulsePhase += isAudioPlaying ? (0.1 + intensity * 0.1) : 0.05;
        const pulseAmount = Math.sin(light.pulsePhase) * 0.5 + 0.5;
        const targetWidth = light.beamWidth * (1 + (isAudioPlaying ? (pulseAmount * intensity) : pulseAmount * 0.2));
        light.currentWidth += (targetWidth - light.currentWidth) * transitionSpeed;

        ctx.beginPath();
        ctx.moveTo(light.x, light.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = light.currentWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        const glowSize = isAudioPlaying ? (5 + intensity * 5) : 5;
        const glowAlpha = isAudioPlaying ? (0.5 + intensity * 0.5) : 0.3;

        ctx.beginPath();
        ctx.arc(light.x, light.y, glowSize * 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${light.hue}, 100%, 50%, ${glowAlpha * 0.3})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(light.x, light.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${light.hue}, 100%, 50%, ${glowAlpha})`;
        ctx.fill();

        if (isAudioPlaying && intensity > 0.7 && Math.random() > 0.92) {
            light.hue = (light.hue + Math.random() * 60) % 360;
        }

        const moveSpeed = isAudioPlaying ? (2 + intensity * 3) : 1;
        light.x += Math.sin(animationTime * 0.5 + index) * moveSpeed;
        if (light.x < 0) light.x = canvas.width;
        if (light.x > canvas.width) light.x = 0;
    });

    return animationTime + (isAudioPlaying ? 0.015 : 0.01);
}