const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { customerStore, adminStore } = require('./dataStore');

// Ensure logs directories exist
const customerLogsDir = path.join(__dirname, '../logs/customer-activity');
const adminLogsDir = path.join(__dirname, '../logs/admin-activity');

if (!fs.existsSync(customerLogsDir)) {
    fs.mkdirSync(customerLogsDir, { recursive: true });
}
if (!fs.existsSync(adminLogsDir)) {
    fs.mkdirSync(adminLogsDir, { recursive: true });
}

// Winston logger for customer activities
const customerLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'bus-booking', userType: 'customer' },
    transports: [
        // Error log
        new winston.transports.File({ 
            filename: path.join(customerLogsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // All customer activity log (shareable)
        new winston.transports.File({ 
            filename: path.join(customerLogsDir, 'customer-activity.log'),
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            maxsize: 10485760, // 10MB
            maxFiles: 10
        }),
        // Daily log files
        new winston.transports.File({
            filename: path.join(customerLogsDir, `daily-${new Date().toISOString().split('T')[0]}.log`),
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            maxsize: 5242880, // 5MB
            maxFiles: 30 // Keep 30 days
        }),
        // Console with colors and readable format
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
                    return `📊 [${timestamp}] ${level}: ${message}${metaStr ? '\n' + metaStr : ''}`;
                })
            )
        })
    ]
});

// Winston logger for admin activities
const adminLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'bus-booking', userType: 'admin' },
    transports: [
        // Error log
        new winston.transports.File({ 
            filename: path.join(adminLogsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // All admin activity log
        new winston.transports.File({ 
            filename: path.join(adminLogsDir, 'admin-activity.log'),
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            maxsize: 10485760, // 10MB
            maxFiles: 10
        }),
        // Daily log files
        new winston.transports.File({
            filename: path.join(adminLogsDir, `daily-${new Date().toISOString().split('T')[0]}.log`),
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            maxsize: 5242880, // 5MB
            maxFiles: 30 // Keep 30 days
        }),
        // Console with colors and readable format
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
                    return `📊 [${timestamp}] ${level}: ${message}${metaStr ? '\n' + metaStr : ''}`;
                })
            )
        })
    ]
});

/**
 * Get user details from database
 */
async function getUserDetails(userId, userType) {
    try {
        if (userType === 'customer') {
            const customer = await customerStore.findById(userId);
            if (customer) {
                return {
                    customerId: customer.customerId,
                    fullName: customer.fullName,
                    email: customer.email,
                    phone: customer.phone
                };
            }
        } else if (userType === 'admin') {
            const admin = await adminStore.findById(userId);
            if (admin) {
                return {
                    adminId: admin.adminId,
                    fullName: admin.fullName,
                    email: admin.email,
                    phone: admin.phone,
                    enterpriseName: admin.enterpriseName
                };
            }
        }
        return null;
    } catch (error) {
        console.error('Error fetching user details:', error);
        return null;
    }
}

/**
 * Log customer activity with detailed information including user details
 * @param {number} customerId - Customer ID
 * @param {string} action - Action name (e.g., 'login', 'booking_created', 'route_navigation')
 * @param {object} details - Additional details about the action
 * @param {object} req - Express request object (optional)
 */
