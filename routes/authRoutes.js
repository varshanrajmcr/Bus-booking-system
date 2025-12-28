const { body } = require('express-validator');
const { customerStore, adminStore, enterpriseStore } = require('../utils/dataStore');
const { handleValidationErrors } = require('../utils/validationHelper');
const sessionManager = require('../utils/sessionManager');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwtHelper');
const { logLogin, logLogout, logAdminLogin, logAdminLogout } = require('../utils/customerLogger');

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
    
        // Terminate any existing sessions for this user
        const customerIdValue = parseInt(customer.customerId || customer.id);
        sessionManager.terminateUserSessions('customer', customerIdValue);
        
        // Generate new session token
        const sessionToken = sessionManager.setActiveSession('customer', customerIdValue);
        
        // Generate JWT tokens
        const accessToken = generateAccessToken({
            userId: customerIdValue,
            userType: 'customer',
            email: customer.email,
            fullName: customer.fullName
        });
        
        const refreshToken = generateRefreshToken({
            userId: customerIdValue,
            userType: 'customer'
        });
        
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
    
            // Set JWT tokens in HTTP-only cookies
            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
            
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
    
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
    
        // Terminate any existing sessions for this user
        const adminIdValue = parseInt(admin.adminId || admin.id);
        sessionManager.terminateUserSessions('admin', adminIdValue);
        
        // Generate new session token
        const sessionToken = sessionManager.setActiveSession('admin', adminIdValue);
        
        // Generate JWT tokens
        const accessToken = generateAccessToken({
            userId: adminIdValue,
            userType: 'admin',
            email: admin.email,
            fullName: admin.fullName,
            enterpriseName: admin.enterpriseName
        });
        
        const refreshToken = generateRefreshToken({
            userId: adminIdValue,
            userType: 'admin'
        });
    
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
    
            // Set JWT tokens in HTTP-only cookies
            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
            
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
            
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
        
        if (req.session.userId) {
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
    
    // Remove active session from session manager
    if (req.session && req.session.userId && req.session.userType) {
        sessionManager.removeActiveSession(req.session.userType, req.session.userId);
    }
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Error logging out' });
        }
        res.clearCookie('connect.sid');
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
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
        
        // Generate new tokens
        const newAccessToken = generateAccessToken({
            userId: decoded.userId,
            userType: decoded.userType,
            email: user.email,
            fullName: user.fullName,
            enterpriseName: user.enterpriseName || null
        });
        
        const newRefreshToken = generateRefreshToken({
            userId: decoded.userId,
            userType: decoded.userType
        });
        
        // Set new tokens in cookies
        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
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
