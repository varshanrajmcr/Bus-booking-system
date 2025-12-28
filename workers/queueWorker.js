/**
 * Standalone BullMQ Worker Process
 * 
 * This file can be run independently to process queue jobs
 * Useful for scaling workers across multiple processes/servers
 * 
 * Usage: node workers/queueWorker.js
 */

require('dotenv').config();

console.log('Starting BullMQ workers...');

// Initialize queue processors (this will start all workers)
const { closeWorkers } = require('../utils/queueProcessors');

console.log('All queue workers started and ready to process jobs');

// Handle graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`${signal} received: shutting down workers gracefully`);
    try {
        await closeWorkers();
        console.log('Workers shut down successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error shutting down workers:', error);
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception in worker:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection in worker:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

