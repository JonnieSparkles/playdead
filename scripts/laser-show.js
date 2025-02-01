const canvas = document.getElementById("laser-visualizer");
const ctx = canvas.getContext("2d");
const toggleButton = document.getElementById("toggle-visualizer");
const audioElement = document.getElementById('audio-player');

let isVisualizerActive = false;
let currentModeIndex = -1; // Start with off (-1)
const modes = ["wave", "classic", "starburst"];
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
        animate: (lasers) => {
            const intensity = getAudioIntensity();
            const intensityDelta = intensity - lastIntensity;
            
            ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            lasers.forEach(laser => {
                laser.update(intensity, intensityDelta);
                laser.draw();
            });
            
            lastIntensity = intensity;
            animationTime += animationSpeed * 0.3;
        }
    },
    starburst: {
        init: () => ({
            bursts: Array.from({ length: 3 }, () => ({
                rays: Array.from({ length: 12 }, (_, i) => ({
                    angle: (i * Math.PI * 2) / 12 + random(-0.2, 0.2),  // Initial angle variation
                    length: random(200, 400),
                    hue: random(0, 360),
                    opacity: random(0.6, 1),
                    speed: random(3, 6),
                    spinRate: random(-0.02, 0.02)  // Added spin for each ray
                })),
                age: random(0, 1),
                x: canvas.width * random(0.2, 0.8),  // Better spread across screen
                y: canvas.height * random(0.2, 0.8),
                scale: random(0.8, 1.2)  // Size variation
            }))
        }),
        animate: (state) => {
            const intensity = getAudioIntensity();
            const isAudioPlaying = !audioElement.paused;
            
            ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Dynamic burst creation based on intensity
            if (isAudioPlaying && intensity > 0.7 && Math.random() < 0.2 + (intensity * 0.3)) {
                const burstCount = Math.floor(random(8, 16));  // Variable ray count
                state.bursts.push({
                    rays: Array.from({ length: burstCount }, (_, i) => ({
                        angle: (i * Math.PI * 2) / burstCount + random(-0.3, 0.3),
                        length: random(300, 600) * (1 + intensity),  // Longer rays on high intensity
                        hue: random(0, 360),
                        opacity: 1,
                        speed: random(3, 6),
                        spinRate: random(-0.02, 0.02)
                    })),
                    age: 0,
                    x: canvas.width * random(0.1, 0.9),
                    y: canvas.height * random(0.1, 0.9),
                    scale: random(0.8, 1.2) * (1 + intensity * 0.5)
                });
            }
            
            state.bursts = state.bursts.filter(burst => {
                burst.age += 0.015 * (isAudioPlaying ? (1 + intensity) : 0.3);
                
                if (burst.age > 1) return false;
                
                burst.rays.forEach(ray => {
                    // Add spin to ray angle
                    ray.angle += ray.spinRate * (isAudioPlaying ? (1 + intensity) : 0.3);
                    
                    const length = ray.length * burst.scale * 
                        (1 - burst.age * 0.7) * // Fade out
                        (1 + intensity * 2) *   // Intensity scaling
                        (1 + Math.sin(animationTime * 2) * 0.1); // Subtle pulse
                    
                    const endX = burst.x + Math.cos(ray.angle) * length;
                    const endY = burst.y + Math.sin(ray.angle) * length;
                    
                    const gradient = ctx.createLinearGradient(burst.x, burst.y, endX, endY);
                    
                    const brightness = isAudioPlaying ? 
                        50 + (intensity * 30) : 
                        40 + Math.sin(animationTime * 2) * 10; // Subtle pulse when paused
                    
                    const alpha = ray.opacity * (1 - burst.age) * (isAudioPlaying ? 
                        0.8 + (intensity * 0.2) : 
                        0.4 + Math.sin(animationTime) * 0.2); // Breathing effect when paused
                    
                    gradient.addColorStop(0, `hsla(${ray.hue}, 100%, ${brightness}%, ${alpha})`);
                    gradient.addColorStop(0.5, `hsla(${ray.hue + 30}, 100%, ${brightness}%, ${alpha * 0.5})`);
                    gradient.addColorStop(1, `hsla(${ray.hue}, 100%, ${brightness}%, 0)`);
                    
                    ctx.beginPath();
                    ctx.moveTo(burst.x, burst.y);
                    ctx.lineTo(endX, endY);
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = isAudioPlaying ? 
                        2 + (intensity * 3) * (1 - burst.age) : 
                        1 + Math.sin(animationTime * 2) * 0.5;
                    ctx.stroke();
                    
                    // Enhanced glow effect
                    ctx.lineWidth = ctx.lineWidth * 2;
                    ctx.strokeStyle = `hsla(${ray.hue}, 100%, ${brightness}%, ${alpha * 0.3})`;
                    ctx.stroke();
                });
                
                return true;
            });
            
            // Dynamic minimum burst count based on intensity
            const minBursts = isAudioPlaying ? 
                Math.max(2, Math.floor(3 + intensity * 2)) : 
                2;
            
            while (state.bursts.length < minBursts) {
                state.bursts.push({
                    rays: Array.from({ length: Math.floor(random(8, 16)) }, (_, i) => ({
                        angle: (i * Math.PI * 2) / 12 + random(-0.3, 0.3),
                        length: random(200, 400),
                        hue: random(0, 360),
                        opacity: random(0.6, 1),
                        speed: random(3, 6),
                        spinRate: random(-0.02, 0.02)
                    })),
                    age: random(0, 0.5),
                    x: canvas.width * random(0.1, 0.9),
                    y: canvas.height * random(0.1, 0.9),
                    scale: random(0.8, 1.2)
                });
            }
            
            animationTime += animationSpeed * (isAudioPlaying ? (1 + intensity) : 0.3);
        }
    }
};

// Animation Loop
function animate() {
    if (!isVisualizerActive) return;
    
    laserModes[modes[currentModeIndex]].animate(lasers);
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
    const currentMode = modes[currentModeIndex];
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