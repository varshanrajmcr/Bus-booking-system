/**
 * Browser Session Manager
 * Tracks browser-wide active sessions using localStorage
 * Ensures only one customer and one admin can be logged in per browser
 */

const ACTIVE_CUSTOMER_KEY = 'active_customer_session';
const ACTIVE_ADMIN_KEY = 'active_admin_session';
const EXPLICIT_LOGOUT_KEY = 'explicit_logout';

/**
 * Set active customer session in browser
 * @param {number|string} userId - Customer ID
 */
export function setActiveCustomerSession(userId) {
    localStorage.setItem(ACTIVE_CUSTOMER_KEY, userId.toString());
    localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
    console.log('[BrowserSession] Active customer session set:', userId);
}

/**
 * Set active admin session in browser
 * @param {number|string} userId - Admin ID
 */
export function setActiveAdminSession(userId) {
    localStorage.setItem(ACTIVE_ADMIN_KEY, userId.toString());
    localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
    console.log('[BrowserSession] Active admin session set:', userId);
}

/**
 * Get active customer session
 * @returns {string|null} Customer ID or null
 */
export function getActiveCustomerSession() {
    return localStorage.getItem(ACTIVE_CUSTOMER_KEY);
}

/**
 * Get active admin session
 * @returns {string|null} Admin ID or null
 */
export function getActiveAdminSession() {
    return localStorage.getItem(ACTIVE_ADMIN_KEY);
}

/**
 * Clear active customer session
 */
export function clearActiveCustomerSession() {
    localStorage.removeItem(ACTIVE_CUSTOMER_KEY);
    console.log('[BrowserSession] Active customer session cleared');
}

/**
 * Clear active admin session
 */
export function clearActiveAdminSession() {
    localStorage.removeItem(ACTIVE_ADMIN_KEY);
    console.log('[BrowserSession] Active admin session cleared');
}

/**
 * Set explicit logout flag (user clicked logout)
 * @param {string} userType - 'customer' or 'admin'
 */
export function setExplicitLogout(userType) {
    localStorage.setItem(EXPLICIT_LOGOUT_KEY, userType);
    if (userType === 'customer') {
        clearActiveCustomerSession();
    } else if (userType === 'admin') {
        clearActiveAdminSession();
    }
    console.log('[BrowserSession] Explicit logout set for:', userType);
}

/**
 * Check if explicit logout was performed
 * @param {string} userType - 'customer' or 'admin'
 * @returns {boolean} True if explicit logout was performed
 */
export function isExplicitLogout(userType) {
    return localStorage.getItem(EXPLICIT_LOGOUT_KEY) === userType;
}

/**
 * Clear explicit logout flag
 */
export function clearExplicitLogout() {
    localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
    console.log('[BrowserSession] Explicit logout flag cleared');
}

