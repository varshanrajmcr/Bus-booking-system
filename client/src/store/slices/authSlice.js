import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  userName: 'Welcome, User',
  enterpriseName: 'Enterprise Name',
  userType: null, // 'customer' or 'admin'
  isAuthenticated: false,
  sessionChecked: false
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.userType = action.payload?.userType || null;
      state.isAuthenticated = !!action.payload;
      if (action.payload) {
        state.userName = `Welcome, ${action.payload.fullName || (action.payload.userType === 'admin' ? 'Admin' : 'User')}`;
        if (action.payload.enterpriseName) {
          state.enterpriseName = action.payload.enterpriseName;
        }
      }
    },
    setUserName: (state, action) => {
      state.userName = action.payload;
    },
    setEnterpriseName: (state, action) => {
      state.enterpriseName = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.userName = 'Welcome, User';
      state.enterpriseName = 'Enterprise Name';
      state.userType = null;
      state.isAuthenticated = false;
      state.sessionChecked = false;
    },
    setSessionChecked: (state, action) => {
      state.sessionChecked = action.payload;
    }
  }
});

export const { setUser, setUserName, setEnterpriseName, logout, setSessionChecked } = authSlice.actions;
export default authSlice.reducer;

