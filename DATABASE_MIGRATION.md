# Database Migration Guide

## Overview
The application has been migrated from JSON file storage to PostgreSQL database using Sequelize ORM.

## Prerequisites
1. PostgreSQL installed and running
2. Node.js and npm installed

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Create PostgreSQL Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE bus_booking_db;

# Exit psql
\q
```

### 3. Configure Database Connection
Update `config/database.js` or set environment variables:
- DB_NAME=bus_booking_db
- DB_USER=postgres
- DB_PASSWORD=your_password
- DB_HOST=localhost
- DB_PORT=5432

### 4. Initialize Database Tables
```bash
npm run init-db
```

This will:
- Connect to the database
- Create all necessary tables (customers, admins, enterprises, buses, bookings, passengers)
- Set up relationships between tables

## Important Notes

### Route Handlers Update Required
All route handlers in `busRoutes.js` and `bookingRoutes.js` need to be updated to use `async/await` since all dataStore methods are now async.

Example conversion:
```javascript
// Before
const handler = (req, res) => {
    const buses = busStore.getAll();
    res.json({ buses });
};

// After
const handler = async (req, res) => {
    try {
        const buses = await busStore.getAll();
        res.json({ buses });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
```

### Data Migration
If you have existing data in JSON files, you'll need to create a migration script to import that data into PostgreSQL.

## Model Structure

### Tables Created:
1. **customers** - Customer information
2. **admins** - Admin information
3. **enterprises** - Enterprise information
4. **buses** - Bus details
5. **bookings** - Booking records
6. **passengers** - Passenger details (normalized)

### Relationships:
- Admin → Enterprise (One-to-One)
- Admin → Bus (One-to-Many)
- Enterprise → Bus (One-to-Many)
- Customer → Booking (One-to-Many)
- Admin → Booking (One-to-Many)
- Bus → Booking (One-to-Many)
- Booking → Passenger (One-to-Many)

## Next Steps

1. Update all handlers in `routes/busRoutes.js` to be async
2. Update all handlers in `routes/bookingRoutes.js` to be async
3. Test all API endpoints
4. Migrate existing JSON data if needed

