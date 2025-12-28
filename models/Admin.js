const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Admin = sequelize.define('Admin', {
    adminId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'admin_id'
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
        allowNull: false
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    userType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'admin',
        field: 'user_type'
    },
    enterpriseName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'enterprise_name'
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    }
}, {
    tableName: 'admins',
    timestamps: true,
    updatedAt: false
});

module.exports = Admin;

