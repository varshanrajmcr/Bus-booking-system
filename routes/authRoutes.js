const { body } = require('express-validator');
const { customerStore, adminStore, enterpriseStore } = require('../utils/dataStore');
const { handleValidationErrors } = require('../utils/validationHelper');
const sessionManager = require('../utils/sessionManager');
const { generateAccessToken, generateRefreshToken, getTokenFromRequest, verifyAccessToken } = require('../utils/jwtHelper');
const {logLogout, logAdminLogin, logAdminLogout } = require('../utils/customerLogger');

// Admin registration key (in production, store this securely)
const ADMIN_KEY = 'ADMIN123';

// ========== VALIDATORS ==========

const customerSignupValidators = [
    body('fullName')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone is required')
        .matches(/^[0-9]{10}$/).withMessage('Phone must be exactly 10 digits'),
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/\d/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage('Password must contain at least one special character'),
    body('confirmPassword')
        .notEmpty().withMessage('Confirm password is required')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
    }
            return true;
        }),
    handleValidationErrors
];

const customerLoginValidators = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required'),
    handleValidationErrors
];

const adminSignupValidators = [
    body('fullName')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone is required')
        .matches(/^[0-9]{10}$/).withMessage('Phone must be exactly 10 digits'),
    body('adminKey')
        .trim()
        .notEmpty().withMessage('Admin key is required')
        .custom((value) => {
            if (value !== ADMIN_KEY) {
                throw new Error('Invalid admin key');
            }
            return true;
        }),
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/\d/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage('Password must contain at least one special character'),
    body('confirmPassword')
        .notEmpty().withMessage('Confirm password is required')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),
    body('enterpriseName')
        .trim()
        .notEmpty().withMessage('Enterprise name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Enterprise name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s-]+$/).withMessage('Enterprise name must contain only letters, spaces, and hyphens'),
    handleValidationErrors
];

const adminLoginValidators = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required'),
    handleValidationErrors
];

// ========== HANDLERS ==========

