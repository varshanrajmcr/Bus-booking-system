import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPrice, formatTime } from '../../utils/formatting';
import { validatePassengerName } from '../../utils/validation';
import { initRouteTracker, trackSeatSelection } from '../../utils/routeTracker';
import { redirectToLogin } from '../../utils/navigation';
import Navbar from '../common/Navbar';
import '../../styles/dashboard.css';
import '../../styles/booking.css';

function Booking() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('Welcome, User');
  const [busData, setBusData] = useState(null);
  const [bookingData, setBookingData] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [maxSeats, setMaxSeats] = useState(0);
  const [seatPrice, setSeatPrice] = useState(0);
  const [currentPassengerIndex, setCurrentPassengerIndex] = useState(1);
  const [passengerData, setPassengerData] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    // Add dashboard-page class to body
    const body = document.body;
    body.classList.add('dashboard-page');
    
    const initialize = async () => {
      try {
        const sessionResponse = await api.get('/session?type=customer');
        if (sessionResponse.data.authenticated && sessionResponse.data.user.userType === 'customer') {
          setUserName(`Welcome, ${sessionResponse.data.user.fullName || 'User'}`);
        } else {
          redirectToLogin('customer', { showAlert: true, navigate });
          return;
        }
      } catch (error) {
        console.error('Error checking session:', error);
        redirectToLogin('customer', { navigate });
        return;
      }

      const bookingDataStr = localStorage.getItem('bookingData');
      if (!bookingDataStr) {
        setErrorMessage('No bus selected. Please search and select a bus first.');
        setTimeout(() => {
          navigate('/customer/dashboard');
        }, 2000);
        return;
      }

      const booking = JSON.parse(bookingDataStr);
      setBookingData(booking);

      try {
        const response = await api.get(`/buses/${booking.busId}`);
        if (response.status === 200 && response.data.bus) {
          const bus = response.data.bus;
          setBusData(bus);
          setSeatPrice(bus.seaterPrice || bus.price || 0);
          setMaxSeats(booking.passengers || 1);
          await initializeSeatLayout(booking.busId, booking.date);
          initializePassengerData(booking.passengers || 1);
        } else {
          setErrorMessage('Bus not found. Please try again.');
        }
      } catch (error) {
        setErrorMessage('Error loading bus details. Please try again.');
        console.error('Error:', error);
      }
    };

    initialize();
    
    // Initialize route tracking
    initRouteTracker();
    
    return () => {
      body.classList.remove('dashboard-page');
    };
  }, [navigate]);

  const initializeSeatLayout = async (busId, date) => {
    try {
      const response = await api.get(`/bookings/seats/${busId}/${encodeURIComponent(date)}`);
      if (response.status === 200) {
        setBookedSeats(response.data.bookedSeats || []);
      }
    } catch (error) {
      console.error('Error loading booked seats:', error);
    }
  };

  const initializePassengerData = (passengers) => {
    const sortedSeats = [...selectedSeats].sort((a, b) => a - b);
    const passengersArray = Array(passengers).fill(null).map((_, index) => ({
      name: '',
      age: '',
      gender: '',
      seatNumber: sortedSeats[index] ? parseInt(sortedSeats[index]) : null,
      seatType: 'seater',
      price: seatPrice
    }));
    setPassengerData(passengersArray);
  };

  useEffect(() => {
    if (selectedSeats.length === maxSeats && maxSeats > 0) {
      initializePassengerData(maxSeats);
    }
  }, [selectedSeats, maxSeats]);

  const handleSeatClick = (seatNumber, seatType) => {
    if (bookedSeats.includes(seatNumber)) {
      return; // Seat is already booked
    }

    const isSelected = selectedSeats.includes(seatNumber);
    
    if (isSelected) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatNumber));
      // Update passenger data to remove seat assignment
      const sortedSeats = [...selectedSeats.filter(s => s !== seatNumber)].sort((a, b) => a - b);
      setPassengerData(passengerData.map((p, idx) => ({
        ...p,
        seatNumber: sortedSeats[idx] ? parseInt(sortedSeats[idx]) : null
      })));
    } else {
      if (selectedSeats.length < maxSeats) {
        const newSelectedSeats = [...selectedSeats, seatNumber];
        setSelectedSeats(newSelectedSeats);
        // Track seat selection
        if (bookingData?.busId) {
          trackSeatSelection(bookingData.busId, newSelectedSeats);
        }
      }
    }
  };

  const handlePassengerChange = (index, field, value) => {
    setPassengerData(passengerData.map((p, idx) => 
      idx === index ? { ...p, [field]: value } : p
    ));
    
    // Validate passenger name in real-time
    if (field === 'name') {
      setNameError(value.trim() !== '' && !validatePassengerName(value));
    }
  };

  const handleNextPassenger = () => {
    const currentPassenger = passengerData[currentPassengerIndex - 1];
    
    if (!currentPassenger.name || !currentPassenger.age || !currentPassenger.gender) {
      setErrorMessage('Please fill all details for this passenger before proceeding.');
      return;
    }
    
    // Validate passenger name format
    if (!validatePassengerName(currentPassenger.name)) {
      setErrorMessage('Passenger name should contain only letters (a-z, A-Z) and periods (.). No numbers or special characters allowed.');
      setNameError(true);
      return;
    }
    
    // Validate age
    const age = parseInt(currentPassenger.age);
    if (isNaN(age) || age < 1 || age > 120) {
      setErrorMessage('Age must be between 1 and 120');
      return;
    }
    
    setErrorMessage('');
    setNameError(false);
    
    if (currentPassengerIndex < maxSeats) {
      setCurrentPassengerIndex(currentPassengerIndex + 1);
    }
  };

  const handlePreviousPassenger = () => {
    if (currentPassengerIndex > 1) {
      setCurrentPassengerIndex(currentPassengerIndex - 1);
      setErrorMessage('');
      setNameError(false);
    }
  };

  const handleBook = async (e) => {
    if (e) {
      e.preventDefault();
    }
    
    console.log('handleBook called', { passengerData, selectedSeats, maxSeats, currentPassengerIndex });
    
    setErrorMessage('');
    setNameError(false);

    // Sort seats first
    const sortedSeatsFinal = [...selectedSeats].sort((a, b) => a - b);

    // Save current passenger data from form inputs before submitting
    const nameInput = document.getElementById('passenger_name')?.value?.trim() || '';
    const ageInput = document.getElementById('passenger_age')?.value || '';
    const genderInput = document.getElementById('passenger_gender')?.value || '';
    
    // Update current passenger data with form values
    const updatedPassengerData = [...passengerData];
    if (updatedPassengerData[currentPassengerIndex - 1]) {
      updatedPassengerData[currentPassengerIndex - 1] = {
        ...updatedPassengerData[currentPassengerIndex - 1],
        name: nameInput || updatedPassengerData[currentPassengerIndex - 1].name,
        age: ageInput || updatedPassengerData[currentPassengerIndex - 1].age,
        gender: genderInput || updatedPassengerData[currentPassengerIndex - 1].gender,
        seatNumber: updatedPassengerData[currentPassengerIndex - 1].seatNumber || sortedSeatsFinal[currentPassengerIndex - 1]
      };
    }
    
    // Validate all passengers
    if (selectedSeats.length !== maxSeats) {
      setErrorMessage(`Please select ${maxSeats} seat(s)`);
      return;
    }

    if (updatedPassengerData.length !== selectedSeats.length) {
      setErrorMessage('Number of passengers must match number of seats');
      return;
    }

    const validGenders = ['Male', 'Female', 'Other'];

    for (let i = 0; i < updatedPassengerData.length; i++) {
      const passenger = updatedPassengerData[i];
      
      if (!passenger.name || !passenger.age || !passenger.gender) {
        setErrorMessage(`Please fill all details for Passenger ${i + 1}.`);
        setCurrentPassengerIndex(i + 1);
        return;
      }

      if (!validatePassengerName(passenger.name)) {
        setErrorMessage(`Passenger ${i + 1}: Name should contain only letters (a-z, A-Z) and periods (.). No numbers or special characters allowed.`);
        setCurrentPassengerIndex(i + 1);
        setNameError(true);
        return;
      }

      const age = parseInt(passenger.age);
      if (isNaN(age) || age < 1 || age > 120) {
        setErrorMessage(`Passenger ${i + 1}: Age must be between 1 and 120`);
        setCurrentPassengerIndex(i + 1);
        return;
      }

      if (!validGenders.includes(passenger.gender)) {
        setErrorMessage(`Passenger ${i + 1}: Gender must be one of: ${validGenders.join(', ')}`);
        setCurrentPassengerIndex(i + 1);
        return;
      }

      // Ensure seat number is set
      if (!passenger.seatNumber) {
        updatedPassengerData[i].seatNumber = sortedSeatsFinal[i];
      }
    }

    // Calculate prices based on seat type
    const seaterPrice = parseFloat(busData.seaterPrice || seatPrice || 0);
    const sleeperPrice = parseFloat(busData.sleeperPrice || (seatPrice + 600) || 0);
    const sleeperSeatsCount = Math.min(12, Math.floor((busData.totalSeats || 32) * 0.375));
    
    const passengers = updatedPassengerData.map((p, idx) => {
      const seatNum = p.seatNumber || sortedSeatsFinal[idx];
      const seatType = seatNum <= sleeperSeatsCount ? 'sleeper' : 'seater';
      const price = seatType === 'sleeper' ? sleeperPrice : seaterPrice;
      
      return {
        name: p.name.trim(),
        age: parseInt(p.age),
        gender: p.gender,
        seatNumber: parseInt(seatNum),
        seatType: seatType,
        price: price
      };
    });

    const totalAmount = passengers.reduce((sum, p) => sum + p.price, 0);

    const bookingPayload = {
      busId: bookingData.busId,
      date: bookingData.date,
      seats: sortedSeatsFinal,
      passengers: passengers,
      totalAmount: totalAmount
    };

    console.log('Submitting booking:', bookingPayload);

    try {
      const response = await api.post('/bookings/create', bookingPayload);
      console.log('Booking response:', response);
      if (response.status === 201) {
        localStorage.removeItem('bookingData');
        alert('Booking confirmed successfully!');
        navigate('/customer/bookings');
      } else {
        console.error('Unexpected response status:', response.status);
        setErrorMessage('Unexpected response from server. Please try again.');
      }
    } catch (error) {
      console.error('Booking error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Error creating booking. Please try again.';
      setErrorMessage(errorMsg);
      alert(errorMsg); // Also show alert for visibility
    }
  };

  const goBackToDashboard = () => {
    navigate('/customer/dashboard');
  };

  if (!busData) {
    return (
      <>
        <Navbar userName={userName} />
        <div className="booking-container">
          {errorMessage && (
            <div className="error-message" style={{ display: 'block' }}>
              {errorMessage}
            </div>
          )}
          <div>Loading...</div>
        </div>
      </>
    );
  }

  const totalSeats = busData.totalSeats || 32;
  const sleeperSeats = Math.min(12, Math.floor(totalSeats * 0.375)); // ~37.5% sleeper
  const seaterSeats = totalSeats - sleeperSeats;
  const sortedSeats = selectedSeats.length > 0 ? [...selectedSeats].sort((a, b) => a - b) : [];
  
  // Calculate total amount based on selected seats
  const calculateTotalAmount = () => {
    const seaterPrice = parseFloat(busData.seaterPrice || seatPrice || 0);
    const sleeperPrice = parseFloat(busData.sleeperPrice || (seatPrice + 600) || 0);
    
    return selectedSeats.reduce((sum, seatNum) => {
      const seatType = seatNum <= sleeperSeats ? 'sleeper' : 'seater';
      const price = seatType === 'sleeper' ? sleeperPrice : seaterPrice;
      return sum + price;
    }, 0);
  };

  return (
    <>
      <Navbar userName={userName} />
      <div className="booking-container">
        {errorMessage && (
          <div className="error-message" style={{ display: 'block' }}>
            {errorMessage}
          </div>
        )}

        <div className="booking-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <button className="btn-back" onClick={goBackToDashboard}>
              ← Back to Search
            </button>
          </div>
          <h1>Select Your Seats</h1>
          <div className="booking-info" id="bookingInfo">
            <div className="booking-info-item">
              <div className="booking-info-label">Bus Name</div>
              <div className="booking-info-value">{busData.enterpriseName ? `${busData.enterpriseName} - ${busData.busName}` : busData.busName}</div>
            </div>
            <div className="booking-info-item">
              <div className="booking-info-label">Route</div>
              <div className="booking-info-value">{busData.from} → {busData.to}</div>
            </div>
            <div className="booking-info-item">
              <div className="booking-info-label">Date</div>
              <div className="booking-info-value">{bookingData.date}</div>
            </div>
            <div className="booking-info-item">
              <div className="booking-info-label">Time</div>
              <div className="booking-info-value">{formatTime(busData.departureTime)}</div>
            </div>
            <div className="booking-info-item">
              <div className="booking-info-label">Price</div>
              <div className="booking-info-value">₹{formatPrice(busData.seaterPrice || seatPrice)} (Seater) / ₹{formatPrice(busData.sleeperPrice || (seatPrice + 600))} (Sleeper)</div>
            </div>
            <div className="booking-info-item">
              <div className="booking-info-label">Seats to Book</div>
              <div className="booking-info-value">{maxSeats}</div>
            </div>
          </div>
        </div>

        <div className="booking-content">
          <div className="seat-selection-section">
            <div className="bus-layout">
              <div className="driver-section">
                <div className="exit-section">
                  <div className="exit-icon">🚪</div>
                  <div className="exit-label">EXIT</div>
                </div>
                <div className="driver-area">
                  <div className="driver-icon">🚌</div>
                  <div className="driver-label">DRIVER</div>
                </div>
              </div>

              <div className="seats-container">
                <div className="seat-legend">
                  <div className="legend-item">
                    <div className="seat-available"></div>
                    <span>Available</span>
                  </div>
                  <div className="legend-item">
                    <div className="seat-selected"></div>
                    <span>Selected</span>
                  </div>
                  <div className="legend-item">
                    <div className="seat-occupied"></div>
                    <span>Occupied</span>
                  </div>
                </div>

                <div className="seat-layout-wrapper">
                  <div className="window-label left-window">Window</div>
                  <div className="seat-grid" id="seatGrid">
                    {/* Sleeper Section */}
                    <div className="sleeper-section">
                      {Array.from({ length: sleeperSeats }, (_, index) => {
                        const seatNumber = index + 1;
                        const isBooked = bookedSeats.includes(seatNumber);
                        const isSelected = selectedSeats.includes(seatNumber);
                        
                        return (
                          <div
                            key={seatNumber}
                            className={`seat sleeper ${isBooked ? 'occupied' : isSelected ? 'selected' : 'available'}`}
                            onClick={() => !isBooked && handleSeatClick(seatNumber, 'sleeper')}
                            style={{ cursor: isBooked ? 'not-allowed' : 'pointer' }}
                            title={isBooked ? 'This seat is already booked' : ''}
                          >
                            {seatNumber}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Walking Space */}
                    <div className="walking-space"></div>
                    
                    {/* Seater Section */}
                    <div className="seater-section">
                      {Array.from({ length: seaterSeats }, (_, index) => {
                        const seatNumber = sleeperSeats + index + 1;
                        const isBooked = bookedSeats.includes(seatNumber);
                        const isSelected = selectedSeats.includes(seatNumber);
                        
                        return (
                          <div
                            key={seatNumber}
                            className={`seat seater ${isBooked ? 'occupied' : isSelected ? 'selected' : 'available'}`}
                            onClick={() => !isBooked && handleSeatClick(seatNumber, 'seater')}
                            style={{ cursor: isBooked ? 'not-allowed' : 'pointer' }}
                            title={isBooked ? 'This seat is already booked' : ''}
                          >
                            {seatNumber}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="window-label right-window">Window</div>
                </div>

                <div className="seat-info">
                  <p><strong>Selected Seats:</strong> <span id="selectedSeats">{selectedSeats.length > 0 ? sortedSeats.join(', ') : 'None'}</span></p>
                  <p><strong>Total Amount:</strong> ₹<span id="totalAmount">{formatPrice(calculateTotalAmount())}</span></p>
                </div>
              </div>
            </div>
          </div>

          {selectedSeats.length === maxSeats && maxSeats > 0 && (
            <div className="passenger-details-section">
              <div className="passenger-header">
                <h2>Passenger Details</h2>
                <div className="passenger-counter">
                  <span id="currentPassenger">{currentPassengerIndex}</span> of <span id="totalPassengers">{maxSeats}</span>
                </div>
              </div>
              
              <form id="passengerForm" onSubmit={handleBook}>
                <div id="passengerFields">
                  {passengerData.length > 0 && (
                    <div className="passenger-field">
                      <div className="passenger-number">
                        Passenger {currentPassengerIndex} - Seat {passengerData[currentPassengerIndex - 1]?.seatNumber || (sortedSeats.length > 0 ? sortedSeats[currentPassengerIndex - 1] : 'Not Selected')}
                      </div>
                      
                      <label htmlFor="passenger_name">Full Name</label>
                      <input
                        type="text"
                        id="passenger_name"
                        name="passenger_name"
                        value={passengerData[currentPassengerIndex - 1]?.name || ''}
                        onChange={(e) => handlePassengerChange(currentPassengerIndex - 1, 'name', e.target.value)}
                        placeholder="Enter passenger name (letters and periods only)"
                        pattern="[a-zA-Z. ]+"
                        required
                        style={{ borderColor: nameError ? '#ff6b6b' : '' }}
                      />
                      {nameError && (
                        <small id="nameError" style={{ color: '#ff6b6b', display: 'block', fontSize: '12px', marginTop: '5px' }}>
                          Name should contain only letters (a-z, A-Z) and periods (.)
                        </small>
                      )}
                      
                      <label htmlFor="passenger_age" style={{ marginTop: '10px' }}>Age</label>
                      <input
                        type="number"
                        id="passenger_age"
                        name="passenger_age"
                        value={passengerData[currentPassengerIndex - 1]?.age || ''}
                        onChange={(e) => handlePassengerChange(currentPassengerIndex - 1, 'age', e.target.value)}
                        min="1"
                        max="120"
                        placeholder="Enter age"
                        required
                      />
                      
                      <label htmlFor="passenger_gender" style={{ marginTop: '10px' }}>Gender</label>
                      <select
                        id="passenger_gender"
                        name="passenger_gender"
                        value={passengerData[currentPassengerIndex - 1]?.gender || ''}
                        onChange={(e) => handlePassengerChange(currentPassengerIndex - 1, 'gender', e.target.value)}
                        required
                        style={{ width: '100%', padding: '12px 15px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px' }}
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  )}
                </div>
                
                <div className="passenger-navigation">
                  <button 
                    type="button" 
                    className="btn-nav btn-prev" 
                    id="prevButton"
                    style={{ display: currentPassengerIndex > 1 ? 'block' : 'none' }}
                    onClick={handlePreviousPassenger}
                  >
                    ← Previous
                  </button>
                  <button 
                    type="button" 
                    className="btn-nav btn-next" 
                    id="nextButton"
                    style={{ display: currentPassengerIndex < maxSeats ? 'block' : 'none' }}
                    onClick={handleNextPassenger}
                  >
                    Next Passenger →
                  </button>
                  <button 
                    type="submit" 
                    className="btn-book-final" 
                    id="bookButton"
                    style={{ display: currentPassengerIndex === maxSeats ? 'block' : 'none' }}
                  >
                    Confirm Booking
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Booking;

