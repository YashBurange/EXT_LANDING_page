import { useSpotlight } from './hooks/useSpotlight.js';
import { useScrollAnimation } from './hooks/useScrollAnimation.js';
import { useRealTimeCollaboration } from './hooks/useRealTimeCollaboration.js';
import './styles/main.css';

/**
 * Main application entry point
 */
function init() {
    // Initialize hooks
    useSpotlight();
    useScrollAnimation();
    useRealTimeCollaboration();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

