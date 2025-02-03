/**
 * Laser Show Visualizer
 * Provides dynamic visual effects synchronized with audio playback.
 * Supports multiple visualization modes and responds to audio intensity.
 */
const modes = ["ripple", "classic", "spotlights"];
const canvas = document.getElementById("laser-visualizer");
const ctx = canvas.getContext("2d");
const toggleButton = document.getElementById("toggle-visualizer");
let mediaElement = document.getElementById('audio-player') || document.getElementById('video-player') || {
    // Provide default properties/methods if no media element exists
    paused: true,
    currentTime: 0,
    duration: 0
};

let isVisualizerActive = false;
let currentModeIndex = -1; // Start with visualizer off
let lasers = [];

// Timing-based animation parameters
let animationTime = 0;
const animationSpeed = 0.05;

// Intensity multiplier for all modes
const intensityMultiplier = 0.75;

// Enhanced tracking without Web Audio API
let lastIntensity = 0;
const smoothingFactor = 0.15;
let lastAudioTime = 0;
let intensityHistory = new Array(15).fill(0);

// Core configuration constants
const DEV_MODE = window.location.hash === '#dev';
let DEV_SIMULATING = false;

// Magic numbers for the visualizer
const INTENSITY_HISTORY_SIZE = 15;
const SMOOTHING_FACTOR = 0.15;
const ANIMATION_SPEED = 0.05;
const BASE_INTENSITY_MULTIPLIER = 0.75;
const TIME_GAP_THRESHOLD = 0.1;

console.log('Initial state:', { DEV_MODE, DEV_SIMULATING });

/**
 * Development mode controls
 * Enables simulation of audio playback for testing visualizations
 * without requiring actual audio input
 */
