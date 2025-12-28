# BullMQ Implementation Guide

## Overview

BullMQ has been integrated into the bus booking system to handle background jobs efficiently. This document explains where and how BullMQ is being used effectively.

## What is BullMQ?

BullMQ is a Redis-based queue system for Node.js that provides:
- **Reliable job processing** - Jobs are persisted in Redis
- **Retry mechanisms** - Automatic retries with exponential backoff
- **Priority queues** - Important jobs processed first
- **Rate limiting** - Control job processing rate
- **Scalability** - Run workers across multiple processes/servers
- **Monitoring** - Track job status and queue metrics

## Where BullMQ is Effective in This Project

### 1. **Email Queue** (`email-queue`) ⭐ PRIMARY USE CASE

**Location:** `routes/bookingRoutes.js` - `createBookingHandler` and `cancelBookingHandler`

**Why it's effective:**
- **Non-blocking**: Email sending doesn't delay booking confirmation response
- **Reliability**: Failed emails are automatically retried (3 attempts with exponential backoff)
- **Scalability**: Can process multiple emails concurrently (5 at a time)
- **Rate limiting**: Prevents email service overload (max 10 emails per second)

**What it does:**
- Sends booking confirmation emails when tickets are successfully booked
- Sends cancellation emails when bookings are cancelled
- Handles EmailJS integration asynchronously

**Code Integration:**
```javascript
// In createBookingHandler (line ~291)
queueBookingConfirmationEmail(customer.email, {
    customerName: customer.fullName,
    bookingId: savedBooking.bookingId,
    busName: bus.busName,
    // ... other booking details
});
```

### 2. **Logging Queue** (`logging-queue`) ⭐ PERFORMANCE OPTIMIZATION

**Location:** `routes/bookingRoutes.js` - `createBookingHandler` and `cancelBookingHandler`

**Why it's effective:**
- **Performance**: Heavy logging operations don't block API responses
- **Throughput**: Processes 10 log entries concurrently
- **Non-critical**: Logging failures don't affect booking operations
- **Resource management**: Prevents logging from consuming too many resources

**What it does:**
- Queues customer activity logs
- Queues booking creation logs
- Queues booking cancellation logs

**Code Integration:**
```javascript
// In createBookingHandler (line ~268)
queueBookingCreationLog(
    customerId,
    bookingId,
    bookingData,
    req
);
```

### 3. **Notification Queue** (`notification-queue`)

**Location:** Can be used for admin notifications and alerts

**Why it's effective:**
- **Decoupling**: Separates notification logic from main business logic
- **Extensibility**: Easy to add SMS, push notifications, etc.
- **Reliability**: Ensures notifications are delivered even if service is temporarily down

**What it does:**
- Processes admin alerts and notifications
- Can be extended for SMS, push notifications, etc.

### 4. **Cleanup Queue** (`cleanup-queue`)

**Location:** Can be scheduled for maintenance tasks

**Why it's effective:**
- **Scheduled tasks**: Run cleanup jobs at specific times
- **Resource management**: Clean up old data, expired sessions, etc.
- **Non-intrusive**: Runs in background without affecting user operations

**What it does:**
- Scheduled cleanup of expired sessions
- Cleanup of old log files
- Database maintenance tasks

## Queue Configuration

### Queue Settings

**Email Queue:**
- **Concurrency**: 5 jobs at a time
- **Rate Limit**: 10 jobs per second
- **Retries**: 3 attempts with exponential backoff
- **Priority**: High (1) for booking confirmations

**Logging Queue:**
- **Concurrency**: 10 jobs at a time
- **Rate Limit**: 50 jobs per second
- **Retries**: 2 attempts
- **Priority**: Normal (0)

**Notification Queue:**
- **Concurrency**: 5 jobs at a time
- **Priority**: High (1)

**Cleanup Queue:**
- **Concurrency**: 1 job at a time (sequential)
- **Retries**: 1 attempt

## File Structure

```
utils/
├── queueConfig.js          # Queue configuration and Redis connection
├── queueProcessors.js      # Worker processors for each queue
└── queueService.js         # Helper functions to add jobs to queues

workers/
└── queueWorker.js          # Standalone worker process (optional)

routes/
└── bookingRoutes.js        # Integration point (uses queueService)
```

## Setup Instructions

### 1. Install Redis

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:latest
```

### 2. Configure Environment Variables

Add to `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Leave empty if no password
```

### 3. Start the Application

**Option 1: Workers run with main server (default)**
```bash
npm start
# or
npm run dev
```

**Option 2: Run workers separately (for scaling)**
```bash
# Terminal 1: Main server
npm start

# Terminal 2: Worker process
npm run worker
```

## Monitoring Queue Status

You can check queue statistics by calling:
```javascript
const { getQueueStats } = require('./utils/queueService');
const stats = await getQueueStats();
console.log(stats);
```

This returns:
```javascript
{
  email: {
    waiting: 0,
    active: 2,
    completed: 150,
    failed: 1,
    delayed: 0
  },
  logging: { ... },
  notification: { ... },
  cleanup: { ... }
}
```

## Benefits of This Implementation

### 1. **Improved Response Times**
- API responses are faster because heavy operations (emails, logging) are queued
- Users get immediate feedback on booking confirmations

### 2. **Better Reliability**
- Failed jobs are automatically retried
- Jobs persist in Redis, so they survive server restarts
- No data loss if service temporarily fails

### 3. **Scalability**
- Can run multiple worker processes
- Distribute load across servers
- Easy to scale email processing independently

### 4. **Resource Management**
- Rate limiting prevents service overload
- Concurrency control manages resource usage
- Priority queues ensure important jobs are processed first

### 5. **Maintainability**
- Clean separation of concerns
- Easy to add new queue types
- Centralized queue management

## Best Practices

1. **Always use queues for:**
   - External API calls (EmailJS, SMS, etc.)
   - Heavy I/O operations (file logging, database writes)
   - Non-critical operations that shouldn't block responses

2. **Don't use queues for:**
   - Critical synchronous operations
   - Operations that need immediate feedback
   - Simple in-memory operations

3. **Error Handling:**
   - Queue failures are logged but don't break the main flow
   - Retry mechanisms handle temporary failures
   - Monitor failed jobs regularly

## Troubleshooting

### Redis Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution:** Make sure Redis is running: `redis-cli ping` (should return `PONG`)

### Jobs Not Processing
**Check:**
1. Redis is running
2. Workers are initialized (check server logs)
3. Jobs are being added to queue (check queue stats)

### High Memory Usage
**Solution:** Adjust `removeOnComplete` and `removeOnFail` settings in `queueConfig.js`

## Future Enhancements

1. **Queue Dashboard**: Add Bull Board for visual queue monitoring
2. **Scheduled Jobs**: Use BullMQ's cron jobs for periodic tasks
3. **Job Priorities**: Implement different priority levels
4. **Dead Letter Queue**: Handle permanently failed jobs
5. **Metrics**: Integrate with monitoring tools (Prometheus, Grafana)

## Summary

BullMQ is effectively used in this project for:
- ✅ **Email sending** (booking confirmations, cancellations)
- ✅ **Logging operations** (customer activity, booking logs)
- ✅ **Background notifications** (admin alerts)
- ✅ **Scheduled cleanup tasks**

This implementation ensures the booking system is **fast, reliable, and scalable** while maintaining clean code architecture.

