const { sequelize } = require('../config/database');
const Customer = require('./Customer');
const Admin = require('./Admin');
const Enterprise = require('./Enterprise');
const Bus = require('./Bus');
const Booking = require('./Booking');
const Passenger = require('./Passenger');

// Define associations
// Admin -> Enterprise (One-to-One)
Admin.hasOne(Enterprise, { foreignKey: 'adminId', as: 'enterprise' });
Enterprise.belongsTo(Admin, { foreignKey: 'adminId', as: 'admin' });

// Admin -> Bus (One-to-Many)
Admin.hasMany(Bus, { foreignKey: 'adminId', as: 'buses' });
Bus.belongsTo(Admin, { foreignKey: 'adminId', as: 'admin' });

// Enterprise -> Bus (One-to-Many via enterpriseName)
Enterprise.hasMany(Bus, { foreignKey: 'enterpriseName', sourceKey: 'enterpriseName', as: 'buses' });
Bus.belongsTo(Enterprise, { foreignKey: 'enterpriseName', targetKey: 'enterpriseName', as: 'enterprise' });

// Customer -> Booking (One-to-Many)
Customer.hasMany(Booking, { foreignKey: 'customerId', as: 'bookings' });
Booking.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

// Bus -> Booking (One-to-Many)
// Note: We don't use CASCADE DELETE - bookings are preserved when bus is "deleted" (marked as cancelled)
Bus.hasMany(Booking, { foreignKey: 'busId', as: 'bookings' });
Booking.belongsTo(Bus, { foreignKey: 'busId', as: 'bus' });

// Booking -> Passenger (One-to-Many)
// Using 'passengerList' as alias to avoid collision with 'passengers' JSONB field
Booking.hasMany(Passenger, { foreignKey: 'bookingId', sourceKey: 'bookingId', as: 'passengerList' });
Passenger.belongsTo(Booking, { foreignKey: 'bookingId', targetKey: 'bookingId', as: 'booking' });

module.exports = {
    sequelize,
    Customer,
    Admin,
    Enterprise,
    Bus,
    Booking,
    Passenger
};