async function logCustomerActivity(customerId, action, details = {}, req = null) {
    try {
        // Fetch customer details from database
        const userDetails = await getUserDetails(customerId, 'customer');
        
        const logData = {
            customerId: parseInt(customerId),
            userDetails: userDetails || {
                customerId: parseInt(customerId),
                fullName: 'Unknown',
                email: 'N/A',
                phone: 'N/A'
            },
            action,
            ...details,
            timestamp: new Date().toISOString()
        };
        
        // Add request information if available
        if (req) {
            logData.route = req.path || req.url;
            logData.method = req.method;
            logData.ipAddress = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'N/A';
            logData.userAgent = req.get('user-agent') || 'N/A';
            logData.sessionId = req.sessionID || 'N/A';
            logData.referrer = req.get('referer') || 'N/A';
        }
        
        // Log to file (structured JSON)
        customerLogger.info('Customer Activity', logData);
        
        // Enhanced console log with emoji and formatting
        const actionEmoji = getActionEmoji(action);
        const user = logData.userDetails;
        console.log(`\n${actionEmoji} [CUSTOMER] ${action.toUpperCase()}`);
        console.log(`   User: ${user.fullName} (ID: ${user.customerId})`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Route: ${logData.route || 'N/A'}`);
        console.log(`   Method: ${logData.method || 'N/A'}`);
        console.log(`   IP: ${logData.ipAddress}`);
        if (Object.keys(details).length > 0) {
            console.log(`   Details:`, details);
        }
        console.log(`   Timestamp: ${logData.timestamp}\n`);
    } catch (error) {
        console.error('Error in logCustomerActivity:', error);
        // Fallback logging without user details
        const logData = {
            customerId: parseInt(customerId),
            action,
            ...details,
            timestamp: new Date().toISOString(),
            error: 'Failed to fetch user details'
        };
        customerLogger.info('Customer Activity', logData);
    }
}

/**
 * Log admin activity with detailed information including user details
 * @param {number} adminId - Admin ID
 * @param {string} action - Action name (e.g., 'login', 'bus_created', 'bus_cancelled')
 * @param {object} details - Additional details about the action
 * @param {object} req - Express request object (optional)
 */
async function logAdminActivity(adminId, action, details = {}, req = null) {
    try {
        // Fetch admin details from database
        const userDetails = await getUserDetails(adminId, 'admin');
        
        const logData = {
            adminId: parseInt(adminId),
            userDetails: userDetails || {
                adminId: parseInt(adminId),
                fullName: 'Unknown',
                email: 'N/A',
                phone: 'N/A',
                enterpriseName: 'N/A'
            },
            action,
            ...details,
            timestamp: new Date().toISOString()
        };
        
        // Add request information if available
        if (req) {
            logData.route = req.path || req.url;
            logData.method = req.method;
            logData.ipAddress = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'N/A';
            logData.userAgent = req.get('user-agent') || 'N/A';
            logData.sessionId = req.sessionID || 'N/A';
            logData.referrer = req.get('referer') || 'N/A';
        }
        
        // Log to file (structured JSON)
        adminLogger.info('Admin Activity', logData);
        
        // Enhanced console log with emoji and formatting
        const actionEmoji = getActionEmoji(action);
        const user = logData.userDetails;
        console.log(`\n${actionEmoji} [ADMIN] ${action.toUpperCase()}`);
        console.log(`   User: ${user.fullName} (ID: ${user.adminId})`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone}`);
        if (user.enterpriseName) {
            console.log(`   Enterprise: ${user.enterpriseName}`);
        }
        console.log(`   Route: ${logData.route || 'N/A'}`);
        console.log(`   Method: ${logData.method || 'N/A'}`);
        console.log(`   IP: ${logData.ipAddress}`);
        if (Object.keys(details).length > 0) {
            console.log(`   Details:`, details);
        }
        console.log(`   Timestamp: ${logData.timestamp}\n`);
    } catch (error) {
        console.error('Error in logAdminActivity:', error);
        // Fallback logging without user details
        const logData = {
            adminId: parseInt(adminId),
            action,
            ...details,
            timestamp: new Date().toISOString(),
            error: 'Failed to fetch user details'
        };
        adminLogger.info('Admin Activity', logData);
    }
}

/**
 * Get emoji for action type
 */
function getActionEmoji(action) {
    const emojiMap = {
        'login': '🔐',
        'logout': '🚪',
        'signup': '📝',
        'booking_created': '✅',
        'booking_cancelled': '❌',
        'bus_search': '🔍',
        'seat_selection': '🪑',
        'route_navigation': '🧭',
        'api_call': '📡',
        'form_submission': '📋',
        'button_click': '🖱️',
        'page_view': '👁️',
        'error': '⚠️',
        'bus_created': '🚌',
        'bus_updated': '✏️',
        'bus_cancelled': '❌',
        'bus_deleted': '🗑️'
    };
    return emojiMap[action.toLowerCase()] || '📊';
}

/**
 * Log customer route navigation
 */
async function logRouteNavigation(customerId, route, req = null) {
    await logCustomerActivity(customerId, 'route_navigation', {
        page: route,
        referrer: req?.get('referer') || 'N/A'
    }, req);
}

/**
 * Log customer API call
 */
async function logAPICall(customerId, endpoint, method, requestBody = {}, responseStatus = null, req = null) {
    // Sanitize request body (remove sensitive data)
    const sanitizedBody = sanitizeRequestBody(requestBody);
    
    await logCustomerActivity(customerId, 'api_call', {
        endpoint,
        method,
        requestBody: sanitizedBody,
        responseStatus
    }, req);
}

/**
 * Log customer login
 */
async function logLogin(customerId, email, req = null) {
    await logCustomerActivity(customerId, 'login', {
        email: email,
        loginTime: new Date().toISOString()
    }, req);
}

/**
 * Log customer logout
 */
async function logLogout(customerId, req = null) {
    await logCustomerActivity(customerId, 'logout', {
        logoutTime: new Date().toISOString()
    }, req);
}

/**
 * Log admin login
 */
async function logAdminLogin(adminId, email, req = null) {
    await logAdminActivity(adminId, 'login', {
        email: email,
        loginTime: new Date().toISOString()
    }, req);
}

/**
 * Log admin logout
 */
async function logAdminLogout(adminId, req = null) {
    await logAdminActivity(adminId, 'logout', {
        logoutTime: new Date().toISOString()
    }, req);
}

/**
 * Log booking creation
 */
async function logBookingCreation(customerId, bookingId, bookingDetails, req = null) {
    await logCustomerActivity(customerId, 'booking_created', {
        bookingId,
        busId: bookingDetails.busId,
        date: bookingDetails.date,
        seats: bookingDetails.seats,
        totalAmount: bookingDetails.totalAmount,
        passengerCount: bookingDetails.passengerCount || 0
    }, req);
}