if (DEV_MODE) {
    // Clean up any existing buttons immediately
    document.querySelectorAll('.dev-simulate-button').forEach(btn => btn.remove());
    
    // Only add the button once the DOM is ready
    window.addEventListener('DOMContentLoaded', () => {
        // Double check for any existing buttons
        document.querySelectorAll('.dev-simulate-button').forEach(btn => btn.remove());

        const simulateButton = document.createElement('button');
        simulateButton.className = 'dev-simulate-button';
        simulateButton.textContent = '▶️ Simulate';
        simulateButton.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            background: #444;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            display: block;
        `;
        
        simulateButton.onclick = () => {
            DEV_SIMULATING = !DEV_SIMULATING;
            simulateButton.textContent = DEV_SIMULATING ? '⏸️ Pause' : '▶️ Simulate';
        };
        
        document.body.appendChild(simulateButton);
    }, { once: true }); // Ensure the event listener only fires once
}

/**
 * Determines if audio should be considered playing
 * Returns true if either actual audio is playing or simulation is active
 */
function isAudioPlaying() {
    if (DEV_MODE && DEV_SIMULATING) return true;
    return mediaElement && !mediaElement.paused;
}

// Classic Laser Class with improved dynamics
class Laser {
    constructor(minSpeed, maxSpeed, colorIndex = 0) {
        this.x1 = random(0, canvas.width);
        this.y1 = random(0, canvas.height);
        this.x2 = random(0, canvas.width);
        this.y2 = random(0, canvas.height);
        this.vx1 = random(-maxSpeed, maxSpeed);
        this.vy1 = random(-maxSpeed, maxSpeed);
        this.vx2 = random(-maxSpeed, maxSpeed);
        this.vy2 = random(-maxSpeed, maxSpeed);
        this.baseSpeed = random(minSpeed, maxSpeed);
        this.colorIndex = colorIndex;
        this.hue = 0;
        this.targetHue = 0;
        this.colorTransitionSpeed = random(0.01, 0.03);
        this.baseWidth = random(1, 2);
        this.lineWidth = this.baseWidth;
        this.targetSpeedMultiplier = 1;
        this.currentSpeedMultiplier = 1;
        this.targetAlpha = 1;
        this.currentAlpha = 1;
        this.idlePhase = Math.random() * Math.PI * 2; // For idle animation
        this.idleSpeed = random(0.01, 0.02);
    }

    update(intensity, intensityDelta, currentColors, nextColors, schemeTransition) {
        const isPlaying = isAudioPlaying();
        const progressFactor = (mediaElement.currentTime / mediaElement.duration) || 0;
        const progressVariation = Math.sin(progressFactor * Math.PI * 2) * 0.2;
        
        // Enhanced idle motion
        this.idlePhase += this.idleSpeed;
        const idleMotion = Math.sin(this.idlePhase) * 0.2;
        const idlePulse = Math.sin(this.idlePhase * 0.5) * 0.3 + 0.7; // Slower, gentle pulse
        
        // Smoother speed multiplier transitions
        this.targetSpeedMultiplier = !isPlaying ? 
            0.2 + (idleMotion * 0.1) : // Gentler idle movement
            Math.min(0.8 + (intensity * 1.5) + progressVariation, 2.0);
        
        // Gentler speed transition
        this.currentSpeedMultiplier += (this.targetSpeedMultiplier - this.currentSpeedMultiplier) * 0.1;
        
        // Color transitions based on schemes
        const targetHue = currentColors[this.colorIndex];
        const nextHue = nextColors[this.colorIndex];
        this.targetHue = schemeTransition > 0 
            ? targetHue + (nextHue - targetHue) * (1 - schemeTransition)
            : targetHue;

        // Smoother color transitions
        this.hue += (this.targetHue - this.hue) * this.colorTransitionSpeed * 1.5;
        
        // Update velocities with idle influence
        if (!isPlaying) {
            this.vx1 += Math.sin(this.idlePhase * 0.7) * 0.01;
            this.vy1 += Math.cos(this.idlePhase * 0.8) * 0.01;
            this.vx2 += Math.sin(this.idlePhase * 0.9) * 0.01;
            this.vy2 += Math.cos(this.idlePhase * 1.0) * 0.01;
        }

        // More gradual movement bursts
        if (isPlaying && intensity > 0.6) {
            const burstMultiplier = 1.0 + (intensity * 0.3);
            this.vx1 *= burstMultiplier;
            this.vy1 *= burstMultiplier;
            this.vx2 *= burstMultiplier;
            this.vy2 *= burstMultiplier;
        }

        // More conservative velocity limits - reduce the max velocity when playing
        const maxVelocity = !isPlaying ? 3 : 4 + (intensity * 2); // Reduced from 5 + (intensity * 3)
        
        this.vx1 = Math.max(Math.min(this.vx1, maxVelocity), -maxVelocity);
        this.vy1 = Math.max(Math.min(this.vy1, maxVelocity), -maxVelocity);
        this.vx2 = Math.max(Math.min(this.vx2, maxVelocity), -maxVelocity);
        this.vy2 = Math.max(Math.min(this.vy2, maxVelocity), -maxVelocity);

        // Smoother movement - reduce the speed multiplier
        const speedMultiplier = !isPlaying ? 
            this.currentSpeedMultiplier : 
            this.currentSpeedMultiplier * (0.8 + intensity * 0.2); // Reduced from 1.1 + intensity * 0.2
        
        this.x1 += this.vx1 * speedMultiplier;
        this.y1 += this.vy1 * speedMultiplier;
        this.x2 += this.vx2 * speedMultiplier;
        this.y2 += this.vy2 * speedMultiplier;

        const margin = 50;
        
        if (this.x1 < -margin) { this.x1 = -margin; this.vx1 *= -0.8; }
        if (this.x1 > canvas.width + margin) { this.x1 = canvas.width + margin; this.vx1 *= -0.8; }
        if (this.y1 < -margin) { this.y1 = -margin; this.vy1 *= -0.8; }
        if (this.y1 > canvas.height + margin) { this.y1 = canvas.height + margin; this.vy1 *= -0.8; }
        
        if (this.x2 < -margin) { this.x2 = -margin; this.vx2 *= -0.8; }
        if (this.x2 > canvas.width + margin) { this.x2 = canvas.width + margin; this.vx2 *= -0.8; }
        if (this.y2 < -margin) { this.y2 = -margin; this.vy2 *= -0.8; }
        if (this.y2 > canvas.height + margin) { this.y2 = canvas.height + margin; this.vy2 *= -0.8; }

        // Stronger dampening when playing
        const dampening = !isPlaying ? 0.99 : 0.992 + (intensity * 0.001); // Increased from 0.995
        
        this.vx1 *= dampening;
        this.vy1 *= dampening;
        this.vx2 *= dampening;
        this.vy2 *= dampening;

        // Enhanced alpha transitions for idle state
        this.targetAlpha = !isPlaying ? 
            0.4 + (idlePulse * 0.2) : // Pulsing opacity when idle
            0.7 + (intensity * 0.2);
        
        this.currentAlpha += (this.targetAlpha - this.currentAlpha) * 0.1;

        // Update colors with smooth transitions
        const saturation = !isPlaying ? 
            70 + (idlePulse * 20) : // Pulsing saturation when idle
            100;
        const lightness = !isPlaying ?
            40 + (idlePulse * 10) : // Pulsing brightness when idle
            50 + (intensity * 30);
        
        this.startColor = `hsla(${this.hue}, ${saturation}%, ${lightness}%, ${this.currentAlpha})`;
        this.endColor = `hsla(${(this.hue + 30) % 360}, ${saturation}%, ${lightness}%, ${this.currentAlpha * 0.5})`;
    }

    draw(ctx) {
        // Draw trail first
        ctx.beginPath();
        const trailGradient = ctx.createLinearGradient(this.x1, this.y1, this.x2, this.y2);
        trailGradient.addColorStop(0, `hsla(${this.hue}, 100%, 50%, 0.1)`);
        trailGradient.addColorStop(1, `hsla(${(this.hue + 30) % 360}, 100%, 50%, 0.05)`);
        ctx.strokeStyle = trailGradient;
        ctx.lineWidth = this.lineWidth * 3;
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();

        // Draw main beam
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

// Consolidate mode initialization and animation into a cleaner structure
const laserModes = {
    ripple: {
        init: () => ({
            ripples: Array.from({ length: 5 }, (_, i) => ({
                radius: i * 50,
                opacity: 1 - (i * 0.2),
                speed: 3 + (i * 0.5),
                hue: (i * 60) % 360
            }))
        }),
        animate: (state, ctx, canvas, getAudioIntensity, mediaElement, animationTime) => {
            const intensity = getAudioIntensity();
            const isPlaying = isAudioPlaying();
            
            ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const maxRadius = Math.max(canvas.width, canvas.height) * 0.8;
            
            state.ripples.forEach(ripple => {
                // Update radius
                ripple.radius += ripple.speed * (isPlaying ? (1 + intensity) : 0.5);
                
                // Reset ripple when it gets too large
                if (ripple.radius > maxRadius) {
                    ripple.radius = 0;
                    ripple.hue = (ripple.hue + 60) % 360;
                }
                
                // Draw ripple
                ctx.beginPath();
                ctx.arc(centerX, centerY, ripple.radius, 0, Math.PI * 2);
                
                const alpha = ripple.opacity * (isPlaying ? (0.5 + intensity * 0.5) : 0.3);
                const brightness = isPlaying ? (50 + intensity * 30) : 50;
                
                ctx.strokeStyle = `hsla(${ripple.hue}, 100%, ${brightness}%, ${alpha})`;
                ctx.lineWidth = isPlaying ? (2 + intensity * 3) : 2;
                ctx.stroke();
            });
            
            animationTime += animationSpeed * (isPlaying ? (1 + intensity) : 0.3);
            return animationTime + (isPlaying ? 0.015 : 0.008);
        }
    },
    classic: {
        init: () => ({
            lasers: Array.from({ length: 15 }, (_, i) => new Laser(2, 4, i % 3)),
            colorSchemes: [
                [350, 45, 85],
                [180, 210, 240],
                [280, 315, 350],
                [45, 85, 125],
                [200, 240, 280]
            ],
            currentScheme: 0,
            schemeTransition: 0
        }),
        animate: (state, ctx, canvas, getAudioIntensity, mediaElement, animationTime) => {
            const intensity = getAudioIntensity();
            const isPlaying = isAudioPlaying();
            const intensityDelta = intensity - lastIntensity;

            ctx.fillStyle = `rgba(0, 0, 0, ${isPlaying ? 0.15 : 0.05})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Color scheme management
            if (isPlaying && intensity > 0.7 && Math.random() > 0.995) {
                state.schemeTransition = 1;
            }

            if (state.schemeTransition > 0) {
                state.schemeTransition -= 0.02;
                if (state.schemeTransition <= 0) {
                    state.currentScheme = (state.currentScheme + 1) % state.colorSchemes.length;
                }
            }

            const currentColors = state.colorSchemes[state.currentScheme];
            const nextColors = state.colorSchemes[(state.currentScheme + 1) % state.colorSchemes.length];

            state.lasers.forEach(laser => {
                laser.update(
                    intensity, 
                    intensityDelta,
                    currentColors,
                    nextColors,
                    state.schemeTransition
                );
                laser.draw(ctx);
            });

            lastIntensity = intensity;
            return animationTime + (isPlaying ? 0.015 : 0.008);
        }
    },
    spotlights: {
        init: () => ({
            colorSchemes: [
                [350, 45, 85],      // Red, Orange, Yellow (warm)
                [180, 210, 240],    // Aqua, Cyan, Blue (cool)
                [280, 315, 350],    // Purple, Magenta, Red (rich)
                [45, 85, 125],      // Orange, Yellow, Spring Green
                [200, 240, 280]     // Blue, Azure, Purple
            ],
            currentScheme: 0,
            schemeTransition: 0,
            fogParticles: (() => {
                return window.isMobileDevice() ? [] : Array.from({ length: 100 }, () => ({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    size: Math.random() * 150 + 50,
                    vx: (Math.random() - 0.5) * 0.2,
                    vy: (Math.random() - 0.5) * 0.1 - 0.1,
                    alpha: Math.random() * 0.3,
                    pulseOffset: Math.random() * Math.PI * 2
                }));
            })(),
            spotlights: Array.from({ length: 6 }, (_, index) => ({
                x: window.innerWidth * ((index + 0.5) / 6),
                y: -20,
                angle: Math.PI * 0.4,
                baseAngle: Math.PI * 0.4,
                sweepSpeed: Math.random() * 0.01 + 0.005,
                sweepAngle: Math.random() * Math.PI * 2,
                sweepRange: Math.PI * 0.25,
                sweepCenter: Math.PI * 0.1,
                colorIndex: index % 3,
                hue: 0,
                targetHue: 0,
                beamLength: Math.max(window.innerWidth, window.innerHeight) * 1.2,
                beamWidth: Math.random() * 20 + 15,
                currentAlpha: 0.3,
                currentWidth: 0,
                colorTransitionSpeed: 0.03,
                pattern: 'sweep',
                patternTime: 0,
                circlePhase: Math.random() * Math.PI * 2,
                flashIntensity: 0,
                idlePhase: Math.random() * Math.PI * 2,
                idleSpeed: random(0.003, 0.006)
            })),
            uplights: Array.from({ length: 4 }, (_, index) => ({
                x: window.innerWidth * ((index + 0.5) / 4),
                y: window.innerHeight + 20,
                angle: -Math.PI * 0.4,
                baseAngle: -Math.PI * 0.4,
                sweepSpeed: Math.random() * 0.01 + 0.005,
                sweepAngle: Math.random() * Math.PI * 2,
                sweepRange: Math.PI * 0.2,
                sweepCenter: -Math.PI * 0.1, // Adjusted center point for uplights
                hue: 0,
                targetHue: 0,
                beamLength: Math.max(window.innerWidth, window.innerHeight) * 1.2,
                beamWidth: Math.random() * 20 + 15,
                currentAlpha: 0.3,
                currentWidth: 0,
                colorTransitionSpeed: 0.03,
                colorIndex: index % 3,
                idlePhase: Math.random() * Math.PI * 2,
                idleSpeed: random(0.003, 0.006)
            }))
        }),
        animate: (state, ctx, canvas, getAudioIntensity, mediaElement, animationTime) => {
            const intensity = getAudioIntensity();
            const isPlaying = isAudioPlaying();

            // Color scheme management - trigger changes more frequently
            if (isPlaying && intensity > 0.7 && Math.random() > 0.992) {
                state.schemeTransition = 1;
            }

            if (state.schemeTransition > 0) {
                state.schemeTransition -= 0.008;
                if (state.schemeTransition <= 0) {
                    state.currentScheme = (state.currentScheme + 1) % state.colorSchemes.length;
                    state.schemeTransition = 0;
                }
            }

            const currentColors = state.colorSchemes[state.currentScheme];
            const nextColors = state.colorSchemes[(state.currentScheme + 1) % state.colorSchemes.length];

            ctx.fillStyle = `rgba(0, 0, 0, ${isPlaying ? 0.2 : 0.3})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Update and draw fog particles (skip on mobile)
            if (!window.isMobileDevice()) {
                state.fogParticles.forEach(particle => {
                    // Update position
                    particle.x += particle.vx;
                    particle.y += particle.vy;

                    // Reset particles that move off screen
                    if (particle.y < -particle.size) {
                        particle.y = canvas.height + particle.size;
                        particle.x = Math.random() * canvas.width;
                    }
                    if (particle.x < -particle.size) particle.x = canvas.width + particle.size;
                    if (particle.x > canvas.width + particle.size) particle.x = -particle.size;

                    // Pulse the fog opacity with the music
                    const pulseAmount = isPlaying ? 
                        (0.2 + Math.sin(particle.pulseOffset + animationTime * 2) * 0.1) * (1 + intensity * 0.5) :
                        0.2 + Math.sin(particle.pulseOffset + animationTime * 2) * 0.1;

                    // Draw the fog particle
                    const gradient = ctx.createRadialGradient(
                        particle.x, particle.y, 0,
                        particle.x, particle.y, particle.size
                    );
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${particle.alpha * pulseAmount})`);
                    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    
                    ctx.beginPath();
                    ctx.fillStyle = gradient;
                    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                    ctx.fill();
                });
            }

            const updateLight = (light, isUplight = false) => {
                // Smoother color transitions
                const targetHue = currentColors[light.colorIndex];
                const nextHue = nextColors[light.colorIndex];
                light.targetHue = state.schemeTransition > 0 
                    ? targetHue + (nextHue - targetHue) * (1 - state.schemeTransition)
                    : targetHue;

                // Slower, smoother color transition
                light.hue = light.hue || targetHue;
                light.hue += (light.targetHue - light.hue) * 0.03;

                // Smooth intensity transitions
                light.smoothedIntensity = light.smoothedIntensity || 0;
                light.smoothedIntensity += (intensity - light.smoothedIntensity) * 0.1;

                let targetAngle = light.baseAngle;

                switch (light.pattern || 'sweep') {
                    case 'sweep':
                        light.sweepSpeed = light.sweepSpeed || 0.002;
                        
                        const timeVariation = Math.sin(animationTime * 0.2) * 0.3 + 0.7;
                        const baseSpeed = isPlaying ? 0.0018 : 0.001;
                        const targetSweepSpeed = (baseSpeed + light.smoothedIntensity * 0.003) * timeVariation;
                        
                        const maxSweepSpeed = isPlaying ? 0.004 : 0.003;
                        const minSweepSpeed = isPlaying ? 0.001 : 0.0008;
                        
                        light.sweepSpeed += (targetSweepSpeed - light.sweepSpeed) * 0.015;
                        light.sweepSpeed = Math.max(minSweepSpeed, Math.min(maxSweepSpeed, light.sweepSpeed));
                        
                        const fastVariation = Math.sin(animationTime * 1.5) * 0.05;
                        const slowVariation = Math.sin(animationTime * 0.3) * 0.08;
                        const variation = 1 + fastVariation + slowVariation;
                        
                        light.sweepAngle = (light.sweepAngle || 0) + light.sweepSpeed * variation;
                        light.sweepAngle = light.sweepAngle % (Math.PI * 2);
                        
                        light.sweepCenterOffset = light.sweepCenterOffset || 0;
                        light.sweepCenterOffset += (Math.sin(animationTime * 0.1) * 0.1 - light.sweepCenterOffset) * 0.01;
                        
                        targetAngle = light.baseAngle + 
                            Math.sin(light.sweepAngle) * light.sweepRange * 0.6 + 
                            light.sweepCenter + light.sweepCenterOffset;
                        break;

                    case 'circle':
                        light.circlePhase = (light.circlePhase || 0) + 
                            (0.003 + light.smoothedIntensity * 0.005);
                        const circleSize = 0.1 + light.smoothedIntensity * 0.15;
                        targetAngle = light.baseAngle + Math.cos(light.circlePhase) * circleSize;
                        break;
                }

                // Smooth angle transitions
                light.currentAngle = light.currentAngle || targetAngle;
                light.currentAngle += (targetAngle - light.currentAngle) * 0.08;

                // Draw beams with safety checks
                const drawBeam = (width, alpha, angle) => {
                    // Ensure all coordinates are finite numbers
                    const startX = Number.isFinite(light.x) ? light.x : 0;
                    const startY = Number.isFinite(light.y) ? light.y : 0;
                    const cosAngle = Math.cos(angle);
                    const sinAngle = Math.sin(angle);
                    const beamLength = Number.isFinite(light.beamLength) ? light.beamLength : 1000;
                    
                    const endX = startX + cosAngle * beamLength;
                    const endY = startY + sinAngle * beamLength;

                    // Only draw if all coordinates are valid
                    if (Number.isFinite(startX) && Number.isFinite(startY) && 
                        Number.isFinite(endX) && Number.isFinite(endY)) {
                        
                        const safeAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
                        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
                        const hue = Math.round(light.hue % 360);
                        
                        gradient.addColorStop(0, `hsla(${hue}, 70%, 50%, ${safeAlpha})`);
                        gradient.addColorStop(0.5, `hsla(${hue}, 60%, 50%, ${safeAlpha * 0.5})`);
                        gradient.addColorStop(1, `hsla(${hue}, 50%, 50%, 0)`);

                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(endX, endY);
                        ctx.strokeStyle = gradient;
                        ctx.lineWidth = width;
                        ctx.lineCap = 'round';
                        ctx.stroke();
                    }
                };

                // Draw the beams
                const baseAlpha = isPlaying ? 
                    (0.3 + light.smoothedIntensity * 0.3) : 
                    0.15;

                drawBeam(light.beamWidth * 2, baseAlpha * 0.3, light.currentAngle);
                drawBeam(light.beamWidth * 1.5, baseAlpha * 0.5, light.currentAngle);
                drawBeam(light.beamWidth, baseAlpha, light.currentAngle);
            };

            // Update lights
            state.spotlights.forEach(light => updateLight(light, false));
            state.uplights.forEach(light => updateLight(light, true));

            return animationTime + (isPlaying ? 0.015 : 0.008);
        }
    }
};

