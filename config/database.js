require('dotenv').config();
const { Sequelize } = require('sequelize');

// Database configuration
// Load from environment variables or use defaults
// Ensure password is always a string
const dbPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '';
const dbConfig = {
    database: process.env.DB_NAME || 'bus_booking_db',
    username: process.env.DB_USER || 'postgres',
    password: String(dbPassword), // Ensure password is always a string
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};

// Only include password if it's not empty (for cases where no password is needed)
if (!dbPassword) {
    console.warn('Warning: DB_PASSWORD is not set. If your PostgreSQL requires a password, set it in .env file.');
}

const sequelize = new Sequelize(dbConfig);

// Test database connection
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');
        return true;
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        return false;
    }
}

module.exports = { sequelize, testConnection };

