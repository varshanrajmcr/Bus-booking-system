const { body, param, query } = require('express-validator');
const { busStore, bookingStore, enterpriseStore } = require('../utils/dataStore');
const { handleValidationErrors } = require('../utils/validationHelper');
const { Bus } = require('../models');
const { logBusCreation, logBusUpdate, logBusCancellation } = require('../utils/customerLogger');
const {
    getBusSearch, setBusSearch,
    getBusesByAdmin, setBusesByAdmin, invalidateBusesByAdmin,
    getBusById, setBusById, invalidateBusById,
    invalidateAllBuses
} = require('../utils/cacheService');

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

const searchBusesValidators = [
    body('from')
        .trim()
        .notEmpty().withMessage('From location is required')
        .isLength({ min: 2, max: 50 }).withMessage('From location must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s-]+$/).withMessage('From location must contain only letters, spaces, and hyphens'),
    body('to')
        .trim()
        .notEmpty().withMessage('To location is required')
        .isLength({ min: 2, max: 50 }).withMessage('To location must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s-]+$/).withMessage('To location must contain only letters, spaces, and hyphens')
        .custom((value, { req }) => {
            if (value.toLowerCase() === req.body.from?.toLowerCase()) {
                throw new Error('From and To locations cannot be the same');
            }
            return true;
        }),
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
    body('passengers')
        .optional()
        .isInt({ min: 1, max: 10 }).withMessage('Passengers must be between 1 and 10'),
    handleValidationErrors
];

const getBusByIdValidators = [
    param('id')
        .isInt({ min: 1 }).withMessage('Bus ID must be a positive integer'),
    handleValidationErrors
];

const addBusValidators = [
    body('busName')
        .trim()
        .notEmpty().withMessage('Bus name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Bus name must be between 2 and 100 characters'),
    body('enterpriseName')
        .trim()
        .notEmpty().withMessage('Enterprise name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Enterprise name must be between 2 and 50 characters'),
    body('from')
        .trim()
        .notEmpty().withMessage('From location is required')
        .isLength({ min: 2, max: 50 }).withMessage('From location must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s-]+$/).withMessage('From location must contain only letters, spaces, and hyphens'),
    body('to')
        .trim()
        .notEmpty().withMessage('To location is required')
        .isLength({ min: 2, max: 50 }).withMessage('To location must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s-]+$/).withMessage('To location must contain only letters, spaces, and hyphens')
        .custom((value, { req }) => {
            if (value.toLowerCase() === req.body.from?.toLowerCase()) {
                throw new Error('From and To locations cannot be the same');
            }
            return true;
        }),
    body('departureTime')
        .trim()
        .notEmpty().withMessage('Departure time is required')
        .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Departure time must be in HH:MM format (24-hour)'),
    body('arrivalTime')
        .trim()
        .notEmpty().withMessage('Arrival time is required')
        .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Arrival time must be in HH:MM format (24-hour)'),
    body('duration')
        .trim()
        .notEmpty().withMessage('Duration is required')
        .isLength({ min: 1, max: 20 }).withMessage('Duration must be between 1 and 20 characters'),
    body('seaterPrice')
        .notEmpty().withMessage('Seater price is required')
        .isFloat({ min: 0, max: 100000 }).withMessage('Seater price must be a number between 0 and 100000'),
    body('sleeperPrice')
        .notEmpty().withMessage('Sleeper price is required')
        .isFloat({ min: 0, max: 100000 }).withMessage('Sleeper price must be a number between 0 and 100000')
        .custom((value, { req }) => {
            if (parseFloat(value) <= parseFloat(req.body.seaterPrice || 0)) {
                throw new Error('Sleeper price must be higher than seater price');
            }
            return true;
        }),
    body('busType')
        .trim()
        .notEmpty().withMessage('Bus type is required')
        .isIn(['AC Seater/Sleeper', 'Non-AC Seater/Sleeper']).withMessage('Invalid bus type'),
    body('totalSeats')
        .notEmpty().withMessage('Total seats is required')
        .isInt({ min: 1, max: 50 }).withMessage('Total seats must be between 1 and 50'),
    body('date')
        .notEmpty().withMessage('Schedule date is required')
        .isISO8601().withMessage('Date must be a valid date')
        .custom((value) => {
            const selectedDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (selectedDate < today) {
                throw new Error('Schedule date cannot be in the past');
            }
            return true;
        }),
    handleValidationErrors
];

const updateBusValidators = [
    param('id')
        .isInt({ min: 1 }).withMessage('Bus ID must be a positive integer'),
    body('busName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Bus name must be between 2 and 100 characters'),
    body('from')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('From location must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s-]+$/).withMessage('From location must contain only letters, spaces, and hyphens'),
    body('to')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('To location must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s-]+$/).withMessage('To location must contain only letters, spaces, and hyphens'),
    body('departureTime')
        .optional()
        .trim()
        .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Departure time must be in HH:MM format (24-hour)'),
    body('arrivalTime')
        .optional()
        .trim()
        .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Arrival time must be in HH:MM format (24-hour)'),
    body('duration')
        .optional()
        .trim()
        .isLength({ min: 1, max: 20 }).withMessage('Duration must be between 1 and 20 characters'),
    body('seaterPrice')
        .optional()
        .isFloat({ min: 0, max: 100000 }).withMessage('Seater price must be a number between 0 and 100000'),
    body('sleeperPrice')
        .optional()
        .isFloat({ min: 0, max: 100000 }).withMessage('Sleeper price must be a number between 0 and 100000'),
    body('busType')
        .optional()
        .trim()
        .isIn(['AC Seater/Sleeper', 'Non-AC Seater/Sleeper']).withMessage('Invalid bus type'),
    body('totalSeats')
        .optional()
        .isInt({ min: 1, max: 50 }).withMessage('Total seats must be between 1 and 50'),
    body('date')
        .optional()
        .isISO8601().withMessage('Date must be a valid date')
        .custom((value) => {
            if (value) {
                const selectedDate = new Date(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selectedDate < today) {
                    throw new Error('Schedule date cannot be in the past');
                }
            }
            return true;
        }),
    handleValidationErrors
];

const deleteBusValidators = [
    param('id')
        .isInt({ min: 1 }).withMessage('Bus ID must be a positive integer'),
    handleValidationErrors
];

const getLocationsValidators = [
    query('q')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Query must be between 1 and 100 characters'),
    query('type')
        .optional()
        .isIn(['from', 'to', 'all']).withMessage('Type must be one of: from, to, all'),
    handleValidationErrors
];

// ========== HANDLERS ==========

const searchBusesHandler = async (req, res) => {
    try {
        const { from, to, date, passengers } = req.body;
        const passengersCount = passengers || 1;
        const currentTime = new Date(); // Current time for filtering already departed buses
        
        // Check cache first
        const cachedResult = await getBusSearch(from, to, date);
        if (cachedResult) {
            console.log('[Cache] Bus search cache HIT:', { from, to, date });
            // Filter cached results: exclude cancelled, inactive buses, already departed buses, and filter by passenger count
            const filteredBuses = cachedResult.buses.filter(bus => {
                const busStatus = bus.status || 'active';
                // Only show active buses (exclude cancelled and inactive)
                if (busStatus !== 'active') {
                    return false;
                }
                
                // Check if departure time has passed
                if (bus.date && bus.departureTime) {
                    const [year, month, day] = bus.date.trim().split('-').map(Number);
                    const [hours, minutes] = bus.departureTime.trim().split(':').map(Number);
                    const departureDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
                    
                    // Exclude buses where departure time has already passed
                    if (departureDateTime < currentTime) {
                        return false;
                    }
                }
                
                // Filter by passenger count
                return bus.availableSeatsForDate >= passengersCount;
            });
            return res.json({
                buses: filteredBuses,
                count: filteredBuses.length,
                cached: true
            });
        }
        
        console.log('[Cache] Bus search cache MISS:', { from, to, date });
        
        // Get buses from database (only active buses for search)
        const allBuses = await busStore.getAll();
        
        // Filter: only active buses that haven't departed yet
        const buses = allBuses.filter(bus => {
            const busStatus = bus.status || 'active';
            if (busStatus !== 'active') return false;
            
            // Check if departure time has passed
            if (bus.date && bus.departureTime) {
                const [year, month, day] = bus.date.trim().split('-').map(Number);
                const [hours, minutes] = bus.departureTime.trim().split(':').map(Number);
                const departureDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
                
                // Exclude buses where departure time has already passed
                if (departureDateTime < currentTime) {
                    return false;
                }
            }
            
            return true;
        });
    
        // Filter buses based on search criteria (use totalSeats for initial filter)
    const filteredBuses = buses.filter(bus => {
            const fromMatch = bus.from.toLowerCase() === from.trim().toLowerCase();
            const toMatch = bus.to.toLowerCase() === to.trim().toLowerCase();
            // Match date - compare date strings (YYYY-MM-DD format)
            const busDate = bus.date ? new Date(bus.date).toISOString().split('T')[0] : null;
            const searchDateStr = date.trim();
            const dateMatch = busDate === searchDateStr;
            // Use totalSeats for initial filtering - actual availability will be calculated per date below
            const totalSeats = bus.totalSeats || 32;
            const hasSeats = totalSeats >= passengersCount;
        
        return fromMatch && toMatch && dateMatch && hasSeats;
    });
    
        // For each bus, calculate booked seats for the specific date
        const busesWithBookedSeats = await Promise.all(filteredBuses.map(async (bus) => {
            // Get all bookings for this bus
            const bookings = await bookingStore.findByBusId(bus.busId || bus.id);
            
            // Filter bookings for the specific date (handle date format variations)
            const bookingsForDate = bookings.filter(b => {
                // Normalize dates for comparison (handle YYYY-MM-DD format)
                const bookingDate = b.date ? b.date.trim() : '';
                const searchDate = date.trim();
                return bookingDate === searchDate && b.status === 'confirmed';
});

            // Extract all booked seat numbers
            const bookedSeats = [];
            bookingsForDate.forEach(booking => {
                if (Array.isArray(booking.seats)) {
                    bookedSeats.push(...booking.seats.map(seat => parseInt(seat)));
                }
            });
            
            // Remove duplicates and sort
            const uniqueBookedSeats = [...new Set(bookedSeats)].sort((a, b) => a - b);
            
            // Calculate actual available seats for this date (total - booked)
            const totalSeats = bus.totalSeats || 32;
            const bookedCount = uniqueBookedSeats.length;
            const availableForDate = totalSeats - bookedCount;
            
            return {
                ...bus,
                bookedSeats: uniqueBookedSeats,
                bookedSeatsCount: bookedCount,
                availableSeatsForDate: availableForDate
            };
        }));
        
        // Filter buses by actual availability (not just totalSeats) and exclude already departed buses
        const busesWithEnoughSeats = busesWithBookedSeats.filter(bus => {
            // Check if departure time has passed
            if (bus.date && bus.departureTime) {
                const [year, month, day] = bus.date.trim().split('-').map(Number);
                const [hours, minutes] = bus.departureTime.trim().split(':').map(Number);
                const departureDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
                
                // Exclude buses where departure time has already passed
                if (departureDateTime < currentTime) {
                    return false;
                }
            }
            
            return bus.availableSeatsForDate >= passengersCount;
        });
        
        // Check if no single bus has enough seats, but multiple buses together might
        const totalAvailableSeats = busesWithBookedSeats.reduce((sum, bus) => 
            sum + bus.availableSeatsForDate, 0
        );
        
        // Prepare response
        const response = {
            buses: busesWithEnoughSeats,
            count: busesWithEnoughSeats.length
        };
        
        // Add warning if no single bus has enough seats but total available might be enough
        if (busesWithEnoughSeats.length === 0 && busesWithBookedSeats.length > 0 && totalAvailableSeats >= passengersCount) {
            response.warning = {
                message: `No single bus has ${passengersCount} seats available, but you can book from multiple buses.`,
                totalAvailableSeats: totalAvailableSeats,
                requestedSeats: passengersCount,
                availableBuses: busesWithBookedSeats.map(bus => ({
                    busId: bus.busId || bus.id,
                    busName: bus.busName,
                    enterpriseName: bus.enterpriseName,
                    availableSeats: bus.availableSeatsForDate,
                    from: bus.from,
                    to: bus.to,
                    departureTime: bus.departureTime,
                    arrivalTime: bus.arrivalTime
                }))
            };
            // Still return all buses so user can see them
            response.buses = busesWithBookedSeats;
        } else if (busesWithEnoughSeats.length === 0 && busesWithBookedSeats.length > 0) {
            // No buses have enough seats, and total available is also insufficient
            response.warning = {
                message: `No buses have enough seats available. Only ${totalAvailableSeats} seat(s) available across all buses, but you need ${passengersCount}.`,
                totalAvailableSeats: totalAvailableSeats,
                requestedSeats: passengersCount,
                availableBuses: busesWithBookedSeats.map(bus => ({
                    busId: bus.busId || bus.id,
                    busName: bus.busName,
                    enterpriseName: bus.enterpriseName,
                    availableSeats: bus.availableSeatsForDate,
                    from: bus.from,
                    to: bus.to,
                    departureTime: bus.departureTime,
                    arrivalTime: bus.arrivalTime
                }))
            };
            // Still return all buses so user can see them
            response.buses = busesWithBookedSeats;
        }
        
        // Filter out already departed buses before caching
        const busesForCache = busesWithBookedSeats.filter(bus => {
            if (bus.date && bus.departureTime) {
                const [year, month, day] = bus.date.trim().split('-').map(Number);
                const [hours, minutes] = bus.departureTime.trim().split(':').map(Number);
                const departureDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
                return departureDateTime >= currentTime;
            }
            return true;
        });
        
        // Cache the result (cache all buses with availability, not filtered by passenger count, but excluding already departed)
        await setBusSearch(from, to, date, {
            buses: busesForCache,
            count: busesForCache.length
        });
        
        res.json(response);
    } catch (error) {
        console.error('Error in searchBusesHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getAdminBusesHandler = async (req, res) => {
    try {
        const adminId = req.session.userId;
        
        // Check cache first
        const cachedBuses = await getBusesByAdmin(adminId);
        if (cachedBuses) {
            console.log('[Cache] Admin buses cache HIT for admin:', adminId);
            return res.json({ buses: cachedBuses, count: cachedBuses.length, cached: true });
        }
        
        console.log('[Cache] Admin buses cache MISS for admin:', adminId);
        
        const allBuses = await busStore.findByAdminId(adminId);
        // Include all buses (active, inactive, and cancelled) for admin dashboard
        // This ensures cancelled buses are available for displaying booking details
        const buses = allBuses;
        
        // Cache the result
        await setBusesByAdmin(adminId, buses);
        
        res.json({ buses, count: buses.length });
    } catch (error) {
        console.error('Error in getAdminBusesHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getAllBusesHandler = async (req, res) => {
    try {
        const buses = await busStore.getAll();
        res.json({ buses });
    } catch (error) {
        console.error('Error in getAllBusesHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get bus statuses by bus IDs (lightweight endpoint for checking cancelled buses)
const getBusStatusesHandler = async (req, res) => {
    try {
        const { busIds } = req.body;
        
        if (!Array.isArray(busIds) || busIds.length === 0) {
            return res.json({ statuses: {} });
        }
        
        // Convert to integers and filter out invalid IDs
        const validBusIds = busIds.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
        
        if (validBusIds.length === 0) {
            return res.json({ statuses: {} });
        }
        
        // Fetch only busId and status fields using Sequelize (efficient query)
        const { Op } = require('sequelize');
        const buses = await Bus.findAll({
            where: {
                busId: { [Op.in]: validBusIds }
            },
            attributes: ['busId', 'status'],
            raw: true
        });
        
        // Create a map of busId -> status
        const statuses = {};
        buses.forEach(bus => {
            statuses[bus.busId] = bus.status || 'active';
        });
        
        res.json({ statuses });
    } catch (error) {
        console.error('Error in getBusStatusesHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get buses by bus IDs (for customer bookings - only fetch buses they booked)
const getBusesByIdsHandler = async (req, res) => {
    try {
        const { busIds } = req.body;
        
        if (!Array.isArray(busIds) || busIds.length === 0) {
            return res.json({ buses: [] });
        }
        
        // Convert to integers and filter out invalid IDs
        const validBusIds = busIds.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
        
        if (validBusIds.length === 0) {
            return res.json({ buses: [] });
        }
        
        // Fetch buses by IDs using Sequelize
        const { Op } = require('sequelize');
        const buses = await Bus.findAll({
            where: {
                busId: { [Op.in]: validBusIds }
            },
            raw: true
        });
        
        res.json({ buses });
    } catch (error) {
        console.error('Error in getBusesByIdsHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getBusByIdHandler = async (req, res) => {
    try {
        const busId = parseInt(req.params.id);
        
        // Check cache first
        const cachedBus = await getBusById(busId);
        if (cachedBus) {
            console.log('[Cache] Bus details cache HIT for bus:', busId);
            return res.json({ bus: cachedBus, cached: true });
        }
        
        console.log('[Cache] Bus details cache MISS for bus:', busId);
        
        const bus = await busStore.findById(busId);
    
    if (!bus) {
        return res.status(404).json({ error: 'Bus not found' });
    }
    
    // Cache the result
    await setBusById(busId, bus);
    
    res.json({ bus });
    } catch (error) {
        console.error('Error in getBusByIdHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addBusHandler = async (req, res) => {
    try {
        const { busName, enterpriseName, from, to, date, departureTime, arrivalTime, duration, seaterPrice, sleeperPrice, busType, totalSeats } = req.body;
        const adminId = req.session.userId;
        
        // Create new bus
        const newBus = {
            busName: busName.trim(),
            adminId: parseInt(adminId),
            enterpriseName: enterpriseName.trim(),
            from: from.trim(),
            to: to.trim(),
            date: date.trim(),
            departureTime: departureTime.trim(),
            arrivalTime: arrivalTime.trim(),
            duration: duration.trim(),
            seaterPrice: Math.round(parseFloat(seaterPrice) * 100) / 100,
            sleeperPrice: Math.round(parseFloat(sleeperPrice) * 100) / 100,
            availableSeats: parseInt(totalSeats), // Initialize with total seats
            busType: busType.trim(),
            totalSeats: parseInt(totalSeats),
            status: 'active'
        };
        
        const savedBus = await busStore.add(newBus);
        
        // Log bus creation
        logBusCreation(parseInt(adminId), {
            busId: savedBus.busId || savedBus.id,
            busName: savedBus.busName,
            from: savedBus.from,
            to: savedBus.to,
            date: savedBus.date
        }, req);
        
        // Update enterprise bus count
        const enterprise = await enterpriseStore.findByName(enterpriseName.trim());
        if (enterprise) {
            const adminBuses = await busStore.findByAdminId(parseInt(adminId));
            await enterpriseStore.update(enterpriseName.trim(), {
                busCount: adminBuses.length
            });
        }
        
        // Invalidate cache for this admin's buses and all bus searches
        await invalidateBusesByAdmin(parseInt(adminId));
        await invalidateAllBuses();
        
        res.status(201).json({
            message: 'Bus scheduled successfully',
            bus: savedBus
        });
    } catch (error) {
        console.error('Error in addBusHandler:', error);
        
        // Handle Sequelize validation errors
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ 
                error: 'Validation failed',
                message: 'A bus with this name already exists. Please use a different name or schedule it for a different date.'
            });
        }
        
        if (error.name === 'SequelizeValidationError') {
            const errors = error.errors.map(err => ({
                field: err.path,
                message: err.message,
                value: err.value
            }));
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors
            });
        }
        
        res.status(500).json({ error: 'Internal server error' });
    }
};

const updateBusHandler = async (req, res) => {
    try {
        const busId = parseInt(req.params.id);
        const adminId = req.session.userId;
        const { busName, from, to, date, departureTime, arrivalTime, duration, seaterPrice, sleeperPrice, busType, totalSeats } = req.body;
        
        // Find bus
        const bus = await busStore.findById(busId);
        if (!bus) {
            return res.status(404).json({ error: 'Bus not found' });
        }
        
        // Check if admin owns this bus
        if (bus.adminId !== parseInt(adminId)) {
            return res.status(403).json({ error: 'You can only update your own buses' });
        }
        
        // Validate location matching
        const finalFrom = from !== undefined ? from.trim() : bus.from;
        const finalTo = to !== undefined ? to.trim() : bus.to;
        if (finalFrom.toLowerCase() === finalTo.toLowerCase()) {
            return res.status(400).json({ error: 'From and To locations cannot be the same' });
        }
        
        // Validate price relationship
        const finalSeaterPrice = seaterPrice !== undefined ? Math.round(parseFloat(seaterPrice) * 100) / 100 : bus.seaterPrice;
        const finalSleeperPrice = sleeperPrice !== undefined ? Math.round(parseFloat(sleeperPrice) * 100) / 100 : bus.sleeperPrice;
        if (finalSleeperPrice <= finalSeaterPrice) {
            return res.status(400).json({ error: 'Sleeper price must be higher than seater price' });
        }
        
        // Build updates object
        const updates = {};
        if (busName !== undefined) updates.busName = busName.trim();
        if (from !== undefined) updates.from = from.trim();
        if (to !== undefined) updates.to = to.trim();
        if (date !== undefined) updates.date = date.trim();
        if (departureTime !== undefined) updates.departureTime = departureTime.trim();
        if (arrivalTime !== undefined) updates.arrivalTime = arrivalTime.trim();
        if (duration !== undefined) updates.duration = duration.trim();
        if (seaterPrice !== undefined) updates.seaterPrice = Math.round(parseFloat(seaterPrice) * 100) / 100;
        if (sleeperPrice !== undefined) updates.sleeperPrice = Math.round(parseFloat(sleeperPrice) * 100) / 100;
        if (busType !== undefined) updates.busType = busType.trim();
        if (totalSeats !== undefined) {
            updates.totalSeats = parseInt(totalSeats);
            // Update availableSeats if totalSeats changed (but don't go below current bookings)
            const bookings = await bookingStore.findByBusId(busId);
            const totalBooked = bookings.reduce((sum, b) => sum + (b.seats ? b.seats.length : 0), 0);
            updates.availableSeats = Math.max(parseInt(totalSeats) - totalBooked, 0);
        }
        
        const updatedBus = await busStore.update(busId, updates);
        
        if (updatedBus) {
            // Log bus update
            logBusUpdate(parseInt(adminId), busId, updates, req);
            
            // Invalidate cache for this bus and admin's buses
            await invalidateBusById(busId);
            await invalidateBusesByAdmin(parseInt(adminId));
            await invalidateAllBuses();
            
            // Notify admin via SSE about bus update
            const notifyFn = getNotifyFunction();
            if (notifyFn) {
                notifyFn(parseInt(adminId), 'bus_updated', {
                    busId: busId
                }).catch(err => console.error('Error notifying SSE:', err));
            }
            
            res.json({
                message: 'Bus updated successfully',
                bus: updatedBus
            });
        } else {
            res.status(500).json({ error: 'Failed to update bus' });
        }
    } catch (error) {
        console.error('Error in updateBusHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const deleteBusHandler = async (req, res) => {
    try {
        const busId = parseInt(req.params.id);
        const adminId = req.session.userId;
        
        // Find bus
        const bus = await busStore.findById(busId);
        if (!bus) {
            return res.status(404).json({ error: 'Bus not found' });
        }
        
        // Check if admin owns this bus
        if (bus.adminId !== parseInt(adminId)) {
            return res.status(403).json({ error: 'You can only delete your own buses' });
        }
        
        // Check if bus has any bookings and cancel them
        const bookings = await bookingStore.findByBusId(busId);
        if (bookings.length > 0) {
            // Update all bookings for this bus to cancelled status
            const cancelledCount = await bookingStore.updateByBusId(busId, { 
                status: 'cancelled' 
            });
            console.log(`Cancelled ${cancelledCount} booking(s) for bus ${busId} (${bus.busName})`);
        }
        
        // Mark bus as cancelled instead of deleting it (preserves bookings and bus data)
        await busStore.update(busId, { status: 'cancelled' });
        
        // Log bus cancellation
        logBusCancellation(parseInt(adminId), busId, {
            busName: bus.busName,
            date: bus.date
        }, req);
        
        // Update enterprise bus count
        const enterprise = await enterpriseStore.findByAdminId(parseInt(adminId));
        if (enterprise) {
            const adminBuses = await busStore.findByAdminId(parseInt(adminId));
            await enterpriseStore.update(enterprise.enterpriseName, {
                busCount: adminBuses.length
            });
        }
        
        // Invalidate cache for this bus and admin's buses
        await invalidateBusById(busId);
        await invalidateBusesByAdmin(parseInt(adminId));
        await invalidateAllBuses();
        
        // Notify admin via SSE about bus cancellation
        const notifyFn = getNotifyFunction();
        if (notifyFn) {
            notifyFn(parseInt(adminId), 'bus_cancelled', {
                busId: busId
            }).catch(err => console.error('Error notifying SSE:', err));
        }
        
        res.json({
            message: 'Bus cancelled successfully'
        });
    } catch (error) {
        console.error('Error in deleteBusHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get location suggestions (autocomplete)
const getLocationsHandler = async (req, res) => {
    try {
        const { q = '', type = 'all' } = req.query;
        const query = q.trim().toLowerCase();
        
        // Get all active buses
        const allBuses = await busStore.getAll();
        const activeBuses = allBuses.filter(bus => (bus.status || 'active') === 'active');
        
        // Collect unique locations
        const locationsSet = new Set();
        
        activeBuses.forEach(bus => {
            if (type === 'from' || type === 'all') {
                if (bus.from) {
                    locationsSet.add(bus.from.trim());
                }
            }
            if (type === 'to' || type === 'all') {
                if (bus.to) {
                    locationsSet.add(bus.to.trim());
                }
            }
        });
        
        // Convert to array and filter by query if provided
        let locations = Array.from(locationsSet);
        
        if (query.length > 0) {
            locations = locations.filter(location => 
                location.toLowerCase().includes(query)
            );
        }
        
        // Sort alphabetically
        locations.sort((a, b) => a.localeCompare(b));
        
        // Limit results to 20 for performance
        locations = locations.slice(0, 20);
        
        res.json({
            locations,
            count: locations.length,
            query: q
        });
    } catch (error) {
        console.error('Error in getLocationsHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Sync all bus locations to OpenSearch (admin only, for initial setup and manual sync)
const syncLocationsHandler = async (req, res) => {
    try {
        const result = await syncAllLocations();
        res.json({
            message: 'Locations synced to OpenSearch successfully',
            indexed: result.indexed,
            errors: result.errors
        });
    } catch (error) {
        console.error('Error in syncLocationsHandler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    // Validators
    searchBusesValidators,
    getBusByIdValidators,
    addBusValidators,
    updateBusValidators,
    deleteBusValidators,
    getLocationsValidators,
    // Handlers
    searchBusesHandler,
    getAdminBusesHandler,
    getAllBusesHandler,
    getBusStatusesHandler,
    getBusesByIdsHandler,
    getBusByIdHandler,
    addBusHandler,
    updateBusHandler,
    deleteBusHandler,
    getLocationsHandler
};
