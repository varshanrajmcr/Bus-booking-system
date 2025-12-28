import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  errorMessage: '',
  successMessage: '',
  nameError: false,
  passwordRequirements: {
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  }
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setErrorMessage: (state, action) => {
      state.errorMessage = action.payload;
    },
    setSuccessMessage: (state, action) => {
      state.successMessage = action.payload;
    },
    clearMessages: (state) => {
      state.errorMessage = '';
      state.successMessage = '';
    },
    setNameError: (state, action) => {
      state.nameError = action.payload;
    },
    setPasswordRequirements: (state, action) => {
      state.passwordRequirements = { ...state.passwordRequirements, ...action.payload };
    },
    resetPasswordRequirements: (state) => {
      state.passwordRequirements = {
        length: false,
        upper: false,
        lower: false,
        number: false,
        special: false
      };
    }
  }
});

export const {
  setErrorMessage,
  setSuccessMessage,
  clearMessages,
  setNameError,
  setPasswordRequirements,
  resetPasswordRequirements
} = uiSlice.actions;
export default uiSlice.reducer;

