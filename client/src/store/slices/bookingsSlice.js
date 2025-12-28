import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  bookings: [],
  busData: null,
  bookingData: null,
  selectedSeats: [],
  bookedSeats: [],
  maxSeats: 0,
  seatPrice: 0,
  currentPassengerIndex: 1,
  passengerData: [],
  loading: false
};

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    setBookings: (state, action) => {
      state.bookings = action.payload;
    },
    setBusData: (state, action) => {
      state.busData = action.payload;
    },
    setBookingData: (state, action) => {
      state.bookingData = action.payload;
    },
    setSelectedSeats: (state, action) => {
      state.selectedSeats = action.payload;
    },
    setBookedSeats: (state, action) => {
      state.bookedSeats = action.payload;
    },
    setMaxSeats: (state, action) => {
      state.maxSeats = action.payload;
    },
    setSeatPrice: (state, action) => {
      state.seatPrice = action.payload;
    },
    setCurrentPassengerIndex: (state, action) => {
      state.currentPassengerIndex = action.payload;
    },
    setPassengerData: (state, action) => {
      state.passengerData = action.payload;
    },
    addPassenger: (state, action) => {
      state.passengerData.push(action.payload);
    },
    updatePassenger: (state, action) => {
      const { index, data } = action.payload;
      if (state.passengerData[index]) {
        state.passengerData[index] = { ...state.passengerData[index], ...data };
      }
    },
    setBookingLoading: (state, action) => {
      state.loading = action.payload;
    },
    resetBookingState: (state) => {
      state.busData = null;
      state.bookingData = null;
      state.selectedSeats = [];
      state.bookedSeats = [];
      state.maxSeats = 0;
      state.seatPrice = 0;
      state.currentPassengerIndex = 1;
      state.passengerData = [];
      state.loading = false;
    }
  }
});

export const {
  setBookings,
  setBusData,
  setBookingData,
  setSelectedSeats,
  setBookedSeats,
  setMaxSeats,
  setSeatPrice,
  setCurrentPassengerIndex,
  setPassengerData,
  addPassenger,
  updatePassenger,
  setBookingLoading,
  resetBookingState
} = bookingsSlice.actions;
export default bookingsSlice.reducer;

