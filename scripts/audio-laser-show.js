// Combined Audio and Laser Mode Script
const canvas = document.getElementById("laser-visualizer");
const ctx = canvas.getContext("2d");
const toggleButton = document.getElementById("toggle-visualizer");
// const audioPlayer = window.audioPlayer; // Use the globally declared instance

let isVisualizerActive = false;
let currentModeIndex = -1; // Start with off (-1)
const modes = ["classic", "hyperSpeed", "audioReactive"];
let lasers = [];

// Initialize Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
const source = audioContext.createMediaElementSource(audioPlayer);
source.connect(analyser);
analyser.connect(audioContext.destination);
analyser.fftSize = 256; // Frequency resolution
const frequencyData = new Uint8Array(analyser.frequencyBinCount);

// Laser Modes
const laserModes = {
    classic: {
        init: () => Array.from({ length: 15 }, () => new Laser(2, 4)),
        animate: (lasers) => lasers.forEach(laser => { laser.update(); laser.draw(); })
    },
    hyperSpeed: {
        init: () => Array.from({ length: 20 }, () => new Laser(5, 10)),
        animate: (lasers) => lasers.forEach(laser => { laser.update(); laser.draw(); })
    },
    audioReactive: {
        init: () => Array.from({ length: 20 }, () => new AudioLaser()),
        animate: (lasers) => {
            analyser.getByteFrequencyData(frequencyData);

            const bass = frequencyData.slice(0, 32).reduce((a, b) => a + b, 0) / 32;
            const mids = frequencyData.slice(32, 96).reduce((a, b) => a + b, 0) / 64;
            const highs = frequencyData.slice(96).reduce((a, b) => a + b, 0) / (frequencyData.length - 96);

            lasers.forEach(laser => {
                laser.update(bass, mids, highs);
                laser.draw();
            });
        }
    }
};

// Classic Laser Class
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
        this.color = `hsl(${random(0, 360)}, 100%, 50%)`;
        this.lineWidth = random(1, 2);
    }

    update() {
        this.x1 += this.vx1;
        this.y1 += this.vy1;
        this.x2 += this.vx2;
        this.y2 += this.vy2;

        if (this.x1 <= 0 || this.x1 >= canvas.width) this.vx1 *= -1;
        if (this.y1 <= 0 || this.y1 >= canvas.height) this.vy1 *= -1;
        if (this.x2 <= 0 || this.x2 >= canvas.width) this.vx2 *= -1;
        if (this.y2 <= 0 || this.y2 >= canvas.height) this.vy2 *= -1;
    }

    draw() {
        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();
    }
}

// Audio-Reactive Laser Class
class AudioLaser {
    constructor() {
        this.x1 = Math.random() * canvas.width;
        this.y1 = Math.random() * canvas.height;
        this.x2 = Math.random() * canvas.width;
        this.y2 = Math.random() * canvas.height;
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        this.lineWidth = 2;
    }

    update(bass, mids, highs) {
        this.x1 += (Math.random() - 0.5) * bass / 50;
        this.y1 += (Math.random() - 0.5) * mids / 50;
        this.x2 += (Math.random() - 0.5) * highs / 50;
        this.y2 += (Math.random() - 0.5) * bass / 50;

        this.x1 = (this.x1 + canvas.width) % canvas.width;
        this.y1 = (this.y1 + canvas.height) % canvas.height;
        this.x2 = (this.x2 + canvas.width) % canvas.width;
        this.y2 = (this.y2 + canvas.height) % canvas.height;
    }

    draw() {
        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();
    }
}

// Animation Loop
function animate() {
    if (!isVisualizerActive) return;
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    laserModes[modes[currentModeIndex]].animate(lasers);

    requestAnimationFrame(animate);
}

// Toggle Visualizer
function toggleMode() {
    currentModeIndex = (currentModeIndex + 1) % (modes.length + 1); // Cycle through modes + off

    if (currentModeIndex === modes.length) {
        // Turn off visualizer
        isVisualizerActive = false;
        canvas.style.display = "none";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    // Activate visualizer with the new mode
    isVisualizerActive = true;
    resizeCanvas();
    lasers = laserModes[modes[currentModeIndex]].init();
    canvas.style.display = "block";
    animate();
}

toggleButton.addEventListener("click", toggleMode);

// Resize Canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Helper Function
function random(min, max) {
    return Math.random() * (max - min) + min;
}

window.addEventListener("resize", resizeCanvas);
