const canvas = document.getElementById("laser-visualizer");
const ctx = canvas.getContext("2d");
const toggleButton = document.getElementById("toggle-visualizer");

let isVisualizerActive = false;
let currentModeIndex = -1; // Start with off (-1)
const modes = ["classic", "hyperSpeed", "fractal"];
let lasers = [];

// Laser Modes
const laserModes = {
    classic: {
        init: () => Array.from({ length: 15 }, () => new Laser(2, 4)),
        animate: (lasers) => lasers.forEach(laser => { laser.update(); laser.draw(); })
    },
    fractal: {
        init: () => [],
        animate: () => {
            for (let i = 0; i < 3; i++) { // Adjust number of fractal instances
                const x = Math.random() * canvas.width; // Center fractals
                const y = Math.random() * canvas.height;
                const size = Math.random() * 50 + 50; // Base size
                const depth = Math.floor(Math.random() * 4) + 3; // Random depth
                const angle = Math.random() * Math.PI * 2; // Random angle
                const color = `hsl(${Math.random() * 360}, 100%, 50%)`; // Vibrant colors
                drawFractal(x, y, size, depth, angle, color);
            }
        }
    },
    hyperSpeed: {
        init: () => Array.from({ length: 20 }, () => new Laser(5, 10)), // Slow down speeds
        animate: (lasers) => lasers.forEach(laser => { laser.update(); laser.draw(); })
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

// Fractal Drawing Function
function drawFractal(x, y, size, depth, angle, color) {
    if (depth <= 0) return;

    // Calculate end points
    const x2 = x + Math.cos(angle) * size;
    const y2 = y + Math.sin(angle) * size;

    // Draw the line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = depth;
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Recursive calls to draw branches
    const newSize = size * 0.7; // Scale down the size
    drawFractal(x2, y2, newSize, depth - 1, angle - Math.PI / 6, color); // Left branch
    drawFractal(x2, y2, newSize, depth - 1, angle + Math.PI / 6, color); // Right branch
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
    // Set canvas size to match the full viewport size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    canvas.style.position = "fixed"; // Fixes the canvas to the viewport
    canvas.style.top = "0";
    canvas.style.left = "0";
}

// Helper Function
function random(min, max) {
    return Math.random() * (max - min) + min;
}
