/**
 * JWT Token Management Utility for Frontend
 * Handles storing, retrieving, and sending JWT tokens
 * Uses sessionStorage instead of localStorage so each tab has its own tokens
 */

const JWT_STORAGE_KEY = 'jwt_access_token';
const REFRESH_STORAGE_KEY = 'jwt_refresh_token';

/**
 * Decode JWT token without verification (for debugging)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null
 */
function decodeTokenPayload(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
}

/**
 * Store JWT tokens
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 */
export function storeTokens(accessToken, refreshToken) {
    // Clear old tokens first to avoid any conflicts
    const oldToken = sessionStorage.getItem(JWT_STORAGE_KEY);
    if (oldToken) {
        const oldDecoded = decodeTokenPayload(oldToken);
        console.log('[TOKEN STORE] Clearing old token for:', oldDecoded ? {
            userId: oldDecoded.userId,
            userType: oldDecoded.userType,
            email: oldDecoded.email
        } : 'unknown');
    }
    
    if (accessToken) {
        // Debug: Log what we're storing
        const decoded = decodeTokenPayload(accessToken);
        if (decoded) {
            console.log('[TOKEN STORE] Storing NEW token for:', {
                userId: decoded.userId,
                userType: decoded.userType,
                email: decoded.email,
                fullName: decoded.fullName,
                tokenVersion: decoded.tokenVersion
            });
        } else {
            console.warn('[TOKEN STORE] Warning: Could not decode token before storing');
        }
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
export function getAccessToken() {
    const token = sessionStorage.getItem(JWT_STORAGE_KEY);
    // Debug: Log what we're retrieving
    if (token) {
        const decoded = decodeTokenPayload(token);
        if (decoded) {
            console.log('[TOKEN RETRIEVE] Retrieved token for:', {
                userId: decoded.userId,
                userType: decoded.userType,
                email: decoded.email,
                fullName: decoded.fullName,
                tokenVersion: decoded.tokenVersion
            });
        }
    }
    return token;
}

/**
 * Get refresh token from storage
 * @returns {string|null} Refresh token or null
 */
export function getRefreshToken() {
    return sessionStorage.getItem(REFRESH_STORAGE_KEY);
}

/**
 * Clear all tokens from storage
 */
export function clearTokens() {
    sessionStorage.removeItem(JWT_STORAGE_KEY);
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
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
    
    // Use environment variable for API URL in production, or '/api' for development
    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
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

