const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Bus = sequelize.define('Bus', {
    busId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'bus_id'
    },
    busName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'bus_name'
    },
    adminId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'admin_id'
    },
    enterpriseName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'enterprise_name'
    },
    from: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    to: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    departureTime: {
        type: DataTypes.TIME,
        allowNull: false,
        field: 'departure_time'
    },
    arrivalTime: {
        type: DataTypes.TIME,
        allowNull: false,
        field: 'arrival_time'
    },
    duration: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    seaterPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'seater_price'
    },
    sleeperPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'sleeper_price'
    },
    availableSeats: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'available_seats'
    },
    busType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'bus_type'
    },
    totalSeats: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'total_seats'
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        field: 'status'
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'date'
    }
}, {
    tableName: 'buses',
    timestamps: false
});

module.exports = Bus;

