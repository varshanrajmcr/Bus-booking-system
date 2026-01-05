import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { formatPrice } from '../../utils/formatting';
import { redirectToLogin } from '../../utils/navigation';
import Navbar from '../common/Navbar';
import '../../styles/dashboard.css';

function Bookings() {
  const navigate = useNavigate();
  const { page } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userName, setUserName] = useState('Welcome, User');
  const [bookings, setBookings] = useState([]);
  const [allBuses, setAllBuses] = useState([]);
  const [filterBus, setFilterBus] = useState(() => {
    try {
      return searchParams.get('filterBus') || '';
    } catch {
      return '';
    }
  });
  const [filterStatus, setFilterStatus] = useState(() => {
    try {
      return searchParams.get('filterStatus') || '';
    } catch {
      return '';
    }
  });
  const [sortOrder, setSortOrder] = useState(() => {
    try {
      return searchParams.get('sortOrder') || 'latest';
    } catch {
      return 'latest';
    }
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [uniqueBusIds, setUniqueBusIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const isInitialMount = useRef(true);
  const itemsPerPage = 5;
  const currentPage = parseInt(page) || 1;

  useEffect(() => {
    // Add dashboard-page class to body
    const body = document.body;
    body.classList.add('dashboard-page');
    
    const initialize = async () => {
      try {
        const sessionResponse = await api.get('/session?type=customer');
        if (sessionResponse.data.authenticated && sessionResponse.data.user.userType === 'customer') {
          setUserName(`Welcome, ${sessionResponse.data.user.fullName || 'User'}`);
          // Redirect to page 1 if no page in URL
          if (!page) {
            navigate('/customer/bookings/1', { replace: true });
            return;
          }
        } else {
          redirectToLogin('customer', { showAlert: true, navigate });
        }
      } catch (error) {
        console.error('Error checking session:', error);
        redirectToLogin('customer', { navigate });
      }
    };

    initialize();
    
    return () => {
      body.classList.remove('dashboard-page');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBookings = async (pageNum = currentPage) => {
    try {
      setLoading(true);
      // Build query parameters
      const params = new URLSearchParams();
      if (filterBus) params.append('filterBus', filterBus);
      if (filterStatus) params.append('filterStatus', filterStatus);
      if (sortOrder) params.append('sortOrder', sortOrder);
      
      const queryString = params.toString();
      const url = `/bookings/customer/${pageNum}${queryString ? '?' + queryString : ''}`;
      
      const response = await api.get(url);
      if (response.status === 200) {
        const bookingsList = response.data.bookings || [];
        const pagination = response.data.pagination || {};
        const filterData = response.data.filterData || {};
        
        setBookings(bookingsList);
        setTotalPages(pagination.totalPages || 1);
        setTotalCount(pagination.totalCount || 0);
        
        // Set unique bus IDs from filter data
        if (filterData.uniqueBusIds) {
          setUniqueBusIds(filterData.uniqueBusIds);
        }
        
        // Set bus details for filter dropdown (only on page 1 to avoid unnecessary updates)
        if (pageNum === 1 && filterData.buses) {
          setAllBuses(filterData.buses);
        }
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  // Load bookings when page changes
  useEffect(() => {
    if (!page) {
      // If no page, redirect to page 1
      navigate('/customer/bookings/1', { replace: true });
      return;
    }
    
    // Only load if we have a valid page number
    const pageNum = parseInt(page);
    if (pageNum && pageNum > 0) {
      loadBookings(pageNum);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  
  // Navigate to page 1 when filters change (if not already on page 1)
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    if (!page) return;
    
    // If we're not on page 1 and filters change, navigate to page 1
    if (currentPage !== 1) {
      const params = new URLSearchParams();
      if (filterBus) params.set('filterBus', filterBus);
      if (filterStatus) params.set('filterStatus', filterStatus);
      if (sortOrder) params.set('sortOrder', sortOrder);
      navigate(`/customer/bookings/1?${params.toString()}`, { replace: false });
    } else {
      // Update search params when on page 1 (only if they actually changed)
      const params = new URLSearchParams();
      if (filterBus) params.set('filterBus', filterBus);
      if (filterStatus) params.set('filterStatus', filterStatus);
      if (sortOrder) params.set('sortOrder', sortOrder);
      const newParams = params.toString();
      const currentParams = searchParams.toString();
      if (newParams !== currentParams) {
        setSearchParams(params, { replace: true });
        // Reload bookings with new filters
        loadBookings(1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBus, filterStatus, sortOrder]);

  const clearFilters = () => {
    setFilterBus('');
    setFilterStatus('');
    setSortOrder('latest');
    navigate('/customer/bookings/1');
  };

  const cancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      const response = await api.put(`/bookings/${bookingId}/cancel`);
      if (response.status === 200) {
        alert('Booking cancelled successfully');
        // Reload current page after cancellation
        await loadBookings(currentPage);
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Error cancelling booking');
    }
  };

  const getBusDetails = (busId) => {
    // First try to find in current bookings (bus details are included in each booking)
    const booking = bookings.find(b => b.busId === busId);
    if (booking && booking.bus) {
      return booking.bus;
    }
    // Fallback to allBuses (for filter dropdown)
    return allBuses.find(bus => bus.busId === busId);
  };

  // Smart pagination helper - shows ellipsis for large page counts
  const getPageNumbers = (currentPage, totalPages) => {
    const pages = [];
    const maxVisible = 7; // Maximum number of page buttons to show
    
    if (totalPages <= maxVisible) {
      // If total pages is less than maxVisible, show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 3) {
        // Near the beginning: show 1, 2, 3, 4, 5, ..., last
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end: show 1, ..., last-4, last-3, last-2, last-1, last
        pages.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle: show 1, ..., current-1, current, current+1, ..., last
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  // Memoize bus filter options - only recalculate when dependencies change
  const busFilterOptions = useMemo(() => {
    return uniqueBusIds
      .map(busId => {
        // First try to find in current bookings
        const booking = bookings.find(b => b.busId === busId);
        if (booking && booking.bus) {
          return {
            busId,
            label: `${booking.bus.busName} - ${booking.bus.from} → ${booking.bus.to}`
          };
        }
        // Fallback to allBuses
        const bus = allBuses.find(bus => bus.busId === busId);
        if (bus) {
          return {
            busId,
            label: `${bus.busName} - ${bus.from} → ${bus.to}`
          };
        }
        return null;
      })
      .filter(Boolean); // Remove null entries
  }, [uniqueBusIds, bookings, allBuses]);

  // Memoize page numbers calculation
  const pageNumbers = useMemo(() => {
    return getPageNumbers(currentPage, totalPages);
  }, [currentPage, totalPages]);

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams();
    if (filterBus) params.set('filterBus', filterBus);
    if (filterStatus) params.set('filterStatus', filterStatus);
    if (sortOrder) params.set('sortOrder', sortOrder);
    const queryString = params.toString();
    navigate(`/customer/bookings/${newPage}${queryString ? '?' + queryString : ''}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
                onChange={(e) => {
                  if (!loading) {
                    setFilterBus(e.target.value);
                  }
                }}
                disabled={loading}
                style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                <option value="">All Buses</option>
                {busFilterOptions.map(bus => (
                  <option key={bus.busId} value={bus.busId}>
                    {bus.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="filterStatus">Filter by Status</label>
              <select
                id="filterStatus"
                value={filterStatus}
                onChange={(e) => {
                  if (!loading) {
                    setFilterStatus(e.target.value);
                  }
                }}
                disabled={loading}
                style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                <option value="">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="sortBookings">Sort Order</label>
              <button 
                type="button" 
                className="btn-filter" 
                onClick={() => {
                  if (!loading) {
                    setSortOrder(sortOrder === 'latest' ? 'older' : 'latest');
                  }
                }}
                disabled={loading}
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {sortOrder === 'latest' ? '📅 Latest First' : '📅 Older First'}
              </button>
            </div>
            <div className="filter-group">
              <label>&nbsp;</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn-clear" 
                  onClick={clearFilters}
                  disabled={loading}
                  style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bookings-list">
          {loading ? (
            <div className="no-data">
              <div className="no-data-icon">⏳</div>
              <p>Loading bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="no-data">
              <div className="no-data-icon">📋</div>
              <p>No bookings found</p>
            </div>
          ) : (
            <>
              {bookings.map(booking => {
              // Bus details are now included directly in the booking object
              const bus = booking.bus;
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
              })}
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '30px',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: '8px 16px',
                      background: currentPage === 1 ? '#ccc' : '#97d700',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    Previous
                  </button>
                  
                  {pageNumbers.map((page, index) => {
                    if (page === 'ellipsis') {
                      return (
                        <span
                          key={`ellipsis-${index}`}
                          style={{
                            padding: '8px 4px',
                            color: '#666',
                            fontSize: '14px',
                            fontWeight: 'normal'
                          }}
                        >
                          ...
                        </span>
                      );
                    }
                    
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        style={{
                          padding: '8px 16px',
                          background: currentPage === page ? '#97d700' : '#f0f0f0',
                          color: currentPage === page ? 'white' : '#333',
                          border: '1px solid #ddd',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: currentPage === page ? 'bold' : 'normal',
                          minWidth: '40px'
                        }}
                      >
                        {page}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '8px 16px',
                      background: currentPage === totalPages ? '#ccc' : '#97d700',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
              
              {totalPages > 1 && (
                <div style={{
                  textAlign: 'center',
                  marginTop: '10px',
                  color: '#666',
                  fontSize: '14px'
                }}>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} bookings
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Bookings;

