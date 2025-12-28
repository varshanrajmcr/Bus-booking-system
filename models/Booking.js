const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Booking = sequelize.define('Booking', {
    bookingId: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        field: 'booking_id'
    },
    busId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'bus_id'
    },
    customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'customer_id'
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    seats: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: false
    },
    passengers: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'total_amount'
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'confirmed'
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    }
}, {
    tableName: 'bookings',
    timestamps: true,
    updatedAt: false
});

module.exports = Booking;

