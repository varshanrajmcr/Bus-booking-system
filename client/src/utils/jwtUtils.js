/**
 * JWT Token Management Utility for Frontend
 * Handles storing, retrieving, and sending JWT tokens
 */

const JWT_STORAGE_KEY = 'jwt_access_token';
const REFRESH_STORAGE_KEY = 'jwt_refresh_token';

/**
 * Store JWT tokens
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 */
export function storeTokens(accessToken, refreshToken) {
    if (accessToken) {
        localStorage.setItem(JWT_STORAGE_KEY, accessToken);
    }
    if (refreshToken) {
        localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
    }
}

/**
 * Get access token from storage
 * @returns {string|null} Access token or null
 */
export function getAccessToken() {
    return localStorage.getItem(JWT_STORAGE_KEY);
}

/**
 * Get refresh token from storage
 * @returns {string|null} Refresh token or null
 */
export function getRefreshToken() {
    return localStorage.getItem(REFRESH_STORAGE_KEY);
}

/**
 * Clear all tokens from storage
 */
export function clearTokens() {
    localStorage.removeItem(JWT_STORAGE_KEY);
    localStorage.removeItem(REFRESH_STORAGE_KEY);
}

/**
 * Check if user has a valid token
 * @returns {boolean} True if token exists
 */
export function hasToken() {
    return !!getAccessToken();
}

/**
 * Refresh access token using refresh token
 * @returns {Promise<Object>} New tokens or error
 */
export async function refreshAccessToken() {
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

