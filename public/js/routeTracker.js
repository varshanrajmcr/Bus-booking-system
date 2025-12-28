/**
 * Frontend Route Tracker
 * Tracks all page navigation and user interactions for customers
 */

let currentCustomerId = null;
let sessionStartTime = null;

/**
 * Track frontend action and send to backend
 */
async function trackFrontendAction(action, details = {}) {
    if (!currentCustomerId) return;
    
    try {
        // Enhanced console log
        const actionEmoji = getActionEmoji(action);
        console.log(`\n${actionEmoji} [CUSTOMER ${currentCustomerId}] ${action.toUpperCase()}`);
        console.log(`   Route: ${window.location.pathname}`);
        if (Object.keys(details).length > 0) {
            console.log(`   Details:`, details);
        }
        console.log(`   Timestamp: ${new Date().toISOString()}\n`);
        
        // Send to backend
        await fetch('/api/activities/track', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action,
                ...details,
                route: window.location.pathname,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        // Silently fail - tracking is non-critical
        console.error('Error tracking frontend action:', error);
    }
}

/**
 * Get emoji for action type
 */
function getActionEmoji(action) {
    const emojiMap = {
        'login': '🔐',
        'logout': '🚪',
        'signup': '📝',
        'booking_created': '✅',
        'booking_cancelled': '❌',
        'bus_search': '🔍',
        'seat_selection': '🪑',
        'route_navigation': '🧭',
        'api_call': '📡',
        'form_submission': '📋',
        'button_click': '🖱️',
        'page_view': '👁️',
        'error': '⚠️'
    };
    return emojiMap[action.toLowerCase()] || '📊';
}

/**
 * Initialize route tracking
 */
function initRouteTracker() {
    // Get customer ID from session
    fetch('/api/session', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.authenticated && data.user && data.user.userType === 'customer') {
                currentCustomerId = data.user.customerId || data.user.id;
                sessionStartTime = new Date().toISOString();
                
                // Track initial page load
                trackFrontendAction('page_view', {
                    page: window.location.pathname,
                    referrer: document.referrer
                });
            }
        })
        .catch(err => console.error('Error initializing route tracker:', err));
    
    // Track route changes (for SPA-like navigation)
    let lastRoute = window.location.pathname;
    const routeCheckInterval = setInterval(() => {
        if (window.location.pathname !== lastRoute) {
            lastRoute = window.location.pathname;
            trackFrontendAction('route_navigation', {
                route: lastRoute,
                referrer: document.referrer
            });
        }
    }, 100);
    
    // Track page visibility changes (when user switches tabs/windows)
    document.addEventListener('visibilitychange', () => {
        if (currentCustomerId) {
            trackFrontendAction('page_visibility_change', {
                hidden: document.hidden,
                route: window.location.pathname
            });
        }
    });
    
    // Track before page unload (logout or close)
    window.addEventListener('beforeunload', () => {
        if (currentCustomerId) {
            trackFrontendAction('page_unload', {
                route: window.location.pathname,
                sessionDuration: sessionStartTime ? 
                    Math.floor((Date.now() - new Date(sessionStartTime)) / 1000) : 0
            });
        }
    });
}

/**
 * Track button clicks
 */
function trackButtonClick(buttonId, buttonText, context = {}) {
    trackFrontendAction('button_click', {
        buttonId,
        buttonText,
        ...context
    });
}

/**
 * Track form submission
 */
function trackFormSubmission(formId, formData = {}) {
    // Sanitize form data
    const sanitized = { ...formData };
    delete sanitized.password;
    delete sanitized.confirmPassword;
    
    trackFrontendAction('form_submission', {
        formId,
        formData: sanitized
    });
}

/**
 * Track seat selection
 */
function trackSeatSelection(busId, selectedSeats) {
    trackFrontendAction('seat_selection', {
        busId,
        selectedSeats,
        seatCount: selectedSeats.length
    });
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRouteTracker);
} else {
    initRouteTracker();
}

// Export for use in other scripts
window.routeTracker = {
    trackAction: trackFrontendAction,
    trackButtonClick,
    trackFormSubmission,
    trackSeatSelection,
    setCustomerId: (id) => { currentCustomerId = id; }
};

