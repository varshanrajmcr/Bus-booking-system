const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

// Redis connection configuration
// Only connect if Redis is configured (REDIS_URL or REDIS_HOST is set)
let redisConnection = null;
let isRedisAvailable = false;

// Check if Redis is configured
const hasRedisConfig = process.env.REDIS_URL || process.env.REDIS_HOST;

if (hasRedisConfig) {
    if (process.env.REDIS_URL) {
        // Redis URL connection string (Railway, Render, etc.)
        redisConnection = new IORedis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });
    } else if (process.env.REDIS_HOST) {
        // Individual Redis variables
        redisConnection = new IORedis({
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });
    }

    // Handle Redis connection events
    if (redisConnection) {
        redisConnection.on('error', (error) => {
            console.error('Redis connection error:', error.message);
            isRedisAvailable = false;
        });

        redisConnection.on('connect', () => {
            console.log('Redis connected successfully');
            isRedisAvailable = true;
        });

        redisConnection.on('ready', () => {
            isRedisAvailable = true;
        });
    }
} else {
    console.log('Redis not configured - running without Redis (caching and queues disabled)');
}

// Queue names
const QUEUE_NAMES = {
    EMAIL: 'email-queue',
    LOGGING: 'logging-queue',
    NOTIFICATION: 'notification-queue',
    CLEANUP: 'cleanup-queue'
};

// Create queues only if Redis is available
let emailQueue, loggingQueue, notificationQueue, cleanupQueue;

if (redisConnection) {
    emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
        connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        },
        removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000 // Keep last 1000 completed jobs
        },
        removeOnFail: {
            age: 7 * 24 * 3600 // Keep failed jobs for 7 days
        }
    }
});

    loggingQueue = new Queue(QUEUE_NAMES.LOGGING, {
        connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 500
        },
        removeOnFail: {
            age: 24 * 3600 // Keep failed jobs for 24 hours
        }
    }
});

    notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
        connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        removeOnComplete: {
            age: 3600,
            count: 500
        }
    }
});

    cleanupQueue = new Queue(QUEUE_NAMES.CLEANUP, {
        connection: redisConnection,
        defaultJobOptions: {
            attempts: 1,
            removeOnComplete: true
        }
    });
}

// Graceful shutdown
async function closeQueues() {
    if (!redisConnection) return;
    
    const queuesToClose = [];
    if (emailQueue) queuesToClose.push(emailQueue.close());
    if (loggingQueue) queuesToClose.push(loggingQueue.close());
    if (notificationQueue) queuesToClose.push(notificationQueue.close());
    if (cleanupQueue) queuesToClose.push(cleanupQueue.close());

    await Promise.all(queuesToClose);
    
    if (redisConnection) {
        await redisConnection.quit();
    }
    console.log('All queues closed gracefully');
}

module.exports = {
    redisConnection,
    emailQueue,
    loggingQueue,
    notificationQueue,
    cleanupQueue,
    QUEUE_NAMES,
    closeQueues,
    isRedisAvailable: () => isRedisAvailable && redisConnection !== null
};

