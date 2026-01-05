const jwt = require('jsonwebtoken');
const sessionManager = require('./sessionManager');

// JWT secret key (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'bus-booking-jwt-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'bus-booking-refresh-secret-key-change-in-production';

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '24h'; // 24 hours
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

/**
 * Generate access token (short-lived)
 * @param {Object} payload - User data to encode in token
 * @param {number} tokenVersion - Token version to include (optional, will be fetched if not provided)
 * @returns {string} JWT access token
 */
function generateAccessToken(payload, tokenVersion = null) {
    // Get token version if not provided
    if (tokenVersion === null) {
        tokenVersion = sessionManager.getTokenVersion(payload.userType, payload.userId);
    }
    
    const tokenPayload = {
        userId: payload.userId,
        userType: payload.userType,
        email: payload.email,
        fullName: payload.fullName,
        enterpriseName: payload.enterpriseName || null,
        type: 'access',
        tokenVersion: tokenVersion
    };
    
    return jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'bus-booking-system',
        audience: 'bus-booking-users'
    });
}

/**
 * Generate refresh token (long-lived)
 * @param {Object} payload - User data to encode in token
 * @param {number} tokenVersion - Token version to include (optional, will be fetched if not provided)
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(payload, tokenVersion = null) {
    // Get token version if not provided
    if (tokenVersion === null) {
        tokenVersion = sessionManager.getTokenVersion(payload.userType, payload.userId);
    }
    
    const tokenPayload = {
        userId: payload.userId,
        userType: payload.userType,
        type: 'refresh',
        tokenVersion: tokenVersion
    };
    
    return jwt.sign(tokenPayload, JWT_REFRESH_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        issuer: 'bus-booking-system',
        audience: 'bus-booking-users'
    });
}

/**
 * Verify access token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
function verifyAccessToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: 'bus-booking-system',
            audience: 'bus-booking-users'
        });
        
        if (decoded.type !== 'access') {
            return null; // Not an access token
        }
        
        // Check token version - if token version doesn't match current version, token is invalid
        if (decoded.userId && decoded.userType) {
            // If token doesn't have version, treat as invalid (old tokens from before versioning)
            if (decoded.tokenVersion === undefined) {
                return { invalid: true, error: 'Token version missing - please login again' };
            }
            
            const isValidVersion = sessionManager.isTokenVersionValid(
                decoded.userType,
                decoded.userId,
                decoded.tokenVersion
            );
            
            if (!isValidVersion) {
                return { invalid: true, error: 'Another user has logged in - please login again' };
            }
        }
        
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { expired: true, error: 'Token expired' };
        }
        if (error.name === 'JsonWebTokenError') {
            return { invalid: true, error: 'Invalid token' };
        }
        return null;
    }
}

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
function verifyRefreshToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
            issuer: 'bus-booking-system',
            audience: 'bus-booking-users'
        });
        
        if (decoded.type !== 'refresh') {
            return null; // Not a refresh token
        }
        
        // Check token version - if token version doesn't match current version, token is invalid
        if (decoded.userId && decoded.userType) {
            // If token doesn't have version, treat as invalid (old tokens from before versioning)
            if (decoded.tokenVersion === undefined) {
                return { invalid: true, error: 'Refresh token version missing - please login again' };
            }
            
            const isValidVersion = sessionManager.isTokenVersionValid(
                decoded.userType,
                decoded.userId,
                decoded.tokenVersion
            );
            
            if (!isValidVersion) {
                return { invalid: true, error: 'Another user has logged in - please login again' };
            }
        }
        
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { expired: true, error: 'Refresh token expired' };
        }
        if (error.name === 'JsonWebTokenError') {
            return { invalid: true, error: 'Invalid refresh token' };
        }
        return null;
    }
}

/**
 * Extract token from Authorization header
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null
 */
function extractTokenFromHeader(req) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return null;
    }
    
    // Support both "Bearer <token>" and just "<token>"
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    
    return authHeader;
}

/**
 * Extract token from cookie
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null
 */
function extractTokenFromCookie(req) {
    return req.cookies?.accessToken || req.cookies?.jwt || null;
}

/**
 * Get token from request (checks header first, then cookie)
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null
 */
function getTokenFromRequest(req) {
    // Check Authorization header first (preferred for API)
    const headerToken = extractTokenFromHeader(req);
    if (headerToken) {
        return headerToken;
    }
    
    // Fallback to cookie (for browser requests)
    return extractTokenFromCookie(req);
}

/**
 * Decode token without verification (for debugging)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null
 */
function decodeToken(token) {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    extractTokenFromHeader,
    extractTokenFromCookie,
    getTokenFromRequest,
    decodeToken,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY
};