const customerSignupHandler = async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
    
    // Check if customer already exists by email
        const existingCustomer = await customerStore.findByEmail(email.toLowerCase());
    if (existingCustomer) {
        return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Check if phone number already exists
    const existingCustomerByPhone = await customerStore.findByPhone(phone.trim());
    if (existingCustomerByPhone) {
        return res.status(400).json({ error: 'Phone number already registered' });
    }
    
    // Create new customer
    const newCustomer = {
            fullName: fullName.trim(),
        email: email.toLowerCase(),
            phone: phone.trim(),
        password, // In production, hash this password
        userType: 'customer'
    };
    
        const savedCustomer = await customerStore.add(newCustomer);
    
        res.status(201).json({
        message: 'Customer account created successfully',
        user: {
                customerId: savedCustomer.customerId,
            fullName: savedCustomer.fullName,
            email: savedCustomer.email,
            userType: savedCustomer.userType
        }
    });
    } catch (error) {
        console.error('Error in customerSignupHandler:', error);
        // Provide more detailed error message
        if (error.name === 'SequelizeUniqueConstraintError') {
            if (error.errors && error.errors.length > 0) {
                const field = error.errors[0].path;
                if (field === 'email') {
                    return res.status(400).json({ error: 'Email already registered' });
                } else if (field === 'phone') {
                    return res.status(400).json({ error: 'Phone number already registered' });
    }
            }
            return res.status(400).json({ error: 'A customer with this information already exists' });
        }
        if (error.name === 'SequelizeValidationError') {
            const validationErrors = error.errors.map(e => e.message).join(', ');
            return res.status(400).json({ error: `Validation error: ${validationErrors}` });
        }
        res.status(500).json({ error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
};

const customerLoginHandler = async (req, res) => {
    try {
        const { email, password } = req.body;
    
        // Find customer from database
        const customer = await customerStore.findByEmail(email.toLowerCase());
    
    if (!customer || customer.password !== password) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    
        // Verify we have the correct customer data
        const customerIdValue = parseInt(customer.customerId || customer.id);
        console.log(`[LOGIN] Customer login attempt - Email: ${email}, Found Customer ID: ${customerIdValue}, Name: ${customer.fullName}`);
        
        // Always invalidate any previous customer session to ensure single-session-per-browser
        // This handles cases where:
        // 1. Another customer was logged in (different userId)
        // 2. Same customer logged in again (re-login)
        // 3. Previous customer logged out but tokens still exist in other tabs
        const activeCustomerId = sessionManager.getActiveBrowserSession('customer');
        if (activeCustomerId) {
            if (activeCustomerId !== customerIdValue) {
                // Different customer is logged in - invalidate their session
                console.log(`[LOGIN] Another customer (${activeCustomerId}) is logged in. Invalidating their session.`);
                sessionManager.terminateUserSessions('customer', activeCustomerId);
            } else {
                // Same customer is already logged in - invalidate their existing session first
                console.log(`[LOGIN] Same customer (${customerIdValue}) is already logged in. Invalidating existing session.`);
                sessionManager.terminateUserSessions('customer', customerIdValue);
            }
        } else {
            // No active browser session tracked, but there might be tokens in other tabs
            // from a previous customer who logged out. We still need to ensure this new login
            // gets a fresh token version by incrementing it.
            console.log(`[LOGIN] No active customer session tracked, invalidating any existing tokens for customer ${customerIdValue}`);
            sessionManager.terminateUserSessions('customer', customerIdValue);
        }
        
        // Set this customer as active browser session
        sessionManager.setActiveBrowserSession('customer', customerIdValue);
        
        // Generate new session token
        const sessionToken = sessionManager.setActiveSession('customer', customerIdValue);
        
        // Get current token version (after increment from terminateUserSessions)
        const tokenVersion = sessionManager.getTokenVersion('customer', customerIdValue);
        
        // Generate JWT tokens with current token version
        const accessToken = generateAccessToken({
            userId: customerIdValue,
            userType: 'customer',
            email: customer.email,
            fullName: customer.fullName
        }, tokenVersion);
        
        const refreshToken = generateRefreshToken({
            userId: customerIdValue,
            userType: 'customer'
        }, tokenVersion);
        
        // Debug logging to verify correct customer data
        console.log(`[LOGIN] Customer login - ID: ${customerIdValue}, Email: ${customer.email}, FullName: ${customer.fullName}`);
        console.log(`[LOGIN] Generated tokens for customerId: ${customerIdValue}`);
        
        // Create/update session - ensure userId is an integer for consistent comparison
        req.session.userId = customerIdValue;
    req.session.userType = 'customer';
    req.session.email = customer.email;
    req.session.fullName = customer.fullName;
        req.session.sessionToken = sessionToken; // Store token in session
        
        // Save session explicitly to ensure it's persisted to PostgreSQL
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Failed to create session' });
            }
    
            // JWT tokens are stored in sessionStorage on frontend (not in cookies)
            // Tokens are sent via Authorization header
    
    res.json({
        message: 'Login successful',
        user: {
                    customerId: customerIdValue,
            fullName: customer.fullName,
            email: customer.email,
            userType: customer.userType
                },
                tokens: {
                    accessToken,
                    refreshToken
                }
            });
        });
    } catch (error) {
        console.error('Error in customerLoginHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const adminSignupHandler = async (req, res) => {
    try {
        const { fullName, email, phone, password, enterpriseName } = req.body;
    
    // Check if admin already exists
        const existingAdmin = await adminStore.findByEmail(email.toLowerCase());
    if (existingAdmin) {
        return res.status(400).json({ error: 'Email already registered' });
    }
        
        // Check if enterprise name already exists
        const existingEnterprise = await enterpriseStore.findByName(enterpriseName.trim());
        if (existingEnterprise) {
            return res.status(400).json({ error: 'Enterprise name already exists' });
    }
    
    // Create new admin
    const newAdmin = {
            fullName: fullName.trim(),
        email: email.toLowerCase(),
            phone: phone.trim(),
        password, // In production, hash this password
            userType: 'admin',
            enterpriseName: enterpriseName.trim()
    };
    
        const savedAdmin = await adminStore.add(newAdmin);
        
        // Create enterprise
        const newEnterprise = {
            enterpriseName: enterpriseName.trim(),
            adminId: savedAdmin.adminId,
            busCount: 0
        };
        await enterpriseStore.add(newEnterprise);
    
    res.status(201).json({
        message: 'Admin account created successfully',
        user: {
                adminId: savedAdmin.adminId,
            fullName: savedAdmin.fullName,
            email: savedAdmin.email,
                userType: savedAdmin.userType,
                enterpriseName: savedAdmin.enterpriseName
            }
        });
    } catch (error) {
        console.error('Error in adminSignupHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const adminLoginHandler = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find admin from database
        const admin = await adminStore.findByEmail(email.toLowerCase());
    
    if (!admin || admin.password !== password) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    
        const adminIdValue = parseInt(admin.adminId || admin.id);
        console.log(`[LOGIN] Admin login attempt - Email: ${email}, Found Admin ID: ${adminIdValue}, Name: ${admin.fullName}`);
        
        // Always invalidate any previous admin session to ensure single-session-per-browser
        // This handles cases where:
        // 1. Another admin was logged in (different userId)
        // 2. Same admin logged in again (re-login)
        // 3. Previous admin logged out but tokens still exist in other tabs
        const activeAdminId = sessionManager.getActiveBrowserSession('admin');
        if (activeAdminId) {
            if (activeAdminId !== adminIdValue) {
                // Different admin is logged in - invalidate their session
                console.log(`[LOGIN] Another admin (${activeAdminId}) is logged in. Invalidating their session.`);
                sessionManager.terminateUserSessions('admin', activeAdminId);
            } else {
                // Same admin is already logged in - invalidate their existing session first
                console.log(`[LOGIN] Same admin (${adminIdValue}) is already logged in. Invalidating existing session.`);
                sessionManager.terminateUserSessions('admin', adminIdValue);
            }
        } else {
            // No active browser session tracked, but there might be tokens in other tabs
            // from a previous admin who logged out. We still need to ensure this new login
            // gets a fresh token version by incrementing it.
            console.log(`[LOGIN] No active admin session tracked, invalidating any existing tokens for admin ${adminIdValue}`);
            sessionManager.terminateUserSessions('admin', adminIdValue);
        }
        
        // Set this admin as active browser session
        sessionManager.setActiveBrowserSession('admin', adminIdValue);
        
        // Generate new session token
        const sessionToken = sessionManager.setActiveSession('admin', adminIdValue);
        
        // Get current token version (after increment from terminateUserSessions)
        const tokenVersion = sessionManager.getTokenVersion('admin', adminIdValue);
        
        // Generate JWT tokens with current token version
        const accessToken = generateAccessToken({
            userId: adminIdValue,
            userType: 'admin',
            email: admin.email,
            fullName: admin.fullName,
            enterpriseName: admin.enterpriseName
        }, tokenVersion);
        
        const refreshToken = generateRefreshToken({
            userId: adminIdValue,
            userType: 'admin'
        }, tokenVersion);
    
        // Create session - ensure userId is an integer for consistent comparison
        req.session.userId = adminIdValue;
    req.session.userType = 'admin';
    req.session.email = admin.email;
    req.session.fullName = admin.fullName;
        req.session.enterpriseName = admin.enterpriseName;
        req.session.sessionToken = sessionToken; // Store token in session
        
        // Save session explicitly to ensure it's persisted to PostgreSQL
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Failed to create session' });
            }
    
            // JWT tokens are stored in sessionStorage on frontend (not in cookies)
            // Tokens are sent via Authorization header
            
            // Log admin login
            logAdminLogin(adminIdValue, admin.email, req);
            
            res.json({
                message: 'Login successful',
                user: {
                    adminId: adminIdValue,
                    fullName: admin.fullName,
                    email: admin.email,
                    userType: admin.userType,
                    enterpriseName: admin.enterpriseName
                },
                tokens: {
                    accessToken,
                    refreshToken
                }
            });
});
    } catch (error) {
        console.error('Error in adminLoginHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getSessionHandler = async (req, res) => {
    try {
        // Determine expected user type from query parameter, referrer, or path
        const expectedUserType = req.query.type || 
                                (req.get('referer') && req.get('referer').includes('/admin') ? 'admin' : null) ||
                                (req.get('referer') && req.get('referer').includes('/customer') ? 'customer' : null) ||
                                (req.path && req.path.includes('/admin') ? 'admin' : null) ||
                                (req.path && req.path.includes('/customer') ? 'customer' : null);
        
        // First, check JWT token if present (takes precedence over session)
        const jwtToken = getTokenFromRequest(req);
        
        if (jwtToken) {
            const decoded = verifyAccessToken(jwtToken);
            
            // If JWT token is invalid or version mismatch, session is terminated
            if (decoded && decoded.invalid) {
                // Clear session and tokens
                if (req.session) {
                    req.session.destroy();
                }
                res.clearCookie('connect.sid');
                return res.json({
                    authenticated: false,
                    sessionTerminated: true,
                    error: 'Session terminated',
                    message: decoded.error || 'Another user has logged into this account. Please login again.'
                });
            }
            
            // If JWT token is valid, use it for authentication
            if (decoded && !decoded.expired && !decoded.invalid) {
                // Check if user type matches expected type
                if (expectedUserType && decoded.userType !== expectedUserType) {
                    return res.json({
                        authenticated: false,
                        message: 'Session mismatch - please login again'
                    });
                }
                
                // Get user from database to return full user info
                let user = null;
                if (decoded.userType === 'customer') {
                    user = await customerStore.findById(decoded.userId);
                } else if (decoded.userType === 'admin') {
                    user = await adminStore.findById(decoded.userId);
                }
                
                if (!user) {
                    return res.json({
                        authenticated: false,
                        message: 'User not found'
                    });
                }
                
                // Update session with JWT token data for backward compatibility
                if (!req.session) {
                    req.session = {};
                }
                req.session.userId = decoded.userId;
                req.session.userType = decoded.userType;
                req.session.email = decoded.email;
                req.session.fullName = decoded.fullName;
                if (decoded.enterpriseName) {
                    req.session.enterpriseName = decoded.enterpriseName;
                }
                
                const userResponse = {
                    authenticated: true,
                    user: {
                        fullName: decoded.fullName,
                        email: decoded.email,
                        userType: decoded.userType
                    }
                };
                
                if (decoded.userType === 'customer') {
                    userResponse.user.customerId = decoded.userId;
                } else if (decoded.userType === 'admin') {
                    userResponse.user.adminId = decoded.userId;
                    if (decoded.enterpriseName) {
                        userResponse.user.enterpriseName = decoded.enterpriseName;
                    }
                }
                
                return res.json(userResponse);
            }
        }
        
        // Fallback to session-based authentication
        // But first check if JWT token exists and is invalid (version mismatch)
        // This ensures old tabs with invalid JWT tokens are logged out even if session cookie is valid
        if (jwtToken) {
            const decoded = verifyAccessToken(jwtToken);
            if (decoded && decoded.invalid) {
                // JWT token is invalid (version mismatch) - terminate session
                if (req.session) {
                    req.session.destroy();
                }
                res.clearCookie('connect.sid');
                return res.json({
                    authenticated: false,
                    sessionTerminated: true,
                    error: 'Session terminated',
                    message: decoded.error || 'Another user has logged into this account. Please login again.'
                });
            }
        }
        
        if (req.session && req.session.userId) {
            // Verify user still exists in database
            let user = null;
            
            // If userType is missing, try to find user in both stores (same logic as middleware)
            if (!req.session.userType) {
                user = await adminStore.findById(req.session.userId);
                if (user) {
                    req.session.userType = 'admin';
                } else {
                    user = await customerStore.findById(req.session.userId);
                    if (user) {
                        req.session.userType = 'customer';
                    }
                }
            } else if (req.session.userType === 'customer') {
                user = await customerStore.findById(req.session.userId);
            } else if (req.session.userType === 'admin') {
                user = await adminStore.findById(req.session.userId);
            }
            
            if (user) {
                // Update session with latest user data
                req.session.email = user.email;
                req.session.fullName = user.fullName;
                
                // Ensure userType is set from database
                if (user.userType) {
                    req.session.userType = user.userType;
                }
                
                // CRITICAL: Only return session data if it matches the expected user type
                // This prevents admin session from being shown in customer tabs and vice versa
                if (expectedUserType && req.session.userType !== expectedUserType) {
                    // Session exists but for different user type - return unauthenticated
                    return res.json({
                        authenticated: false,
                        message: 'Session mismatch - please login again'
                    });
                }
                
                // Save session to ensure userType is persisted
                req.session.save((err) => {
                    if (err) {
                        console.error('Error saving session:', err);
                    }
                });
                
                const userResponse = {
                    authenticated: true,
                    user: {
                        fullName: req.session.fullName,
                        email: req.session.email,
                        userType: req.session.userType
                    }
                };
                
                // Add appropriate ID field based on user type
                if (req.session.userType === 'customer') {
                    userResponse.user.customerId = req.session.userId;
                } else if (req.session.userType === 'admin') {
                    userResponse.user.adminId = req.session.userId;
                    if (user.enterpriseName) {
                        userResponse.user.enterpriseName = user.enterpriseName;
                    }
                }
                
                // If no JWT token was provided but session is valid, generate new tokens
                // This allows new tabs to get tokens when accessing dashboard directly
                if (!jwtToken) {
                    const tokenVersion = sessionManager.getTokenVersion(req.session.userType, req.session.userId);
                    
                    if (req.session.userType === 'customer') {
                        const accessToken = generateAccessToken({
                            userId: req.session.userId,
                            userType: 'customer',
                            email: req.session.email,
                            fullName: req.session.fullName
                        }, tokenVersion);
                        
                        const refreshToken = generateRefreshToken({
                            userId: req.session.userId,
                            userType: 'customer'
                        }, tokenVersion);
                        
                        userResponse.tokens = {
                            accessToken,
                            refreshToken
                        };
                    } else if (req.session.userType === 'admin') {
                        const accessToken = generateAccessToken({
                            userId: req.session.userId,
                            userType: 'admin',
                            email: req.session.email,
                            fullName: req.session.fullName,
                            enterpriseName: req.session.enterpriseName || null
                        }, tokenVersion);
                        
                        const refreshToken = generateRefreshToken({
                            userId: req.session.userId,
                            userType: 'admin'
                        }, tokenVersion);
                        
                        userResponse.tokens = {
                            accessToken,
                            refreshToken
                        };
                    }
                }
                
                res.json(userResponse);
            } else {
                // User not found in database, destroy session
                req.session.destroy();
                res.json({
                    authenticated: false,
                    message: 'User not found'
                });
            }
        } else {
            res.json({
                authenticated: false
            });
        }
    } catch (error) {
        console.error('Error in getSessionHandler:', error);
        res.json({
            authenticated: false,
            error: 'Internal server error'
        });
    }
};

const logoutHandler = (req, res) => {
    // Log logout before destroying session
    if (req.session && req.session.userId) {
        if (req.session.userType === 'customer') {
            logLogout(req.session.userId, req);
        } else if (req.session.userType === 'admin') {
            logAdminLogout(req.session.userId, req);
        }
    }
    
    // Invalidate all sessions and tokens for this user
    // Increment token version instead of removing it - this invalidates all tokens in all tabs
    if (req.session && req.session.userId && req.session.userType) {
        sessionManager.removeActiveSession(req.session.userType, req.session.userId);
        // Increment token version to invalidate all JWT tokens in all tabs
        sessionManager.incrementTokenVersion(req.session.userType, req.session.userId);
        // Clear browser-wide session tracking
        sessionManager.clearActiveBrowserSession(req.session.userType);
    }
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Error logging out' });
        }
        res.clearCookie('connect.sid');
        // JWT tokens are stored in sessionStorage on frontend, cleared by frontend on logout
        res.json({ message: 'Logout successful' });
    });
};

