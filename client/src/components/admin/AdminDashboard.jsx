import { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, Filler } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setUser, setUserName, setEnterpriseName, logout } from '../../store/slices/authSlice';
import { clearTokens, storeTokens } from '../../utils/jwtUtils';
import {
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
} from '../../store/slices/adminSlice';
import { setErrorMessage, setSuccessMessage, clearMessages } from '../../store/slices/uiSlice';
import { redirectToLogin } from '../../utils/navigation';
import { setActiveAdminSession } from '../../utils/browserSessionManager';
import api from '../../services/api';
import { formatPrice, formatTime } from '../../utils/formatting';
import { validateBusName, validateLocation, validateTime, validateDuration, validatePrice, validateBusType, validateTotalSeats } from '../../utils/validation';
import { getCachedSSEData, storeSSEData, hasDataChanged, getCachedHash } from '../../utils/sseCache';
import '../../styles/dashboard.css';
import './AdminDashboard.css';

ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Filler
);

function AdminDashboard() {
  const dispatch = useAppDispatch();
  
  // Redux state
  const { userName, enterpriseName, user } = useAppSelector((state) => state.auth);
  const {
    activeTab,
    buses,
    bookings,
    stats,
    busForm,
    editingBusId,
    filteredBuses,
    filteredBookings,
    busFilters,
    bookingFilters,
    bookingSortOrder,
    overviewTimePeriod,
    bookingTrendType,
    eventSource
  } = useAppSelector((state) => state.admin);
  const { errorMessage, successMessage } = useAppSelector((state) => state.ui);
  
  // Get admin ID for cache operations
  const adminId = user?.adminId;

  // Local state for trend data (fetched from server)
  const [bookingTrendData, setBookingTrendData] = useState({
    labels: ['No Data'],
    datasets: [{
      label: 'Number of Bookings',
      data: [0],
      borderColor: '#C9A961',
      backgroundColor: 'rgba(201, 169, 97, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: '#C9A961',
      pointBorderColor: '#fff',
      pointBorderWidth: 2
    }]
  });

  // Date selection state
  const [dateSelectionType, setDateSelectionType] = useState('single'); // 'single', 'weekends', 'weekdays', 'full', 'special'
  const [selectedDates, setSelectedDates] = useState([]);
  
  // Pagination state for buses
  const [currentBusPage, setCurrentBusPage] = useState(1);
  // Pagination state for bookings
  const [currentBookingPage, setCurrentBookingPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    // Add dashboard-page class to body
    const body = document.body;
    body.classList.add('dashboard-page');
    
    const checkSession = async () => {
      try {
        const response = await api.get('/session?type=admin');
        // Session termination is handled by API interceptor - no need to check here
        
        if (response.data.authenticated && response.data.user.userType === 'admin') {
          // Store tokens if provided (e.g., when accessing dashboard directly via session cookie)
          if (response.data.tokens) {
            storeTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
            console.log('[AdminDashboard] Stored tokens from session endpoint');
          }
          
          // Ensure admin session is stored in localStorage (persist it)
          if (response.data.user.adminId) {
            setActiveAdminSession(response.data.user.adminId);
            console.log('[AdminDashboard] Admin session stored in localStorage:', response.data.user.adminId);
          }
          
          dispatch(setUser(response.data.user));
          dispatch(setUserName(`Welcome, ${response.data.user.fullName || 'Admin'}`));
          dispatch(setEnterpriseName(response.data.user.enterpriseName || 'Enterprise Name'));
          await loadData(true); // Load from cache first
          // Connect to SSE for real-time updates (will update if data changed)
          connectSSE();
        } else {
          redirectToLogin('admin', { showAlert: true, navigate: null });
        }
      } catch (error) {
        // Session termination errors are handled by API interceptor
        console.error('Error checking session:', error);
        // Only navigate if it's not a session termination (which interceptor handles)
        if (!error.response?.data?.sessionTerminated) {
          redirectToLogin('admin', { navigate: null });
        }
      }
    };

    checkSession();
    
    // Set up periodic check for completed journeys (every 5 minutes)
    const statusCheckInterval = setInterval(() => {
      const currentBuses = buses.map(bus => checkAndUpdateBusStatus(bus));
      dispatch(setBuses(currentBuses));
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => {
      body.classList.remove('dashboard-page');
      // Close SSE connection on unmount
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(statusCheckInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate bus statistics (seater/sleeper availability, booking percentage)
  const calculateBusStats = (bus, allBookings) => {
    const totalSeats = bus.totalSeats || 32;
    const sleeperSeats = Math.min(12, Math.floor(totalSeats * 0.375)); // ~37.5% sleeper
    const seaterSeats = totalSeats - sleeperSeats;
    
    // Get bookings for this bus on this date
    const busBookings = allBookings.filter(b => 
      (b.busId === bus.busId || b.busId === bus.id) && 
      b.date === bus.date && 
      b.status === 'confirmed'
    );
    
    // Calculate booked seats
    const bookedSeats = [];
    let bookedSeaters = 0;
    let bookedSleepers = 0;
    
    busBookings.forEach(booking => {
      if (Array.isArray(booking.seats)) {
        bookedSeats.push(...booking.seats.map(s => parseInt(s)));
      }
      if (Array.isArray(booking.passengers)) {
        booking.passengers.forEach(p => {
          if (p.seatType === 'seater') bookedSeaters++;
          else if (p.seatType === 'sleeper') bookedSleepers++;
        });
      }
    });
    
    const totalBooked = [...new Set(bookedSeats)].length;
    const availableSeats = totalSeats - totalBooked;
    const bookingPercentage = totalSeats > 0 ? Math.round((totalBooked / totalSeats) * 100) : 0;
    
    const availableSeaters = seaterSeats - bookedSeaters;
    const availableSleepers = sleeperSeats - bookedSleepers;
    
    return {
      totalSeats,
      sleeperSeats,
      seaterSeats,
      totalBooked,
      availableSeats,
      bookingPercentage,
      bookedSeaters,
      bookedSleepers,
      availableSeaters: Math.max(0, availableSeaters),
      availableSleepers: Math.max(0, availableSleepers)
    };
  };

  // Check if journey is complete and update status
  const checkAndUpdateBusStatus = (bus) => {
    if (!bus.date || !bus.arrivalTime) return bus;
    
    // Parse date and time, ensuring we use local timezone
    const dateStr = bus.date.trim();
    const timeStr = bus.arrivalTime.trim();
    
    // Create date object in local timezone
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    const journeyDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    
    const now = new Date();
    
    // If journey is complete (arrival time has passed), mark as inactive
    // Only mark as inactive if the journey date is actually in the past
    if (journeyDate < now && bus.status !== 'cancelled') {
      return { ...bus, status: 'inactive' };
    }
    
    return bus;
  };

  const loadData = async (useCache = true) => {
    try {
      // Try to load from cache first
      if (useCache && adminId) {
        const cachedData = getCachedSSEData(adminId);
        if (cachedData && cachedData.buses && cachedData.bookings) {
          console.log('[AdminDashboard] Loading data from cache');
          
          let busesList = cachedData.buses || [];
          
          // Check and update status for completed journeys (but keep cancelled buses)
          busesList = busesList.map(bus => {
            if (bus.status === 'cancelled') {
              return bus; // Keep cancelled buses as-is
            }
            return checkAndUpdateBusStatus(bus);
          });
          
          // Sort buses by date
          busesList.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateA - dateB;
          });
          dispatch(setBuses(busesList));
          dispatch(setFilteredBuses(busesList));
          
          const bookingsList = cachedData.bookings || [];
          dispatch(setBookings(bookingsList));
          dispatch(setFilteredBookings(bookingsList));
          
          // Calculate stats
          const totalRevenue = bookingsList
            .filter(b => b.status === 'confirmed')
            .reduce((sum, b) => sum + (parseFloat(b.totalAmount) || 0), 0);
          
          const totalPassengers = bookingsList
            .filter(b => b.status === 'confirmed')
            .reduce((sum, b) => sum + (b.passengers?.length || 0), 0);

          dispatch(setStats({
            totalBuses: busesList.length,
            totalBookings: bookingsList.length,
            totalRevenue: totalRevenue,
            totalPassengers: totalPassengers
          }));
          
          // Return early - SSE will update if data has changed
          return;
        }
      }
      
      // If no cache or cache miss, fetch from server
      console.log('[AdminDashboard] Loading data from server');
      const [busesResponse, bookingsResponse] = await Promise.all([
        api.get('/buses/admin'),
        api.get('/bookings/admin')
      ]);

      if (busesResponse.status === 200) {
        let busesList = busesResponse.data.buses || [];
        
        // Check and update status for completed journeys (but keep cancelled buses)
        busesList = busesList.map(bus => {
          if (bus.status === 'cancelled') {
            return bus; // Keep cancelled buses as-is
          }
          return checkAndUpdateBusStatus(bus);
        });
        
        // Sort buses by date
        busesList.sort((a, b) => {
          const dateA = new Date(a.date || 0);
          const dateB = new Date(b.date || 0);
          return dateA - dateB;
        });
        dispatch(setBuses(busesList));
        dispatch(setFilteredBuses(busesList));
        
        if (bookingsResponse.status === 200) {
          const bookingsList = bookingsResponse.data.bookings || [];
          dispatch(setBookings(bookingsList));
          dispatch(setFilteredBookings(bookingsList));
          
          // Calculate stats
          const totalRevenue = bookingsList
            .filter(b => b.status === 'confirmed')
            .reduce((sum, b) => sum + (parseFloat(b.totalAmount) || 0), 0);
          
          const totalPassengers = bookingsList
            .filter(b => b.status === 'confirmed')
            .reduce((sum, b) => sum + (b.passengers?.length || 0), 0);

          dispatch(setStats({
            totalBuses: busesList.length,
            totalBookings: bookingsList.length,
            totalRevenue: totalRevenue,
            totalPassengers: totalPassengers
          }));
          
          // Store in cache
          if (adminId) {
            storeSSEData(adminId, {
              buses: busesList,
              bookings: bookingsList
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Connect to SSE for real-time updates
  const connectSSE = () => {
    // Close existing connection if any
    if (eventSource) {
      eventSource.close();
    }

    try {
      const sse = new EventSource('/api/admin/stream', {
        withCredentials: true
      });

      sse.onopen = () => {
        console.log('SSE connection established');
      };

      sse.addEventListener('initial', (event) => {
        try {
          const data = JSON.parse(event.data);
          // Check if data has changed before processing
          if (adminId && !hasDataChanged(adminId, data)) {
            console.log('[SSE] Initial data unchanged, skipping update');
            return; // Data hasn't changed, skip processing
          }
          handleSSEMessage('initial', data, adminId);
        } catch (error) {
          console.error('Error parsing SSE initial message:', error);
        }
      });

      sse.addEventListener('booking_created', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage('booking_created', data, adminId);
        } catch (error) {
          console.error('Error parsing SSE booking_created message:', error);
        }
      });

      sse.addEventListener('bus_created', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage('bus_created', data, adminId);
        } catch (error) {
          console.error('Error parsing SSE bus_created message:', error);
        }
      });

      sse.addEventListener('bus_updated', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage('bus_updated', data, adminId);
        } catch (error) {
          console.error('Error parsing SSE bus_updated message:', error);
        }
      });

      sse.addEventListener('bus_cancelled', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage('bus_cancelled', data, adminId);
        } catch (error) {
          console.error('Error parsing SSE bus_cancelled message:', error);
        }
      });

      sse.addEventListener('booking_cancelled', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage('booking_cancelled', data, adminId);
        } catch (error) {
          console.error('Error parsing SSE booking_cancelled message:', error);
        }
      });

      sse.addEventListener('error', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage('error', data);
        } catch (error) {
          console.error('Error parsing SSE error message:', error);
        }
      });

      sse.onerror = (error) => {
        console.error('SSE connection error:', error);
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (sse.readyState === EventSource.CLOSED) {
            console.log('Attempting to reconnect SSE...');
            connectSSE();
          }
        }, 3000);
      };

      dispatch(setEventSource(sse));
    } catch (error) {
      console.error('Error establishing SSE connection:', error);
    }
  };

  // Handle SSE messages and update UI
  const handleSSEMessage = (eventType, data, adminId) => {
    console.log('Received SSE message:', eventType, data);
    
    if (eventType === 'initial' || eventType === 'booking_created' || 
        eventType === 'bus_created' || eventType === 'bus_updated' || 
        eventType === 'bus_cancelled' || eventType === 'booking_cancelled') {
      
      // Handle bus updates efficiently
      if (eventType === 'bus_updated' && data.bus) {
        const updatedBus = checkAndUpdateBusStatus(data.bus);
        dispatch(updateBus({ 
          busId: updatedBus.busId || updatedBus.id, 
          updates: updatedBus 
        }));
        // Reapply filters to update filtered list
        const currentBuses = buses.map(b => 
          (b.busId || b.id) === (updatedBus.busId || updatedBus.id) ? updatedBus : b
        );
        applyBusFilters(currentBuses);
      } else if (eventType === 'bus_cancelled' && data.busId) {
        // Remove cancelled bus from state
        dispatch(removeBus(data.busId));
        // Reapply filters to update filtered list
        const currentBuses = buses.filter(b => (b.busId || b.id) !== data.busId);
        applyBusFilters(currentBuses);
      } else if (data.buses) {
        // For initial load or bus_created, reload all buses
        let fetchedBuses = data.buses || [];
        // Check and update status for completed journeys
        fetchedBuses = fetchedBuses.map(bus => checkAndUpdateBusStatus(bus));
        fetchedBuses.sort((a, b) => {
          const dateA = new Date(a.date || 0);
          const dateB = new Date(b.date || 0);
          return dateA - dateB;
        });
        dispatch(setBuses(fetchedBuses));
        applyBusFilters(fetchedBuses);
      }
      
      if (data.bookings) {
        const bookingsList = Array.isArray(data.bookings) ? [...data.bookings] : [];
        dispatch(setBookings(bookingsList));
        applyBookingFilters(bookingsList);
        
        // Recalculate stats
        const totalRevenue = bookingsList
          .filter(b => b.status === 'confirmed')
          .reduce((sum, b) => sum + (parseFloat(b.totalAmount) || 0), 0);
        
        const totalPassengers = bookingsList
          .filter(b => b.status === 'confirmed')
          .reduce((sum, b) => sum + (b.passengers?.length || 0), 0);

        dispatch(setStats({
          ...stats,
          totalBookings: bookingsList.length,
          totalRevenue: totalRevenue,
          totalPassengers: totalPassengers
        }));
      }
      
      // Store in cache when we receive full data (initial or after changes)
      if (adminId && (eventType === 'initial' || eventType === 'bus_created' || eventType === 'booking_created')) {
        if (data.buses && data.bookings) {
          storeSSEData(adminId, {
            buses: data.buses,
            bookings: data.bookings
          });
        }
      }
      
      // Show notification for real-time updates (except initial load)
      if (eventType !== 'initial') {
        if (eventType === 'booking_cancelled' && data.cancelledBy === 'customer') {
          showBookingCancellationNotification(data);
        } else {
          dispatch(setSuccessMessage(`Real-time update: ${eventType.replace('_', ' ')}`));
          setTimeout(() => dispatch(setSuccessMessage('')), 3000);
        }
      }
    } else if (eventType === 'error') {
      console.error('SSE error:', data);
      dispatch(setErrorMessage(data.message || 'Error receiving real-time update'));
      setTimeout(() => dispatch(setErrorMessage('')), 5000);
    }
  };

  const showBookingCancellationNotification = (data) => {
    const cancelledBooking = bookings.find(b => b.bookingId === data.bookingId);
    const bus = buses.find(b => (b.busId || b.id) === data.busId);
    const busName = bus ? `${bus.enterpriseName || 'Bus Service'} - ${bus.busName}` : `Bus ID: ${data.busId}`;
    const seats = (data.seats && data.seats.length > 0) ? data.seats : 
                 (cancelledBooking && cancelledBooking.seats) ? cancelledBooking.seats : [];
    const seatsText = seats.length > 0 ? `Seats ${seats.join(', ')} are now available.` : '';
    
    const notification = document.createElement('div');
    notification.id = 'bookingCancellationNotification';
    notification.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
      color: white;
      padding: 20px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      animation: slideDown 0.5s ease-out;
    `;
    
    notification.innerHTML = `
      <div style="flex: 1; display: flex; align-items: center; gap: 15px;">
        <span style="font-size: 32px;">⚠️</span>
        <div>
          <strong style="font-size: 16px; display: block; margin-bottom: 5px;">Booking Cancellation Notice</strong>
          <span style="font-size: 14px;">
            Customer has cancelled booking <strong>${data.bookingId}</strong> for bus <strong>${busName}</strong>.
            ${seatsText}
          </span>
        </div>
      </div>
      <button onclick="this.parentElement.remove(); document.body.style.paddingTop = '';" 
              style="background: rgba(255,255,255,0.2); color: white; border: 2px solid white; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 18px; font-weight: bold;">×</button>
    `;
    
    if (!document.getElementById('adminNotificationStyles')) {
      const style = document.createElement('style');
      style.id = 'adminNotificationStyles';
      style.textContent = `
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.style.paddingTop = '80px';
    document.body.insertBefore(notification, document.body.firstChild);
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
        document.body.style.paddingTop = '';
      }
    }, 10000);
  };

  useEffect(() => {
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('date');
    if (dateInput) {
      dateInput.setAttribute('min', today);
    }
  }, [activeTab]);

  // Calculate duration when times change
  useEffect(() => {
    if (busForm.departureTime && busForm.arrivalTime) {
      const [depHours, depMinutes] = busForm.departureTime.split(':').map(Number);
      const [arrHours, arrMinutes] = busForm.arrivalTime.split(':').map(Number);

      let depTotalMinutes = depHours * 60 + depMinutes;
      let arrTotalMinutes = arrHours * 60 + arrMinutes;

      // Handle next day arrival
      if (arrTotalMinutes < depTotalMinutes) {
        arrTotalMinutes += 24 * 60;
      }

      const diffMinutes = arrTotalMinutes - depTotalMinutes;
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;

      dispatch(setBusForm({ ...busForm, duration: `${hours}h ${minutes}m` }));
    } else {
      dispatch(setBusForm({ ...busForm, duration: '' }));
    }
  }, [busForm.departureTime, busForm.arrivalTime]);

  const calculateDuration = () => {
    if (!busForm.departureTime || !busForm.arrivalTime) {
      dispatch(setBusForm({ ...busForm, duration: '' }));
      return;
    }

    const [depHours, depMinutes] = busForm.departureTime.split(':').map(Number);
    const [arrHours, arrMinutes] = busForm.arrivalTime.split(':').map(Number);

    let depTotalMinutes = depHours * 60 + depMinutes;
    let arrTotalMinutes = arrHours * 60 + arrMinutes;

    // Handle next day arrival
    if (arrTotalMinutes < depTotalMinutes) {
      arrTotalMinutes += 24 * 60;
    }

    const diffMinutes = arrTotalMinutes - depTotalMinutes;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    dispatch(setBusForm({ ...busForm, duration: `${hours}h ${minutes}m` }));
  };

  const handleBusFormChange = (field, value) => {
    dispatch(setBusForm({ ...busForm, [field]: value }));
  };

  // Calculate dates for current month based on selection type
  const calculateDatesForType = (type) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get last day of current month
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    const dates = [];
    const startDate = new Date(today); // Start from today
    
    for (let d = new Date(startDate); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      if (type === 'weekends') {
        // Saturday (6) and Sunday (0)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          dates.push(dateStr);
        }
      } else if (type === 'weekdays') {
        // Monday (1) to Friday (5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          dates.push(dateStr);
        }
      } else if (type === 'full') {
        // All days (Sunday to Saturday)
        dates.push(dateStr);
      }
    }
    
    return dates.sort();
  };

  // Handle date selection type change
  const handleDateSelectionTypeChange = (type) => {
    setDateSelectionType(type);
    
    if (type === 'single') {
      setSelectedDates([]);
      if (!editingBusId) {
        handleBusFormChange('date', '');
      }
    } else if (type === 'special') {
      // Keep existing selected dates or start fresh
      if (selectedDates.length === 0) {
        setSelectedDates([]);
      }
    } else {
      // Calculate dates for weekends, weekdays, or full
      const calculatedDates = calculateDatesForType(type);
      setSelectedDates(calculatedDates);
      handleBusFormChange('date', '');
    }
  };

  // Apply bus filters
  const applyBusFilters = (busesList = buses) => {
    let filtered = [...busesList];
    
    // Filter out cancelled buses from the buses list (but keep them in state for bookings)
    filtered = filtered.filter(bus => (bus.status || 'active') !== 'cancelled');
    
    if (busFilters.date) {
      filtered = filtered.filter(bus => bus.date === busFilters.date);
    }
    
    dispatch(setFilteredBuses(filtered));
    // Reset to page 1 when filters change
    setCurrentBusPage(1);
  };

  // Apply booking filters
  const applyBookingFilters = (bookingsList = bookings) => {
    let filtered = [...bookingsList];
    
    if (bookingFilters.bus) {
      filtered = filtered.filter(b => b.busId === parseInt(bookingFilters.bus));
    }
    
    if (bookingFilters.date) {
      filtered = filtered.filter(b => b.date?.trim() === bookingFilters.date);
    }
    
    if (bookingFilters.status) {
      filtered = filtered.filter(b => b.status === bookingFilters.status);
    }
    
    // Apply sorting by travel date
    filtered.sort((a, b) => {
      // Get travel dates (YYYY-MM-DD format)
      const dateA = a.date ? new Date(a.date.trim()) : new Date(0);
      const dateB = b.date ? new Date(b.date.trim()) : new Date(0);
      
      if (bookingSortOrder === 'latest') {
        // Latest travel dates first (descending)
        return dateB - dateA;
      } else {
        // Older travel dates first (ascending)
        return dateA - dateB;
      }
    });
    
    dispatch(setFilteredBookings(filtered));
    // Reset to page 1 when filters change
    setCurrentBookingPage(1);
  };

  useEffect(() => {
    applyBusFilters();
  }, [busFilters, buses]);

  useEffect(() => {
    applyBookingFilters();
  }, [bookingFilters, bookings, bookingSortOrder]);

  const handleBusFilterChange = (field, value) => {
    dispatch(setBusFilters({ ...busFilters, [field]: value }));
  };

  const clearBusFilters = () => {
    dispatch(setBusFilters({ date: '' }));
  };

  const handleBookingFilterChange = (field, value) => {
    dispatch(setBookingFilters({ ...bookingFilters, [field]: value }));
  };

  const clearBookingFilters = () => {
    dispatch(setBookingFilters({ bus: '', date: '', status: '' }));
  };

  const editBus = (busId) => {
    const bus = buses.find(b => (b.busId || b.id) === busId);
    if (!bus) {
      dispatch(setErrorMessage('Bus not found'));
      return;
    }
    
    dispatch(setBusForm({
      busName: bus.busName || '',
      from: bus.from || '',
      to: bus.to || '',
      date: bus.date ? bus.date.split('T')[0] : '',
      departureTime: formatTime(bus.departureTime) || '',
      arrivalTime: formatTime(bus.arrivalTime) || '',
      duration: bus.duration || '',
      seaterPrice: bus.seaterPrice || '',
      sleeperPrice: bus.sleeperPrice || '',
      busType: bus.busType || '',
      totalSeats: bus.totalSeats || '32'
    }));
    
    // Reset to single date type when editing
    setDateSelectionType('single');
    setSelectedDates([]);
    
    dispatch(setEditingBusId(busId));
    dispatch(setActiveTab('add-bus'));
    dispatch(clearMessages());
  };

  const deleteBus = async (busId) => {
    if (!window.confirm('Are you sure you want to delete this bus? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await api.delete(`/buses/${busId}`);
      
      if (response.status === 200) {
        dispatch(setSuccessMessage('Bus deleted successfully!'));
        // Optimize: Remove bus from Redux state directly instead of reloading all data
        dispatch(removeBus(busId));
        // Update filtered buses
        const currentBuses = buses.filter(b => (b.busId || b.id) !== busId);
        applyBusFilters(currentBuses);
        // Don't update stats here - overview section calculates its own stats from all bookings
        // This ensures overview shows overall/historical stats even when buses are deleted
        setTimeout(() => dispatch(setSuccessMessage('')), 3000);
      }
    } catch (error) {
      dispatch(setErrorMessage(error.response?.data?.error || 'Failed to delete bus'));
      setTimeout(() => dispatch(setErrorMessage('')), 5000);
    }
  };

  const handleBusSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearMessages());

    // Ensure duration is calculated
    if (busForm.departureTime && busForm.arrivalTime) {
      calculateDuration();
    }

    const formData = {
      busName: busForm.busName.trim(),
      enterpriseName: enterpriseName.trim(),
      from: busForm.from.trim(),
      to: busForm.to.trim(),
      date: busForm.date,
      departureTime: busForm.departureTime,
      arrivalTime: busForm.arrivalTime,
      duration: busForm.duration.trim(),
      seaterPrice: Math.round(parseFloat(busForm.seaterPrice) * 100) / 100,
      sleeperPrice: Math.round(parseFloat(busForm.sleeperPrice) * 100) / 100,
      busType: busForm.busType,
      totalSeats: parseInt(busForm.totalSeats)
    };

    // Validate all fields
    const allErrors = [];

    const busNameValidation = validateBusName(formData.busName);
    if (!busNameValidation.isValid) {
      allErrors.push(...busNameValidation.errors);
    }

    const fromValidation = validateLocation(formData.from, 'From location');
    if (!fromValidation.isValid) {
      allErrors.push(...fromValidation.errors);
    }

    const toValidation = validateLocation(formData.to, 'To location');
    if (!toValidation.isValid) {
      allErrors.push(...toValidation.errors);
    }

    if (formData.from.toLowerCase() === formData.to.toLowerCase()) {
      allErrors.push('From and To locations cannot be the same');
    }

    const departureTimeValidation = validateTime(formData.departureTime, 'Departure time');
    if (!departureTimeValidation.isValid) {
      allErrors.push(...departureTimeValidation.errors);
    }

    const arrivalTimeValidation = validateTime(formData.arrivalTime, 'Arrival time');
    if (!arrivalTimeValidation.isValid) {
      allErrors.push(...arrivalTimeValidation.errors);
    }

    const durationValidation = validateDuration(formData.duration);
    if (!durationValidation.isValid) {
      allErrors.push(...durationValidation.errors);
    }

    const seaterPriceValidation = validatePrice(formData.seaterPrice, 'Seater price');
    if (!seaterPriceValidation.isValid) {
      allErrors.push(...seaterPriceValidation.errors);
    }

    const sleeperPriceValidation = validatePrice(formData.sleeperPrice, 'Sleeper price');
    if (!sleeperPriceValidation.isValid) {
      allErrors.push(...sleeperPriceValidation.errors);
    }

    if (seaterPriceValidation.isValid && sleeperPriceValidation.isValid) {
      if (sleeperPriceValidation.value <= seaterPriceValidation.value) {
        allErrors.push('Sleeper price must be higher than seater price');
      }
    }

    const busTypeValidation = validateBusType(formData.busType);
    if (!busTypeValidation.isValid) {
      allErrors.push(...busTypeValidation.errors);
    }

    const totalSeatsValidation = validateTotalSeats(formData.totalSeats);
    if (!totalSeatsValidation.isValid) {
      allErrors.push(...totalSeatsValidation.errors);
    }

    // Validate date selection based on type
    if (dateSelectionType === 'single') {
      if (!busForm.date) {
        allErrors.push('Schedule date is required');
      }
    } else {
      if (selectedDates.length === 0) {
        allErrors.push('At least one date must be selected');
      }
    }

    if (allErrors.length > 0) {
      dispatch(setErrorMessage('Validation errors:\n' + allErrors.join('\n')));
      return;
    }

    try {
      if (editingBusId) {
        // Update existing bus (only single date mode for editing)
        const response = await api.put(`/buses/${editingBusId}`, formData);
        
        if (response.status === 200) {
          dispatch(setSuccessMessage('Bus updated successfully!'));
          setTimeout(() => dispatch(setSuccessMessage('')), 3000);
          dispatch(resetBusForm());
          setDateSelectionType('single');
          setSelectedDates([]);
          
          // Optimize: Update bus in Redux state directly instead of reloading all data
          const updatedBus = checkAndUpdateBusStatus(response.data.bus);
          dispatch(updateBus({ 
            busId: editingBusId, 
            updates: updatedBus 
          }));
          // Reapply filters to update filtered list
          const currentBuses = buses.map(b => 
            (b.busId || b.id) === editingBusId ? updatedBus : b
          );
          applyBusFilters(currentBuses);
          dispatch(setEditingBusId(null));
        }
      } else {
        // Create new bus(s) - handle both single and multiple dates
        const datesToSchedule = dateSelectionType === 'single' 
          ? [busForm.date] 
          : selectedDates;
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // Create buses for each selected date
        for (const date of datesToSchedule) {
          try {
            const busData = {
              ...formData,
              date: date
            };
            const response = await api.post('/buses', busData);
            if (response.status === 201) {
              successCount++;
            }
          } catch (error) {
            errorCount++;
            const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to create bus';
            errors.push(`${date}: ${errorMsg}`);
          }
        }

        // Show success/error messages
        if (successCount > 0 && errorCount === 0) {
          dispatch(setSuccessMessage(
            datesToSchedule.length === 1 
              ? 'Bus scheduled successfully!' 
              : `${successCount} bus(es) scheduled successfully!`
          ));
        } else if (successCount > 0 && errorCount > 0) {
          dispatch(setSuccessMessage(
            `${successCount} bus(es) scheduled successfully. ${errorCount} failed.`
          ));
          dispatch(setErrorMessage('Some buses failed to schedule:\n' + errors.join('\n')));
        } else {
          dispatch(setErrorMessage('Failed to schedule buses:\n' + errors.join('\n')));
        }

        setTimeout(() => {
          dispatch(setSuccessMessage(''));
          dispatch(setErrorMessage(''));
        }, 5000);

        // Reset form
        dispatch(resetBusForm());
        setDateSelectionType('single');
        setSelectedDates([]);
        
        // Reload buses to show newly created ones
        await loadData();
        
        // Switch to buses tab after 1 second
        setTimeout(() => {
          dispatch(setActiveTab('buses'));
        }, 1000);
      }
    } catch (error) {
      if (!editingBusId) {
        // Error already handled in the loop above
        return;
      }
      dispatch(setErrorMessage(error.response?.data?.error || 'Failed to update bus. Please try again.'));
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear JWT tokens and Redux state
      clearTokens();
      dispatch(logout());
      redirectToLogin('admin');
    }
  };

  // Filter bookings by booking creation time (createdAt) for overview
  const getFilteredBookingsForOverview = () => {
    if (overviewTimePeriod === 'overall') {
      return bookings;
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    
    return bookings.filter(booking => {
      if (!booking.createdAt) return false;
      
      const bookingCreatedAt = new Date(booking.createdAt);
      bookingCreatedAt.setHours(0, 0, 0, 0);
      
      if (overviewTimePeriod === 'today') {
        // Bookings created today
        return bookingCreatedAt.getTime() === today.getTime();
      } else if (overviewTimePeriod === 'pastWeek') {
        // Bookings created in the past 7 days (including today)
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return bookingCreatedAt >= weekAgo && bookingCreatedAt <= today;
      } else if (overviewTimePeriod === 'pastMonth') {
        // Bookings created in the past 30 days (including today)
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return bookingCreatedAt >= monthAgo && bookingCreatedAt <= today;
      }
      
      return true;
    });
  };

  // Calculate stats based on filtered bookings
  // For overall stats, count buses from bookings (including deleted buses) so stats don't change when buses are deleted
  const getOverviewStats = () => {
    const filteredBookings = getFilteredBookingsForOverview();
    const confirmedBookings = filteredBookings.filter(b => b.status === 'confirmed');
    
    // Count unique buses from all bookings (including deleted buses) for overall stats
    const uniqueBusIds = new Set(filteredBookings.map(b => b.busId));
    const totalBusesFromBookings = uniqueBusIds.size;
    
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.totalAmount) || 0), 0);
    const totalPassengers = confirmedBookings.reduce((sum, b) => sum + (b.passengers?.length || 0), 0);
    
    return {
      totalBuses: totalBusesFromBookings, // Count from bookings to include deleted buses
      totalBookings: filteredBookings.length,
      totalRevenue: totalRevenue,
      totalPassengers: totalPassengers
    };
  };

  const overviewStats = getOverviewStats();

  // Calculate chart data with only buses that have bookings in the selected period
  // Only show buses that are currently available (not deleted) - use actual bus names only
  const getChartData = () => {
    const filteredBookingsForChart = getFilteredBookingsForOverview();
    
    if (filteredBookingsForChart.length === 0 || buses.length === 0) {
      return {
        labels: ['No Bookings'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e0e0e0']
        }]
      };
    }

    // Only include buses that are currently in the buses array (not deleted)
    // This ensures we only show actual bus names, not fallback names like "Bus #9"
    const busBookingCounts = buses.map(bus => {
      const count = filteredBookingsForChart.filter(b => b.busId === (bus.busId || bus.id)).length;
      return { busName: bus.busName, count };
    }).filter(item => item.count > 0) // Only include buses with bookings
      .sort((a, b) => b.count - a.count); // Sort by count descending

    if (busBookingCounts.length === 0) {
      return {
        labels: ['No Bookings'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e0e0e0']
        }]
      };
    }

    const colors = [
      '#C9A961',
      '#B8860B',
      '#D4AF37',
      '#F4D03F',
      '#F7DC6F',
      '#FFD700',
      '#FFA500'
    ];

    return {
      labels: busBookingCounts.map(item => item.busName),
      datasets: [{
        data: busBookingCounts.map(item => item.count),
        backgroundColor: colors.slice(0, busBookingCounts.length)
      }]
    };
  };

  const chartData = getChartData();

  // Fetch booking trends from server
  useEffect(() => {
    const fetchTrendData = async () => {
      try {
        const params = new URLSearchParams({
          period: overviewTimePeriod,
          type: bookingTrendType
        });
        
        const response = await api.get(`/bookings/admin/trends?${params.toString()}`);
        
        if (response.status === 200 && response.data) {
          const { labels, data } = response.data;
          
          setBookingTrendData({
            labels: labels.length > 0 ? labels : ['No Data'],
            datasets: [{
              label: 'Number of Bookings',
              data: data.length > 0 ? data : [0],
              borderColor: '#C9A961',
              backgroundColor: 'rgba(201, 169, 97, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: '#C9A961',
              pointBorderColor: '#fff',
              pointBorderWidth: 2
            }]
          });
        }
      } catch (error) {
        console.error('Error fetching trend data:', error);
        // Set default empty data on error
        setBookingTrendData({
          labels: ['No Data'],
          datasets: [{
            label: 'Number of Bookings',
            data: [0],
            borderColor: '#C9A961',
            backgroundColor: 'rgba(201, 169, 97, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#C9A961',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }]
        });
      }
    };

    fetchTrendData();
  }, [overviewTimePeriod, bookingTrendType]);

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          precision: 0
        }
      }
    }
  };

  // Pagination calculations for buses
  const totalBusPages = Math.ceil(filteredBuses.length / itemsPerPage);
  const startBusIndex = (currentBusPage - 1) * itemsPerPage;
  const endBusIndex = startBusIndex + itemsPerPage;
  const currentBuses = filteredBuses.slice(startBusIndex, endBusIndex);

  const handleBusPageChange = (page) => {
    setCurrentBusPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Smart pagination helper - shows ellipsis for large page counts
  const getBusPageNumbers = (currentPage, totalPages) => {
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

  // Pagination calculations for bookings
  const totalBookingPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const startBookingIndex = (currentBookingPage - 1) * itemsPerPage;
  const endBookingIndex = startBookingIndex + itemsPerPage;
  const currentBookings = filteredBookings.slice(startBookingIndex, endBookingIndex);

  const handleBookingPageChange = (page) => {
    setCurrentBookingPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Smart pagination helper for bookings - shows ellipsis for large page counts
  const getBookingPageNumbers = (currentPage, totalPages) => {
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

  return (
    <>
      <nav className="navbar">
        <div className="nav-container">
          <h2>
            <img src="/images/logo.jpg" alt="JourneyJunction Logo" className="nav-logo" /> 
            JourneyJunction
          </h2>
          <div className="nav-links">
            <span id="userName">{userName}</span>
            <button className="btn-logout" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="admin-dashboard">
        <div className="dashboard-header">
          <div>
            <h1>Admin Dashboard</h1>
          </div>
          <div className="admin-info">
            <div className="enterprise-name">{enterpriseName}</div>
            <div id="adminName">{userName}</div>
          </div>
        </div>

        {errorMessage && (
          <div className="error-message" style={{ display: 'block' }}>
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="success-message" style={{ display: 'block' }}>
            {successMessage}
          </div>
        )}

        <div className="tabs">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => dispatch(setActiveTab('overview'))}
          >
            Overview
          </button>
          <button
            className={`tab-button ${activeTab === 'buses' ? 'active' : ''}`}
            onClick={() => dispatch(setActiveTab('buses'))}
          >
            My Buses
          </button>
          <button
            className={`tab-button ${activeTab === 'add-bus' ? 'active' : ''}`}
            onClick={() => dispatch(setActiveTab('add-bus'))}
          >
            ➕ Add New Bus
          </button>
          <button
            className={`tab-button ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => dispatch(setActiveTab('bookings'))}
          >
            Bookings
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="tab-content active">
            <div className="section-title">Dashboard Overview</div>
            
            {/* Time Period Filter */}
            <div className="filter-section" style={{ marginBottom: '20px' }}>
              <div className="filter-row">
                <div className="filter-group">
                  <label htmlFor="overviewTimePeriod">Filter by Booking Time</label>
                  <select
                    id="overviewTimePeriod"
                    value={overviewTimePeriod}
                    onChange={(e) => dispatch(setOverviewTimePeriod(e.target.value))}
                    style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                  >
                    <option value="overall">Overall (All Bookings)</option>
                    <option value="today">Today</option>
                    <option value="pastWeek">Past Week</option>
                    <option value="pastMonth">Past Month</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="stats-cards">
              <div className="stat-card">
                <div className="stat-value">{overviewStats.totalBuses}</div>
                <div className="stat-label">Total Buses</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{overviewStats.totalBookings}</div>
                <div className="stat-label">Total Bookings</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">₹{formatPrice(overviewStats.totalRevenue)}</div>
                <div className="stat-label">Total Revenue</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{overviewStats.totalPassengers}</div>
                <div className="stat-label">Total Passengers</div>
              </div>
            </div>
            
            {buses.length > 0 && (
              <div className="chart-container">
                <div className="chart-title">Bookings by Bus</div>
                <div className="chart-wrapper">
                  <Pie data={chartData} />
                </div>
              </div>
            )}

            {/* Booking Trend Chart */}
            <div className="chart-container" style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div className="chart-title">Booking Trends</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <label htmlFor="trendType" style={{ fontSize: '14px', fontWeight: '500' }}>View:</label>
                  <select
                    id="trendType"
                    value={bookingTrendType}
                    onChange={(e) => dispatch(setBookingTrendType(e.target.value))}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '14px', 
                      borderRadius: '5px',
                      border: '1px solid #ddd',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div className="chart-wrapper" style={{ height: '300px' }}>
                <Line data={bookingTrendData} options={trendChartOptions} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'buses' && (
          <div className="tab-content active">
            <div className="section-title">My Scheduled Buses</div>
            
            {/* Filter Section for Buses */}
            <div className="filter-section">
              <div className="filter-row">
                <div className="filter-group">
                  <label htmlFor="filterBusDate">Filter by Travel Date</label>
                  <input
                    type="date"
                    id="filterBusDate"
                    value={busFilters.date}
                    onChange={(e) => handleBusFilterChange('date', e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label>&nbsp;</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="btn-clear" onClick={clearBusFilters}>
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="buses-list">
              {filteredBuses.length === 0 ? (
                <div className="no-data">No buses found</div>
              ) : (
                <>
                  {currentBuses.map(bus => {
                    const busStats = calculateBusStats(bus, bookings);
                    return (
                      <div key={bus.busId || bus.id} className="bus-card-admin">
                        <div className="bus-info-admin">
                          <h3>{bus.busName}</h3>
                          <div className="bus-details-grid">
                            <div className="bus-detail-item">
                              <strong>Route:</strong> {bus.from} → {bus.to}
                            </div>
                            <div className="bus-detail-item">
                              <strong>Date:</strong> {bus.date}
                            </div>
                            <div className="bus-detail-item">
                              <strong>Time:</strong> {formatTime(bus.departureTime)} - {formatTime(bus.arrivalTime)}
                            </div>
                            <div className="bus-detail-item">
                              <strong>Duration:</strong> {bus.duration}
                            </div>
                            <div className="bus-detail-item">
                              <strong>Type:</strong> {bus.busType}
                            </div>
                            <div className="bus-detail-item">
                              <strong>Total Seats:</strong> {busStats.totalSeats}
                            </div>
                            <div className="bus-detail-item">
                              <strong>Seater Seats:</strong> {busStats.availableSeaters} / {busStats.seaterSeats} available ({busStats.bookedSeaters} booked)
                            </div>
                            <div className="bus-detail-item">
                              <strong>Sleeper Seats:</strong> {busStats.availableSleepers} / {busStats.sleeperSeats} available ({busStats.bookedSleepers} booked)
                            </div>
                            <div className="bus-detail-item">
                              <strong>Booking Status:</strong> {busStats.totalBooked} / {busStats.totalSeats} seats booked ({busStats.bookingPercentage}%)
                              <div style={{ 
                                width: '100%', 
                                height: '8px', 
                                background: '#333', 
                                borderRadius: '4px', 
                                marginTop: '5px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${busStats.bookingPercentage}%`,
                                  height: '100%',
                                  background: busStats.bookingPercentage >= 80 ? '#4caf50' : 
                                             busStats.bookingPercentage >= 50 ? '#ff9800' : '#2196f3',
                                  transition: 'width 0.3s ease'
                                }}></div>
                              </div>
                            </div>
                            <div className="bus-detail-item">
                              <strong>Price:</strong> ₹{formatPrice(bus.seaterPrice)} (Seater) / ₹{formatPrice(bus.sleeperPrice)} (Sleeper)
                            </div>
                            {bus.status && (
                              <div className="bus-detail-item">
                                <strong>Status:</strong> <span style={{
                                  color: bus.status === 'active' ? '#4caf50' : 
                                         bus.status === 'inactive' ? '#ff9800' : '#f44336',
                                  fontWeight: 'bold'
                                }}>{bus.status}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="bus-actions">
                          <button className="btn-edit" onClick={() => editBus(bus.busId || bus.id)}>✏️ Edit</button>
                          <button className="btn-delete" onClick={() => deleteBus(bus.busId || bus.id)}>🗑️ Delete</button>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Pagination Controls */}
                  {totalBusPages > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '10px',
                      marginTop: '30px',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={() => handleBusPageChange(currentBusPage - 1)}
                        disabled={currentBusPage === 1}
                        style={{
                          padding: '8px 16px',
                          background: currentBusPage === 1 ? '#ccc' : '#97d700',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: currentBusPage === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        Previous
                      </button>
                      
                      {getBusPageNumbers(currentBusPage, totalBusPages).map((page, index) => {
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
                            onClick={() => handleBusPageChange(page)}
                            style={{
                              padding: '8px 16px',
                              background: currentBusPage === page ? '#97d700' : '#f0f0f0',
                              color: currentBusPage === page ? 'white' : '#333',
                              border: '1px solid #ddd',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: currentBusPage === page ? 'bold' : 'normal',
                              minWidth: '40px'
                            }}
                          >
                            {page}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => handleBusPageChange(currentBusPage + 1)}
                        disabled={currentBusPage === totalBusPages}
                        style={{
                          padding: '8px 16px',
                          background: currentBusPage === totalBusPages ? '#ccc' : '#97d700',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: currentBusPage === totalBusPages ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                  
                  {totalBusPages > 1 && (
                    <div style={{
                      textAlign: 'center',
                      marginTop: '10px',
                      color: '#666',
                      fontSize: '14px'
                    }}>
                      Showing {startBusIndex + 1} - {Math.min(endBusIndex, filteredBuses.length)} of {filteredBuses.length} buses
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'add-bus' && (
          <div className="tab-content active">
            <div className="section-title">{editingBusId ? 'Edit Bus' : 'Schedule New Bus'}</div>
            <div className="add-bus-form">
              {errorMessage && (
                <div className="error-message" style={{ display: 'block' }}>
                  {errorMessage.split('\n').map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              )}
              {successMessage && (
                <div className="success-message" style={{ display: 'block' }}>
                  {successMessage}
                </div>
              )}
              <form id="addBusForm" onSubmit={handleBusSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="busName">Bus Name *</label>
                    <input
                      type="text"
                      id="busName"
                      name="busName"
                      placeholder="e.g., Volvo AC Sleeper"
                      value={busForm.busName}
                      onChange={(e) => handleBusFormChange('busName', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="enterpriseName">Enterprise Name *</label>
                    <input
                      type="text"
                      id="enterpriseName"
                      name="enterpriseName"
                      value={enterpriseName}
                      readOnly
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="from">From (Departure City) *</label>
                    <input
                      type="text"
                      id="from"
                      name="from"
                      placeholder="e.g., Mumbai"
                      value={busForm.from}
                      onChange={(e) => handleBusFormChange('from', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="to">To (Destination City) *</label>
                    <input
                      type="text"
                      id="to"
                      name="to"
                      placeholder="e.g., Pune"
                      value={busForm.to}
                      onChange={(e) => handleBusFormChange('to', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="dateSelectionType">Schedule Date Type *</label>
                    <select
                      id="dateSelectionType"
                      name="dateSelectionType"
                      value={dateSelectionType}
                      onChange={(e) => handleDateSelectionTypeChange(e.target.value)}
                      style={{
                        padding: '10px',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                        width: '100%'
                      }}
                    >
                      <option value="single">Single Date</option>
                      <option value="weekends">Weekends (Sat & Sun)</option>
                      <option value="weekdays">Weekdays (Mon to Fri)</option>
                      <option value="full">Full (Sun to Sat)</option>
                      <option value="special">Special (Custom Selected Dates)</option>
                    </select>
                  </div>
                  {dateSelectionType === 'single' ? (
                    <div className="form-group">
                      <label htmlFor="date">Schedule Date *</label>
                      <input
                        type="date"
                        id="date"
                        name="date"
                        value={busForm.date}
                        onChange={(e) => handleBusFormChange('date', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                  ) : (
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Selected Dates ({selectedDates.length}) *</label>
                      <div style={{ 
                        border: '1px solid #ddd', 
                        borderRadius: '4px', 
                        padding: '15px',
                        backgroundColor: '#f9f9f9',
                        minHeight: '100px'
                      }}>
                        {dateSelectionType === 'special' && (
                          <div style={{ marginBottom: '15px' }}>
                            <input
                              type="date"
                              id="customDatePicker"
                              min={new Date().toISOString().split('T')[0]}
                              max={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]}
                              onChange={(e) => {
                                const date = e.target.value;
                                if (date && !selectedDates.includes(date)) {
                                  // Check if date is in current month
                                  const selectedDate = new Date(date);
                                  selectedDate.setHours(0, 0, 0, 0);
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  if (selectedDate.getMonth() === today.getMonth() && 
                                      selectedDate.getFullYear() === today.getFullYear() &&
                                      selectedDate >= today) {
                                    const newDates = [...selectedDates, date].sort();
                                    setSelectedDates(newDates);
                                    e.target.value = '';
                                  } else {
                                    alert('Please select a date from the current month starting from today.');
                                    e.target.value = '';
                                  }
                                }
                              }}
                              style={{ 
                                padding: '8px', 
                                borderRadius: '4px', 
                                border: '1px solid #ccc',
                                marginRight: '10px'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const dateInput = document.getElementById('customDatePicker');
                                if (dateInput && dateInput.value) {
                                  const date = dateInput.value;
                                  const selectedDate = new Date(date);
                                  selectedDate.setHours(0, 0, 0, 0);
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  if (selectedDate.getMonth() === today.getMonth() && 
                                      selectedDate.getFullYear() === today.getFullYear() &&
                                      selectedDate >= today) {
                                    if (!selectedDates.includes(date)) {
                                      const newDates = [...selectedDates, date].sort();
                                      setSelectedDates(newDates);
                                      dateInput.value = '';
                                    }
                                  } else {
                                    alert('Please select a date from the current month starting from today.');
                                    dateInput.value = '';
                                  }
                                }
                              }}
                              style={{
                                padding: '8px 15px',
                                backgroundColor: '#97d700',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                marginRight: '10px'
                              }}
                            >
                              Add Date
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedDates([])}
                              style={{
                                padding: '8px 15px',
                                backgroundColor: '#ff6b6b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Clear All
                            </button>
                          </div>
                        )}
                        {selectedDates.length > 0 ? (
                          <div>
                            <div style={{ 
                              marginBottom: '8px', 
                              fontSize: '14px', 
                              fontWeight: 'bold',
                              color: '#666'
                            }}>
                              {dateSelectionType === 'special' ? 'Selected Dates:' : 'Dates for Current Month:'}
                            </div>
                            <div style={{ 
                              display: 'flex', 
                              flexWrap: 'wrap', 
                              gap: '8px'
                            }}>
                              {selectedDates.map((date, index) => (
                                <span
                                  key={index}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '6px 12px',
                                    backgroundColor: '#97d700',
                                    color: 'white',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    gap: '8px'
                                  }}
                                >
                                  {new Date(date).toLocaleDateString('en-US', { 
                                    weekday: 'short',
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                  {dateSelectionType === 'special' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedDates(selectedDates.filter((d, i) => i !== index));
                                      }}
                                      style={{
                                        background: 'rgba(255,255,255,0.3)',
                                        border: 'none',
                                        color: 'white',
                                        borderRadius: '50%',
                                        width: '20px',
                                        height: '20px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0
                                      }}
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ 
                            color: '#999', 
                            fontSize: '14px', 
                            fontStyle: 'italic' 
                          }}>
                            {dateSelectionType === 'special' 
                              ? 'No dates selected. Use the date picker above to add dates from the current month.'
                              : 'No dates available for the current month.'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label htmlFor="departureTime">Departure Time *</label>
                    <input
                      type="time"
                      id="departureTime"
                      name="departureTime"
                      value={busForm.departureTime}
                      onChange={(e) => handleBusFormChange('departureTime', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="arrivalTime">Arrival Time *</label>
                    <input
                      type="time"
                      id="arrivalTime"
                      name="arrivalTime"
                      value={busForm.arrivalTime}
                      onChange={(e) => handleBusFormChange('arrivalTime', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="duration">Duration (Auto-calculated) *</label>
                    <input
                      type="text"
                      id="duration"
                      name="duration"
                      placeholder="e.g., 4h 0m"
                      value={busForm.duration}
                      readOnly
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="seaterPrice">Seater Price (₹) *</label>
                    <input
                      type="number"
                      id="seaterPrice"
                      name="seaterPrice"
                      min="0"
                      step="0.01"
                      placeholder="500"
                      value={busForm.seaterPrice}
                      onChange={(e) => handleBusFormChange('seaterPrice', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sleeperPrice">Sleeper Price (₹) *</label>
                    <input
                      type="number"
                      id="sleeperPrice"
                      name="sleeperPrice"
                      min="0"
                      step="0.01"
                      placeholder="1100"
                      value={busForm.sleeperPrice}
                      onChange={(e) => handleBusFormChange('sleeperPrice', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="busType">Bus Type *</label>
                    <select
                      id="busType"
                      name="busType"
                      value={busForm.busType}
                      onChange={(e) => handleBusFormChange('busType', e.target.value)}
                      required
                    >
                      <option value="">Select Bus Type</option>
                      <option value="AC Seater/Sleeper">AC Seater/Sleeper</option>
                      <option value="Non-AC Seater/Sleeper">Non-AC Seater/Sleeper</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="totalSeats">Total Seats *</label>
                    <input
                      type="number"
                      id="totalSeats"
                      name="totalSeats"
                      min="1"
                      max="50"
                      value={busForm.totalSeats}
                      onChange={(e) => handleBusFormChange('totalSeats', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn-add-bus" style={{
                  background: '#97d700',
                  color: 'white',
                  padding: '14px 35px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 8px rgba(201, 169, 97, 0.3)'
                }}>
                  {editingBusId ? 'Update Bus' : 'Schedule Bus'}
                </button>
                {editingBusId && (
                  <button
                    type="button"
                    onClick={() => {
                      dispatch(setEditingBusId(null));
                      dispatch(resetBusForm());
                      setDateSelectionType('single');
                      setSelectedDates([]);
                      dispatch(setErrorMessage(''));
                      dispatch(setSuccessMessage(''));
                    }}
                    style={{
                      background: '#666',
                      color: 'white',
                      padding: '14px 35px',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      marginLeft: '10px',
                      transition: 'all 0.3s'
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="tab-content active">
            <div className="section-title">All Bookings</div>
            
            {/* Filter Section */}
            <div className="filter-section">
              <div className="filter-row">
                <div className="filter-group">
                  <label htmlFor="filterBus">Filter by Bus</label>
                  <select
                    id="filterBus"
                    value={bookingFilters.bus}
                    onChange={(e) => handleBookingFilterChange('bus', e.target.value)}
                  >
                    <option value="">All Buses</option>
                    {buses.map(bus => (
                      <option key={bus.busId || bus.id} value={bus.busId || bus.id}>
                        {bus.busName} - {bus.from} → {bus.to}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="filterDate">Filter by Travel Date</label>
                  <input
                    type="date"
                    id="filterDate"
                    value={bookingFilters.date}
                    onChange={(e) => handleBookingFilterChange('date', e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="filterStatus">Filter by Status</label>
                  <select
                    id="filterStatus"
                    value={bookingFilters.status}
                    onChange={(e) => handleBookingFilterChange('status', e.target.value)}
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
                    onClick={() => dispatch(setBookingSortOrder(bookingSortOrder === 'latest' ? 'older' : 'latest'))}
                    style={{ width: '100%', padding: '8px' }}
                  >
                    {bookingSortOrder === 'latest' ? '📅 Latest First' : '📅 Older First'}
                  </button>
                </div>
                <div className="filter-group">
                  <label>&nbsp;</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="btn-clear" onClick={clearBookingFilters}>
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bookings-list">
              {filteredBookings.length === 0 ? (
                <div className="no-data">
                  <div className="no-data-icon">🎫</div>
                  <p>No bookings found. {bookings.length === 0 ? 'No bookings yet.' : 'Try adjusting your filters.'}</p>
                </div>
              ) : (
                <>
                  {currentBookings.map(booking => {
                  const bus = buses.find(b => (b.busId || b.id) === booking.busId);
                  return (
                    <div key={booking.bookingId} className="booking-card">
                      <div className="booking-header">
                        <div>
                          <div className="booking-id">{booking.bookingId}</div>
                          {booking.createdAt && (
                            <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                              Created: {new Date(booking.createdAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className={`booking-status status-${booking.status}`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </div>
                      </div>
                      <div className="booking-info-grid">
                        {bus && (
                          <>
                            <div className="info-item">
                              <div className="info-label">Bus</div>
                              <div className="info-value">{bus.busName}</div>
                            </div>
                            <div className="info-item">
                              <div className="info-label">Route</div>
                              <div className="info-value">{bus.from} → {bus.to}</div>
                            </div>
                          </>
                        )}
                        <div className="info-item">
                          <div className="info-label">Travel Date</div>
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
                        {booking.passengers && (
                          <div className="info-item">
                            <div className="info-label">Passengers</div>
                            <div className="info-value">{booking.passengers.length}</div>
                          </div>
                        )}
                      </div>
                      {booking.passengers && booking.passengers.length > 0 && (
                        <div className="passengers-section">
                          <div className="passengers-title">Passenger Details</div>
                          <div className="passengers-list">
                            {booking.passengers.map((passenger, idx) => (
                              <div key={idx} className="passenger-item">
                                <div className="passenger-detail">
                                  <strong>Name:</strong>
                                  <span>{passenger.name}</span>
                                </div>
                                <div className="passenger-detail">
                                  <strong>Age:</strong>
                                  <span>{passenger.age} years</span>
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
                    </div>
                  );
                  })}
                  
                  {/* Pagination Controls */}
                  {totalBookingPages > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '10px',
                      marginTop: '30px',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={() => handleBookingPageChange(currentBookingPage - 1)}
                        disabled={currentBookingPage === 1}
                        style={{
                          padding: '8px 16px',
                          background: currentBookingPage === 1 ? '#ccc' : '#97d700',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: currentBookingPage === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        Previous
                      </button>
                      
                      {getBookingPageNumbers(currentBookingPage, totalBookingPages).map((page, index) => {
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
                            onClick={() => handleBookingPageChange(page)}
                            style={{
                              padding: '8px 16px',
                              background: currentBookingPage === page ? '#97d700' : '#f0f0f0',
                              color: currentBookingPage === page ? 'white' : '#333',
                              border: '1px solid #ddd',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: currentBookingPage === page ? 'bold' : 'normal',
                              minWidth: '40px'
                            }}
                          >
                            {page}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => handleBookingPageChange(currentBookingPage + 1)}
                        disabled={currentBookingPage === totalBookingPages}
                        style={{
                          padding: '8px 16px',
                          background: currentBookingPage === totalBookingPages ? '#ccc' : '#97d700',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: currentBookingPage === totalBookingPages ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                  
                  {totalBookingPages > 1 && (
                    <div style={{
                      textAlign: 'center',
                      marginTop: '10px',
                      color: '#666',
                      fontSize: '14px'
                    }}>
                      Showing {startBookingIndex + 1} - {Math.min(endBookingIndex, filteredBookings.length)} of {filteredBookings.length} bookings
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default AdminDashboard;

