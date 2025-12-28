const { redisConnection } = require('./queueConfig');

// Seat lock configuration
const LOCK_TIMEOUT_MINUTES = 5; // Seats locked for 5 minutes
const LOCK_PREFIX = 'seat-lock';

/**
 * Generate lock key for a seat
 * @param {number} busId - Bus ID
 * @param {string} date - Travel date (YYYY-MM-DD)
 * @param {number} seatNumber - Seat number
 * @returns {string} Lock key
 */
function getSeatLockKey(busId, date, seatNumber) {
    return `${LOCK_PREFIX}:${busId}:${date}:${seatNumber}`;
}

/**
 * Generate lock key for multiple seats
 * @param {number} busId - Bus ID
 * @param {string} date - Travel date (YYYY-MM-DD)
 * @param {Array<number>} seatNumbers - Array of seat numbers
 * @returns {Array<string>} Array of lock keys
 */
function getSeatLockKeys(busId, date, seatNumbers) {
    return seatNumbers.map(seat => getSeatLockKey(busId, date, seat));
}

/**
 * Lock a single seat
 * @param {number} busId - Bus ID
 * @param {string} date - Travel date (YYYY-MM-DD)
 * @param {number} seatNumber - Seat number
 * @param {number} customerId - Customer ID who is locking
 * @param {number} timeoutMinutes - Lock timeout in minutes (default: 5)
 * @returns {Promise<boolean>} True if lock acquired, false if already locked
 */
async function lockSeat(busId, date, seatNumber, customerId, timeoutMinutes = LOCK_TIMEOUT_MINUTES) {
    if (!redisConnection) {
        console.warn('[Seat Lock] Redis not configured - seat locking disabled');
        return true; // Allow booking to proceed
    }
    try {
        const lockKey = getSeatLockKey(busId, date, seatNumber);
        const lockValue = JSON.stringify({
            customerId: parseInt(customerId),
            lockedAt: Date.now(),
            expiresAt: Date.now() + (timeoutMinutes * 60 * 1000),
            busId: parseInt(busId),
            date: date.trim(),
            seatNumber: parseInt(seatNumber)
        });
        
        // Try to set lock (only if key doesn't exist - NX flag)
        // EX sets expiration time in seconds
        const result = await redisConnection.set(
            lockKey,
            lockValue,
            'EX',  // Expire after
            timeoutMinutes * 60,  // seconds
            'NX'   // Only set if not exists
        );
        
        if (result === 'OK') {
            console.log(`[Seat Lock] Seat ${seatNumber} locked for customer ${customerId} on bus ${busId} for date ${date}`);
            return true;
        } else {
            console.log(`[Seat Lock] Seat ${seatNumber} already locked on bus ${busId} for date ${date}`);
            return false;
        }
    } catch (error) {
        console.error(`[Seat Lock] Error locking seat ${seatNumber}:`, error);
        throw error;
    }
}

/**
 * Lock multiple seats atomically
 * @param {number} busId - Bus ID
 * @param {string} date - Travel date (YYYY-MM-DD)
 * @param {Array<number>} seatNumbers - Array of seat numbers
 * @param {number} customerId - Customer ID who is locking
 * @param {number} timeoutMinutes - Lock timeout in minutes
 * @returns {Promise<{success: boolean, lockedSeats: Array<number>, failedSeats: Array<number>}>}
 */
async function lockSeats(busId, date, seatNumbers, customerId, timeoutMinutes = LOCK_TIMEOUT_MINUTES) {
    if (!redisConnection) {
        console.warn('[Seat Lock] Redis not configured - seat locking disabled');
        return { success: true, lockedSeats: seatNumbers, failedSeats: [] };
    }
    try {
        const lockedSeats = [];
        const failedSeats = [];
        
        // Try to lock each seat
        for (const seatNumber of seatNumbers) {
            const locked = await lockSeat(busId, date, seatNumber, customerId, timeoutMinutes);
            if (locked) {
                lockedSeats.push(seatNumber);
            } else {
                failedSeats.push(seatNumber);
            }
        }
        
        // If any seat failed to lock, release all locked seats
        if (failedSeats.length > 0) {
            console.log(`[Seat Lock] Failed to lock all seats. Releasing ${lockedSeats.length} locked seats.`);
            await releaseSeats(busId, date, lockedSeats);
            return {
                success: false,
                lockedSeats: [],
                failedSeats: failedSeats
            };
        }
        
        return {
            success: true,
            lockedSeats: lockedSeats,
            failedSeats: []
        };
    } catch (error) {
        console.error(`[Seat Lock] Error locking seats:`, error);
        throw error;
    }
}

