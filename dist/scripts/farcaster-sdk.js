// farcaster-sdk.js - Farcaster Mini App SDK integration

// Global SDK reference
let farcasterSDK = null;

// Initialize Farcaster SDK
async function initializeFarcasterSDK() {
    try {
        // Import the SDK using the CDN method as recommended in the docs
        const { sdk } = await import('https://esm.sh/@farcaster/miniapp-sdk');
        farcasterSDK = sdk;
        console.log('Farcaster SDK initialized successfully');
        
        // Call ready() immediately after SDK initialization
        await sdk.actions.ready();
        console.log('Farcaster ready() called successfully');
        
        return true;
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
