const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

// Redis connection configuration
const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

// Queue names
const QUEUE_NAMES = {
    EMAIL: 'email-queue',
    LOGGING: 'logging-queue',
    NOTIFICATION: 'notification-queue',
    CLEANUP: 'cleanup-queue'
};

// Create queues
const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
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

const loggingQueue = new Queue(QUEUE_NAMES.LOGGING, {
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

const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        removeOnComplete: {
            age: 3600,
            count: 500
        }
    }
});

const cleanupQueue = new Queue(QUEUE_NAMES.CLEANUP, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true
    }
});

// Handle Redis connection errors
redisConnection.on('error', (error) => {
    console.error('Redis connection error:', error);
});

redisConnection.on('connect', () => {
    console.log('Redis connected successfully');
});

// Graceful shutdown
async function closeQueues() {
    await Promise.all([
        emailQueue.close(),
        loggingQueue.close(),
        notificationQueue.close(),
        cleanupQueue.close()
    ]);
    await redisConnection.quit();
    console.log('All queues closed gracefully');
}

module.exports = {
    redisConnection,
    emailQueue,
    loggingQueue,
    notificationQueue,
    cleanupQueue,
    QUEUE_NAMES,
    closeQueues
};

