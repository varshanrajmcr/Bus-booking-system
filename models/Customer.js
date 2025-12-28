const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Customer = sequelize.define('Customer', {
    customerId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'customer_id'
    },
    fullName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'full_name'
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    phone: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    userType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'customer',
        field: 'user_type'
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    }
}, {
    tableName: 'customers',
    timestamps: true,
    updatedAt: false
});

module.exports = Customer;

