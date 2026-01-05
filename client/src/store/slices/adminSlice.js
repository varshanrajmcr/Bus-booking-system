import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeTab: 'overview',
  buses: [],
  bookings: [],
  stats: {
    totalBuses: 0,
    totalBookings: 0,
    totalRevenue: 0,
    totalPassengers: 0
  },
  busForm: {
    busName: '',
    from: '',
    to: '',
    date: '',
    departureTime: '',
    arrivalTime: '',
    duration: '',
    seaterPrice: '',
    sleeperPrice: '',
    busType: '',
    totalSeats: '32'
  },
  editingBusId: null,
  filteredBuses: [],
  filteredBookings: [],
  busFilters: { date: '' },
  bookingFilters: { bus: '', date: '', status: '' },
  bookingSortOrder: 'latest', // 'latest' or 'older'
  overviewTimePeriod: 'overall', // 'overall', 'today', 'pastWeek', 'pastMonth'
  bookingTrendType: 'daily', // 'daily' or 'monthly'
  eventSource: null
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    setBuses: (state, action) => {
      state.buses = action.payload;
    },
    setBookings: (state, action) => {
      state.bookings = action.payload;
    },
    setStats: (state, action) => {
      state.stats = { ...state.stats, ...action.payload };
    },
    setBusForm: (state, action) => {
      state.busForm = { ...state.busForm, ...action.payload };
    },
    resetBusForm: (state) => {
      state.busForm = {
        busName: '',
        from: '',
        to: '',
        date: '',
        departureTime: '',
        arrivalTime: '',
        duration: '',
        seaterPrice: '',
        sleeperPrice: '',
        busType: '',
        totalSeats: '32'
      };
    },
    setEditingBusId: (state, action) => {
      state.editingBusId = action.payload;
    },
    setFilteredBuses: (state, action) => {
      state.filteredBuses = action.payload;
    },
    setFilteredBookings: (state, action) => {
      state.filteredBookings = action.payload;
    },
    setBusFilters: (state, action) => {
      state.busFilters = { ...state.busFilters, ...action.payload };
    },
    setBookingFilters: (state, action) => {
      state.bookingFilters = { ...state.bookingFilters, ...action.payload };
    },
    setBookingSortOrder: (state, action) => {
      state.bookingSortOrder = action.payload;
    },
    setOverviewTimePeriod: (state, action) => {
      state.overviewTimePeriod = action.payload;
    },
    setBookingTrendType: (state, action) => {
      state.bookingTrendType = action.payload;
    },
    setEventSource: (state, action) => {
      state.eventSource = action.payload;
    },
    updateBus: (state, action) => {
      const { busId, updates } = action.payload;
      const index = state.buses.findIndex(b => (b.busId || b.id) === busId);
      if (index !== -1) {
        state.buses[index] = { ...state.buses[index], ...updates };
      }
    },
    removeBus: (state, action) => {
      state.buses = state.buses.filter(b => (b.busId || b.id) !== action.payload);
    }
  }
});

export const {
  setActiveTab,
  setBuses,
  setBookings,
  setStats,
  setBusForm,
  resetBusForm,
  setEditingBusId,
  setFilteredBuses,
  setFilteredBookings,
  setBusFilters,
  setBookingFilters,
  setBookingSortOrder,
  setOverviewTimePeriod,
  setBookingTrendType,
  setEventSource,
  updateBus,
  removeBus
} = adminSlice.actions;
export default adminSlice.reducer;

