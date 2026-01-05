import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setUser, setUserName } from '../../store/slices/authSlice';
import {
  setBuses,
  setSearchParams,
  setLoading,
  setNoResults,
  setSeatWarning,
  setDuplicateSearchMessage,
  setLastSearchKey,
  setLastSearchTime,
  clearSearchResults
} from '../../store/slices/busesSlice';
import api from '../../services/api';
import { storeTokens } from '../../utils/jwtUtils';
import { validateLocation, validateTravelDate, validatePassengers } from '../../utils/validation';
import { formatPrice, formatTime } from '../../utils/formatting';
import { redirectToLogin } from '../../utils/navigation';
import { setActiveCustomerSession } from '../../utils/browserSessionManager';
import Navbar from '../common/Navbar';
import '../../styles/dashboard.css';

function CustomerDashboard() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  // Redux state
  const { userName } = useAppSelector((state) => state.auth);
  const { buses, searchParams, loading, noResults, seatWarning, duplicateSearchMessage, lastSearchKey, lastSearchTime } = useAppSelector((state) => state.buses);
  
  // Local refs for search tracking
  const isSearchingRef = useRef(false);
  
  // Local state for form inputs (these don't need to be in Redux)
  const [fromLocation, setFromLocation] = useState(searchParams.from || '');
  const [toLocation, setToLocation] = useState(searchParams.to || '');
  const [travelDate, setTravelDate] = useState(searchParams.date || '');
  const [passengers, setPassengers] = useState(searchParams.passengers || 1);
  
  // Autocomplete state
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [fromFocused, setFromFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);
  
  // Refs for debouncing
  const fromDebounceTimer = useRef(null);
  const toDebounceTimer = useRef(null);

  useEffect(() => {
    // Add dashboard-page class to body
    const body = document.body;
    body.classList.add('dashboard-page');
    
    // Set minimum date
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('travelDate');
    if (dateInput) {
      dateInput.setAttribute('min', today);
    }

    // Check session
    const checkSession = async () => {
      try {
        const response = await api.get('/session?type=customer');
        // Session termination is handled by API interceptor - no need to check here
        
        if (response.data.authenticated && response.data.user.userType === 'customer') {
          // Store tokens if provided (e.g., when accessing dashboard directly via session cookie)
          if (response.data.tokens) {
            storeTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
            console.log('[CustomerDashboard] Stored tokens from session endpoint');
          }
          
          // Ensure customer session is stored in localStorage (persist it)
          if (response.data.user.customerId) {
            setActiveCustomerSession(response.data.user.customerId);
            console.log('[CustomerDashboard] Customer session stored in localStorage:', response.data.user.customerId);
          }
          
          dispatch(setUser(response.data.user));
          dispatch(setUserName(`Welcome, ${response.data.user.fullName || 'User'}`));
        } else {
          redirectToLogin('customer', { showAlert: true, navigate });
        }
      } catch (error) {
        // Session termination errors are handled by API interceptor
        console.error('Error checking session:', error);
        // Only navigate if it's not a session termination (which interceptor handles)
        if (!error.response?.data?.sessionTerminated) {
          redirectToLogin('customer', { navigate });
        }
      }
    };
    checkSession();
    
    return () => {
      body.classList.remove('dashboard-page');
      // Clear debounce timers on unmount
      if (fromDebounceTimer.current) {
        clearTimeout(fromDebounceTimer.current);
      }
      if (toDebounceTimer.current) {
        clearTimeout(toDebounceTimer.current);
      }
    };
  }, [navigate]);
  
  // Debounced function to fetch location suggestions
  const fetchLocationSuggestions = async (query, type, setSuggestions) => {
    if (query.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        type: type
      });
      const response = await api.get(`/buses/locations?${params.toString()}`);
      
      if (response.status === 200 && response.data.locations) {
        setSuggestions(response.data.locations);
      }
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      setSuggestions([]);
    }
  };
  
  // Handle from location input with debouncing
  const handleFromLocationChange = (e) => {
    const value = e.target.value;
    setFromLocation(value);
    setShowFromSuggestions(true);
    
    // Clear previous timer
    if (fromDebounceTimer.current) {
      clearTimeout(fromDebounceTimer.current);
    }
    
    // Set new timer for debouncing (300ms delay)
    fromDebounceTimer.current = setTimeout(() => {
      fetchLocationSuggestions(value, 'from', setFromSuggestions);
    }, 300);
  };
  
  // Handle to location input with debouncing
  const handleToLocationChange = (e) => {
    const value = e.target.value;
    setToLocation(value);
    setShowToSuggestions(true);
    
    // Clear previous timer
    if (toDebounceTimer.current) {
      clearTimeout(toDebounceTimer.current);
    }
    
    // Set new timer for debouncing (300ms delay)
    toDebounceTimer.current = setTimeout(() => {
      fetchLocationSuggestions(value, 'to', setToSuggestions);
    }, 300);
  };
  
  // Handle suggestion selection
  const handleFromSuggestionSelect = (location) => {
    setFromLocation(location);
    setShowFromSuggestions(false);
    setFromFocused(false);
    if (fromDebounceTimer.current) {
      clearTimeout(fromDebounceTimer.current);
    }
  };
  
  const handleToSuggestionSelect = (location) => {
    setToLocation(location);
    setShowToSuggestions(false);
    setToFocused(false);
    if (toDebounceTimer.current) {
      clearTimeout(toDebounceTimer.current);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    // Prevent duplicate requests
    if (loading || isSearchingRef.current) {
      console.log('Search already in progress, ignoring duplicate request');
      return;
    }
    
    const searchData = {
      from: fromLocation.trim(),
      to: toLocation.trim(),
      date: travelDate,
      passengers: parseInt(passengers)
    };

    // Create a search key to compare with last search
    const searchKey = JSON.stringify({
      from: searchData.from.toLowerCase(),
      to: searchData.to.toLowerCase(),
      date: searchData.date,
      passengers: searchData.passengers
    });

    // Prevent duplicate search with same parameters, but allow refresh after 30 seconds
    const now = Date.now();
    const timeSinceLastSearch = lastSearchTime ? (now - lastSearchTime) : Infinity;
    const REFRESH_INTERVAL = 10000; // 30 seconds - allow refresh after this time

    // Check if any currently displayed bus is cancelled (admin might have cancelled it)
    const hasCancelledBus = buses.some(bus => bus.status === 'cancelled');

    if (lastSearchKey === searchKey && timeSinceLastSearch < REFRESH_INTERVAL && !hasCancelledBus) {
      const secondsRemaining = Math.ceil((REFRESH_INTERVAL - timeSinceLastSearch) / 1000);
      dispatch(setDuplicateSearchMessage(
        `You have already searched for this route. Results are displayed below. You can refresh in ${secondsRemaining} seconds to see the latest updates.`
      ));
      setTimeout(() => dispatch(setDuplicateSearchMessage('')), 3000); // Clear message after 3 seconds
      return;
    }

    // If there's a cancelled bus in results, allow refresh immediately to get updated results
    if (hasCancelledBus) {
      console.log('Detected cancelled bus in results, allowing refresh to get updated data');
    }

    // Clear duplicate message if it exists
    dispatch(setDuplicateSearchMessage(''));

    // Validation
    const fromValidation = validateLocation(searchData.from, 'From location');
    if (!fromValidation.isValid) {
      alert('Validation Error:\n' + fromValidation.errors.join('\n'));
      return;
    }

    const toValidation = validateLocation(searchData.to, 'To location');
    if (!toValidation.isValid) {
      alert('Validation Error:\n' + toValidation.errors.join('\n'));
      return;
    }

    if (searchData.from.toLowerCase() === searchData.to.toLowerCase()) {
      alert('From and To locations cannot be the same!');
      return;
    }

    const dateValidation = validateTravelDate(searchData.date);
    if (!dateValidation.isValid) {
      alert('Validation Error:\n' + dateValidation.errors.join('\n'));
      return;
    }

    const passengersValidation = validatePassengers(searchData.passengers);
    if (!passengersValidation.isValid) {
      alert('Validation Error:\n' + passengersValidation.errors.join('\n'));
      return;
    }

    // Set loading and ref flags
    dispatch(setLoading(true));
    isSearchingRef.current = true;
    dispatch(setNoResults(false));
    dispatch(setBuses([]));
    dispatch(setSeatWarning(null));

    try {
      const response = await api.post('/buses/search', searchData);

      if (response.data.buses && response.data.buses.length > 0) {
        if (response.data.warning) {
          dispatch(setSeatWarning(response.data.warning));
        }
        dispatch(setBuses(response.data.buses));
      } else {
        dispatch(setNoResults(true));
      }

      // Store this search as the last successful search
      dispatch(setLastSearchKey(searchKey));
      dispatch(setLastSearchTime(Date.now()));
      dispatch(setSearchParams(searchData));
    } catch (error) {
      dispatch(setNoResults(true));
      console.error('Error:', error);
      // Don't store failed searches as last search
    } finally {
      // Always reset flags
      dispatch(setLoading(false));
      isSearchingRef.current = false;
    }
  };

  const bookBus = (busId, date, passengers) => {
    const bookingData = { busId, date, passengers };
    localStorage.setItem('bookingData', JSON.stringify(bookingData));
    const userConfirmed = window.confirm('Are you sure you want to book this bus?');
    if (userConfirmed) {
      navigate('/customer/booking');
    }
  };

  return (
    <>
      <Navbar userName={userName} showBookingsLink={true} />

      <div className="dashboard-container">
        <div className="search-section">
          <h1>Search Buses</h1>
          <form id="searchForm" className="search-form" onSubmit={handleSearch}>
            <div className="form-row">
              <div className="form-group" style={{ position: 'relative' }}>
                <label htmlFor="fromLocation">From</label>
                <input
                  type="text"
                  id="fromLocation"
                  name="fromLocation"
                  placeholder="Enter departure city"
                  value={fromLocation}
                  onChange={handleFromLocationChange}
                  onFocus={() => {
                    setFromFocused(true);
                    if (fromLocation.trim().length > 0 && fromSuggestions.length > 0) {
                      setShowFromSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding suggestions to allow click on suggestion
                    setTimeout(() => {
                      setShowFromSuggestions(false);
                      setFromFocused(false);
                    }, 200);
                  }}
                  autoComplete="off"
                  required
                />
                {showFromSuggestions && fromFocused && fromSuggestions.length > 0 && (
                  <ul className="autocomplete-suggestions" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderTop: 'none',
                    borderRadius: '0 0 4px 4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    {fromSuggestions.map((location, index) => (
                      <li
                        key={index}
                        onClick={() => handleFromSuggestionSelect(location)}
                        style={{
                          padding: '10px 15px',
                          cursor: 'pointer',
                          borderBottom: index < fromSuggestions.length - 1 ? '1px solid #eee' : 'none'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                      >
                        {location}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label htmlFor="toLocation">To</label>
                <input
                  type="text"
                  id="toLocation"
                  name="toLocation"
                  placeholder="Enter destination city"
                  value={toLocation}
                  onChange={handleToLocationChange}
                  onFocus={() => {
                    setToFocused(true);
                    if (toLocation.trim().length > 0 && toSuggestions.length > 0) {
                      setShowToSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding suggestions to allow click on suggestion
                    setTimeout(() => {
                      setShowToSuggestions(false);
                      setToFocused(false);
                    }, 200);
                  }}
                  autoComplete="off"
                  required
                />
                {showToSuggestions && toFocused && toSuggestions.length > 0 && (
                  <ul className="autocomplete-suggestions" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderTop: 'none',
                    borderRadius: '0 0 4px 4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    {toSuggestions.map((location, index) => (
                      <li
                        key={index}
                        onClick={() => handleToSuggestionSelect(location)}
                        style={{
                          padding: '10px 15px',
                          cursor: 'pointer',
                          borderBottom: index < toSuggestions.length - 1 ? '1px solid #eee' : 'none'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                      >
                        {location}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="travelDate">Travel Date</label>
                <input
                  type="date"
                  id="travelDate"
                  name="travelDate"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="passengers">Passengers</label>
                <input
                  type="number"
                  id="passengers"
                  name="passengers"
                  min="1"
                  max="10"
                  value={passengers}
                  onChange={(e) => setPassengers(parseInt(e.target.value))}
                  required
                />
              </div>
            </div>
            <button 
              type="submit" 
              className="btn-search"
              disabled={loading}
              style={{ 
                opacity: loading ? 0.6 : 1, 
                cursor: loading ? 'not-allowed' : 'pointer' 
              }}
            >
              {loading ? 'Searching...' : 'Search Buses'}
            </button>
          </form>
        </div>

        {duplicateSearchMessage && (
          <div style={{
            background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
            border: '2px solid #2196f3',
            borderRadius: '12px',
            padding: '15px 20px',
            margin: '20px 0',
            color: '#1565c0',
            fontWeight: '500',
            boxShadow: '0 2px 8px rgba(33, 150, 243, 0.2)'
          }}>
            {duplicateSearchMessage}
          </div>
        )}

        {loading && (
          <div id="loadingMessage" className="loading-message">
            Searching for buses...
          </div>
        )}

        {noResults && (
          <div id="noResults" className="no-results">
            <p>No buses found for your search. Please try different locations or date.</p>
          </div>
        )}

        {seatWarning && (
          <div id="seatAvailabilityWarning" style={{
            background: 'linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%)',
            border: '2px solid #ffc107',
            borderRadius: '12px',
            padding: '20px',
            margin: '20px 0',
            boxShadow: '0 4px 15px rgba(255, 193, 7, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: '15px' }}>
              <div style={{ fontSize: '32px' }}>⚠️</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '18px' }}>Seat Availability Notice</h3>
                <p style={{ margin: '0 0 15px 0', color: '#856404', fontSize: '14px', lineHeight: '1.6' }}>
                  {seatWarning.message}
                </p>
                {seatWarning.totalAvailableSeats >= seatWarning.requestedSeats && (
                  <div style={{ background: 'white', borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
                    <p style={{ margin: '0 0 10px 0', color: '#333', fontWeight: '600', fontSize: '14px' }}>
                      💡 <strong>Solution:</strong> You can book seats from multiple buses to accommodate all {seatWarning.requestedSeats} passengers.
                    </p>
                    <p style={{ margin: '0', color: '#666', fontSize: '13px' }}>
                      Total available seats: <strong>{seatWarning.totalAvailableSeats}</strong> | Required: <strong>{seatWarning.requestedSeats}</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div id="busResults" className="bus-results">
          {buses
            .filter(bus => {
              // Filter out cancelled/inactive buses
              if ((bus.status || 'active') !== 'active') {
                return false;
              }
              
              // Filter out buses that have already departed
              if (bus.date && bus.departureTime) {
                const [year, month, day] = bus.date.trim().split('-').map(Number);
                const [hours, minutes] = bus.departureTime.trim().split(':').map(Number);
                const departureDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
                const now = new Date();
                
                // Exclude buses where departure time has already passed
                if (departureDateTime < now) {
                  return false;
                }
              }
              
              return true;
            })
            .map(bus => (
            <div key={bus.busId || bus.id} className="bus-card">
              <div className="bus-info">
                <div className="bus-route">
                  <div className="route-line">
                    <div className="route-segment departure-segment">
                      <div className="time-label"> ⏰ Departure</div>
                      <div className="route-time departure-time">{formatTime(bus.departureTime)}</div>
                      <div className="route-location">{bus.from}</div>
                    </div>
                    <div className="route-arrow">→</div>
                    <div className="route-segment arrival-segment">
                      <div className="time-label"> ⏰ Arrival</div>
                      <div className="route-time arrival-time">{formatTime(bus.arrivalTime)}</div>
                      <div className="route-location">  {bus.to}</div>
                    </div>
                  </div>
                </div>
                <div className="bus-details">
                  <div className="detail-item">
                    <span>🚌</span>
                    <span>{bus.busName}</span>
                  </div>
                  <div className="detail-item">
                    <span>⏱️</span>
                    <span>{bus.duration}</span>
                  </div>
                  <div className="detail-item">
                    <span>💺</span>
                    <span>{bus.availableSeatsForDate !== undefined ? bus.availableSeatsForDate : bus.availableSeats} seats available</span>
                    {bus.bookedSeatsCount > 0 && (
                      <small style={{ display: 'block', color: '#666', fontSize: '12px', marginTop: '2px' }}>
                        {bus.bookedSeatsCount} seat(s) already booked
                      </small>
                    )}
                  </div>
                  <div className="detail-item">
                    <span>🛣️</span>
                    <span>{bus.busType}</span>
                  </div>
                </div>
              </div>
              <div className="enterprise-name-section" style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                padding: '15px',
                background: 'linear-gradient(135deg, #rgb(151, 215, 0) 0%, #rgb(132, 187, 2) 100%)',
                color: '#000000',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                letterSpacing: '0.5px',
                width: '100%',
                alignSelf: 'stretch'
              }}>
                {bus.enterpriseName || 'Bus Service'}
              </div>
              <div className="bus-price-section">
                <div className="price">₹{formatPrice(bus.seaterPrice || bus.price)} - ₹{formatPrice(bus.sleeperPrice || (bus.price + 600))}</div>
                <div className="price-label">Seater - Sleeper</div>
                <button 
                  className="btn-book" 
                  onClick={() => bookBus(bus.busId || bus.id, travelDate, passengers)}
                >
                  Book Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default CustomerDashboard;

