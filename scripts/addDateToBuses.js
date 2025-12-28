const { sequelize } = require('../config/database');
const { testConnection } = require('../config/database');

async function addDateColumnToBuses() {
    try {
        // Test connection
        const connected = await testConnection();
        if (!connected) {
            console.error('Failed to connect to database. Please check your database configuration.');
            process.exit(1);
        }

        console.log('Database connection established successfully.');

        // Check if date column already exists
        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'buses' AND column_name = 'date'
        `);

        if (results.length > 0) {
            console.log('Date column already exists in buses table.');
            // Ensure it's NOT NULL (in case Sequelize sync dropped it)
            console.log('Ensuring date column is NOT NULL...');
            try {
                await sequelize.query(`
                    ALTER TABLE "buses" ALTER COLUMN "date" SET NOT NULL;
                `);
                console.log('Date column is now NOT NULL.');
            } catch (err) {
                // If it's already NOT NULL, that's fine
                if (err.message && err.message.includes('already')) {
                    console.log('Date column is already NOT NULL.');
                } else {
                    console.log('Note: Could not set NOT NULL constraint (may already be set).');
                }
            }
            
            // Check if any buses have null dates and set them
            const [nullDates] = await sequelize.query(`
                SELECT COUNT(*) as count FROM "buses" WHERE "date" IS NULL
            `);
            if (nullDates[0].count > 0) {
                const today = new Date().toISOString().split('T')[0];
                console.log(`Found ${nullDates[0].count} bus(es) with null dates. Setting to ${today}...`);
                await sequelize.query(`
                    UPDATE "buses" 
                    SET "date" = '${today}'::DATE 
                    WHERE "date" IS NULL;
                `);
            }
            
            process.exit(0);
        }

        // Step 1: Add date column as nullable first
        console.log('Adding date column to buses table (nullable)...');
        await sequelize.query(`
            ALTER TABLE "buses" ADD COLUMN "date" DATE;
        `);

        // Step 2: Set default date for existing buses (use today's date)
        console.log('Setting default date for existing buses...');
        const today = new Date().toISOString().split('T')[0];
        await sequelize.query(`
            UPDATE "buses" 
            SET "date" = '${today}'::DATE 
            WHERE "date" IS NULL;
        `);

        // Step 3: Make the column NOT NULL
        console.log('Making date column NOT NULL...');
        await sequelize.query(`
            ALTER TABLE "buses" ALTER COLUMN "date" SET NOT NULL;
        `);

        console.log('Successfully added date column to buses table!');
        console.log(`All existing buses have been set to date: ${today}`);
        console.log('You may want to update these dates manually if needed.');
        console.log('\nNote: If you run init-db again, Sequelize may try to alter this column.');
        console.log('The date column is now NOT NULL in the database.');
        
        process.exit(0);
    } catch (error) {
        console.error('Error adding date column to buses:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    addDateColumnToBuses();
}

module.exports = { addDateColumnToBuses };

