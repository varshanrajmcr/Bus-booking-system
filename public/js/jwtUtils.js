/**
 * JWT Token Management Utility for Frontend
 * Handles storing, retrieving, and sending JWT tokens
 * Uses sessionStorage instead of localStorage so each tab has its own tokens
 */

const JWT_STORAGE_KEY = 'jwt_access_token';
const REFRESH_STORAGE_KEY = 'jwt_refresh_token';

/**
 * Store JWT tokens
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 */
function storeTokens(accessToken, refreshToken) {
    if (accessToken) {
        sessionStorage.setItem(JWT_STORAGE_KEY, accessToken);
    }
    if (refreshToken) {
        sessionStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
    }
}

/**
 * Get access token from storage
 * @returns {string|null} Access token or null
 */
function getAccessToken() {
    return sessionStorage.getItem(JWT_STORAGE_KEY);
}

/**
 * Get refresh token from storage
 * @returns {string|null} Refresh token or null
 */
function getRefreshToken() {
    return sessionStorage.getItem(REFRESH_STORAGE_KEY);
}

/**
 * Clear all tokens from storage
 */
function clearTokens() {
    sessionStorage.removeItem(JWT_STORAGE_KEY);
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
}

/**
 * Check if user has a valid token
 * @returns {boolean} True if token exists
 */
function hasToken() {
    return !!getAccessToken();
}

/**
 * Refresh access token using refresh token
 * @returns {Promise<Object>} New tokens or error
 */
async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }
    
    try {
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ refreshToken })
        });
        
        const data = await response.json();
        
        if (response.ok && data.tokens) {
            storeTokens(data.tokens.accessToken, data.tokens.refreshToken);
            return data.tokens;
        } else {
            clearTokens();
            throw new Error(data.error || 'Failed to refresh token');
        }
    } catch (error) {
        clearTokens();
        throw error;
    }
}

/**
 * Make authenticated fetch request with automatic token refresh
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function authenticatedFetch(url, options = {}) {
    // Get access token
    const accessToken = getAccessToken();
    
    // Add Authorization header if token exists
    if (accessToken) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    // Ensure credentials are included
    options.credentials = options.credentials || 'include';
    
    // Make initial request
    let response = await fetch(url, options);
    
    // If token expired, try to refresh
    if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        
        if (errorData.expired || errorData.error === 'Token expired') {
            try {
                // Try to refresh token
                await refreshAccessToken();
                
                // Retry request with new token
                const newAccessToken = getAccessToken();
                if (newAccessToken) {
                    options.headers = options.headers || {};
                    options.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    response = await fetch(url, options);
                }
            } catch (refreshError) {
                // Refresh failed, clear tokens and redirect to login
                clearTokens();
                const userType = url.includes('/admin/') ? 'admin' : 'customer';
                window.location.href = `/${userType}/login.html?message=${encodeURIComponent('Session expired. Please login again.')}`;
                throw refreshError;
            }
        } else if (errorData.sessionTerminated) {
            // Session terminated by another login
            clearTokens();
            const userType = url.includes('/admin/') ? 'admin' : 'customer';
            window.location.href = `/${userType}/login.html?message=${encodeURIComponent(errorData.message || 'Another user has logged into this account. Please login again.')}`;
        }
    }
    
    return response;
}

/**
 * Decode JWT token (without verification - client-side only)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null
 */
function decodeToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        return null;
    }
}

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} True if expired
 */
function isTokenExpired(token) {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
        return true;
    }
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
}

/**
 * Get token expiration time
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null
 */
function getTokenExpiration(token) {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
        return null;
    }
    return new Date(decoded.exp * 1000);
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        storeTokens,
        getAccessToken,
        getRefreshToken,
        clearTokens,
        hasToken,
        refreshAccessToken,
        authenticatedFetch,
        decodeToken,
        isTokenExpired,
        getTokenExpiration
    };
}

