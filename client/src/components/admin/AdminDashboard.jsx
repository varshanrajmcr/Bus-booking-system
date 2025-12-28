import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setUser, setUserName, setEnterpriseName } from '../../store/slices/authSlice';
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
  setEventSource,
  updateBus,
  removeBus
} from '../../store/slices/adminSlice';
import { setErrorMessage, setSuccessMessage, clearMessages } from '../../store/slices/uiSlice';
import api from '../../services/api';
import { formatPrice, formatTime } from '../../utils/formatting';
import { validateBusName, validateLocation, validateTime, validateDuration, validatePrice, validateBusType, validateTotalSeats } from '../../utils/validation';
import '../../styles/dashboard.css';
import './AdminDashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend);

function AdminDashboard() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  // Redux state
  const { userName, enterpriseName } = useAppSelector((state) => state.auth);
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
    eventSource
  } = useAppSelector((state) => state.admin);
  const { errorMessage, successMessage } = useAppSelector((state) => state.ui);

  useEffect(() => {
    // Add dashboard-page class to body
    const body = document.body;
    body.classList.add('dashboard-page');
    
    const checkSession = async () => {
      try {
        const response = await api.get('/session?type=admin');
        if (response.data.authenticated && response.data.user.userType === 'admin') {
          dispatch(setUser(response.data.user));
          dispatch(setUserName(`Welcome, ${response.data.user.fullName || 'Admin'}`));
          dispatch(setEnterpriseName(response.data.user.enterpriseName || 'Enterprise Name'));
          await loadData();
          // Connect to SSE for real-time updates
          connectSSE();
        } else {
          alert('Please login to continue');
          navigate('/admin/login');
        }
      } catch (error) {
        console.error('Error checking session:', error);
        navigate('/admin/login');
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
  }, [navigate]);

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
    
    const journeyDate = new Date(bus.date + 'T' + bus.arrivalTime);
    const now = new Date();
    
    // If journey is complete (arrival time has passed), mark as inactive
    if (journeyDate < now && bus.status !== 'cancelled') {
      return { ...bus, status: 'inactive' };
    }
    
    return bus;
  };

  const loadData = async () => {
    try {
      const [busesResponse, bookingsResponse] = await Promise.all([
        api.get('/buses/admin'),
        api.get('/bookings/admin')
      ]);

      if (busesResponse.status === 200) {
        let busesList = busesResponse.data.buses || [];
        
        // Check and update status for completed journeys
        busesList = busesList.map(bus => checkAndUpdateBusStatus(bus));
        
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
          handleSSEMessage('initial', data);
        } catch (error) {
          console.error('Error parsing SSE initial message:', error);
        }
      });

      sse.addEventListener('booking_created', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage('booking_created', data);
        } catch (error) {
          console.error('Error parsing SSE booking_created message:', error);
        }
      });

      sse.addEventListener('bus_created', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage('bus_created', data);
        } catch (error) {
          console.error('Error parsing SSE bus_created message:', error);
        }
      });

      sse.addEventListener('bus_updated', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage('bus_updated', data);
        } catch (error) {
          console.error('Error parsing SSE bus_updated message:', error);
        }
      });

      sse.addEventListener('bus_cancelled', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage('bus_cancelled', data);
        } catch (error) {
          console.error('Error parsing SSE bus_cancelled message:', error);
        }
      });

      sse.addEventListener('booking_cancelled', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage('booking_cancelled', data);
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
  const handleSSEMessage = (eventType, data) => {
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

  // Apply bus filters
  const applyBusFilters = (busesList = buses) => {
    let filtered = [...busesList];
    
    if (busFilters.date) {
      filtered = filtered.filter(bus => bus.date === busFilters.date);
    }
    
    dispatch(setFilteredBuses(filtered));
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
    
    dispatch(setFilteredBookings(filtered));
  };

  useEffect(() => {
    applyBusFilters();
  }, [busFilters, buses]);

  useEffect(() => {
    applyBookingFilters();
  }, [bookingFilters, bookings]);

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
        // Recalculate stats
        const currentBookings = bookings.filter(b => (b.busId || b.id) !== busId);
        const totalRevenue = currentBookings
          .filter(b => b.status === 'confirmed')
          .reduce((sum, b) => sum + (parseFloat(b.totalAmount) || 0), 0);
        const totalPassengers = currentBookings
          .filter(b => b.status === 'confirmed')
          .reduce((sum, b) => sum + (b.passengers?.length || 0), 0);
        dispatch(setStats({
          totalBuses: currentBuses.length,
          totalBookings: currentBookings.length,
          totalRevenue: totalRevenue,
          totalPassengers: totalPassengers
        }));
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
      seaterPrice: parseFloat(busForm.seaterPrice),
      sleeperPrice: parseFloat(busForm.sleeperPrice),
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

    if (allErrors.length > 0) {
      dispatch(setErrorMessage('Validation errors:\n' + allErrors.join('\n')));
      return;
    }

    try {
      let response;
      if (editingBusId) {
        // Update existing bus
        response = await api.put(`/buses/${editingBusId}`, formData);
      } else {
        // Create new bus
        response = await api.post('/buses', formData);
      }
      
      if (response.status === 200 || response.status === 201) {
        dispatch(setSuccessMessage(editingBusId ? 'Bus updated successfully!' : 'Bus scheduled successfully!'));
        // Reset form
        dispatch(resetBusForm());
        
        if (editingBusId) {
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
        } else {
          // For new bus, reload all data to get complete bus object with ID
          await loadData();
        }
        
        // Switch to buses tab after 1 second
        setTimeout(() => {
          dispatch(setActiveTab('buses'));
        }, 1000);
      }
    } catch (error) {
      dispatch(setErrorMessage(error.response?.data?.error || (editingBusId ? 'Failed to update bus. Please try again.' : 'Failed to schedule bus. Please try again.')));
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/admin/login');
    }
  };

  const chartData = buses.length > 0 ? {
    labels: buses.map(bus => bus.busName),
    datasets: [{
      data: buses.map(bus => {
        return bookings.filter(b => b.busId === (bus.busId || bus.id)).length;
      }),
      backgroundColor: [
        '#C9A961',
        '#B8860B',
        '#D4AF37',
        '#F4D03F',
        '#F7DC6F',
        '#FFD700',
        '#FFA500'
      ]
    }]
  } : {
    labels: ['No Data'],
    datasets: [{
      data: [1],
      backgroundColor: ['#e0e0e0']
    }]
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
            <div className="stats-cards">
              <div className="stat-card">
                <div className="stat-value">{stats.totalBuses}</div>
                <div className="stat-label">Total Buses</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalBookings}</div>
                <div className="stat-label">Total Bookings</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">₹{formatPrice(stats.totalRevenue)}</div>
                <div className="stat-label">Total Revenue</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalPassengers}</div>
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
          </div>
        )}

        {activeTab === 'buses' && (
          <div className="tab-content active">
            <div className="section-title">My Scheduled Buses</div>
            
            {/* Filter Section for Buses */}
            <div className="filter-section">
              <div className="filter-row">
                <div className="filter-group">
                  <label htmlFor="filterBusDate">Filter by Date</label>
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
                    <button type="button" className="btn-filter" onClick={() => applyBusFilters()}>
                      Apply Filter
                    </button>
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
                filteredBuses.map(bus => {
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
                })
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
                  <div className="form-group">
                    <label htmlFor="date">Schedule Date *</label>
                    <input
                      type="date"
                      id="date"
                      name="date"
                      value={busForm.date}
                      onChange={(e) => handleBusFormChange('date', e.target.value)}
                      required
                    />
                  </div>
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
                      setBusForm({
                        busName: '',
                        from: '',
                        to: '',
                        date: '',
                        departureTime: '',
                        arrivalTime: '',
                        duration: '',
                        seaterPrice: '',
                        sleeperPrice: '',
                        busType: '',
                        totalSeats: '32'
                      });
                      setErrorMessage('');
                      setSuccessMessage('');
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
                  <label htmlFor="filterDate">Filter by Date</label>
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
                  <label>&nbsp;</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="btn-filter" onClick={() => applyBookingFilters()}>
                      Apply Filters
                    </button>
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
                filteredBookings.map(booking => {
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
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default AdminDashboard;

