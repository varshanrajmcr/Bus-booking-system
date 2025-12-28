/**
 * Frontend Route Tracker for React
 * Tracks all page navigation and user interactions for customers
 */

let currentCustomerId = null;
let sessionStartTime = null;
let offlineStartTime = null;
let offlineRoute = null;
let isOffline = false;
let lastOnlineRoute = null;
let justCameOnline = false; // Flag to track if user just came back online
let savedOfflineRouteForTracking = null; // Store offline route for navigation tracking after coming online

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
        'error': '⚠️',
        'user_offline': '📴',
        'user_online': '📶'
    };
    return emojiMap[action.toLowerCase()] || '📊';
}

/**
 * Track user going offline
 */
function trackUserOffline() {
    if (!currentCustomerId) return;
    
    isOffline = true;
    offlineStartTime = new Date().toISOString();
    offlineRoute = window.location.pathname;
    lastOnlineRoute = offlineRoute;
    
    // Get current context (form data, selected seats, etc.)
    const context = {
        route: offlineRoute,
        timestamp: offlineStartTime,
        userAgent: navigator.userAgent,
        // Try to capture any form data or state
        formData: getCurrentFormData(),
        selectedSeats: getSelectedSeats(),
        bookingData: getBookingData()
    };
    
    trackFrontendAction('user_offline', {
        ...context,
        message: `User went offline at ${offlineRoute}`
    });
}

/**
 * Track user coming back online
 */
function trackUserOnline() {
    if (!currentCustomerId) return;
    
    // If we weren't tracking offline, still track coming online (might have missed offline event)
    if (!isOffline && !offlineStartTime) {
        // User came online but we didn't track them going offline
        // This can happen if they were offline before page load
        trackFrontendAction('user_online', {
            route: window.location.pathname,
            timestamp: new Date().toISOString(),
            message: 'User is now online (was offline before tracking started)'
        });
        return;
    }
    
    const onlineTime = new Date().toISOString();
    const currentRoute = window.location.pathname;
    const savedOfflineRoute = offlineRoute; // Save before resetting
    const offlineDuration = offlineStartTime ? 
        Math.floor((Date.now() - new Date(offlineStartTime)) / 1000) : 0;
    
    const context = {
        offlineRoute: savedOfflineRoute,
        onlineRoute: currentRoute,
        offlineDuration: offlineDuration,
        routeChanged: savedOfflineRoute !== currentRoute,
        timestamp: onlineTime,
        userAgent: navigator.userAgent,
        // Capture current context when coming back online
        formData: getCurrentFormData(),
        selectedSeats: getSelectedSeats(),
        bookingData: getBookingData()
    };
    
    trackFrontendAction('user_online', {
        ...context,
        message: `User came back online after ${offlineDuration}s. Was at ${savedOfflineRoute}, now at ${currentRoute}`
    });
    
    // Set flag that user just came online (for next navigation tracking)
    justCameOnline = true;
    savedOfflineRouteForTracking = savedOfflineRoute; // Save for navigation tracking
    
    // Reset offline state
    isOffline = false;
    offlineStartTime = null;
    offlineRoute = null;
    
    // Clear the flag after a short delay (in case user navigates immediately)
    setTimeout(() => {
        justCameOnline = false;
        savedOfflineRouteForTracking = null;
    }, 5000);
}

/**
 * Get current form data from the page (if any)
 */
function getCurrentFormData() {
    try {
        const forms = document.querySelectorAll('form');
        const formData = {};
        
        forms.forEach((form, index) => {
            const formId = form.id || `form_${index}`;
            const inputs = form.querySelectorAll('input, select, textarea');
            const data = {};
            
            inputs.forEach(input => {
                if (input.type !== 'password' && input.name) {
                    data[input.name] = input.value || '';
                }
            });
            
            if (Object.keys(data).length > 0) {
                formData[formId] = data;
            }
        });
        
        return Object.keys(formData).length > 0 ? formData : null;
    } catch (error) {
        return null;
    }
}

/**
 * Get selected seats (if on booking page)
 */
