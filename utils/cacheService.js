const IORedis = require('ioredis');

// Create separate Redis connection for caching (or reuse existing)
// Only connect if Redis is configured
let cacheClient = null;
let cacheAvailable = false;

// Check if Redis is configured
const hasRedisConfig = process.env.REDIS_URL || process.env.REDIS_HOST;

if (hasRedisConfig) {
    if (process.env.REDIS_URL) {
        // Redis URL connection string
        cacheClient = new IORedis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            db: 1, // Use different database for cache (0 is for BullMQ queues)
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });
    } else if (process.env.REDIS_HOST) {
        // Individual Redis variables
        cacheClient = new IORedis({
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            db: 1, // Use different database for cache (0 is for BullMQ queues)
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });
    }

    // Handle cache connection events
    if (cacheClient) {
        cacheClient.on('error', (error) => {
            console.error('[Cache] Redis connection error:', error.message);
            cacheAvailable = false;
        });

        cacheClient.on('connect', () => {
            console.log('[Cache] Redis cache connected successfully');
            cacheAvailable = true;
        });

        cacheClient.on('ready', () => {
            cacheAvailable = true;
        });
    }
} else {
    console.log('[Cache] Redis not configured - running without cache');
}

// Cache TTL constants (in seconds)
const CACHE_TTL = {
    BUS_LIST: 300,        // 5 minutes - bus lists don't change frequently
    BUS_DETAILS: 180,     // 3 minutes - individual bus details
    BUS_SEARCH: 120,      // 2 minutes - search results (shorter, more dynamic)
    CUSTOMER_BOOKINGS: 60, // 1 minute - bookings change more frequently
    ADMIN_BOOKINGS: 60,   // 1 minute - admin bookings
    CUSTOMER_DETAILS: 300, // 5 minutes - customer info doesn't change often
    ADMIN_DETAILS: 300     // 5 minutes - admin info
};

// Cache key prefixes
const CACHE_KEYS = {
    BUS: 'bus',
    BUS_LIST: 'bus:list',
    BUS_ADMIN: 'bus:admin',
    BUS_SEARCH: 'bus:search',
    BOOKING: 'booking',
    BOOKING_CUSTOMER: 'booking:customer',
    BOOKING_ADMIN: 'booking:admin',
    CUSTOMER: 'customer',
    ADMIN: 'admin'
};

/**
 * Generate cache key
 */
function getCacheKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
}

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null
 */
async function get(key) {
    if (!cacheClient || !cacheAvailable) return null;
    try {
        const value = await cacheClient.get(key);
        if (value) {
            return JSON.parse(value);
        }
        return null;
    } catch (error) {
        console.error(`[Cache] Error getting key ${key}:`, error.message);
        return null; // Return null on error, don't break the app
    }
}

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
async function set(key, value, ttl) {
    if (!cacheClient || !cacheAvailable) return false;
    try {
        const serialized = JSON.stringify(value);
        await cacheClient.setex(key, ttl, serialized);
        return true;
    } catch (error) {
        console.error(`[Cache] Error setting key ${key}:`, error.message);
        return false; // Return false on error, don't break the app
    }
}

/**
 * Delete cache key(s)
 * @param {string|string[]} keys - Cache key(s) to delete
 * @returns {Promise<number>} Number of keys deleted
 */
async function del(...keys) {
    if (!cacheClient || !cacheAvailable) return 0;
    try {
        if (keys.length === 0) return 0;
        const flatKeys = keys.flat();
        return await cacheClient.del(...flatKeys);
    } catch (error) {
        console.error(`[Cache] Error deleting keys:`, error.message);
        return 0;
    }
}

/**
 * Delete all cache keys matching a pattern
 * @param {string} pattern - Pattern to match (e.g., 'bus:*')
 * @returns {Promise<number>} Number of keys deleted
 */
async function delPattern(pattern) {
    if (!cacheClient || !cacheAvailable) return 0;
    try {
        const keys = await cacheClient.keys(pattern);
        if (keys.length === 0) return 0;
        return await cacheClient.del(...keys);
    } catch (error) {
        console.error(`[Cache] Error deleting pattern ${pattern}:`, error.message);
        return 0;
    }
}

/**
 * Cache bus list by admin ID
 */
async function getBusesByAdmin(adminId) {
    const key = getCacheKey(CACHE_KEYS.BUS_ADMIN, adminId);
    return await get(key);
}

async function setBusesByAdmin(adminId, buses) {
    const key = getCacheKey(CACHE_KEYS.BUS_ADMIN, adminId);
    return await set(key, buses, CACHE_TTL.BUS_LIST);
}

async function invalidateBusesByAdmin(adminId) {
    const key = getCacheKey(CACHE_KEYS.BUS_ADMIN, adminId);
    await del(key);
    // Also invalidate all bus lists
    await delPattern(`${CACHE_KEYS.BUS_LIST}:*`);
}

/**
 * Cache bus details by ID
 */
async function getBusById(busId) {
    const key = getCacheKey(CACHE_KEYS.BUS, busId);
    return await get(key);
}

