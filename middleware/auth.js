// Authentication middleware to protect routes
const { adminStore, customerStore } = require('../utils/dataStore');
const { getTokenFromRequest, verifyAccessToken } = require('../utils/jwtHelper');

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
};

// Middleware to check if user is a customer
const requireCustomer = async (req, res, next) => {
    // First, try to authenticate via JWT token
    const token = getTokenFromRequest(req);
    if (token) {
        const decoded = verifyAccessToken(token);
        if (decoded && !decoded.expired && !decoded.invalid) {
            if (decoded.userType === 'customer') {
                // Set user info from JWT token
                req.user = {
                    userId: decoded.userId,
                    userType: decoded.userType,
                    email: decoded.email,
                    fullName: decoded.fullName
                };
                // Also set session for backward compatibility
                if (!req.session) {
                    req.session = {};
                }
                req.session.userId = decoded.userId;
                req.session.userType = decoded.userType;
                req.session.email = decoded.email;
                req.session.fullName = decoded.fullName;
                return next();
            } else {
                return res.status(403).json({ error: 'Customer access required' });
            }
        } else if (decoded && decoded.expired) {
            return res.status(401).json({ 
                error: 'Token expired',
                expired: true,
                message: 'Please refresh your token or login again'
            });
        }
    }
    
    // Fallback to session-based authentication
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Always verify userType from database if it's not 'customer' or missing
    // This handles cases where user logged in as admin then as customer (or vice versa)
    if (!req.session.userType || req.session.userType !== 'customer') {
        try {
            // Check customer first
            const customer = await customerStore.findById(req.session.userId);
            if (customer) {
                req.session.userType = 'customer';
                req.session.email = customer.email;
                req.session.fullName = customer.fullName;
                // Wait for session save to complete before proceeding
                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) {
                            console.error('Error saving session:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
                return next();
            }
            
            // Check admin
            const admin = await adminStore.findById(req.session.userId);
            if (admin) {
                req.session.userType = 'admin';
                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) {
                            console.error('Error saving session:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
                return res.status(403).json({ error: 'Customer access required' });
            }
            
            return res.status(401).json({ error: 'User not found' });
        } catch (error) {
            console.error('Error checking user type:', error);
            // If it's a database error, don't immediately fail - might be temporary
            // Check if userType was set by server.js middleware (which runs before this)
            if (req.session.userType === 'customer') {
                // Trust the session if it was set by previous middleware
                console.log('requireCustomer: Database error but userType is customer in session, allowing access');
                return next();
            }
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    // userType is 'customer', allow access
    return next();
};

// Middleware to check if user is an admin
const requireAdmin = async (req, res, next) => {
    // First, try to authenticate via JWT token
    const token = getTokenFromRequest(req);
    if (token) {
        const decoded = verifyAccessToken(token);
        if (decoded && !decoded.expired && !decoded.invalid) {
            if (decoded.userType === 'admin') {
                // Set user info from JWT token
                req.user = {
                    userId: decoded.userId,
                    userType: decoded.userType,
                    email: decoded.email,
                    fullName: decoded.fullName,
                    enterpriseName: decoded.enterpriseName
                };
                // Also set session for backward compatibility
                if (!req.session) {
                    req.session = {};
                }
                req.session.userId = decoded.userId;
                req.session.userType = decoded.userType;
                req.session.email = decoded.email;
                req.session.fullName = decoded.fullName;
                req.session.enterpriseName = decoded.enterpriseName;
                return next();
            } else {
                return res.status(403).json({ error: 'Admin access required' });
            }
        } else if (decoded && decoded.expired) {
            return res.status(401).json({ 
                error: 'Token expired',
                expired: true,
                message: 'Please refresh your token or login again'
            });
        }
    }
    
    // Fallback to session-based authentication
    if (!req.session || !req.session.userId) {
        console.log('requireAdmin: No session or userId');
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Always verify userType from database if it's not 'admin' or missing
    // This handles cases where user logged in as customer then as admin (or vice versa)
    if (!req.session.userType || req.session.userType !== 'admin') {
        console.log('requireAdmin: userType is missing or not admin, checking database for userId:', req.session.userId);
        try {
            // Check admin first
            const admin = await adminStore.findById(req.session.userId);
            if (admin) {
                req.session.userType = 'admin';
                req.session.email = admin.email;
                req.session.fullName = admin.fullName;
                req.session.enterpriseName = admin.enterpriseName;
                // Wait for session save to complete before proceeding
                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) {
                            console.error('Error saving session:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
                console.log('requireAdmin: Admin found and session updated');
                return next();
            }
            
            // Check customer
            const customer = await customerStore.findById(req.session.userId);
            if (customer) {
                req.session.userType = 'customer';
                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) {
                            console.error('Error saving session:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
                console.log('requireAdmin: Customer found, denying admin access');
                return res.status(403).json({ error: 'Admin access required' });
            }
            
            console.log('requireAdmin: User not found in database');
            return res.status(401).json({ error: 'User not found' });
        } catch (error) {
            console.error('Error checking user type:', error);
            // If it's a database error, don't immediately fail - might be temporary
            // Check if userType was set by server.js middleware (which runs before this)
            if (req.session.userType === 'admin') {
                // Trust the session if it was set by previous middleware
                console.log('requireAdmin: Database error but userType is admin in session, allowing access');
                return next();
            }
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    // userType is 'admin', allow access
    return next();
};

module.exports = {
    requireAuth,
    requireCustomer,
    requireAdmin
};

