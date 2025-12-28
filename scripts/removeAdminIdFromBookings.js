/**
 * Migration script to remove admin_id column from bookings table
 * Since bookings are now accessed through Bus (Admin -> Bus -> Booking),
 * the admin_id column is no longer needed.
 */

const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

async function removeAdminIdFromBookings() {
    try {
        console.log('Starting migration: Removing admin_id from bookings table...');
        
        // Check if column exists
        const checkColumn = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' 
            AND column_name = 'admin_id'
        `, { type: QueryTypes.SELECT });
        
        if (checkColumn.length === 0) {
            console.log('Column admin_id does not exist in bookings table. Migration not needed.');
            process.exit(0);
        }
        
        console.log('Column admin_id exists. Removing...');
        
        // Remove the foreign key constraint first (if it exists)
        try {
            await sequelize.query(`
                ALTER TABLE bookings 
                DROP CONSTRAINT IF EXISTS bookings_admin_id_fkey
            `);
            console.log(' Removed foreign key constraint (if it existed)');
        } catch (error) {
            console.log(' No foreign key constraint to remove (or already removed)');
        }
        
        // Remove the column
        await sequelize.query(`
            ALTER TABLE bookings 
            DROP COLUMN IF EXISTS admin_id
        `);
        
        console.log(' Successfully removed admin_id column from bookings table');
        console.log(' Migration completed successfully');
        
        process.exit(0);
    } catch (error) {
        console.error(' Error during migration:', error);
        process.exit(1);
    }
}

// Run migration
removeAdminIdFromBookings();