/**
 * Animation loop handler
 * Manages the continuous update and rendering of the current visualization mode
 */
function animate() {
    // First check if we should be running at all
    if (!isVisualizerActive && !DEV_SIMULATING) return;
    
    // Add safety checks
    if (!modes || !Array.isArray(modes)) return;
    if (currentModeIndex < 0 || currentModeIndex >= modes.length) return;
    
    const currentMode = modes[currentModeIndex].toLowerCase();
    const mode = laserModes[currentMode];
    
    if (!mode || !lasers) return;

    animationTime = mode.animate(lasers, ctx, canvas, getAudioIntensity, mediaElement, animationTime);
    if (isVisualizerActive) {  // Only continue animation if still active
        requestAnimationFrame(animate);
    }
}

/**
 * Visualization mode manager
 * Cycles through available visualization modes and handles mode initialization
 * Includes an "off" state when cycling past the last mode
 */
function toggleMode() {
    // First, increment the index
    currentModeIndex++;
    
    // If we've gone past the last mode, reset to -1 (off)
    if (currentModeIndex >= modes.length) {
        currentModeIndex = -1;
        isVisualizerActive = false;
        canvas.style.display = "none";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        lasers = null;  // Clear the lasers state
        return;
    }

    // If we get here, we're activating a mode
    isVisualizerActive = true;
    resizeCanvas();
    
    const currentMode = modes[currentModeIndex].toLowerCase();
    const mode = laserModes[currentMode];
    
    if (mode) {
        lasers = mode.init();
        canvas.style.display = "block";
        animate();
    }
}

