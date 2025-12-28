import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  buses: [],
  searchParams: {
    from: '',
    to: '',
    date: '',
    passengers: 1
  },
  loading: false,
  noResults: false,
  seatWarning: null,
  duplicateSearchMessage: '',
  lastSearchKey: null,
  lastSearchTime: null
};

const busesSlice = createSlice({
  name: 'buses',
  initialState,
  reducers: {
    setBuses: (state, action) => {
      state.buses = action.payload;
    },
    setSearchParams: (state, action) => {
      state.searchParams = { ...state.searchParams, ...action.payload };
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setNoResults: (state, action) => {
      state.noResults = action.payload;
    },
    setSeatWarning: (state, action) => {
      state.seatWarning = action.payload;
    },
    setDuplicateSearchMessage: (state, action) => {
      state.duplicateSearchMessage = action.payload;
    },
    setLastSearchKey: (state, action) => {
      state.lastSearchKey = action.payload;
    },
    setLastSearchTime: (state, action) => {
      state.lastSearchTime = action.payload;
    },
    clearSearchResults: (state) => {
      state.buses = [];
      state.noResults = false;
      state.seatWarning = null;
      state.duplicateSearchMessage = '';
    },
    resetSearchState: (state) => {
      state.buses = [];
      state.searchParams = {
        from: '',
        to: '',
        date: '',
        passengers: 1
      };
      state.loading = false;
      state.noResults = false;
      state.seatWarning = null;
      state.duplicateSearchMessage = '';
      state.lastSearchKey = null;
      state.lastSearchTime = null;
    }
  }
});

export const {
  setBuses,
  setSearchParams,
  setLoading,
  setNoResults,
  setSeatWarning,
  setDuplicateSearchMessage,
  setLastSearchKey,
  setLastSearchTime,
  clearSearchResults,
  resetSearchState
} = busesSlice.actions;
export default busesSlice.reducer;

