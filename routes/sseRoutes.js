const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { busStore, bookingStore } = require('../utils/dataStore');

// Store active SSE connections for admins
const adminConnections = new Map(); // Map<adminId, Set<Response>>

// Helper function to send data to all connected clients for an admin
function broadcastToAdmin(adminId, eventType, data) {
    const connections = adminConnections.get(adminId);
    if (connections) {
        const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        connections.forEach(res => {
            try {
                res.write(message);
            } catch (error) {
                console.error('Error sending SSE message:', error);
                // Remove broken connection
                connections.delete(res);
            }
        });
    }
}

// SSE endpoint for admin dashboard real-time updates
router.get('/admin/stream', requireAdmin, async (req, res) => {
    const adminId = req.session.userId;
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    
    // Add this connection to the admin's connection set
    if (!adminConnections.has(adminId)) {
        adminConnections.set(adminId, new Set());
    }
    adminConnections.get(adminId).add(res);
    
    console.log(`SSE connection established for admin ${adminId}. Total connections: ${adminConnections.get(adminId).size}`);
    
    // Send initial data immediately
    try {
        const [buses, bookings] = await Promise.all([
            busStore.findByAdminId(adminId),
            bookingStore.findByAdminId(adminId)
        ]);
        
        const activeBuses = buses.filter(bus => (bus.status || 'active') === 'active');
        
        // Send initial data with event type
        const initialData = { 
            buses: activeBuses, 
            bookings: bookings,
            timestamp: Date.now()
        };
        res.write(`event: initial\ndata: ${JSON.stringify(initialData)}\n\n`);
    } catch (error) {
        console.error('Error sending initial SSE data:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Error loading initial data' })}\n\n`);
    }
    
    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
        try {
            res.write(`: heartbeat\n\n`);
        } catch (error) {
            clearInterval(heartbeatInterval);
        }
    }, 30000);
    
    // Handle client disconnect
    req.on('close', () => {
        console.log(`SSE connection closed for admin ${adminId}`);
        clearInterval(heartbeatInterval);
        const connections = adminConnections.get(adminId);
        if (connections) {
            connections.delete(res);
            if (connections.size === 0) {
                adminConnections.delete(adminId);
            }
        }
    });
    
    // Handle errors
    req.on('error', (error) => {
        console.error(`SSE connection error for admin ${adminId}:`, error);
        clearInterval(heartbeatInterval);
        const connections = adminConnections.get(adminId);
        if (connections) {
            connections.delete(res);
            if (connections.size === 0) {
                adminConnections.delete(adminId);
            }
        }
    });
});

// Function to notify all admins when data changes (called from other routes)
async function notifyAdminDataChange(adminId, eventType, data) {
    if (adminConnections.has(adminId)) {
        // Refresh data from database
        try {
            const [buses, bookings] = await Promise.all([
                busStore.findByAdminId(adminId),
                bookingStore.findByAdminId(adminId)
            ]);
            
            const activeBuses = buses.filter(bus => (bus.status || 'active') === 'active');
            
            broadcastToAdmin(adminId, eventType, {
                buses: activeBuses,
                bookings: bookings,
                timestamp: Date.now(),
                ...data
            });
        } catch (error) {
            console.error('Error notifying admin data change:', error);
        }
    }
}

module.exports = {
    router,
    notifyAdminDataChange,
    broadcastToAdmin
};

