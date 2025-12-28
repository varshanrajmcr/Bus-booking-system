require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { Pool } = require('pg');
const path = require('path');
const { testConnection } = require('./config/database');
const { customerStore, adminStore } = require('./utils/dataStore');
const apiRoutes = require('./routes');
const sessionManager = require('./utils/sessionManager');
const { customerLogger } = require('./utils/customerLogger');

// Initialize BullMQ workers (only in main process, not in worker processes)
let queueWorkers = null;
if (process.env.NODE_ENV !== 'test') {
    try {
        const { closeWorkers } = require('./utils/queueProcessors');
        queueWorkers = { closeWorkers };
        console.log('BullMQ queue workers initialized');
    } catch (error) {
        console.warn('Warning: BullMQ workers not initialized. Make sure Redis is running:', error.message);
    }
}

const app = express();
const PORT = 3000;

// Initialize database connection
async function initializeDatabase() {
try {
        const connected = await testConnection();
        if (!connected) {
            console.error('Failed to connect to database. Please check your database configuration.');
            process.exit(1);
        }
        console.log('Database connection established.');
} catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

// Create PostgreSQL connection pool for session store
const dbPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '';
const sessionPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: String(dbPassword),
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'bus_booking_db',
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Session configuration with PostgreSQL store
app.use(session({
    store: new pgSession({
        pool: sessionPool,
        tableName: 'session', // Table name for sessions
        createTableIfMissing: true, // Automatically create table if it doesn't exist
        pruneSessionInterval: 60, // Clean up expired sessions every 60 seconds
        errorLog: (error) => {
            console.error('Session store error:', error);
        }
    }),
    name: 'connect.sid', // Session cookie name
    secret: 'bus-booking-secret-key-change-in-production',
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something is stored
    rolling: true, // Reset expiration on every request
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax', // Allows cookie to be sent with same-site requests
        path: '/' // Cookie path
    }
}));

// Middleware to verify session user exists in database and check session validity
app.use(async (req, res, next) => {
    if (req.session && req.session.userId) {
        try {
            // Check if session token is valid (single-session-per-account)
            if (req.session.userType && req.session.sessionToken) {
                const isValid = sessionManager.isSessionValid(
                    req.session.userType,
                    req.session.userId,
                    req.session.sessionToken
                );
                
                if (!isValid) {
                    // Session has been invalidated (another user logged in)
                    const userType = req.session.userType || 'customer';
                    console.log(`Session invalidated for ${userType}:${req.session.userId}`);
                    
                    // For API requests, return 401 with message
                    if (req.path.startsWith('/api/')) {
                        req.session.destroy((err) => {
                            if (err) console.error('Session destroy error:', err);
                        });
                        res.clearCookie('connect.sid');
                        return res.status(401).json({ 
                            error: 'Session terminated',
                            message: 'Another user has logged into this account. Please login again.',
                            sessionTerminated: true
                        });
                    }
                    // For page requests, redirect to login
                    req.session.destroy((err) => {
                        if (err) console.error('Session destroy error:', err);
                    });
                    res.clearCookie('connect.sid');
                    return res.redirect(`/${userType}/login.html?message=${encodeURIComponent('Another user has logged into this account. Please login again.')}`);
                }
            }
            
            // Verify user still exists in database
        let user = null;
            
            // If userType is missing, try to find user in both stores
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
        
        if (!user) {
            // User not found in database, destroy session
                req.session.destroy((err) => {
                    if (err) console.error('Session destroy error:', err);
                });
        } else {
                // Only update session if data has changed (to avoid unnecessary saves)
                let sessionUpdated = false;
                
                if (req.session.email !== user.email) {
            req.session.email = user.email;
                    sessionUpdated = true;
                }
                if (req.session.fullName !== user.fullName) {
            req.session.fullName = user.fullName;
                    sessionUpdated = true;
                }
                
                // Explicitly set userType from database user object (always use database value)
                if (user.userType && req.session.userType !== user.userType) {
                    req.session.userType = user.userType;
                    sessionUpdated = true;
                }
                
                // Ensure userId is set correctly (handle both adminId/customerId and id) and is an integer
                const correctUserId = req.session.userType === 'admin' 
                    ? parseInt(user.adminId || user.id)
                    : parseInt(user.customerId || user.id);
                
                if (req.session.userId !== correctUserId) {
                    req.session.userId = correctUserId;
                    sessionUpdated = true;
                }
                
                // Ensure sessionToken exists (for existing sessions, generate one if missing)
                if (!req.session.sessionToken) {
                    const token = sessionManager.setActiveSession(req.session.userType, correctUserId);
                    req.session.sessionToken = token;
                    sessionUpdated = true;
                }
                
                // Only save if session was actually modified
                if (sessionUpdated) {
                    req.session.save((err) => {
                        if (err) {
                            console.error('Error saving session after verification:', err);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error verifying session user:', error);
            // Don't destroy session on error - might be temporary DB issue
        }
    }
    next();
});

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Morgan custom tokens for customer tracking
morgan.token('customer-id', (req) => {
    if (req.session?.userId && req.session?.userType === 'customer') {
        return `customer-${req.session.userId}`;
    }
    return 'anonymous';
});

morgan.token('user-type', (req) => {
    return req.session?.userType || 'guest';
});

// Custom morgan format for customer activity
const customerFormat = ':customer-id :user-type :method :url :status :response-time ms - :remote-addr';

// Morgan middleware - logs all HTTP requests to console and file
app.use(morgan(customerFormat, {
    stream: {
        write: (message) => {
            // Determine which logger to use based on user type in session
            // This is a fallback - actual logging is done in route handlers with user details
            const logger = customerLogger; // Default to customer logger
            logger.info(message.trim(), {
                source: 'morgan',
                type: 'http_request'
            });
        }
    },
    skip: (req) => {
        // Skip static files and assets
        return req.path.startsWith('/public/') || 
               req.path.startsWith('/css/') || 
               req.path.startsWith('/js/') ||
               req.path.startsWith('/images/') ||
               req.path === '/favicon.ico';
    }
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// In production, serve React app; in development, serve HTML files
if (process.env.NODE_ENV === 'production') {
    // Serve React build files
    app.use(express.static(path.join(__dirname, 'client', 'dist')));
    
    // API Routes - All routes are declared in routes/index.js
    app.use('/api', apiRoutes);
    
    // SSE Routes for real-time updates
    const { router: sseRouter } = require('./routes/sseRoutes');
    app.use('/api', sseRouter);
    
    // All other routes serve React app (SPA fallback)
    // Use '/*' instead of '*' for Express 5.x compatibility
    app.get('/*', (req, res) => {
        res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
    });
} else {
    // Development mode: serve HTML files for backward compatibility
    app.get('/customer/signup.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'customer', 'signup.html'));
    });

    app.get('/customer/login.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'customer', 'login.html'));
    });

    app.get('/customer/dashboard.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'customer', 'dashboard.html'));
    });

    app.get('/customer/booking.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'customer', 'booking.html'));
    });

    app.get('/customer/bookings.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'customer', 'bookings.html'));
    });

    app.get('/admin/signup.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'admin', 'signup.html'));
    });

    app.get('/admin/login.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'admin', 'login.html'));
    });

    app.get('/admin/dashboard.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'admin', 'dashboard.html'));
    });

    // API Routes - All routes are declared in routes/index.js
    app.use('/api', apiRoutes);
    
    // SSE Routes for real-time updates
    const { router: sseRouter } = require('./routes/sseRoutes');
    app.use('/api', sseRouter);
    
    // Root route
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'startPage.html'));
    });
}

