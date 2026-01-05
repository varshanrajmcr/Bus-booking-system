const { body, param, query } = require('express-validator');
const { bookingStore, busStore, passengerStore, customerStore } = require('../utils/dataStore');
const { handleValidationErrors } = require('../utils/validationHelper');
const { logBookingCreation, logBookingCancellation } = require('../utils/customerLogger');
const { 
    queueBookingConfirmationEmail, 
    queueBookingCancellationEmail,
    queueBookingCreationLog,
    queueBookingCancellationLog
} = require('../utils/queueService');
const {
    getCustomerBookings, setCustomerBookings, invalidateCustomerBookings,
    getAdminBookings, setAdminBookings, invalidateAdminBookings,
    invalidateBusSearch, invalidateBusById
} = require('../utils/cacheService');
const {
    lockSeats,
    releaseSeats,
    checkSeatsLocked,
    getLockedSeatsForBus
} = require('../utils/seatLockService');
const { Booking, Bus } = require('../models');
const { Sequelize, Op } = require('sequelize');
const { sequelize } = require('../config/database');

// Import SSE notification function (lazy load to avoid circular dependency)
let notifyAdminDataChange = null;
function getNotifyFunction() {
    if (!notifyAdminDataChange) {
        try {
            const sseModule = require('./sseRoutes');
            notifyAdminDataChange = sseModule.notifyAdminDataChange;
        } catch (error) {
            console.error('Error loading SSE module:', error);
        }
    }
    return notifyAdminDataChange;
}

// ========== VALIDATORS ==========

const getBookedSeatsValidators = [
    param('busId')
        .isInt({ min: 1 }).withMessage('Bus ID must be a positive integer'),
    param('date')
        .trim()
        .notEmpty().withMessage('Date is required')
        .custom((value) => {
            const decodedDate = decodeURIComponent(value);
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(decodedDate)) {
                throw new Error('Date must be in YYYY-MM-DD format');
            }
            const date = new Date(decodedDate + 'T00:00:00');
            if (isNaN(date.getTime())) {
                throw new Error('Invalid date');
            }
            return true;
        }),
    handleValidationErrors
];

