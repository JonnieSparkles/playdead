// utils.js - Contains utility functions for the app

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
