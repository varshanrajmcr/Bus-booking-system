import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import busesReducer from './slices/busesSlice';
import bookingsReducer from './slices/bookingsSlice';
import adminReducer from './slices/adminSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    buses: busesReducer,
    bookings: bookingsReducer,
    admin: adminReducer,
    ui: uiReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['buses/setBuses', 'bookings/setBookings', 'admin/setBuses', 'admin/setBookings'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.timestamp', 'payload.eventSource'],
        // Ignore these paths in the state
        ignoredPaths: ['buses.buses', 'bookings.bookings', 'admin.buses', 'admin.bookings', 'admin.eventSource']
      }
    })
});

