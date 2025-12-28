const { sequelize, testConnection } = require('../config/database');
const { Customer, Admin, Enterprise, Bus, Booking, Passenger } = require('../models');

async function initializeDatabase() {
    try {
        // Test connection
        const connected = await testConnection();
        if (!connected) {
            console.error('Failed to connect to database. Please check your database configuration.');
            process.exit(1);
        }

        // Sync all models (create tables if they don't exist)
        // force: false means don't drop existing tables
        // alter: true means update tables to match models
        await sequelize.sync({ alter: true });
        console.log('Database tables synchronized successfully.');

        console.log('Database initialization completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    initializeDatabase();
}

module.exports = { initializeDatabase };

