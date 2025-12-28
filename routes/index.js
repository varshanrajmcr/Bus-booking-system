const express = require('express');
const router = express.Router();

// Import middleware
const { requireCustomer, requireAdmin } = require('../middleware/auth');

// Import auth routes
const {
    customerSignupValidators,
    customerLoginValidators,
    adminSignupValidators,
    adminLoginValidators,
    customerSignupHandler,
    customerLoginHandler,
    adminSignupHandler,
    adminLoginHandler,
    getSessionHandler,
    logoutHandler,
    refreshTokenHandler
} = require('./authRoutes');

// Import bus routes
const {
    searchBusesValidators,
    getBusByIdValidators,
    addBusValidators,
    updateBusValidators,
    deleteBusValidators,
    searchBusesHandler,
    getAdminBusesHandler,
    getAllBusesHandler,
    getBusByIdHandler,
    addBusHandler,
    updateBusHandler,
    deleteBusHandler
} = require('./busRoutes');

// Import booking routes
const {
    getBookedSeatsValidators,
    createBookingValidators,
    getBookingByIdValidators,
    cancelBookingValidators,
    getBookedSeatsHandler,
    createBookingHandler,
    getCustomerBookingsHandler,
    getAdminBookingsHandler,
    getAllBookingsHandler,
    getBookingByIdHandler,
    cancelBookingHandler,
    trackFrontendActivityHandler
} = require('./bookingRoutes');

// ========== AUTH ROUTES ==========

// Customer Signup
// Request: { "fullName": "John Doe", "email": "john@example.com", "phone": "1234567890", "password": "Password123!", "confirmPassword": "Password123!" }
// Response (201): { "message": "Customer account created successfully", "user": { "customerId": 1, "fullName": "John Doe", "email": "john@example.com", "userType": "customer" } }
// Error (400): { "error": "Email already registered" } | { "error": "Phone number already registered" } | { "error": "Validation failed", "details": [...] }
router.post('/customer/signup', customerSignupValidators, customerSignupHandler);

// Customer Login
// Request: { "email": "john@example.com", "password": "Password123!" }
// Response (200): { "message": "Login successful", "user": { "customerId": 1, "fullName": "John Doe", "email": "john@example.com", "userType": "customer" } }
// Error (401): { "error": "Invalid email or password" }
router.post('/customer/login', customerLoginValidators, customerLoginHandler);

// Admin Signup
// Request: { "fullName": "Admin User", "email": "admin@example.com", "phone": "9876543210", "adminKey": "ADMIN123", "password": "AdminPass123!", "confirmPassword": "AdminPass123!", "enterpriseName": "ABC Travels" }
// Response (201): { "message": "Admin account created successfully", "user": { "adminId": 1, "fullName": "Admin User", "email": "admin@example.com", "userType": "admin", "enterpriseName": "ABC Travels" } }
// Error (400): { "error": "Email already registered" } | { "error": "Enterprise name already exists" } | { "error": "Invalid admin key" }
router.post('/admin/signup', adminSignupValidators, adminSignupHandler);

// Admin Login
// Request: { "email": "admin@example.com", "password": "AdminPass123!" }
// Response (200): { "message": "Login successful", "user": { "adminId": 1, "fullName": "Admin User", "email": "admin@example.com", "userType": "admin", "enterpriseName": "ABC Travels" } }
// Error (401): { "error": "Invalid email or password" }
router.post('/admin/login', adminLoginValidators, adminLoginHandler);

// Check session status
// Request: None (uses session cookie)
// Response (200): { "authenticated": true, "user": { "customerId": 1, "fullName": "John Doe", "email": "john@example.com", "userType": "customer" } }
// Response (200): { "authenticated": false }
router.get('/session', getSessionHandler);

// Logout
// Request: None (uses session cookie)
// Response (200): { "message": "Logout successful" }
router.post('/logout', logoutHandler);

// Refresh token
// Request: { "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
// Response (200): { "message": "Token refreshed successfully", "tokens": { "accessToken": "...", "refreshToken": "..." } }
// Error (401): { "error": "Invalid or expired refresh token", "expired": true }
router.post('/auth/refresh', refreshTokenHandler);

// Track frontend activity (customer only)
// Request: { "action": "route_navigation", "route": "/customer/dashboard.html", ... }
// Response (200): { "success": true }
router.post('/activities/track', requireCustomer, trackFrontendActivityHandler);

