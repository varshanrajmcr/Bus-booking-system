import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPrice, formatTime } from '../../utils/formatting';
import Navbar from '../common/Navbar';
import '../../styles/dashboard.css';

function Bookings() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('Welcome, User');
  const [bookings, setBookings] = useState([]);
  const [allBuses, setAllBuses] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [filterBus, setFilterBus] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    // Add dashboard-page class to body
    const body = document.body;
    body.classList.add('dashboard-page');
    
    const initialize = async () => {
      try {
        const sessionResponse = await api.get('/session?type=customer');
        if (sessionResponse.data.authenticated && sessionResponse.data.user.userType === 'customer') {
          setUserName(`Welcome, ${sessionResponse.data.user.fullName || 'User'}`);
          await loadAllBuses();
          await loadBookings();
        } else {
          alert('Please login to continue');
          navigate('/customer/login');
        }
      } catch (error) {
        console.error('Error checking session:', error);
        navigate('/customer/login');
      }
    };

    initialize();
    
    return () => {
      body.classList.remove('dashboard-page');
    };
  }, [navigate]);

  const loadAllBuses = async () => {
    try {
      const response = await api.get('/buses');
      if (response.status === 200) {
        setAllBuses(response.data.buses || []);
      }
    } catch (error) {
      console.error('Error loading buses:', error);
    }
  };

  const loadBookings = async () => {
    try {
      const response = await api.get('/bookings/customer');
      if (response.status === 200) {
        const bookingsList = response.data.bookings || [];
        bookingsList.sort((a, b) => {
          const dateA = new Date(a.date || 0);
          const dateB = new Date(b.date || 0);
          return dateA - dateB;
        });
        setBookings(bookingsList);
        setFilteredBookings(bookingsList);
        populateBusFilter(bookingsList);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  };

  const populateBusFilter = (bookingsList) => {
    const uniqueBusIds = [...new Set(bookingsList.map(b => b.busId))];
    // Filter dropdown will be populated in render
  };

  const applyFilters = () => {
    let filtered = [...bookings];

    if (filterBus) {
      filtered = filtered.filter(b => b.busId === parseInt(filterBus));
    }

    if (filterStatus) {
      filtered = filtered.filter(b => b.status === filterStatus);
    }

    setFilteredBookings(filtered);
  };

  const clearFilters = () => {
    setFilterBus('');
    setFilterStatus('');
    setFilteredBookings(bookings);
  };

  const cancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      const response = await api.put(`/bookings/${bookingId}/cancel`);
      if (response.status === 200) {
        alert('Booking cancelled successfully');
        await loadBookings();
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Error cancelling booking');
    }
  };

  const getBusDetails = (busId) => {
    return allBuses.find(bus => (bus.busId || bus.id) === busId);
  };

  useEffect(() => {
    applyFilters();
  }, [filterBus, filterStatus, bookings]);

  const uniqueBusIds = [...new Set(bookings.map(b => b.busId))];

  return (
    <>
      <Navbar userName={userName} showBookingsLink={false} />
      <div className="dashboard-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          <button 
            className="btn-back" 
            onClick={() => navigate('/customer/dashboard')}
            style={{
              background: '#97d700',  //#00B04F
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.3s, transform 0.2s',
              fontWeight: '500'
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
        <h1>My Bookings</h1>

        <div className="filter-section" style={{ marginBottom: '20px' }}>
          <div className="filter-row">
            <div className="filter-group">
              <label htmlFor="filterBus">Filter by Bus</label>
              <select
                id="filterBus"
                value={filterBus}
                onChange={(e) => setFilterBus(e.target.value)}
              >
                <option value="">All Buses</option>
                {uniqueBusIds.map(busId => {
                  const bus = getBusDetails(busId);
                  return bus ? (
                    <option key={busId} value={busId}>
                      {bus.busName} - {bus.from} → {bus.to}
                    </option>
                  ) : null;
                })}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="filterStatus">Filter by Status</label>
              <select
                id="filterStatus"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="filter-group">
              <label>&nbsp;</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn-filter" onClick={applyFilters}>
                  Apply Filters
                </button>
                <button type="button" className="btn-clear" onClick={clearFilters}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bookings-list">
          {filteredBookings.length === 0 ? (
            <div className="no-data">
              <div className="no-data-icon">📋</div>
              <p>No bookings found</p>
            </div>
          ) : (
            filteredBookings.map(booking => {
              const bus = getBusDetails(booking.busId);
              return (
                <div key={booking.bookingId} className="booking-card">
                  <div className="booking-header">
                    <div className="booking-id">Booking ID: {booking.bookingId}</div>
                    <div className={`booking-status status-${booking.status}`}>
                      {booking.status}
                    </div>
                  </div>
                  {bus && (
                    <div className="booking-info-grid">
                      <div className="info-item">
                        <div className="info-label">Bus</div>
                        <div className="info-value">{bus.busName}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">Route</div>
                        <div className="info-value">{bus.from} → {bus.to}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">Date</div>
                        <div className="info-value">{booking.date}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">Seats</div>
                        <div className="info-value">{booking.seats.join(', ')}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">Total Amount</div>
                        <div className="info-value">₹{formatPrice(booking.totalAmount)}</div>
                      </div>
                    </div>
                  )}
                  {booking.passengers && booking.passengers.length > 0 && (
                    <div className="passengers-section">
                      <div className="passengers-title">Passengers</div>
                      <div className="passengers-list">
                        {booking.passengers.map((passenger, idx) => (
                          <div key={idx} className="passenger-item">
                            <div className="passenger-detail">
                              <strong>Name:</strong>
                              <span>{passenger.name}</span>
                            </div>
                            <div className="passenger-detail">
                              <strong>Age:</strong>
                              <span>{passenger.age}</span>
                            </div>
                            <div className="passenger-detail">
                              <strong>Gender:</strong>
                              <span>{passenger.gender}</span>
                            </div>
                            <div className="passenger-detail">
                              <strong>Seat:</strong>
                              <span>{passenger.seatNumber} ({passenger.seatType})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {booking.status === 'confirmed' && (
                    <button
                      className="btn-cancel"
                      onClick={() => cancelBooking(booking.bookingId)}
                      style={{
                        marginTop: '15px',
                        padding: '10px 20px',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel Booking
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

export default Bookings;