/**
 * Canvas dimension manager
 * Ensures visualization canvas matches window dimensions
 * and maintains proper positioning
 */
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
}

// Event listeners for user interaction
toggleButton.addEventListener("click", toggleMode);

// Helper Function
function random(min, max) {
    return Math.random() * (max - min) + min;
}

// Update getAudioIntensity to use the helper
function getAudioIntensity() {
    if (isAudioPlaying()) {
        const timeGap = Math.abs(mediaElement.currentTime - lastAudioTime) > 0.1;
        lastAudioTime = mediaElement.currentTime;
        
        if (timeGap) return lastIntensity;
        
        const bassTime = (animationTime % 0.2) * Math.PI * 10;
        const midTime = (animationTime % 0.1) * Math.PI * 20;
        
        const bassComponent = Math.abs(Math.sin(bassTime)) * 0.6;
        const midComponent = Math.abs(Math.sin(midTime)) * 0.4;
        
        const rawIntensity = (bassComponent + midComponent) * intensityMultiplier;
        
        intensityHistory.shift();
        intensityHistory.push(rawIntensity);
        
        const smoothedIntensity = calculateSmoothedIntensity(rawIntensity);
        return Math.max(0, Math.min(1, smoothedIntensity));
    }
    
    return (Math.sin(animationTime) * 0.3 + 0.5) * intensityMultiplier;
}