// Refresh token handler
const refreshTokenHandler = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }
        
        const { verifyRefreshToken, generateAccessToken, generateRefreshToken } = require('../utils/jwtHelper');
        const decoded = verifyRefreshToken(refreshToken);
        
        if (!decoded || decoded.expired || decoded.invalid) {
            return res.status(401).json({ 
                error: 'Invalid or expired refresh token',
                expired: decoded?.expired || false
            });
        }
        
        // Get user from database to ensure they still exist
        let user = null;
        if (decoded.userType === 'customer') {
            user = await customerStore.findById(decoded.userId);
        } else if (decoded.userType === 'admin') {
            user = await adminStore.findById(decoded.userId);
        }
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        // Get current token version (keep same version for refresh, don't increment)
        const tokenVersion = sessionManager.getTokenVersion(decoded.userType, decoded.userId);
        
        // Generate new tokens with current token version
        const newAccessToken = generateAccessToken({
            userId: decoded.userId,
            userType: decoded.userType,
            email: user.email,
            fullName: user.fullName,
            enterpriseName: user.enterpriseName || null
        }, tokenVersion);
        
        const newRefreshToken = generateRefreshToken({
            userId: decoded.userId,
            userType: decoded.userType
        }, tokenVersion);
        
        // JWT tokens are stored in sessionStorage on frontend (not in cookies)
        // Tokens are sent via Authorization header
        
        res.json({
            message: 'Token refreshed successfully',
            tokens: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            }
        });
    } catch (error) {
        console.error('Error in refreshTokenHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    // Validators
    customerSignupValidators,
    customerLoginValidators,
    adminSignupValidators,
    adminLoginValidators,
    // Handlers
    customerSignupHandler,
    customerLoginHandler,
    adminSignupHandler,
    adminLoginHandler,
    getSessionHandler,
    logoutHandler,
    refreshTokenHandler
};
