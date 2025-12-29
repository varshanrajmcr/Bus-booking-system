require('dotenv').config();
const { Sequelize } = require('sequelize');

// Database configuration
// Load from environment variables or use defaults
// Support Render's DATABASE_URL, Railway's PostgreSQL variables (PGHOST, PGPORT, etc.) and custom variables
// Ensure password is always a string
const dbPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '';
const dbConfig = {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};

// Use DATABASE_URL if provided (e.g., by Render)
if (process.env.DATABASE_URL) {
    dbConfig.url = process.env.DATABASE_URL;
    // For Render and other cloud providers, enable SSL
    dbConfig.dialectOptions = {
        ssl: {
            require: true,
            rejectUnauthorized: false // For self-signed certificates or development
        }
    };
} else {
    // Fallback to individual variables
    dbConfig.database = process.env.DB_NAME || process.env.PGDATABASE || 'bus_booking_db';
    dbConfig.username = process.env.DB_USER || process.env.PGUSER || 'postgres';
    dbConfig.password = String(dbPassword); // Ensure password is always a string
    dbConfig.host = process.env.DB_HOST || process.env.PGHOST || 'localhost';
    dbConfig.port = parseInt(process.env.DB_PORT || process.env.PGPORT) || 5432;
    
    // Enable SSL for production connections (not localhost)
    if (process.env.NODE_ENV === 'production' && dbConfig.host !== 'localhost' && dbConfig.host !== '127.0.0.1') {
        dbConfig.dialectOptions = {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        };
    }
}

// Only include password warning if not using DATABASE_URL and password is empty
if (!process.env.DATABASE_URL && !dbPassword) {
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

