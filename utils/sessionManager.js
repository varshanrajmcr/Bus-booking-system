// Session Manager for single-session-per-account
// Tracks active sessions and manages session invalidation

// Map: userId -> currentSessionToken
// Format: "userType:userId" -> token
const activeSessions = new Map();

// Map: userId -> currentTokenVersion
// Format: "userType:userId" -> version number
// Used to invalidate old JWT tokens when a new login occurs
const tokenVersions = new Map();

// Map: userType -> userId
// Format: "userType" -> userId
// Tracks browser-wide active sessions (only one customer and one admin per browser)
const activeBrowserSessions = new Map();

// Generate a unique session token
function generateSessionToken() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Get session key for a user
function getSessionKey(userType, userId) {
    return `${userType}:${userId}`;
}

// Set active session for a user (invalidates old sessions)
function setActiveSession(userType, userId) {
    const key = getSessionKey(userType, userId);
    const token = generateSessionToken();
    activeSessions.set(key, token);
    console.log(`Active session set for ${key}, token: ${token}`);
    return token;
}

// Get current session token for a user
function getActiveSessionToken(userType, userId) {
    const key = getSessionKey(userType, userId);
    return activeSessions.get(key);
}

// Check if a session token is valid
function isSessionValid(userType, userId, sessionToken) {
    const currentToken = getActiveSessionToken(userType, userId);
    return currentToken === sessionToken;
}

// Remove active session (on logout)
function removeActiveSession(userType, userId) {
    const key = getSessionKey(userType, userId);
    activeSessions.delete(key);
    console.log(`Active session removed for ${key}`);
}

// Terminate all sessions for a user (called when new login happens)
function terminateUserSessions(userType, userId) {
    const key = getSessionKey(userType, userId);
    const oldToken = activeSessions.get(key);
    if (oldToken) {
        console.log(`Terminating old session for ${key}, old token: ${oldToken}`);
    }
    // The new token will be set by setActiveSession
    // Increment token version to invalidate old JWT tokens
    incrementTokenVersion(userType, userId);
}

// Get current token version for a user
function getTokenVersion(userType, userId) {
    const key = getSessionKey(userType, userId);
    return tokenVersions.get(key) || 1; // Default to 1 if not set
}

// Increment token version (invalidates all previous JWT tokens)
function incrementTokenVersion(userType, userId) {
    const key = getSessionKey(userType, userId);
    const currentVersion = getTokenVersion(userType, userId);
    const newVersion = currentVersion + 1;
    tokenVersions.set(key, newVersion);
    console.log(`Token version incremented for ${key}, new version: ${newVersion}`);
    return newVersion;
}

// Check if a token version is valid
function isTokenVersionValid(userType, userId, tokenVersion) {
    const key = getSessionKey(userType, userId);
    // If token version doesn't exist in map, token is invalid (user logged out or never logged in)
    if (!tokenVersions.has(key)) {
        return false;
    }
    const currentVersion = tokenVersions.get(key);
    return tokenVersion === currentVersion;
}

// Remove token version (on logout)
function removeTokenVersion(userType, userId) {
    const key = getSessionKey(userType, userId);
    tokenVersions.delete(key);
    console.log(`Token version removed for ${key}`);
}

// Get active browser session for a userType (only one per type allowed)
function getActiveBrowserSession(userType) {
    return activeBrowserSessions.get(userType);
}

// Set active browser session (invalidates previous session of same type)
function setActiveBrowserSession(userType, userId) {
    const previousUserId = activeBrowserSessions.get(userType);
    if (previousUserId && previousUserId !== userId) {
        // Invalidate previous user's session
        console.log(`Invalidating previous ${userType} session for userId: ${previousUserId}`);
        terminateUserSessions(userType, previousUserId);
    }
    activeBrowserSessions.set(userType, userId);
    console.log(`Active browser session set: ${userType} -> ${userId}`);
}

// Clear active browser session (on logout)
function clearActiveBrowserSession(userType) {
    const userId = activeBrowserSessions.get(userType);
    activeBrowserSessions.delete(userType);
    console.log(`Active browser session cleared for ${userType}${userId ? ` (userId: ${userId})` : ''}`);
}

module.exports = {
    setActiveSession,
    getActiveSessionToken,
    isSessionValid,
    removeActiveSession,
    terminateUserSessions,
    generateSessionToken,
    getTokenVersion,
    incrementTokenVersion,
    isTokenVersionValid,
    removeTokenVersion,
    getActiveBrowserSession,
    setActiveBrowserSession,
    clearActiveBrowserSession
};