// Start server
async function startServer() {
    await initializeDatabase();
    
    const server = app.listen(PORT, () => {
    console.log(`Bus Booking Server is running on http://localhost:${PORT}`);
    console.log(`Customer Signup: http://localhost:${PORT}/customer/signup.html`);
    console.log(`Customer Login: http://localhost:${PORT}/customer/login.html`);
    console.log(`Admin Signup: http://localhost:${PORT}/admin/signup.html`);
    console.log(`Admin Login: http://localhost:${PORT}/admin/login.html`);
        console.log('Sessions are now persisted in PostgreSQL and will survive server restarts.');
    });
    
    // Schedule periodic cleanup of expired seat locks (every 10 minutes)
    if (queueWorkers) {
        const { scheduleCleanupTask } = require('./utils/queueService');
        // Schedule first cleanup after 10 minutes
        scheduleCleanupTask('expired_seat_locks', {}, 10 * 60 * 1000).then(() => {
            console.log('[Seat Lock] Scheduled cleanup task for expired seat locks');
        });
        
        // Schedule recurring cleanup every 10 minutes
        setInterval(() => {
            scheduleCleanupTask('expired_seat_locks', {}, 0).catch(err => {
                console.error('[Seat Lock] Error scheduling cleanup:', err);
            });
        }, 10 * 60 * 1000); // Every 10 minutes
    }
    
    // Graceful shutdown - close session pool and queues on server shutdown
    async function gracefulShutdown(signal) {
        console.log(`${signal} signal received: shutting down gracefully`);
        
        // Stop accepting new requests
        server.close(async () => {
            console.log('HTTP server closed');
            
            // Close queue workers
            if (queueWorkers && queueWorkers.closeWorkers) {
                try {
                    await queueWorkers.closeWorkers();
                } catch (error) {
                    console.error('Error closing queue workers:', error);
                }
            }
            
            // Close session pool
            sessionPool.end(() => {
                console.log('Session pool closed');
                
            // Close queue connections
            const { closeQueues } = require('./utils/queueConfig');
            const { closeCache } = require('./utils/cacheService');
            
            Promise.all([
                closeQueues(),
                closeCache()
            ]).then(() => {
                console.log('All services closed. Exiting...');
                process.exit(0);
            }).catch((error) => {
                console.error('Error closing services:', error);
                process.exit(1);
            });
        });
    });
        
        // Force exit after 10 seconds
        setTimeout(() => {
            console.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    }
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();