/**
 * Log booking cancellation
 */
async function logBookingCancellation(customerId, bookingId, bookingDetails, req = null) {
    await logCustomerActivity(customerId, 'booking_cancelled', {
        bookingId,
        busId: bookingDetails.busId,
        date: bookingDetails.date,
        seats: bookingDetails.seats || [],
        cancelledAt: new Date().toISOString()
    }, req);
}

/**
 * Log bus search
 */
async function logBusSearch(customerId, searchCriteria, resultsCount, req = null) {
    await logCustomerActivity(customerId, 'bus_search', {
        from: searchCriteria.from,
        to: searchCriteria.to,
        date: searchCriteria.date,
        passengers: searchCriteria.passengers,
        resultsCount
    }, req);
}

/**
 * Log seat selection
 */
async function logSeatSelection(customerId, busId, selectedSeats, req = null) {
    await logCustomerActivity(customerId, 'seat_selection', {
        busId,
        selectedSeats,
        seatCount: selectedSeats.length
    }, req);
}

/**
 * Log admin bus creation
 */
async function logBusCreation(adminId, busDetails, req = null) {
    await logAdminActivity(adminId, 'bus_created', {
        busId: busDetails.busId,
        busName: busDetails.busName,
        from: busDetails.from,
        to: busDetails.to,
        date: busDetails.date
    }, req);
}

/**
 * Log admin bus update
 */
async function logBusUpdate(adminId, busId, busDetails, req = null) {
    await logAdminActivity(adminId, 'bus_updated', {
        busId,
        ...busDetails
    }, req);
}

/**
 * Log admin bus cancellation
 */
async function logBusCancellation(adminId, busId, busDetails, req = null) {
    await logAdminActivity(adminId, 'bus_cancelled', {
        busId,
        busName: busDetails.busName,
        date: busDetails.date
    }, req);
}

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeRequestBody(body) {
    if (!body || typeof body !== 'object') {
        return body;
    }
    
    const sanitized = { ...body };
    
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.confirmPassword;
    delete sanitized.token;
    delete sanitized.accessToken;
    delete sanitized.refreshToken;
    
    return sanitized;
}

/**
 * Get customer activity log from file
 */
async function getCustomerActivityLog(customerId, options = {}) {
    try {
        const fs = require('fs').promises;
        const logFile = path.join(customerLogsDir, 'customer-activity.log');
        
        const content = await fs.readFile(logFile, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line);
        
        let activities = [];
        for (const line of lines) {
            try {
                const logEntry = JSON.parse(line);
                const activity = logEntry.message === 'Customer Activity' ? logEntry : JSON.parse(logEntry.message || '{}');
                
                if (activity.customerId === parseInt(customerId)) {
                    activities.push(activity);
                }
            } catch (e) {
                // Skip invalid lines
            }
        }
        
        // Apply filters
        if (options.action) {
            activities = activities.filter(a => a.action === options.action);
        }
        
        if (options.date) {
            activities = activities.filter(a => {
                const activityDate = new Date(a.timestamp).toISOString().split('T')[0];
                return activityDate === options.date;
            });
        }
        
        // Sort by timestamp (newest first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (options.limit) {
            activities = activities.slice(0, options.limit);
        }
        
        return activities;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        console.error('Error reading customer activity log:', error);
        return [];
    }
}

/**
 * Get admin activity log from file
 */
async function getAdminActivityLog(adminId, options = {}) {
    try {
        const fs = require('fs').promises;
        const logFile = path.join(adminLogsDir, 'admin-activity.log');
        
        const content = await fs.readFile(logFile, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line);
        
        let activities = [];
        for (const line of lines) {
            try {
                const logEntry = JSON.parse(line);
                const activity = logEntry.message === 'Admin Activity' ? logEntry : JSON.parse(logEntry.message || '{}');
                
                if (activity.adminId === parseInt(adminId)) {
                    activities.push(activity);
                }
            } catch (e) {
                // Skip invalid lines
            }
        }
        
        // Apply filters
        if (options.action) {
            activities = activities.filter(a => a.action === options.action);
        }
        
        if (options.date) {
            activities = activities.filter(a => {
                const activityDate = new Date(a.timestamp).toISOString().split('T')[0];
                return activityDate === options.date;
            });
        }
        
        // Sort by timestamp (newest first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (options.limit) {
            activities = activities.slice(0, options.limit);
        }
        
        return activities;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        console.error('Error reading admin activity log:', error);
        return [];
    }
}

module.exports = {
    customerLogger,
    adminLogger,
    logCustomerActivity,
    logAdminActivity,
    logRouteNavigation,
    logAPICall,
    logLogin,
    logLogout,
    logAdminLogin,
    logAdminLogout,
    logBookingCreation,
    logBookingCancellation,
    logBusSearch,
    logSeatSelection,
    logBusCreation,
    logBusUpdate,
    logBusCancellation,
    getCustomerActivityLog,
    getAdminActivityLog
};