async function setBusById(busId, bus) {
    const key = getCacheKey(CACHE_KEYS.BUS, busId);
    return await set(key, bus, CACHE_TTL.BUS_DETAILS);
}

async function invalidateBusById(busId) {
    const key = getCacheKey(CACHE_KEYS.BUS, busId);
    await del(key);
    // Also invalidate any search results that might include this bus
    await delPattern(`${CACHE_KEYS.BUS_SEARCH}:*`);
}

/**
 * Cache bus search results
 */
function getSearchCacheKey(from, to, date) {
    const normalizedFrom = from.toLowerCase().trim();
    const normalizedTo = to.toLowerCase().trim();
    return getCacheKey(CACHE_KEYS.BUS_SEARCH, normalizedFrom, normalizedTo, date);
}

async function getBusSearch(from, to, date) {
    const key = getSearchCacheKey(from, to, date);
    return await get(key);
}

async function setBusSearch(from, to, date, buses) {
    const key = getSearchCacheKey(from, to, date);
    return await set(key, buses, CACHE_TTL.BUS_SEARCH);
}

async function invalidateBusSearch() {
    await delPattern(`${CACHE_KEYS.BUS_SEARCH}:*`);
}

/**
 * Cache customer bookings
 */
async function getCustomerBookings(customerId) {
    const key = getCacheKey(CACHE_KEYS.BOOKING_CUSTOMER, customerId);
    return await get(key);
}

async function setCustomerBookings(customerId, bookings) {
    const key = getCacheKey(CACHE_KEYS.BOOKING_CUSTOMER, customerId);
    return await set(key, bookings, CACHE_TTL.CUSTOMER_BOOKINGS);
}

async function invalidateCustomerBookings(customerId) {
    const key = getCacheKey(CACHE_KEYS.BOOKING_CUSTOMER, customerId);
    await del(key);
}

/**
 * Cache admin bookings
 */
async function getAdminBookings(adminId) {
    const key = getCacheKey(CACHE_KEYS.BOOKING_ADMIN, adminId);
    return await get(key);
}

async function setAdminBookings(adminId, bookings) {
    const key = getCacheKey(CACHE_KEYS.BOOKING_ADMIN, adminId);
    return await set(key, bookings, CACHE_TTL.ADMIN_BOOKINGS);
}

async function invalidateAdminBookings(adminId) {
    const key = getCacheKey(CACHE_KEYS.BOOKING_ADMIN, adminId);
    await del(key);
}

/**
 * Cache customer details
 */
async function getCustomerById(customerId) {
    const key = getCacheKey(CACHE_KEYS.CUSTOMER, customerId);
    return await get(key);
}

async function setCustomerById(customerId, customer) {
    const key = getCacheKey(CACHE_KEYS.CUSTOMER, customerId);
    return await set(key, customer, CACHE_TTL.CUSTOMER_DETAILS);
}

async function invalidateCustomerById(customerId) {
    const key = getCacheKey(CACHE_KEYS.CUSTOMER, customerId);
    await del(key);
}

/**
 * Invalidate all bus-related cache
 */
async function invalidateAllBuses() {
    await Promise.all([
        delPattern(`${CACHE_KEYS.BUS}:*`),
        delPattern(`${CACHE_KEYS.BUS_LIST}:*`),
        delPattern(`${CACHE_KEYS.BUS_ADMIN}:*`),
        delPattern(`${CACHE_KEYS.BUS_SEARCH}:*`)
    ]);
}

/**
 * Invalidate all booking-related cache
 */
async function invalidateAllBookings() {
    await Promise.all([
        delPattern(`${CACHE_KEYS.BOOKING_CUSTOMER}:*`),
        delPattern(`${CACHE_KEYS.BOOKING_ADMIN}:*`)
    ]);
}

/**
 * Get cache statistics
 */
async function getStats() {
    if (!cacheClient || !cacheAvailable) return null;
    try {
        const info = await cacheClient.info('stats');
        const keyspace = await cacheClient.info('keyspace');
        return { info, keyspace };
    } catch (error) {
        console.error('[Cache] Error getting stats:', error);
        return null;
    }
}

// Graceful shutdown
async function closeCache() {
    if (cacheClient) {
        await cacheClient.quit();
        console.log('[Cache] Cache connection closed');
    }
}

module.exports = {
    // Generic cache operations
    get,
    set,
    del,
    delPattern,
    
    // Bus cache operations
    getBusesByAdmin,
    setBusesByAdmin,
    invalidateBusesByAdmin,
    getBusById,
    setBusById,
    invalidateBusById,
    getBusSearch,
    setBusSearch,
    invalidateBusSearch,
    invalidateAllBuses,
    
    // Booking cache operations
    getCustomerBookings,
    setCustomerBookings,
    invalidateCustomerBookings,
    getAdminBookings,
    setAdminBookings,
    invalidateAdminBookings,
    invalidateAllBookings,
    
    // Customer cache operations
    getCustomerById,
    setCustomerById,
    invalidateCustomerById,
    
    // Utility
    getStats,
    closeCache,
    CACHE_TTL
};

