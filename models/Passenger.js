const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Passenger = sequelize.define('Passenger', {
    passengerId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'passenger_id'
    },
    bookingId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'booking_id'
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    age: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    gender: {
        type: DataTypes.STRING(10),
        allowNull: false
    },
    seatNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'seat_number'
    },
    seatType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'seat_type'
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    }
}, {
    tableName: 'passengers',
    timestamps: false
});

module.exports = Passenger;

