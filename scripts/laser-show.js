/**
 * Laser Show Visualizer
 * Provides three visualization modes:
 * - wave: Circular wave patterns that respond to audio intensity
 * - classic: Moving laser beams with color transitions
 * - spotlights: Dynamic spotlight effects with fog simulation
 * 
 * Integrates with audio/video player and responds to:
 * - Audio/Video playback status
 * - Playback state changes
 * - Window resizing
 * - Media type switching (audio/video)
 */
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

// Enhanced tracking without Web Audio API
let lastIntensity = 0;
const smoothingFactor = 0.15;
let lastAudioTime = 0;
let intensityHistory = new Array(15).fill(0);
let lastDelta = 0;
let peakThreshold = 0.1;

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
        const progressFactor = (audioElement.currentTime / audioElement.duration) || 0;
        const progressVariation = Math.sin(progressFactor * Math.PI * 2) * 0.3;
        
        // Update idle phase
        this.idlePhase += this.idleSpeed;
        
        // Blend between idle and active movement
        this.targetSpeedMultiplier = audioElement.paused ? 
            0.3 : 
            Math.min(0.8 + (intensity * intensityMultiplier * 1.5) + progressVariation, 2.0);
        
        this.currentSpeedMultiplier += (this.targetSpeedMultiplier - this.currentSpeedMultiplier) * 0.1;
        
        const isPeak = Math.abs(intensityDelta) > peakThreshold;
        
        // Color transitions based on schemes
        const targetHue = currentColors[this.colorIndex];
        const nextHue = nextColors[this.colorIndex];
        this.targetHue = schemeTransition > 0 
            ? targetHue + (nextHue - targetHue) * (1 - schemeTransition)
            : targetHue;

        this.hue += (this.targetHue - this.hue) * this.colorTransitionSpeed;
        
        if (isPeak && !audioElement.paused) {
            const burstMultiplier = 1.1;
            this.vx1 *= burstMultiplier;
            this.vy1 *= burstMultiplier;
            this.vx2 *= burstMultiplier;
            this.vy2 *= burstMultiplier;
        }

        const maxVelocity = 6; // Reduced from 8
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
        const saturation = 100;
        const lightness = audioElement.paused ?
            50 :
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
    wave: {
        init: () => ({
            waves: Array.from({ length: 5 }, (_, i) => ({
                radius: i * 50,
                opacity: 1 - (i * 0.2),
                speed: 3 + (i * 0.5),
                hue: (i * 60) % 360
            }))
        }),
        animate: (state, ctx, canvas, getAudioIntensity, audioElement, animationTime) => {
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
            return animationTime + (isAudioPlaying ? 0.015 : 0.008);
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
        animate: (state, ctx, canvas, getAudioIntensity, audioElement, animationTime) => {
            const intensity = getAudioIntensity();
            const intensityDelta = intensity - lastIntensity;
            const isAudioPlaying = !audioElement.paused;

            ctx.fillStyle = `rgba(0, 0, 0, ${isAudioPlaying ? 0.15 : 0.05})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Color scheme management
            if (isAudioPlaying && intensity > 0.7 && Math.random() > 0.995) {
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
            return animationTime + (isAudioPlaying ? 0.015 : 0.008);
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
            fogParticles: Array.from({ length: 100 }, () => ({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                size: Math.random() * 150 + 50,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.1 - 0.1,
                alpha: Math.random() * 0.3,
                pulseOffset: Math.random() * Math.PI * 2
            })),
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
        animate: (state, ctx, canvas, getAudioIntensity, audioElement, animationTime) => {
            const intensity = getAudioIntensity();
            const isAudioPlaying = !audioElement.paused;

            // Color scheme management - trigger changes more frequently
            if (isAudioPlaying && intensity > 0.7 && Math.random() > 0.992) {
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

            ctx.fillStyle = `rgba(0, 0, 0, ${isAudioPlaying ? 0.2 : 0.3})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Update and draw fog particles
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
                const pulseAmount = isAudioPlaying ? 
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
                        const baseSpeed = isAudioPlaying ? 0.0018 : 0.001;
                        const targetSweepSpeed = (baseSpeed + light.smoothedIntensity * 0.003) * timeVariation;
                        
                        const maxSweepSpeed = isAudioPlaying ? 0.004 : 0.003;
                        const minSweepSpeed = isAudioPlaying ? 0.001 : 0.0008;
                        
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
                const baseAlpha = isAudioPlaying ? 
                    (0.3 + light.smoothedIntensity * 0.3) : 
                    0.15;

                drawBeam(light.beamWidth * 2, baseAlpha * 0.3, light.currentAngle);
                drawBeam(light.beamWidth * 1.5, baseAlpha * 0.5, light.currentAngle);
                drawBeam(light.beamWidth, baseAlpha, light.currentAngle);
            };

            // Update lights
            state.spotlights.forEach(light => updateLight(light, false));
            state.uplights.forEach(light => updateLight(light, true));

            return animationTime + (isAudioPlaying ? 0.015 : 0.008);
        }
    }
};

// Simplify animation loop
function animate() {
    if (!isVisualizerActive) return;
    
    const currentMode = modes[currentModeIndex].toLowerCase();
    const mode = laserModes[currentMode];
    
    if (mode) {
        animationTime = mode.animate(lasers, ctx, canvas, getAudioIntensity, audioElement, animationTime);
        requestAnimationFrame(animate);
    }
}

// Simplify toggle function
function toggleMode() {
    currentModeIndex = (currentModeIndex + 1) % (modes.length + 1);
    
    if (currentModeIndex === modes.length) {
        isVisualizerActive = false;
        canvas.style.display = "none";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

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

// Clean up getAudioIntensity function
function getAudioIntensity() {
    if (!audioElement.paused) {
        const timeGap = Math.abs(audioElement.currentTime - lastAudioTime) > 0.1;
        lastAudioTime = audioElement.currentTime;
        
        if (timeGap) return lastIntensity;
        
        const bassTime = (audioElement.currentTime % 0.2) * Math.PI * 10;
        const midTime = (audioElement.currentTime % 0.1) * Math.PI * 20;
        
        const bassComponent = Math.abs(Math.sin(bassTime)) * 0.6;
        const midComponent = Math.abs(Math.sin(midTime)) * 0.4;
        
        const rawIntensity = (bassComponent + midComponent) * intensityMultiplier;
        
        // Update intensity history
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

// Initial resize
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Add cleanup for canvas when switching tracks
audioElement.addEventListener('loadstart', () => {
    if (isVisualizerActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
});

// Add resize handler for video content
const resizeObserver = new ResizeObserver(() => {
    if (isVisualizerActive) {
        resizeCanvas();
    }
});
resizeObserver.observe(audioElement.parentElement);