// ========== BUS ROUTES ==========

// Search buses
// Request: { "from": "Chennai", "to": "Bangalore", "date": "2024-12-25", "passengers": 2 } (passengers optional, default: 1)
// Response (200): { "buses": [{ "busId": 1, "busName": "Volvo AC Sleeper", "from": "Chennai", "to": "Bangalore", "date": "2024-12-25", "departureTime": "22:00:00", "arrivalTime": "06:00:00", "duration": "8h 0m", "seaterPrice": "750.00", "sleeperPrice": "1200.00", "totalSeats": 32, "bookedSeats": [1, 2, 5], "bookedSeatsCount": 3, "availableSeatsForDate": 29, ... }], "count": 1 }
// Error (400): { "error": "Validation failed", "details": [...] }
router.post('/buses/search', searchBusesValidators, searchBusesHandler);

// Get all buses for current admin
// Request: None (uses session - requires admin)
// Response (200): { "buses": [{ "busId": 1, "busName": "Volvo AC Sleeper", "adminId": 1, "enterpriseName": "ABC Travels", "from": "Chennai", "to": "Bangalore", "date": "2024-12-25", "departureTime": "22:00:00", "arrivalTime": "06:00:00", "duration": "8h 0m", "seaterPrice": "750.00", "sleeperPrice": "1200.00", "totalSeats": 32, "status": "active", ... }], "count": 1 }
// Error (403): { "error": "Admin access required" }
router.get('/buses/admin', requireAdmin, getAdminBusesHandler);

// Get all buses
// Request: None
// Response (200): { "buses": [{ "busId": 1, "busName": "Volvo AC Sleeper", ... }] }
router.get('/buses', getAllBusesHandler);

// Get bus by ID
// Request: None
// URL Params: id (integer) - Bus ID
// Response (200): { "bus": { "busId": 1, "busName": "Volvo AC Sleeper", ... } }
// Error (404): { "error": "Bus not found" }
router.get('/buses/:id', getBusByIdValidators, getBusByIdHandler);

// Add new bus (admin only)
// Request: { "busName": "Volvo AC Sleeper", "enterpriseName": "ABC Travels", "from": "Chennai", "to": "Bangalore", "date": "2024-12-25", "departureTime": "22:00", "arrivalTime": "06:00", "duration": "8h 0m", "seaterPrice": 750, "sleeperPrice": 1200, "busType": "AC Seater/Sleeper", "totalSeats": 32 }
// Response (201): { "message": "Bus scheduled successfully", "bus": { "busId": 1, "busName": "Volvo AC Sleeper", ... } }
// Error (403): { "error": "Admin access required" } | Error (400): { "error": "Validation failed", "details": [...] }
router.post('/buses', requireAdmin, addBusValidators, addBusHandler);

// Update bus (admin only - only their own buses)
// Request: { "busName": "Updated Bus Name", "from": "Chennai", "to": "Mumbai", "date": "2024-12-26", "departureTime": "23:00", "arrivalTime": "07:00", "duration": "8h 0m", "seaterPrice": 800, "sleeperPrice": 1300, "busType": "AC Seater/Sleeper", "totalSeats": 40 } (all fields optional)
// URL Params: id (integer) - Bus ID
// Response (200): { "message": "Bus updated successfully", "bus": { "busId": 1, ... } }
// Error (403): { "error": "Admin access required" } | Error (404): { "error": "Bus not found" }
router.put('/buses/:id', requireAdmin, updateBusValidators, updateBusHandler);

// Delete bus (admin only - only their own buses)
// Request: None
// URL Params: id (integer) - Bus ID
// Response (200): { "message": "Bus cancelled successfully" }
// Error (403): { "error": "Admin access required" } | Error (404): { "error": "Bus not found" }
router.delete('/buses/:id', requireAdmin, deleteBusValidators, deleteBusHandler);

// ========== BOOKING ROUTES ==========

// Get booked seats for a specific bus and date
// Request: None
// URL Params: busId (integer) - Bus ID, date (string, URL-encoded) - Date in YYYY-MM-DD format
// Response (200): { "busId": 1, "date": "2024-12-25", "bookedSeats": [1, 2, 5, 10, 15] }
// Error (400): { "error": "Validation failed", "details": [...] }
router.get('/bookings/seats/:busId/:date', getBookedSeatsValidators, getBookedSeatsHandler);

