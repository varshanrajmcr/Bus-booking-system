const { Customer, Admin, Enterprise, Bus, Booking, Passenger } = require('../models');

// Customer data operations
const customerStore = {
    getAll: async () => {
        try {
            return await Customer.findAll({ raw: true });
        } catch (error) {
            console.error('Error getting all customers:', error);
            return [];
        }
    },
    save: async (customers) => {
        // Not needed with Sequelize, but kept for compatibility
        return true;
    },
    add: async (customer) => {
        try {
            const newCustomer = await Customer.create(customer);
            return newCustomer.toJSON();
    } catch (error) {
            console.error('Error adding customer:', error);
            throw error;
    }
    },
    findByEmail: async (email) => {
        try {
            const customer = await Customer.findOne({
                where: { email: email.toLowerCase() },
                raw: true
            });
            return customer;
        } catch (error) {
            console.error('Error finding customer by email:', error);
            return null;
        }
    },
    findByPhone: async (phone) => {
        try {
            const customer = await Customer.findOne({
                where: { phone: phone.trim() },
                raw: true
            });
            return customer;
        } catch (error) {
            console.error('Error finding customer by phone:', error);
            return null;
        }
    },
    findById: async (id) => {
        try {
            const customer = await Customer.findByPk(parseInt(id), { raw: true });
            return customer;
        } catch (error) {
            console.error('Error finding customer by id:', error);
            return null;
        }
    }
};

// Admin data operations
const adminStore = {
    getAll: async () => {
        try {
            return await Admin.findAll({ raw: true });
        } catch (error) {
            console.error('Error getting all admins:', error);
            return [];
        }
    },
    save: async (admins) => {
        // Not needed with Sequelize, but kept for compatibility
        return true;
    },
    add: async (admin) => {
        try {
            const newAdmin = await Admin.create(admin);
            return newAdmin.toJSON();
        } catch (error) {
            console.error('Error adding admin:', error);
            throw error;
        }
    },
    findByEmail: async (email) => {
        try {
            const admin = await Admin.findOne({
                where: { email: email.toLowerCase() },
                raw: true
            });
            return admin;
        } catch (error) {
            console.error('Error finding admin by email:', error);
            return null;
        }
    },
    findById: async (id) => {
        try {
            const admin = await Admin.findByPk(parseInt(id), { raw: true });
        return admin;
        } catch (error) {
            console.error('Error finding admin by id:', error);
            return null;
        }
    }
};

// Enterprise data operations
const enterpriseStore = {
    getAll: async () => {
        try {
            return await Enterprise.findAll({ raw: true });
        } catch (error) {
            console.error('Error getting all enterprises:', error);
            return [];
        }
    },
    save: async (enterprises) => {
        // Not needed with Sequelize, but kept for compatibility
        return true;
    },
    add: async (enterprise) => {
        try {
            const newEnterprise = await Enterprise.create(enterprise);
            return newEnterprise.toJSON();
        } catch (error) {
            console.error('Error adding enterprise:', error);
            throw error;
        }
    },
    findByName: async (enterpriseName) => {
        try {
            const enterprise = await Enterprise.findByPk(enterpriseName, { raw: true });
            return enterprise;
        } catch (error) {
            console.error('Error finding enterprise by name:', error);
            return null;
        }
    },
    findByAdminId: async (adminId) => {
        try {
            const enterprise = await Enterprise.findOne({
                where: { adminId: parseInt(adminId) },
                raw: true
            });
            return enterprise;
        } catch (error) {
            console.error('Error finding enterprise by adminId:', error);
            return null;
        }
    },
    update: async (enterpriseName, updates) => {
        try {
            const [updated] = await Enterprise.update(updates, {
                where: { enterpriseName: enterpriseName },
                returning: true
            });
            if (updated > 0) {
                return await Enterprise.findByPk(enterpriseName, { raw: true });
            }
            return null;
        } catch (error) {
            console.error('Error updating enterprise:', error);
            return null;
        }
    }
};

// Bus data operations
const busStore = {
    getAll: async () => {
        try {
            return await Bus.findAll({ raw: true });
        } catch (error) {
            console.error('Error getting all buses:', error);
            return [];
        }
    },
    save: async (buses) => {
        // Not needed with Sequelize, but kept for compatibility
        return true;
    },
    add: async (bus) => {
        try {
            const newBus = await Bus.create(bus);
            return newBus.toJSON();
        } catch (error) {
            console.error('Error adding bus:', error);
            throw error;
        }
    },
    findById: async (id) => {
        try {
            const bus = await Bus.findByPk(parseInt(id), { raw: true });
            return bus;
        } catch (error) {
            console.error('Error finding bus by id:', error);
            return null;
        }
    },
    update: async (id, updates) => {
        try {
            const [updated] = await Bus.update(updates, {
                where: { busId: parseInt(id) },
                returning: true
            });
            if (updated > 0) {
                return await Bus.findByPk(parseInt(id), { raw: true });
            }
            return null;
        } catch (error) {
            console.error('Error updating bus:', error);
        return null;
        }
    },
    findByAdminId: async (adminId) => {
        try {
            return await Bus.findAll({
                where: { adminId: parseInt(adminId) },
                raw: true
            });
        } catch (error) {
            console.error('Error finding buses by adminId:', error);
            return [];
        }
    },
    findByEnterpriseName: async (enterpriseName) => {
        try {
            return await Bus.findAll({
                where: { enterpriseName: enterpriseName },
                raw: true
            });
        } catch (error) {
            console.error('Error finding buses by enterpriseName:', error);
            return [];
        }
    }
};

