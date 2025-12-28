// Session Manager for single-session-per-account
// Tracks active sessions and manages session invalidation

// Map: userId -> currentSessionToken
// Format: "userType:userId" -> token
const activeSessions = new Map();

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
}

module.exports = {
    setActiveSession,
    getActiveSessionToken,
    isSessionValid,
    removeActiveSession,
    terminateUserSessions,
    generateSessionToken
};