/**
 * Release a single seat lock
 * @param {number} busId - Bus ID
 * @param {string} date - Travel date (YYYY-MM-DD)
 * @param {number} seatNumber - Seat number
 * @returns {Promise<boolean>} True if lock released
 */
async function releaseSeat(busId, date, seatNumber) {
    if (!redisConnection) return true;
    try {
        const lockKey = getSeatLockKey(busId, date, seatNumber);
        const result = await redisConnection.del(lockKey);
        
        if (result > 0) {
            console.log(`[Seat Lock] Seat ${seatNumber} lock released for bus ${busId} on date ${date}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`[Seat Lock] Error releasing seat ${seatNumber}:`, error);
        throw error;
    }
}

/**
 * Release multiple seat locks
 * @param {number} busId - Bus ID
 * @param {string} date - Travel date (YYYY-MM-DD)
 * @param {Array<number>} seatNumbers - Array of seat numbers
 * @returns {Promise<number>} Number of locks released
 */
async function releaseSeats(busId, date, seatNumbers) {
    if (!redisConnection) return seatNumbers ? seatNumbers.length : 0;
    try {
        if (!seatNumbers || seatNumbers.length === 0) {
            return 0;
        }
        
        const lockKeys = getSeatLockKeys(busId, date, seatNumbers);
        const result = await redisConnection.del(...lockKeys);
        
        console.log(`[Seat Lock] Released ${result} seat lock(s) for bus ${busId} on date ${date}`);
        return result;
    } catch (error) {
        console.error(`[Seat Lock] Error releasing seats:`, error);
        throw error;
    }
}

/**
 * Check if a seat is locked
 * @param {number} busId - Bus ID
 * @param {string} date - Travel date (YYYY-MM-DD)
 * @param {number} seatNumber - Seat number
 * @returns {Promise<{locked: boolean, lockInfo: Object|null}>}
 */
async function isSeatLocked(busId, date, seatNumber) {
    if (!redisConnection) return { locked: false, lockInfo: null };
    try {
        const lockKey = getSeatLockKey(busId, date, seatNumber);
        const lockValue = await redisConnection.get(lockKey);
        
        if (lockValue) {
            const lockInfo = JSON.parse(lockValue);
            return {
                locked: true,
                lockInfo: lockInfo
            };
        }
        
        return {
            locked: false,
            lockInfo: null
        };
    } catch (error) {
        console.error(`[Seat Lock] Error checking seat lock:`, error);
        return {
            locked: false,
            lockInfo: null
        };
    }
}

/**
 * Check if multiple seats are locked
 * @param {number} busId - Bus ID
 * @param {string} date - Travel date (YYYY-MM-DD)
 * @param {Array<number>} seatNumbers - Array of seat numbers
 * @returns {Promise<{lockedSeats: Array<number>, availableSeats: Array<number>}>}
 */
async function checkSeatsLocked(busId, date, seatNumbers) {
    if (!redisConnection) return { lockedSeats: [], availableSeats: seatNumbers };
    try {
        const lockedSeats = [];
        const availableSeats = [];
        
        for (const seatNumber of seatNumbers) {
            const { locked } = await isSeatLocked(busId, date, seatNumber);
            if (locked) {
                lockedSeats.push(seatNumber);
            } else {
                availableSeats.push(seatNumber);
            }
        }
        
        return {
            lockedSeats: lockedSeats,
            availableSeats: availableSeats
        };
    } catch (error) {
        console.error(`[Seat Lock] Error checking seats locked:`, error);
        return {
            lockedSeats: [],
            availableSeats: seatNumbers
        };
    }
}

/**
 * Get lock information for a seat
 * @param {number} busId - Bus ID
 * @param {string} date - Travel date (YYYY-MM-DD)
 * @param {number} seatNumber - Seat number
 * @returns {Promise<Object|null>} Lock information or null
 */
async function getSeatLockInfo(busId, date, seatNumber) {
    if (!redisConnection) return null;
    try {
        const lockKey = getSeatLockKey(busId, date, seatNumber);
        const lockValue = await redisConnection.get(lockKey);
        
        if (lockValue) {
            return JSON.parse(lockValue);
        }
        
        return null;
    } catch (error) {
        console.error(`[Seat Lock] Error getting lock info:`, error);
        return null;
    }
}

/**
 * Extend lock timeout for seats
 * @param {number} busId - Bus ID
 * @param {string} date - Travel date (YYYY-MM-DD)
 * @param {Array<number>} seatNumbers - Array of seat numbers
 * @param {number} additionalMinutes - Additional minutes to extend
 * @returns {Promise<number>} Number of locks extended
 */
async function extendSeatLocks(busId, date, seatNumbers, additionalMinutes = LOCK_TIMEOUT_MINUTES) {
    if (!redisConnection) return 0;
    try {
        let extendedCount = 0;
        
        for (const seatNumber of seatNumbers) {
            const lockKey = getSeatLockKey(busId, date, seatNumber);
            const exists = await redisConnection.exists(lockKey);
            
            if (exists) {
                await redisConnection.expire(lockKey, additionalMinutes * 60);
                extendedCount++;
            }
        }
        
        if (extendedCount > 0) {
            console.log(`[Seat Lock] Extended ${extendedCount} seat lock(s) by ${additionalMinutes} minutes`);
        }
        
        return extendedCount;
    } catch (error) {
        console.error(`[Seat Lock] Error extending locks:`, error);
        return 0;
    }
}

/**
 * Clean up expired locks (should be called periodically)
 * Note: Redis automatically expires keys, but this can be used for manual cleanup
 * @returns {Promise<number>} Number of expired locks found
 */
async function cleanupExpiredLocks() {
    if (!redisConnection) return 0;
    try {
        // Redis automatically expires keys based on TTL
        // This function is mainly for logging/monitoring
        const pattern = `${LOCK_PREFIX}:*`;
        const keys = await redisConnection.keys(pattern);
        
        let expiredCount = 0;
        const now = Date.now();
        
        for (const key of keys) {
            const lockValue = await redisConnection.get(key);
            if (lockValue) {
                try {
                    const lockInfo = JSON.parse(lockValue);
                    if (lockInfo.expiresAt && lockInfo.expiresAt < now) {
                        // Lock expired but Redis hasn't cleaned it up yet
                        await redisConnection.del(key);
                        expiredCount++;
                    }
                } catch (e) {
                    // Invalid lock data, delete it
                    await redisConnection.del(key);
                    expiredCount++;
                }
            }
        }
        
        if (expiredCount > 0) {
            console.log(`[Seat Lock] Cleaned up ${expiredCount} expired lock(s)`);
        }
        
        return expiredCount;
    } catch (error) {
        console.error(`[Seat Lock] Error cleaning up expired locks:`, error);
        return 0;
    }
}

/**
 * Get all locked seats for a bus and date
 * @param {number} busId - Bus ID
 * @param {string} date - Travel date (YYYY-MM-DD)
 * @returns {Promise<Array<number>>} Array of locked seat numbers
 */
async function getLockedSeatsForBus(busId, date) {
    if (!redisConnection) return [];
    try {
        const pattern = `${LOCK_PREFIX}:${busId}:${date}:*`;
        const keys = await redisConnection.keys(pattern);
        
        const lockedSeats = [];
        
        for (const key of keys) {
            const lockValue = await redisConnection.get(key);
            if (lockValue) {
                try {
                    const lockInfo = JSON.parse(lockValue);
                    lockedSeats.push(lockInfo.seatNumber);
                } catch (e) {
                    // Invalid lock data, skip
                }
            }
        }
        
        return lockedSeats;
    } catch (error) {
        console.error(`[Seat Lock] Error getting locked seats:`, error);
        return [];
    }
}

module.exports = {
    lockSeat,
    lockSeats,
    releaseSeat,
    releaseSeats,
    isSeatLocked,
    checkSeatsLocked,
    getSeatLockInfo,
    extendSeatLocks,
    cleanupExpiredLocks,
    getLockedSeatsForBus,
    LOCK_TIMEOUT_MINUTES
};

