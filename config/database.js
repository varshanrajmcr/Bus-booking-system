require('dotenv').config();
const { Sequelize } = require('sequelize');

// Database configuration
// Support multiple formats:
// 1. DATABASE_URL (Render, Heroku, etc.) - connection string format
// 2. Individual variables (DB_HOST, DB_NAME, etc.)
// 3. PostgreSQL standard variables (PGHOST, PGDATABASE, etc.)

let sequelize;

if (process.env.DATABASE_URL) {
    // Render/Heroku style connection string
    // Format: postgres://user:password@host:port/database
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        dialectOptions: {
            ssl: process.env.NODE_ENV === 'production' ? {
                require: true,
                rejectUnauthorized: false
            } : false
        }
    });
} else {
    // Use individual variables
    const dbPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '';
    const dbConfig = {
        database: process.env.DB_NAME || process.env.PGDATABASE || 'bus_booking_db',
        username: process.env.DB_USER || process.env.PGUSER || 'postgres',
        password: String(dbPassword), // Ensure password is always a string
        host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
        port: parseInt(process.env.DB_PORT || process.env.PGPORT) || 5432,
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

    sequelize = new Sequelize(dbConfig);
}

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

