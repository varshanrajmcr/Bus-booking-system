# Database Setup Instructions

## PostgreSQL Connection Error Fix

If you're getting a "password authentication failed" error, you need to configure your PostgreSQL credentials.

## Option 1: Create a .env file (Recommended)

1. Create a `.env` file in the project root:

```bash
# Database Configuration
DB_NAME=bus_booking_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
DB_HOST=localhost
DB_PORT=5432

# Node Environment
NODE_ENV=development
```

2. Replace `your_postgres_password_here` with your actual PostgreSQL password.

## Option 2: Set Environment Variables

```bash
export DB_PASSWORD=your_postgres_password_here
export DB_USER=postgres
export DB_NAME=bus_booking_db
export DB_HOST=localhost
export DB_PORT=5432
```

## Option 3: Update config/database.js directly

Edit `config/database.js` and replace the default password:

```javascript
password: process.env.DB_PASSWORD || 'your_actual_password',
```

## Create the Database

After configuring credentials, create the database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE bus_booking_db;

# Exit
\q
```

## Initialize Tables

Once the database is created and credentials are configured:

```bash
npm run init-db
```

This will create all necessary tables in your PostgreSQL database.

## Troubleshooting

- **"password authentication failed"**: Check your PostgreSQL password in `.env` file
- **"database does not exist"**: Run `CREATE DATABASE bus_booking_db;` in psql
- **"connection refused"**: Make sure PostgreSQL is running (`brew services start postgresql` on Mac)