const createBookingValidators = [
    body('busId')
        .notEmpty().withMessage('Bus ID is required')
        .isInt({ min: 1 }).withMessage('Bus ID must be a positive integer'),
    body('date')
        .trim()
        .notEmpty().withMessage('Travel date is required')
        .isISO8601().withMessage('Date must be in YYYY-MM-DD format')
        .custom((value) => {
            const date = new Date(value + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (date < today) {
                throw new Error('Travel date cannot be in the past');
            }
            return true;
        }),
    body('seats')
        .isArray({ min: 1, max: 10 }).withMessage('Seats must be an array with 1 to 10 items')
        .custom((seats) => {
            if (!Array.isArray(seats)) {
                throw new Error('Seats must be an array');
            }
            // Validate each seat is a valid integer
            for (let i = 0; i < seats.length; i++) {
                const seatNum = parseInt(seats[i]);
                if (isNaN(seatNum) || seatNum < 1 || seatNum > 50) {
                    throw new Error(`Seat ${i + 1} must be a number between 1 and 50`);
                }
            }
            // Check for duplicates
            const uniqueSeats = [...new Set(seats.map(s => parseInt(s)))];
            if (uniqueSeats.length !== seats.length) {
                throw new Error('Duplicate seat numbers are not allowed');
            }
            return true;
        }),
    body('passengers')
        .isArray({ min: 1, max: 10 }).withMessage('Passengers must be an array with 1 to 10 items')
        .custom((passengers, { req }) => {
            if (!Array.isArray(passengers)) {
                throw new Error('Passengers must be an array');
            }
            // Check length matches seats
            if (passengers.length !== (req.body.seats?.length || 0)) {
                throw new Error('Number of passengers must match number of seats');
            }
            // Validate each passenger
    for (let i = 0; i < passengers.length; i++) {
                const p = passengers[i];
                if (!p.name || typeof p.name !== 'string' || p.name.trim().length === 0) {
                    throw new Error(`Passenger ${i + 1}: Name is required`);
                }
                const nameRegex = /^[a-zA-Z. ]+$/;
                if (!nameRegex.test(p.name.trim())) {
                    throw new Error(`Passenger ${i + 1}: Name should contain only letters (a-z, A-Z) and periods (.)`);
                }
                const age = parseInt(p.age);
                if (isNaN(age) || age < 1 || age > 120) {
                    throw new Error(`Passenger ${i + 1}: Age must be between 1 and 120`);
                }
                const validGenders = ['Male', 'Female', 'Other'];
                if (!p.gender || !validGenders.includes(p.gender)) {
                    throw new Error(`Passenger ${i + 1}: Gender must be one of: ${validGenders.join(', ')}`);
                }
                const seatNum = parseInt(p.seatNumber);
                if (isNaN(seatNum) || seatNum < 1 || seatNum > 32) {
                    throw new Error(`Passenger ${i + 1}: Seat number must be between 1 and 32`);
                }
            }
            // Validate passenger seat numbers match seats array
            const passengerSeatNumbers = passengers.map(p => parseInt(p.seatNumber));
            const requestedSeats = (req.body.seats || []).map(s => parseInt(s));
            const seatsMatch = requestedSeats.every(seat => passengerSeatNumbers.includes(seat));
            if (!seatsMatch || requestedSeats.length !== passengerSeatNumbers.length) {
                throw new Error('Passenger seat numbers must match selected seats');
            }
            return true;
        }),
    body('totalAmount')
        .notEmpty().withMessage('Total amount is required')
        .isFloat({ min: 0, max: 1000000 }).withMessage('Total amount must be a number between 0 and 1000000'),
    handleValidationErrors
];

const getBookingByIdValidators = [
    param('bookingId')
        .trim()
        .notEmpty().withMessage('Booking ID is required')
        .matches(/^BK\d+$/).withMessage('Invalid booking ID format (must start with BK followed by numbers)'),
    handleValidationErrors
];

const cancelBookingValidators = [
    param('bookingId')
        .trim()
        .notEmpty().withMessage('Booking ID is required')
        .matches(/^BK\d+$/).withMessage('Invalid booking ID format (must start with BK followed by numbers)'),
    handleValidationErrors
];

// ========== HANDLERS ==========

const getBookedSeatsHandler = async (req, res) => {
    try {
        const busId = parseInt(req.params.busId);
        const decodedDate = decodeURIComponent(req.params.date);
        
        const bookings = await bookingStore.findByBusId(busId);
        
        // Filter bookings for the specific date (normalize dates for comparison)
        const bookingsForDate = bookings.filter(b => {
            const bookingDate = b.date ? b.date.trim() : '';
            return bookingDate === decodedDate && b.status === 'confirmed';
        });
        
        // Extract all booked seat numbers
        const bookedSeats = [];
        bookingsForDate.forEach(booking => {
            if (Array.isArray(booking.seats)) {
                bookedSeats.push(...booking.seats.map(seat => parseInt(seat))); // Ensure all are numbers
            }
        });
        
        // Remove duplicates and sort
        const uniqueBookedSeats = [...new Set(bookedSeats)].sort((a, b) => a - b);
        
        // Get locked seats (seats being booked by other users)
        const lockedSeats = await getLockedSeatsForBus(busId, decodedDate);
        
        console.log(`Booked seats for bus ${busId} on ${decodedDate}:`, uniqueBookedSeats);
        console.log(`Locked seats for bus ${busId} on ${decodedDate}:`, lockedSeats);
        
        res.json({
            busId: busId,
            date: decodedDate,
            bookedSeats: uniqueBookedSeats,
            lockedSeats: lockedSeats // Seats currently being booked (temporarily locked)
        });
    } catch (error) {
        console.error('Error in getBookedSeatsHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const createBookingHandler = async (req, res) => {
    try {
        const { busId, date, seats, passengers, totalAmount } = req.body;
        const customerId = req.session.userId; // Get from session
        
        // Parse seat numbers
        const seatNumbers = seats.map(seat => parseInt(seat));
        
        // Verify bus exists
        const bus = await busStore.findById(parseInt(busId));
    if (!bus) {
        return res.status(404).json({ error: 'Bus not found' });
    }
    
        // STEP 1: Lock seats to prevent race conditions
        // This ensures no other user can book these seats while we process
        const lockResult = await lockSeats(parseInt(busId), date.trim(), seatNumbers, parseInt(customerId), 5);
        
        if (!lockResult.success) {
            // Some seats are already locked by another user
            return res.status(409).json({ 
                error: `Seat(s) ${lockResult.failedSeats.join(', ')} are currently being booked by another user. Please select different seats or try again in a few moments.`,
                lockedSeats: lockResult.failedSeats
            });
        }
        
        // Seats are now locked - proceed with booking validation
        try {
            // STEP 2: Check if any of the requested seats are already booked for this date
        const existingBookings = await bookingStore.findByBusId(parseInt(busId));
        const bookingsForDate = existingBookings.filter(b => {
            const bookingDate = b.date ? b.date.trim() : '';
            return bookingDate === date.trim() && b.status === 'confirmed';
        });
        
        // Extract all booked seat numbers for this date
        const bookedSeats = [];
        bookingsForDate.forEach(booking => {
            if (Array.isArray(booking.seats)) {
                bookedSeats.push(...booking.seats.map(seat => parseInt(seat))); // Ensure all are numbers
            }
        });
        const uniqueBookedSeats = [...new Set(bookedSeats)];
        
            // Check if any requested seat is already booked (double-check after lock)
        const conflictingSeats = seatNumbers.filter(seat => uniqueBookedSeats.includes(seat));
        if (conflictingSeats.length > 0) {
                // Release locks before returning error
                await releaseSeats(parseInt(busId), date.trim(), seatNumbers);
            return res.status(400).json({ 
                error: `Seat(s) ${conflictingSeats.join(', ')} are already booked for this date. Please select different seats.` 
            });
        }
        
        // Check available seats for this specific date (not global availableSeats)
        const totalSeats = bus.totalSeats || 32;
        const bookedCount = uniqueBookedSeats.length;
        const availableForDate = totalSeats - bookedCount;
        
        if (availableForDate < seatNumbers.length) {
                // Release locks before returning error
                await releaseSeats(parseInt(busId), date.trim(), seatNumbers);
            return res.status(400).json({ error: `Only ${availableForDate} seat(s) available for this date. Please select fewer seats.` });
        }
        
        // Get adminId from bus (for notifications, not stored in booking)
        const adminId = bus.adminId;
        if (!adminId) {
                // Release locks before returning error
                await releaseSeats(parseInt(busId), date.trim(), seatNumbers);
            return res.status(400).json({ error: 'Bus does not have an associated admin' });
        }
        
            // STEP 3: Create booking (seats are locked, safe to proceed)
        const bookingId = `BK${Date.now()}`;
    const booking = {
            bookingId: bookingId,
        busId: parseInt(busId),
        customerId: parseInt(customerId),
            date: date.trim(),
            seats: seatNumbers.sort((a, b) => a - b),
            passengers: passengers, // Keep passengers array in booking for backward compatibility
        totalAmount: parseFloat(totalAmount),
        status: 'confirmed'
    };
    
        const savedBooking = await bookingStore.add(booking);
        
        // STEP 4: Release locks after successful booking
        await releaseSeats(parseInt(busId), date.trim(), seatNumbers).catch(err => {
            console.error('[Seat Lock] Error releasing locks after booking:', err);
            // Don't fail the booking if lock release fails - locks will expire automatically
        });
        
        // Save passengers to database (normalized)
        const normalizedPassengers = passengers.map(passenger => ({
            bookingId: bookingId,
            name: passenger.name,
            age: passenger.age,
            gender: passenger.gender,
            seatNumber: passenger.seatNumber,
            seatType: passenger.seatType || null,
            price: passenger.price || null
        }));
        await passengerStore.addMultiple(normalizedPassengers);
        
        // NOTE: Do NOT update bus.availableSeats globally
        // Seats are date-specific, so availability is calculated from bookings per date
        // The bus.availableSeats field is kept for backward compatibility but not used for date-specific searches
        
        // Queue booking creation log (async, non-blocking)
        queueBookingCreationLog(
            parseInt(customerId),
            savedBooking.bookingId,
            {
                busId: savedBooking.busId,
                date: savedBooking.date,
                seats: savedBooking.seats,
                totalAmount: savedBooking.totalAmount,
                passengerCount: passengers.length
            },
            req
        ).catch(err => console.error('Error queueing booking creation log:', err));
        
        // Notify admin via SSE about new booking
        const notifyFn = getNotifyFunction();
        if (notifyFn) {
            notifyFn(parseInt(adminId), 'booking_created', {
                bookingId: savedBooking.bookingId,
                busId: savedBooking.busId
            }).catch(err => console.error('Error notifying SSE:', err));
        }
        
        // Queue booking confirmation email (async, non-blocking)
        // Get customer details for email
        try {
            const customer = await customerStore.findById(parseInt(customerId));
            if (customer && customer.email) {
                queueBookingConfirmationEmail(customer.email, {
                    customerName: customer.fullName || customer.name || 'Customer',
                    bookingId: savedBooking.bookingId,
                    busName: bus.busName,
                    from: bus.from,
                    to: bus.to,
                    date: savedBooking.date,
                    departureTime: bus.departureTime,
                    arrivalTime: bus.arrivalTime,
                    seats: savedBooking.seats,
                    totalAmount: savedBooking.totalAmount,
                    passengerCount: passengers.length,
                    passengers: passengers
                }).catch(emailError => {
                    // Log error but don't fail the booking
                    console.error('Error queueing booking confirmation email:', emailError);
                });
            }
        } catch (emailError) {
            // Don't fail the booking if email queueing fails
            console.error('Error preparing booking confirmation email:', emailError);
        }
        
        // Invalidate cache - booking created affects availability and customer bookings
        await invalidateCustomerBookings(parseInt(customerId));
        await invalidateAdminBookings(parseInt(adminId));
        await invalidateBusSearch(); // Invalidate all search results (seat availability changed)
        await invalidateBusById(parseInt(busId)); // Invalidate bus details cache
        
        res.status(201).json({
            message: 'Booking confirmed successfully',
            bookingId: savedBooking.bookingId,
            booking: {
                bookingId: savedBooking.bookingId,
                busId: savedBooking.busId,
                customerId: savedBooking.customerId,
                date: savedBooking.date,
                seats: savedBooking.seats,
                totalAmount: savedBooking.totalAmount,
                status: savedBooking.status
            }
        });
        } catch (innerError) {
            // Release locks on any error during booking creation
            await releaseSeats(parseInt(busId), date.trim(), seatNumbers).catch(err => {
                console.error('[Seat Lock] Error releasing locks on inner error:', err);
            });
            throw innerError; // Re-throw to be caught by outer catch
        }
    } catch (error) {
        console.error('Error in createBookingHandler:', error);
        
        // Ensure locks are released even if error occurs before inner try block
        // Check if we have the necessary variables to release locks
        if (req.body && req.body.busId && req.body.date && req.body.seats) {
            const seatNumbers = req.body.seats.map(seat => parseInt(seat));
            await releaseSeats(parseInt(req.body.busId), req.body.date.trim(), seatNumbers).catch(err => {
                console.error('[Seat Lock] Error releasing locks in error handler:', err);
            });
        }
        
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getCustomerBookingsHandler = async (req, res) => {
    try {
    const customerId = req.session.userId;
        
        // Check cache first
        const cachedBookings = await getCustomerBookings(customerId);
        if (cachedBookings) {
            console.log('[Cache] Customer bookings cache HIT for customer:', customerId);
            return res.json({
                bookings: cachedBookings,
                count: cachedBookings.length,
                cached: true
            });
        }
        
        console.log('[Cache] Customer bookings cache MISS for customer:', customerId);
        
        const customerBookings = await bookingStore.findByCustomerId(customerId);
        
        // Cache the result
        await setCustomerBookings(customerId, customerBookings);
    
    res.json({
        bookings: customerBookings,
        count: customerBookings.length
    });
    } catch (error) {
        console.error('Error in getCustomerBookingsHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Paginated customer bookings handler
const getCustomerBookingsPaginatedHandler = async (req, res) => {
    try {
        const customerId = req.session.userId;
        const page = parseInt(req.params.page) || 1;
        const limit = 5; // Fixed 5 items per page
        const sortOrder = req.query.sortOrder || 'latest'; // 'latest' or 'older'
        const filterBus = req.query.filterBus ? parseInt(req.query.filterBus) : null;
        const filterStatus = req.query.filterStatus || null;
        
        // Get all bookings for this customer
        const allCustomerBookings = await bookingStore.findByCustomerId(customerId);
        
        // Apply filters
        let filteredBookings = [...allCustomerBookings];
        
        if (filterBus) {
            filteredBookings = filteredBookings.filter(b => b.busId === filterBus);
        }
        
        if (filterStatus) {
            filteredBookings = filteredBookings.filter(b => b.status === filterStatus);
        }
        
        // Apply sorting by travel date
        filteredBookings.sort((a, b) => {
            const dateA = a.date ? new Date(a.date.trim()) : new Date(0);
            const dateB = b.date ? new Date(b.date.trim()) : new Date(0);
            
            if (sortOrder === 'latest') {
                // Latest travel dates first (descending)
                return dateB - dateA;
            } else {
                // Older travel dates first (ascending)
                return dateA - dateB;
            }
        });
        
        // Calculate pagination
        const totalCount = filteredBookings.length;
        const totalPages = Math.ceil(totalCount / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedBookings = filteredBookings.slice(startIndex, endIndex);
        
        // Get unique bus IDs from all bookings (for filter dropdown)
        const uniqueBusIds = [...new Set(allCustomerBookings.map(b => b.busId).filter(Boolean))];
        
        // Get unique bus IDs from paginated bookings (for current page)
        const busIdsForPage = [...new Set(paginatedBookings.map(b => b.busId).filter(Boolean))];
        
        // Fetch only required bus fields for current page bookings
        // Fetch buses for current page (only busId, busName, from, to)
        const buses = await Bus.findAll({
            where: {
                busId: { [Op.in]: busIdsForPage }
            },
            attributes: ['busId', 'busName', 'from', 'to'], // Only required fields for customer display
            raw: true
        });
        
        // Create a map of busId -> bus details
        const busMap = {};
        buses.forEach(bus => {
            busMap[bus.busId] = {
                busId: bus.busId,
                busName: bus.busName,
                from: bus.from,
                to: bus.to
            };
        });
        
        // Attach minimal bus details to each booking
        const bookingsWithBusDetails = paginatedBookings.map(booking => ({
            ...booking,
            bus: busMap[booking.busId] || null
        }));
        
        // Prepare filterData - only include buses on page 1 to reduce payload
        const filterData = {
            uniqueBusIds: uniqueBusIds
        };
        
        // Only fetch and include bus details for filter dropdown on page 1
        if (page === 1) {
            const allBusesForFilter = await Bus.findAll({
                where: {
                    busId: { [Op.in]: uniqueBusIds }
                },
                attributes: ['busId', 'busName', 'from', 'to'], // Only required fields
                raw: true
            });
            
            filterData.buses = allBusesForFilter.map(bus => ({
                busId: bus.busId,
                busName: bus.busName,
                from: bus.from,
                to: bus.to
            }));
        }
        
        res.json({
            bookings: bookingsWithBusDetails,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalCount: totalCount,
                limit: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            filterData: filterData
        });
    } catch (error) {
        console.error('Error in getCustomerBookingsPaginatedHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getAdminBookingsHandler = async (req, res) => {
    try {
        const adminId = parseInt(req.session.userId);
        
        // Check cache first
        const cachedBookings = await getAdminBookings(adminId);
        if (cachedBookings) {
            console.log('[Cache] Admin bookings cache HIT for admin:', adminId);
            return res.json({
                bookings: cachedBookings,
                count: cachedBookings.length,
                cached: true
            });
        }
        
        console.log('[Cache] Admin bookings cache MISS for admin:', adminId);
        
        const bookings = await bookingStore.findByAdminId(adminId);
        
        // Cache the result
        await setAdminBookings(adminId, bookings);
        
        res.json({
            bookings,
            count: bookings.length
        });
    } catch (error) {
        console.error('Error in getAdminBookingsHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getAllBookingsHandler = async (req, res) => {
    try {
        const bookings = await bookingStore.getAll();
        res.json({
            bookings,
            count: bookings.length
        });
    } catch (error) {
        console.error('Error in getAllBookingsHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getBookingByIdHandler = async (req, res) => {
    try {
        const bookingId = req.params.bookingId.trim();
        const booking = await bookingStore.findById(bookingId);
    
    if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ booking });
    } catch (error) {
        console.error('Error in getBookingByIdHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const cancelBookingHandler = async (req, res) => {
    try {
        const bookingId = req.params.bookingId.trim();
        const customerId = req.session.userId;
        
        // Find the booking
        const booking = await bookingStore.findById(bookingId);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Verify the booking belongs to the current customer
        if (parseInt(booking.customerId) !== parseInt(customerId)) {
            return res.status(403).json({ error: 'You can only cancel your own bookings' });
        }
        
        // Check if booking is already cancelled
        if (booking.status === 'cancelled') {
            return res.status(400).json({ error: 'This booking is already cancelled' });
        }
        
        // Update booking status to cancelled
        const updatedBooking = await bookingStore.update(bookingId, { status: 'cancelled' });
        
        if (!updatedBooking) {
            return res.status(500).json({ error: 'Failed to cancel booking' });
        }
        
        // Queue booking cancellation log (async, non-blocking)
        queueBookingCancellationLog(
            parseInt(customerId),
            bookingId,
            {
                busId: booking.busId,
                date: booking.date,
                seats: booking.seats || []
            },
            req
        ).catch(err => console.error('Error queueing booking cancellation log:', err));
        
        // Get adminId from bus (bookings don't store adminId directly)
        const bus = await busStore.findById(booking.busId);
        const adminId = bus ? bus.adminId : null;
        
        // Notify admin via SSE about booking cancellation
        if (adminId) {
            const notifyFn = getNotifyFunction();
            if (notifyFn) {
                notifyFn(parseInt(adminId), 'booking_cancelled', {
                    bookingId: bookingId,
                    busId: booking.busId,
                    cancelledBy: 'customer',
                    seats: booking.seats || [],
                    date: booking.date
                }).catch(err => console.error('Error notifying SSE:', err));
            }
        }
        
        // Queue cancellation email (async, non-blocking)
        try {
            const customer = await customerStore.findById(parseInt(customerId));
            if (customer && customer.email && bus) {
                queueBookingCancellationEmail(customer.email, {
                    customerName: customer.fullName || customer.name || 'Customer',
                    bookingId: bookingId,
                    busName: bus.busName,
                    from: bus.from,
                    to: bus.to,
                    date: booking.date,
                    totalAmount: booking.totalAmount
                }).catch(emailError => {
                    console.error('Error queueing cancellation email:', emailError);
                });
            }
        } catch (emailError) {
            console.error('Error preparing cancellation email:', emailError);
        }
        
        // Invalidate cache - cancellation affects availability and bookings
        await invalidateCustomerBookings(parseInt(customerId));
        if (adminId) {
            await invalidateAdminBookings(parseInt(adminId));
        }
        await invalidateBusSearch(); // Invalidate all search results (seat availability changed)
        await invalidateBusById(parseInt(booking.busId)); // Invalidate bus details cache
        
    res.json({
            message: 'Booking cancelled successfully',
            booking: updatedBooking
        });
    } catch (error) {
        console.error('Error in cancelBookingHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Track frontend activity
const trackFrontendActivityHandler = async (req, res) => {
    try {
        if (!req.session || !req.session.userId || req.session.userType !== 'customer') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { action, ...details } = req.body;
        const customerId = req.session.userId;
        
        const { logCustomerActivity } = require('../utils/customerLogger');
        logCustomerActivity(
            parseInt(customerId),
            action,
            {
                ...details,
                source: 'frontend'
            },
            req
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error in trackFrontendActivityHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ========== TREND VALIDATORS ==========

const getBookingTrendsValidators = [
    query('period')
        .optional()
        .isIn(['overall', 'today', 'pastWeek', 'pastMonth'])
        .withMessage('Period must be one of: overall, today, pastWeek, pastMonth'),
    query('type')
        .optional()
        .isIn(['daily', 'monthly'])
        .withMessage('Type must be one of: daily, monthly'),
    handleValidationErrors
];

// ========== TREND HANDLER ==========

const getBookingTrendsHandler = async (req, res) => {
    try {
        const adminId = parseInt(req.session.userId);
        const { period = 'overall', type = 'daily' } = req.query;
        
        // Get all bus IDs for this admin
        const adminBuses = await Bus.findAll({
            where: { adminId: adminId },
            attributes: ['busId'],
            raw: true
        });
        
        if (adminBuses.length === 0) {
            return res.json({
                labels: ['No Data'],
                data: [0]
            });
        }
        
        const busIds = adminBuses.map(bus => bus.busId);
        
        // Build date filter based on period (filter by createdAt - booking creation time)
        const whereClause = {
            busId: { [Op.in]: busIds }
        };
        
        if (period !== 'overall') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            today.setHours(0, 0, 0, 0);
            
            if (period === 'today') {
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                whereClause.createdAt = {
                    [Op.gte]: today,
                    [Op.lt]: tomorrow
                };
            } else if (period === 'pastWeek') {
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                whereClause.createdAt = {
                    [Op.gte]: weekAgo,
                    [Op.lt]: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Up to end of today
                };
            } else if (period === 'pastMonth') {
                const monthAgo = new Date(today);
                monthAgo.setDate(monthAgo.getDate() - 30);
                whereClause.createdAt = {
                    [Op.gte]: monthAgo,
                    [Op.lt]: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Up to end of today
                };
            }
        }
        
        let trends;
        
        if (type === 'daily') {
            // Daily trend - group by travel date (booking.date)
            trends = await Booking.findAll({
                where: whereClause,
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('date')), 'date'],
                    [sequelize.fn('COUNT', sequelize.col('booking_id')), 'count']
                ],
                group: [sequelize.fn('DATE', sequelize.col('date'))],
                order: [[sequelize.fn('DATE', sequelize.col('date')), 'ASC']],
                raw: true
            });
            
            const labels = trends.map(t => {
                // Format date as YYYY-MM-DD string
                const dateStr = t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date;
                return dateStr;
            });
            const data = trends.map(t => parseInt(t.count));
            
            return res.json({
                labels: labels.length > 0 ? labels : ['No Data'],
                data: data.length > 0 ? data : [0]
            });
        } else {
            // Monthly trend - group by year-month from travel date
            trends = await Booking.findAll({
                where: whereClause,
                attributes: [
                    [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('date')), 'month'],
                    [sequelize.fn('COUNT', sequelize.col('booking_id')), 'count']
                ],
                group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('date'))],
                order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('date')), 'ASC']],
                raw: true
            });
            
            const labels = trends.map(t => {
                const monthDate = t.month instanceof Date ? t.month : new Date(t.month);
                return monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
            });
            const data = trends.map(t => parseInt(t.count));
            
            return res.json({
                labels: labels.length > 0 ? labels : ['No Data'],
                data: data.length > 0 ? data : [0]
            });
        }
    } catch (error) {
        console.error('Error in getBookingTrendsHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    // Validators
    getBookedSeatsValidators,
    createBookingValidators,
    getBookingByIdValidators,
    cancelBookingValidators,
    getBookingTrendsValidators,
    // Handlers
    getBookedSeatsHandler,
    createBookingHandler,
    getCustomerBookingsHandler,
    getCustomerBookingsPaginatedHandler,
    getAdminBookingsHandler,
    getAllBookingsHandler,
    getBookingByIdHandler,
    cancelBookingHandler,
    getBookingTrendsHandler,
    trackFrontendActivityHandler
};