// Helper function for intensity smoothing
function calculateSmoothedIntensity(rawIntensity) {
    const localAverage = intensityHistory.slice(0, -1).reduce((a, b) => a + b) / (intensityHistory.length - 1);
    const variance = Math.abs(rawIntensity - localAverage);
    
    const peakEnhanced = variance > 0.1 ? 
        rawIntensity * 2.5 : 
        rawIntensity * 0.8;
    
    return lastIntensity * (1 - smoothingFactor) + peakEnhanced * smoothingFactor;
}

// Update the updateMediaElement function to handle missing media element
function updateMediaElement() {
    const newMediaElement = document.getElementById('audio-player') || document.getElementById('video-player');
    if (newMediaElement) {
        if (mediaElement !== newMediaElement) {
            // Remove listeners from old element if it exists and has removeEventListener
            if (mediaElement && mediaElement.removeEventListener) {
                mediaElement.removeEventListener('loadstart', handleLoadStart);
            }
            
            // Update reference and add listeners to new element
            mediaElement = newMediaElement;
            mediaElement.addEventListener('loadstart', handleLoadStart);
        }
    } else {
        // Use dummy media element if none exists
        mediaElement = {
            paused: true,
            currentTime: 0,
            duration: 0
        };
    }
}

// Handle media element changes
function handleLoadStart() {
    if (isVisualizerActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Update the resize observer
const resizeObserver = new ResizeObserver(() => {
    if (isVisualizerActive) {
        resizeCanvas();
    }
});

// Initialize and handle media element changes
function initializeMediaElement() {
    updateMediaElement();
    resizeObserver.observe(mediaElement.parentElement);
}

// Call initialize on load and when media type changes
initializeMediaElement();
document.addEventListener('mediaTypeChanged', initializeMediaElement);