function getSelectedSeats() {
    try {
        const selectedSeats = document.querySelectorAll('.seat.selected');
        if (selectedSeats.length > 0) {
            return Array.from(selectedSeats).map(seat => {
                return {
                    seatNumber: seat.textContent.trim(),
                    seatType: seat.classList.contains('sleeper') ? 'sleeper' : 'seater'
                };
            });
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Get booking data from localStorage (if available)
 */
function getBookingData() {
    try {
        const bookingData = localStorage.getItem('bookingData');
        if (bookingData) {
            const parsed = JSON.parse(bookingData);
            // Don't include sensitive data
            return {
                busId: parsed.busId,
                date: parsed.date,
                passengers: parsed.passengers
            };
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Initialize route tracking
 */
export async function initRouteTracker() {
    try {
        // Get customer ID from session
        const response = await fetch('/api/session?type=customer', { credentials: 'include' });
        const data = await response.json();
        
        if (data.authenticated && data.user && data.user.userType === 'customer') {
            currentCustomerId = data.user.customerId || data.user.id;
            sessionStartTime = new Date().toISOString();
            lastOnlineRoute = window.location.pathname;
            
            // Track initial page load
            trackFrontendAction('page_view', {
                page: window.location.pathname,
                referrer: document.referrer
            });
            
            // Set up online/offline tracking
            setupOnlineOfflineTracking();
        }
    } catch (err) {
        console.error('Error initializing route tracker:', err);
    }
}

/**
 * Set up online/offline event listeners
 */
function setupOnlineOfflineTracking() {
    // Check initial online status
    if (!navigator.onLine && currentCustomerId) {
        trackUserOffline();
    }
    
    // Listen for offline event
    window.addEventListener('offline', () => {
        if (currentCustomerId) {
            trackUserOffline();
        }
    });
    
    // Listen for online event
    window.addEventListener('online', () => {
        if (currentCustomerId) {
            // Small delay to ensure network is actually available
            setTimeout(() => {
                trackUserOnline();
            }, 500);
        }
    });
    
    // Also use visibility API as a fallback
    document.addEventListener('visibilitychange', () => {
        if (currentCustomerId) {
            if (document.hidden) {
                // User switched tabs/windows - track as potential offline
                trackFrontendAction('page_visibility_change', {
                    hidden: true,
                    route: window.location.pathname,
                    timestamp: new Date().toISOString()
                });
            } else {
                // User came back - check if we're online
                if (navigator.onLine && isOffline) {
                    trackUserOnline();
                }
            }
        }
    });
}

/**
 * Track route changes (for React Router)
 */
export function trackRouteChange(route) {
    if (currentCustomerId) {
        // Check if user just came back online and navigated
        const navigatedAfterComingOnline = justCameOnline;
        const wasOffline = isOffline;
        const savedOfflineRoute = savedOfflineRouteForTracking || offlineRoute;
        
        trackFrontendAction('route_navigation', {
            route: route,
            referrer: document.referrer,
            wasOffline: wasOffline,
            offlineRoute: savedOfflineRoute,
            navigatedAfterComingOnline: navigatedAfterComingOnline,
            routeChangedAfterOffline: navigatedAfterComingOnline && savedOfflineRoute && savedOfflineRoute !== route
        });
        
        // Update the last online route
        lastOnlineRoute = route;
        
        // Clear the just came online flag if user navigated
        if (navigatedAfterComingOnline) {
            justCameOnline = false;
            savedOfflineRouteForTracking = null;
        }
    }
}

/**
 * Track button clicks
 */
export function trackButtonClick(buttonId, buttonText, context = {}) {
    trackFrontendAction('button_click', {
        buttonId,
        buttonText,
        ...context
    });
}

/**
 * Track form submission
 */
export function trackFormSubmission(formId, formData = {}) {
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
export function trackSeatSelection(busId, selectedSeats) {
    trackFrontendAction('seat_selection', {
        busId,
        selectedSeats,
        seatCount: selectedSeats.length
    });
}

/**
 * Set customer ID manually (useful after login)
 */
export function setCustomerId(id) {
    currentCustomerId = id;
    sessionStartTime = new Date().toISOString();
}

/**
 * Track page visibility changes
 */
export function trackVisibilityChange() {
    if (currentCustomerId) {
        trackFrontendAction('page_visibility_change', {
            hidden: document.hidden,
            route: window.location.pathname
        });
    }
}

/**
 * Track page unload
 */
export function trackPageUnload() {
    if (currentCustomerId) {
        trackFrontendAction('page_unload', {
            route: window.location.pathname,
            sessionDuration: sessionStartTime ? 
                Math.floor((Date.now() - new Date(sessionStartTime)) / 1000) : 0
        });
    }
}

/**
 * Get current offline status
 */
export function getOfflineStatus() {
    return {
        isOffline,
        offlineStartTime,
        offlineRoute,
        lastOnlineRoute
    };
}

// Export default object for convenience
export default {
    trackAction: trackFrontendAction,
    trackButtonClick,
    trackFormSubmission,
    trackSeatSelection,
    trackRouteChange,
    setCustomerId,
    initRouteTracker,
    trackVisibilityChange,
    trackPageUnload,
    getOfflineStatus
};

