// farcaster-sdk.js - Farcaster Mini App SDK integration

// Global SDK reference
let farcasterSDK = null;

// Initialize Farcaster SDK
async function initializeFarcasterSDK() {
    try {
        // Check if we're running in a Farcaster environment
        if (typeof window !== 'undefined' && window.farcaster) {
            // Import the SDK dynamically
            const { sdk } = await import('@farcaster/miniapp-sdk');
            farcasterSDK = sdk;
            console.log('Farcaster SDK initialized successfully');
            return true;
        } else {
            console.log('Not running in Farcaster environment, SDK not available');
            return false;
        }
    } catch (error) {
        console.log('Farcaster SDK not available:', error.message);
        return false;
    }
}

// Call ready() to hide splash screen and display content
async function hideSplashScreen() {
    if (farcasterSDK && farcasterSDK.actions) {
        try {
            await farcasterSDK.actions.ready();
            console.log('Farcaster splash screen hidden');
        } catch (error) {
            console.error('Error hiding Farcaster splash screen:', error);
        }
    }
}

// Initialize SDK when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await initializeFarcasterSDK();
});

// Export functions for use in other scripts
window.farcasterSDK = {
    initialize: initializeFarcasterSDK,
    hideSplash: hideSplashScreen,
    isAvailable: () => farcasterSDK !== null
};