// Create booking (must come before /bookings/:bookingId to avoid route conflict)
// Request: { "busId": 1, "date": "2024-12-25", "seats": [3, 4], "passengers": [{ "name": "John Doe", "age": 30, "gender": "Male", "seatNumber": 3, "seatType": "seater", "price": 750 }, { "name": "Jane Doe", "age": 28, "gender": "Female", "seatNumber": 4, "seatType": "sleeper", "price": 1200 }], "totalAmount": 1950 }
// Response (201): { "message": "Booking confirmed successfully", "bookingId": "BK1703520000000", "booking": { "bookingId": "BK1703520000000", "busId": 1, "customerId": 1, "adminId": 1, "date": "2024-12-25", "seats": [3, 4], "totalAmount": 1950, "status": "confirmed" } }
// Error (403): { "error": "Customer access required" } | Error (400): { "error": "Seat(s) 3, 4 are already booked for this date. Please select different seats." } | Error (404): { "error": "Bus not found" }
router.post('/bookings/create', requireCustomer, createBookingValidators, createBookingHandler);

// Get all bookings for current customer (must come before /bookings/:bookingId)
// Request: None (uses session - requires customer)
// Response (200): { "bookings": [{ "bookingId": "BK1703520000000", "busId": 1, "customerId": 1, "adminId": 1, "date": "2024-12-25", "seats": [3, 4], "passengers": [...], "totalAmount": 1950, "status": "confirmed", "createdAt": "2024-12-20T10:00:00.000Z" }], "count": 1 }
// Error (403): { "error": "Customer access required" }
router.get('/bookings/customer', requireCustomer, getCustomerBookingsHandler);

// Get all bookings for current admin (must come before /bookings/:bookingId)
// Request: None (uses session - requires admin)
// Response (200): { "bookings": [{ "bookingId": "BK1703520000000", "busId": 1, "customerId": 1, "adminId": 1, "date": "2024-12-25", "seats": [3, 4], "passengers": [...], "totalAmount": 1950, "status": "confirmed", "createdAt": "2024-12-20T10:00:00.000Z" }], "count": 1 }
// Error (403): { "error": "Admin access required" }
router.get('/bookings/admin', requireAdmin, getAdminBookingsHandler);

// Get all bookings (must come before /bookings/:bookingId)
// Request: None
// Response (200): { "bookings": [{ "bookingId": "BK1703520000000", ... }], "count": 1 }
router.get('/bookings', getAllBookingsHandler);

// Cancel booking by customer
// Request: None (uses session - requires customer)
// URL Params: bookingId (string) - Must start with "BK" followed by numbers
// Response (200): { "message": "Booking cancelled successfully", "booking": { "bookingId": "BK1703520000000", "status": "cancelled", ... } }
// Error (403): { "error": "Customer access required" } | Error (403): { "error": "You can only cancel your own bookings" } | Error (404): { "error": "Booking not found" } | Error (400): { "error": "This booking is already cancelled" }
router.put('/bookings/:bookingId/cancel', (req, res, next) => {
    // If bookingId doesn't start with "BK", it's not a valid booking ID, skip this route
    if (!req.params.bookingId || !req.params.bookingId.startsWith('BK')) {
        return res.status(404).json({ error: 'Booking not found' });
    }
    next();
}, requireCustomer, cancelBookingValidators, cancelBookingHandler);

// Get booking by ID 
// Only match if bookingId starts with "BK" to avoid matching "create", "customer", "admin", etc.
// Request: None
// URL Params: bookingId (string) - Must start with "BK" followed by numbers
// Response (200): { "booking": { "bookingId": "BK1703520000000", "busId": 1, "customerId": 1, "adminId": 1, "date": "2024-12-25", "seats": [3, 4], "passengers": [...], "totalAmount": 1950, "status": "confirmed", "createdAt": "2024-12-20T10:00:00.000Z" } }
// Error (404): { "error": "Booking not found" }
router.get('/bookings/:bookingId', (req, res, next) => {
    // If bookingId doesn't start with "BK", it's not a valid booking ID, skip this route
    if (!req.params.bookingId || !req.params.bookingId.startsWith('BK')) {
        return res.status(404).json({ error: 'Booking not found' });
    }
    next();
}, getBookingByIdValidators, getBookingByIdHandler);

module.exports = router;

