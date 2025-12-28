const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Enterprise = sequelize.define('Enterprise', {
    enterpriseName: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        field: 'enterprise_name'
    },
    adminId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'admin_id'
    },
    busCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'bus_count'
    }
}, {
    tableName: 'enterprises',
    timestamps: false
});

module.exports = Enterprise;

