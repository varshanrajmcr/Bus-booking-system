const { sequelize } = require('../config/database');
const { testConnection } = require('../config/database');

async function removeBusNameUniqueConstraint() {
    try {
        // Test connection
        const connected = await testConnection();
        if (!connected) {
            console.error('Failed to connect to database. Please check your database configuration.');
            process.exit(1);
        }

        console.log('Database connection established successfully.');

        // Check if the unique constraint exists
        const [constraints] = await sequelize.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'buses' 
            AND constraint_type = 'UNIQUE'
            AND constraint_name LIKE '%bus_name%'
        `);

        if (constraints.length === 0) {
            console.log('No unique constraint on bus_name found. It may have already been removed.');
            process.exit(0);
        }

        // Drop the unique constraint
        console.log('Removing unique constraint from bus_name...');
        for (const constraint of constraints) {
            try {
                await sequelize.query(`
                    ALTER TABLE "buses" DROP CONSTRAINT "${constraint.constraint_name}";
                `);
                console.log(`Successfully dropped constraint: ${constraint.constraint_name}`);
            } catch (err) {
                console.error(`Error dropping constraint ${constraint.constraint_name}:`, err.message);
            }
        }

        console.log('Successfully removed unique constraint from bus_name!');
        console.log('Now you can create multiple buses with the same name but different dates.');
        
        process.exit(0);
    } catch (error) {
        console.error('Error removing unique constraint:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    removeBusNameUniqueConstraint();
}

module.exports = { removeBusNameUniqueConstraint };