// Booking data operations
const bookingStore = {
    getAll: async () => {
        try {
            return await Booking.findAll({ raw: true });
        } catch (error) {
            console.error('Error getting all bookings:', error);
            return [];
        }
    },
    save: async (bookings) => {
        // Not needed with Sequelize, but kept for compatibility
        return true;
    },
    add: async (booking) => {
        try {
            const newBooking = await Booking.create(booking);
            return newBooking.toJSON();
        } catch (error) {
            console.error('Error adding booking:', error);
            throw error;
        }
    },
    findByCustomerId: async (customerId) => {
        try {
            return await Booking.findAll({
                where: { customerId: parseInt(customerId) },
                raw: true
            });
        } catch (error) {
            console.error('Error finding bookings by customerId:', error);
            return [];
        }
    },
    findByAdminId: async (adminId) => {
        try {
            // Find bookings through bus relationship (Admin -> Bus -> Booking)
            // First, get all buses for this admin
            const adminBuses = await Bus.findAll({
                where: { adminId: parseInt(adminId) },
                attributes: ['busId'],
                raw: true
            });
            
            if (adminBuses.length === 0) {
                return [];
            }
            
            // Get all bus IDs
            const busIds = adminBuses.map(bus => bus.busId);
            
            // Find all bookings for these buses
            return await Booking.findAll({
                where: { busId: busIds },
                raw: true
            });
        } catch (error) {
            console.error('Error finding bookings by adminId:', error);
            return [];
        }
    },
    findByBusId: async (busId) => {
        try {
            return await Booking.findAll({
                where: { busId: parseInt(busId) },
                raw: true
            });
        } catch (error) {
            console.error('Error finding bookings by busId:', error);
            return [];
        }
    },
    findById: async (id) => {
        try {
            const booking = await Booking.findByPk(id, { raw: true });
        return booking;
        } catch (error) {
            console.error('Error finding booking by id:', error);
            return null;
        }
    },
    update: async (bookingId, updates) => {
        try {
            const [updated] = await Booking.update(updates, {
                where: { bookingId: bookingId },
                returning: true
            });
            if (updated > 0) {
                return await Booking.findByPk(bookingId, { raw: true });
            }
            return null;
        } catch (error) {
            console.error('Error updating booking:', error);
            return null;
        }
    },
    updateByBusId: async (busId, updates) => {
        try {
            const [updated] = await Booking.update(updates, {
                where: { busId: parseInt(busId) },
                returning: true
            });
            return updated;
        } catch (error) {
            console.error('Error updating bookings by busId:', error);
            return 0;
        }
    }
};

// Passenger data operations
const passengerStore = {
    getAll: async () => {
        try {
            return await Passenger.findAll({ raw: true });
        } catch (error) {
            console.error('Error getting all passengers:', error);
            return [];
        }
    },
    save: async (passengers) => {
        // Not needed with Sequelize, but kept for compatibility
        return true;
    },
    add: async (passenger) => {
        try {
            const newPassenger = await Passenger.create(passenger);
            return newPassenger.toJSON();
        } catch (error) {
            console.error('Error adding passenger:', error);
            throw error;
        }
    },
    addMultiple: async (passengersArray) => {
        try {
            const newPassengers = await Passenger.bulkCreate(passengersArray);
            return newPassengers.map(p => p.toJSON());
        } catch (error) {
            console.error('Error adding multiple passengers:', error);
            throw error;
        }
    },
    findByBookingId: async (bookingId) => {
        try {
            return await Passenger.findAll({
                where: { bookingId: bookingId },
                raw: true
            });
        } catch (error) {
            console.error('Error finding passengers by bookingId:', error);
            return [];
        }
    },
    findById: async (id) => {
        try {
            const passenger = await Passenger.findByPk(parseInt(id), { raw: true });
            return passenger;
        } catch (error) {
            console.error('Error finding passenger by id:', error);
            return null;
        }
    }
};

module.exports = {
    customerStore,
    adminStore,
    enterpriseStore,
    busStore,
    bookingStore,
    passengerStore
};
