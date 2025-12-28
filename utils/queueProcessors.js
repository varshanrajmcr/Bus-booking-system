const { Worker } = require('bullmq');
const { redisConnection, QUEUE_NAMES, isRedisAvailable } = require('./queueConfig');
const nodemailer = require('nodemailer');

// Gmail SMTP configuration
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FROM_EMAIL = process.env.FROM_EMAIL || GMAIL_USER;
const FROM_NAME = process.env.FROM_NAME || 'Bus Booking System';

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
    }
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('[Email] Gmail SMTP configuration error:', error);
    } else {
        console.log('[Email] Gmail SMTP server is ready to send emails');
    }
});

/**
 * Email Queue Processor
 * Processes booking confirmation emails
 */
let emailWorker, loggingWorker, notificationWorker, cleanupWorker;

// Only create workers if Redis is available
if (redisConnection) {
    emailWorker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job) => {
        const { emailType, customerEmail, bookingData } = job.data;
        
        try {
            if (emailType === 'booking_confirmation') {
                // Validate Gmail configuration
                if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
                    throw new Error('Gmail SMTP configuration missing. Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
                }

                // Format seat numbers
                const seatsString = Array.isArray(bookingData.seats) 
                    ? bookingData.seats.join(', ') 
                    : String(bookingData.seats);

                // Format date
                const formattedDate = bookingData.date 
                    ? new Date(bookingData.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })
                    : bookingData.date;

                // Prepare passenger details HTML
                let passengerDetailsHtml = '';
                if (Array.isArray(bookingData.passengers) && bookingData.passengers.length > 0) {
                    passengerDetailsHtml = bookingData.passengers.map((p, index) => 
                        `<tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${index + 1}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${p.name}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${p.age}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${p.gender}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${p.seatNumber}</td>
                        </tr>`
                    ).join('');
                }

                // HTML email template for booking confirmation
                const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        .header { 
            background: linear-gradient(135deg, #97d700 0%, #7ab800 100%); 
            color: white; 
            padding: 32px 20px; 
            text-align: center; 
            border-radius: 0;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .content { 
            background-color: #ffffff; 
            padding: 32px 24px; 
        }
        .greeting {
            font-size: 16px;
            color: #333333;
            margin-bottom: 20px;
        }
        .success-badge { 
            background: linear-gradient(135deg, #97d700 0%, #7ab800 100%); 
            color: white; 
            padding: 14px 24px; 
            border-radius: 8px; 
            display: inline-block; 
            margin: 20px 0; 
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 12px rgba(151, 215, 0, 0.3);
        }
        .booking-details { 
            background-color: #f8f9fa; 
            padding: 24px; 
            margin: 24px 0; 
            border-radius: 12px; 
            border: 1px solid #e0e0e0;
        }
        .booking-details h2 {
            color: #97d700;
            font-size: 20px;
            font-weight: 700;
            margin: 0 0 20px 0;
            padding-bottom: 12px;
            border-bottom: 2px solid #e0e0e0;
        }
        .detail-row { 
            margin: 12px 0; 
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label { 
            font-weight: 600; 
            color: #666666; 
            font-size: 14px;
        }
        .detail-value {
            color: #333333;
            font-weight: 500;
            font-size: 14px;
            text-align: right;
        }
        .footer { 
            text-align: center; 
            padding: 24px; 
            color: #999999; 
            font-size: 12px; 
            background-color: #f8f9fa;
            border-top: 1px solid #e0e0e0;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0; 
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
        }
        th { 
            background: linear-gradient(135deg, #97d700 0%, #7ab800 100%); 
            color: white; 
            padding: 12px; 
            text-align: left; 
            font-weight: 600;
            font-size: 13px;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #f0f0f0;
            font-size: 14px;
            color: #333333;
        }
        tr:last-child td {
            border-bottom: none;
        }
        tr:hover {
            background-color: #f8f9fa;
        }
        .info-text {
            background-color: #e6f7ff;
            border-left: 4px solid #97d700;
            padding: 16px;
            border-radius: 8px;
            margin: 20px 0;
            font-size: 14px;
            color: #333333;
        }
        .thank-you {
            margin-top: 24px;
            font-size: 15px;
            color: #333333;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎫 Booking Confirmed!</h1>
        </div>
        <div class="content">
            <p class="greeting">Dear ${bookingData.customerName || 'Customer'},</p>
            
            <div class="success-badge">✓ Your booking has been confirmed successfully!</div>
            
            <div class="booking-details">
                <h2>Booking Details</h2>
                <div class="detail-row">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value">${bookingData.bookingId}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Bus Name:</span>
                    <span class="detail-value">${bookingData.busName || 'Bus'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Route:</span>
                    <span class="detail-value">${bookingData.from || 'Origin'} → ${bookingData.to || 'Destination'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Travel Date:</span>
                    <span class="detail-value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Departure Time:</span>
                    <span class="detail-value">${bookingData.departureTime || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Arrival Time:</span>
                    <span class="detail-value">${bookingData.arrivalTime || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Seats:</span>
                    <span class="detail-value">${seatsString}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Amount:</span>
                    <span class="detail-value" style="color: #97d700; font-weight: 700; font-size: 16px;">₹${bookingData.totalAmount}</span>
                </div>
            </div>

            ${passengerDetailsHtml ? `
            <div class="booking-details">
                <h2>Passenger Details</h2>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Age</th>
                            <th>Gender</th>
                            <th>Seat</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${passengerDetailsHtml}
                    </tbody>
                </table>
            </div>
            ` : ''}

            <div class="info-text">
                <strong>📋 Important:</strong> Please keep this email for your records. You can use your Booking ID (<strong>${bookingData.bookingId}</strong>) to track or cancel your booking.
            </div>
            
            <p class="thank-you">Thank you for choosing our bus service. Have a safe journey! 🚌</p>
        </div>
        <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} Bus Booking System. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
                `;

                // Plain text version
                const textContent = `
Booking Confirmation

Dear ${bookingData.customerName || 'Customer'},

Your booking has been confirmed successfully!

Booking Details:
- Booking ID: ${bookingData.bookingId}
- Bus Name: ${bookingData.busName || 'Bus'}
- Route: ${bookingData.from || 'Origin'} to ${bookingData.to || 'Destination'}
- Travel Date: ${formattedDate}
- Departure Time: ${bookingData.departureTime || 'N/A'}
- Arrival Time: ${bookingData.arrivalTime || 'N/A'}
- Seats: ${seatsString}
- Total Amount: ₹${bookingData.totalAmount}

${Array.isArray(bookingData.passengers) && bookingData.passengers.length > 0 ? 
    'Passenger Details:\n' + bookingData.passengers.map((p, i) => 
        `${i + 1}. ${p.name} (Age: ${p.age}, Gender: ${p.gender}, Seat: ${p.seatNumber})`
    ).join('\n') : ''}

Please keep this email for your records. You can use your Booking ID (${bookingData.bookingId}) to track or cancel your booking.

Thank you for choosing our bus service. Have a safe journey!
                `;

                // Send email using Nodemailer
                const mailOptions = {
                    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
                    to: customerEmail,
                    subject: `Booking Confirmation - ${bookingData.bookingId}`,
                    text: textContent,
                    html: htmlContent
                };

                const info = await transporter.sendMail(mailOptions);

                console.log(`[Email Queue] Booking confirmation sent to ${customerEmail} for booking ${bookingData.bookingId}, Message ID: ${info.messageId}`);
                
                return {
                    success: true,
                    messageId: info.messageId,
                    email: customerEmail,
                    bookingId: bookingData.bookingId
                };
            } else if (emailType === 'booking_cancellation') {
                // Validate Gmail configuration
                if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
                    throw new Error('Gmail SMTP configuration missing. Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
                }

                // Format date
                const formattedDate = bookingData.date 
                    ? new Date(bookingData.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })
                    : bookingData.date;

                // Calculate refund amount (80% refund policy - can be customized)
                const refundAmount = bookingData.totalAmount ? (bookingData.totalAmount * 0.8).toFixed(2) : '0.00';
                const cancellationFee = bookingData.totalAmount ? (bookingData.totalAmount * 0.2).toFixed(2) : '0.00';

                // HTML email template for cancellation
                const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        .header { 
            background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); 
            color: white; 
            padding: 32px 20px; 
            text-align: center; 
            border-radius: 0;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .content { 
            background-color: #ffffff; 
            padding: 32px 24px; 
        }
        .greeting {
            font-size: 16px;
            color: #333333;
            margin-bottom: 20px;
        }
        .cancelled-badge { 
            background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); 
            color: white; 
            padding: 14px 24px; 
            border-radius: 8px; 
            display: inline-block; 
            margin: 20px 0; 
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 12px rgba(229, 62, 62, 0.3);
        }
        .booking-details { 
            background-color: #f8f9fa; 
            padding: 24px; 
            margin: 24px 0; 
            border-radius: 12px; 
            border: 1px solid #e0e0e0;
        }
        .booking-details h2 {
            color: #e53e3e;
            font-size: 20px;
            font-weight: 700;
            margin: 0 0 20px 0;
            padding-bottom: 12px;
            border-bottom: 2px solid #e0e0e0;
        }
        .detail-row { 
            margin: 12px 0; 
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label { 
            font-weight: 600; 
            color: #666666; 
            font-size: 14px;
        }
        .detail-value {
            color: #333333;
            font-weight: 500;
            font-size: 14px;
            text-align: right;
        }
        .footer { 
            text-align: center; 
            padding: 24px; 
            color: #999999; 
            font-size: 12px; 
            background-color: #f8f9fa;
            border-top: 1px solid #e0e0e0;
        }
        .refund-box { 
            background-color: #e6f7ff; 
            padding: 20px; 
            border-left: 4px solid #97d700; 
            margin: 20px 0; 
            border-radius: 8px;
        }
        .refund-box h3 {
            margin-top: 0; 
            color: #97d700; 
            font-size: 18px;
            font-weight: 700;
        }
        .refund-box p {
            margin: 8px 0;
            font-size: 14px;
            color: #333333;
        }
        .refund-amount {
            font-size: 24px;
            font-weight: 700;
            color: #97d700;
            margin: 8px 0;
        }
        .fee-box { 
            background-color: #fff5f5; 
            padding: 20px; 
            border-left: 4px solid #e53e3e; 
            margin: 20px 0; 
            border-radius: 8px;
        }
        .fee-box h3 {
            margin-top: 0; 
            color: #e53e3e; 
            font-size: 18px;
            font-weight: 700;
        }
        .fee-box p {
            margin: 8px 0;
            font-size: 14px;
            color: #333333;
        }
        .fee-amount {
            font-size: 20px;
            font-weight: 700;
            color: #e53e3e;
            margin: 8px 0;
        }
        .support-text {
            margin-top: 24px;
            font-size: 14px;
            color: #666666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>❌ Booking Cancelled</h1>
        </div>
        <div class="content">
            <p class="greeting">Dear ${bookingData.customerName || 'Customer'},</p>
            
            <div class="cancelled-badge">Your booking has been cancelled</div>
            
            <div class="booking-details">
                <h2>Cancelled Booking Details</h2>
                <div class="detail-row">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value">${bookingData.bookingId}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Bus Name:</span>
                    <span class="detail-value">${bookingData.busName || 'Bus'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Route:</span>
                    <span class="detail-value">${bookingData.from || 'Origin'} → ${bookingData.to || 'Destination'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Travel Date:</span>
                    <span class="detail-value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Original Amount:</span>
                    <span class="detail-value">₹${bookingData.totalAmount || '0.00'}</span>
                </div>
            </div>

            <div class="refund-box">
                <h3>💰 Refund Information</h3>
                <p><strong>Refund Amount:</strong></p>
                <p class="refund-amount">₹${refundAmount}</p>
                <p>A refund of ₹${refundAmount} (80% of the booking amount) will be processed to your original payment method within <strong>5-7 business days</strong>.</p>
            </div>

            <div class="fee-box">
                <h3>⚠️ Cancellation Fee</h3>
                <p><strong>Cancellation Fee:</strong></p>
                <p class="fee-amount">₹${cancellationFee}</p>
                <p>A cancellation fee of ₹${cancellationFee} (20% of the booking amount) has been deducted as per our cancellation policy.</p>
            </div>

            <p class="support-text">If you have any questions or concerns about this cancellation, please contact our customer support.</p>
            
            <p class="support-text">We hope to serve you again in the future.</p>
        </div>
        <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} Bus Booking System. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
                `;

                // Plain text version
                const textContent = `
Booking Cancellation

Dear ${bookingData.customerName || 'Customer'},

Your booking has been cancelled.

Cancelled Booking Details:
- Booking ID: ${bookingData.bookingId}
- Bus Name: ${bookingData.busName || 'Bus'}
- Route: ${bookingData.from || 'Origin'} to ${bookingData.to || 'Destination'}
- Travel Date: ${formattedDate}
- Original Amount: ₹${bookingData.totalAmount || '0.00'}

Refund Information:
- Refund Amount: ₹${refundAmount}
A refund of ₹${refundAmount} (80% of the booking amount) will be processed to your original payment method within 5-7 business days.

Cancellation Fee:
- Cancellation Fee: ₹${cancellationFee}
A cancellation fee of ₹${cancellationFee} (20% of the booking amount) has been deducted as per our cancellation policy.

If you have any questions or concerns about this cancellation, please contact our customer support.

We hope to serve you again in the future.
                `;

                // Send cancellation email using Nodemailer
                const mailOptions = {
                    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
                    to: customerEmail,
                    subject: `Booking Cancelled - ${bookingData.bookingId}`,
                    text: textContent,
                    html: htmlContent
                };

                const info = await transporter.sendMail(mailOptions);

                console.log(`[Email Queue] Cancellation email sent to ${customerEmail} for booking ${bookingData.bookingId}, Message ID: ${info.messageId}`);
                
                return {
                    success: true,
                    messageId: info.messageId,
                    email: customerEmail,
                    bookingId: bookingData.bookingId,
                    refundAmount: refundAmount
                };
            }
        } catch (error) {
            console.error(`[Email Queue] Error processing email job:`, error);
            throw error; // Re-throw to trigger retry mechanism
        }
    },
    {
        connection: redisConnection,
        concurrency: 5, // Process 5 emails concurrently
        limiter: {
            max: 10, // Max 10 jobs
            duration: 1000 // Per second
        }
    }
);

    // Email worker event handlers
    emailWorker.on('completed', (job) => {
        console.log(`[Email Queue] Job ${job.id} completed successfully`);
    });

    emailWorker.on('failed', (job, err) => {
        console.error(`[Email Queue] Job ${job.id} failed:`, err.message);
    });

    emailWorker.on('error', (err) => {
        console.error(`[Email Queue] Worker error:`, err);
    });

    /**
     * Logging Queue Processor
     * Processes heavy logging operations asynchronously
     */
    loggingWorker = new Worker(
    QUEUE_NAMES.LOGGING,
    async (job) => {
        const { logType, customerId, action, details, req } = job.data;
        
        try {
            if (logType === 'customer_activity') {
                // Import logger dynamically to avoid circular dependencies
                const { logCustomerActivity } = require('./customerLogger');
                logCustomerActivity(
                    customerId,
                    action,
                    details,
                    req
                );
            } else if (logType === 'booking_creation') {
                const { logBookingCreation } = require('./customerLogger');
                logBookingCreation(
                    customerId,
                    details.bookingId,
                    details.bookingData,
                    req
                );
            } else if (logType === 'booking_cancellation') {
                const { logBookingCancellation } = require('./customerLogger');
                logBookingCancellation(
                    customerId,
                    details.bookingId,
                    details.bookingData,
                    req
                );
            }
            
            return { success: true, logType, action };
        } catch (error) {
            console.error(`[Logging Queue] Error processing log job:`, error);
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 10, // Process 10 log entries concurrently
        limiter: {
            max: 50, // Max 50 jobs
            duration: 1000 // Per second
        }
    }
);

    // Logging worker event handlers
    loggingWorker.on('completed', (job) => {
        // Silently complete - logging is background task
    });

    loggingWorker.on('failed', (job, err) => {
        console.error(`[Logging Queue] Job ${job.id} failed:`, err.message);
    });

    /**
     * Notification Queue Processor
     * Processes admin notifications and alerts
     */
    notificationWorker = new Worker(
    QUEUE_NAMES.NOTIFICATION,
    async (job) => {
        const { notificationType, adminId, data } = job.data;
        
        try {
            // This can be extended for SMS, push notifications, etc.
            if (notificationType === 'admin_alert') {
                // Process admin alerts
                console.log(`[Notification Queue] Admin ${adminId} alert:`, data);
            }
            
            return { success: true, notificationType };
        } catch (error) {
            console.error(`[Notification Queue] Error processing notification:`, error);
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 5
    }
);

    /**
     * Cleanup Queue Processor
     * Processes scheduled cleanup tasks
     */
    cleanupWorker = new Worker(
    QUEUE_NAMES.CLEANUP,
    async (job) => {
        const { cleanupType, data } = job.data;
        
        try {
            if (cleanupType === 'expired_sessions') {
                // Clean up expired sessions
                console.log('[Cleanup Queue] Cleaning expired sessions');
            } else if (cleanupType === 'old_logs') {
                // Clean up old log files
                console.log('[Cleanup Queue] Cleaning old logs');
            } else if (cleanupType === 'expired_seat_locks') {
                // Clean up expired seat locks
                const { cleanupExpiredLocks } = require('./seatLockService');
                const cleanedCount = await cleanupExpiredLocks();
                console.log(`[Cleanup Queue] Cleaned up ${cleanedCount} expired seat lock(s)`);
            }
            
            return { success: true, cleanupType };
        } catch (error) {
            console.error(`[Cleanup Queue] Error processing cleanup:`, error);
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 1 // Run cleanup tasks one at a time
    }
    );
} else {
    console.log('[Queue Processors] Redis not configured - queue workers not initialized');
}

// Graceful shutdown
async function closeWorkers() {
    if (!redisConnection) return;
    
    const workersToClose = [];
    if (emailWorker) workersToClose.push(emailWorker.close());
    if (loggingWorker) workersToClose.push(loggingWorker.close());
    if (notificationWorker) workersToClose.push(notificationWorker.close());
    if (cleanupWorker) workersToClose.push(cleanupWorker.close());

    await Promise.all(workersToClose);
    console.log('All queue workers closed gracefully');
}

module.exports = {
    emailWorker,
    loggingWorker,
    notificationWorker,
    cleanupWorker,
    closeWorkers
};

