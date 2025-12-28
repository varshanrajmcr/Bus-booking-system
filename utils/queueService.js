const { emailQueue, loggingQueue, notificationQueue, cleanupQueue } = require('./queueConfig');

/**
 * Queue Service - Helper functions to add jobs to queues
 */

/**
 * Add booking confirmation email to queue
 * @param {string} customerEmail - Customer email address
 * @param {Object} bookingData - Booking details
 * @returns {Promise<string>} Job ID
 */
async function queueBookingConfirmationEmail(customerEmail, bookingData) {
    if (!emailQueue) {
        console.warn('[Queue Service] Email queue not available (Redis not configured)');
        return null;
    }
    try {
        const job = await emailQueue.add(
            'booking-confirmation',
            {
                emailType: 'booking_confirmation',
                customerEmail,
                bookingData
            },
            {
                priority: 1, // High priority for booking confirmations
                jobId: `email-${bookingData.bookingId}-${Date.now()}`
            }
        );
        
        console.log(`[Queue Service] Booking confirmation email queued for ${customerEmail}, Job ID: ${job.id}`);
        return job.id;
    } catch (error) {
        console.error('[Queue Service] Error queueing booking confirmation email:', error);
        throw error;
    }
}

/**
 * Add booking cancellation email to queue
 * @param {string} customerEmail - Customer email address
 * @param {Object} bookingData - Cancellation details
 * @returns {Promise<string>} Job ID
 */
async function queueBookingCancellationEmail(customerEmail, bookingData) {
    if (!emailQueue) {
        console.warn('[Queue Service] Email queue not available (Redis not configured)');
        return null;
    }
    try {
        const job = await emailQueue.add(
            'booking-cancellation',
            {
                emailType: 'booking_cancellation',
                customerEmail,
                bookingData
            },
            {
                priority: 1,
                jobId: `email-cancel-${bookingData.bookingId}-${Date.now()}`
            }
        );
        
        console.log(`[Queue Service] Cancellation email queued for ${customerEmail}, Job ID: ${job.id}`);
        return job.id;
    } catch (error) {
        console.error('[Queue Service] Error queueing cancellation email:', error);
        throw error;
    }
}

/**
 * Add customer activity log to queue
 * @param {number} customerId - Customer ID
 * @param {string} action - Action performed
 * @param {Object} details - Action details
 * @param {Object} req - Express request object (optional)
 * @returns {Promise<string>} Job ID
 */
async function queueCustomerActivityLog(customerId, action, details, req = null) {
    if (!loggingQueue) {
        // Silently skip - logging is optional
        return null;
    }
    try {
        const job = await loggingQueue.add(
            'customer-activity',
            {
                logType: 'customer_activity',
                customerId,
                action,
                details,
                req: req ? {
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                    method: req.method,
                    url: req.url
                } : null
            },
            {
                priority: 0, // Normal priority for logging
                removeOnComplete: true // Don't keep completed log jobs
            }
        );
        
        return job.id;
    } catch (error) {
        console.error('[Queue Service] Error queueing customer activity log:', error);
        // Don't throw - logging failures shouldn't break the app
        return null;
    }
}

/**
 * Add booking creation log to queue
 * @param {number} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @param {Object} bookingData - Booking data
 * @param {Object} req - Express request object (optional)
 * @returns {Promise<string>} Job ID
 */
async function queueBookingCreationLog(customerId, bookingId, bookingData, req = null) {
    if (!loggingQueue) {
        // Silently skip - logging is optional
        return null;
    }
    try {
        const job = await loggingQueue.add(
            'booking-creation',
            {
                logType: 'booking_creation',
                customerId,
                action: 'booking_created',
                details: {
                    bookingId,
                    bookingData
                },
                req: req ? {
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                    method: req.method,
                    url: req.url
                } : null
            },
            {
                priority: 0,
                removeOnComplete: true
            }
        );
        
        return job.id;
    } catch (error) {
        console.error('[Queue Service] Error queueing booking creation log:', error);
        return null;
    }
}

/**
 * Add booking cancellation log to queue
 * @param {number} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @param {Object} bookingData - Cancellation data
 * @param {Object} req - Express request object (optional)
 * @returns {Promise<string>} Job ID
 */
async function queueBookingCancellationLog(customerId, bookingId, bookingData, req = null) {
    if (!loggingQueue) {
        // Silently skip - logging is optional
        return null;
    }
    try {
        const job = await loggingQueue.add(
            'booking-cancellation',
            {
                logType: 'booking_cancellation',
                customerId,
                action: 'booking_cancelled',
                details: {
                    bookingId,
                    bookingData
                },
                req: req ? {
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                    method: req.method,
                    url: req.url
                } : null
            },
            {
                priority: 0,
                removeOnComplete: true
            }
        );
        
        return job.id;
    } catch (error) {
        console.error('[Queue Service] Error queueing booking cancellation log:', error);
        return null;
    }
}

/**
 * Add admin notification to queue
 * @param {number} adminId - Admin ID
 * @param {string} notificationType - Type of notification
 * @param {Object} data - Notification data
 * @returns {Promise<string>} Job ID
 */
async function queueAdminNotification(adminId, notificationType, data) {
    if (!notificationQueue) {
        console.warn('[Queue Service] Notification queue not available (Redis not configured)');
        return null;
    }
    try {
        const job = await notificationQueue.add(
            'admin-notification',
            {
                notificationType,
                adminId,
                data
            },
            {
                priority: 1
            }
        );
        
        return job.id;
    } catch (error) {
        console.error('[Queue Service] Error queueing admin notification:', error);
        return null;
    }
}

/**
 * Schedule cleanup task
 * @param {string} cleanupType - Type of cleanup
 * @param {Object} data - Cleanup data
 * @param {number} delay - Delay in milliseconds
 * @returns {Promise<string>} Job ID
 */
async function scheduleCleanupTask(cleanupType, data, delay = 0) {
    if (!cleanupQueue) {
        console.warn('[Queue Service] Cleanup queue not available (Redis not configured)');
        return null;
    }
    try {
        const job = await cleanupQueue.add(
            'cleanup-task',
            {
                cleanupType,
                data
            },
            {
                delay, // Schedule for future execution
                attempts: 1
            }
        );
        
        return job.id;
    } catch (error) {
        console.error('[Queue Service] Error scheduling cleanup task:', error);
        return null;
    }
}

/**
 * Get queue statistics
 * @returns {Promise<Object>} Queue statistics
 */
async function getQueueStats() {
    if (!emailQueue || !loggingQueue || !notificationQueue || !cleanupQueue) {
        return null;
    }
    try {
        const [emailStats, loggingStats, notificationStats, cleanupStats] = await Promise.all([
            emailQueue.getJobCounts(),
            loggingQueue.getJobCounts(),
            notificationQueue.getJobCounts(),
            cleanupQueue.getJobCounts()
        ]);

        return {
            email: emailStats,
            logging: loggingStats,
            notification: notificationStats,
            cleanup: cleanupStats
        };
    } catch (error) {
        console.error('[Queue Service] Error getting queue stats:', error);
        return null;
    }
}

module.exports = {
    queueBookingConfirmationEmail,
    queueBookingCancellationEmail,
    queueCustomerActivityLog,
    queueBookingCreationLog,
    queueBookingCancellationLog,
    queueAdminNotification,
    scheduleCleanupTask,
    getQueueStats
};

