let adminData = null;
let buses = [];
let filteredBuses = []; // Filtered buses for display
let allBookings = [];
let filteredBookings = [];
let allBuses = []; // Store all buses for filter dropdown
let bookingsChart = null; // Chart.js instance
let eventSource = null; // SSE connection for real-time updates

// Format price to remove .00 for whole numbers
function formatPrice(price) {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return price;
    // If it's a whole number, return without decimals, otherwise return with 2 decimals
    if (numPrice % 1 === 0) {
        return numPrice.toString();
    }
    return numPrice.toFixed(2);
}

// Format time to HH:MM format
function formatTime(time) {
    if (!time) return time;
    const timeStr = String(time).trim();
    // If already in HH:MM format, return as is
    if (/^\d{2}:\d{2}$/.test(timeStr)) {
        return timeStr;
    }
    // If in HH:MM:SS format, extract HH:MM
    if (/^\d{2}:\d{2}:\d{2}/.test(timeStr)) {
        return timeStr.substring(0, 5);
    }
    // Try to parse and format
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        const hours = parts[0].padStart(2, '0');
        const minutes = parts[1].padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    return timeStr;
}

// Calculate duration from departure and arrival times
function calculateDuration() {
    const departureTime = document.getElementById('departureTime').value;
    const arrivalTime = document.getElementById('arrivalTime').value;
    const durationInput = document.getElementById('duration');
    
    if (!departureTime || !arrivalTime) {
        return;
    }
    
    // Parse times (HH:MM format)
    const [depHours, depMinutes] = departureTime.split(':').map(Number);
    const [arrHours, arrMinutes] = arrivalTime.split(':').map(Number);
    
    // Convert to minutes for easier calculation
    let depTotalMinutes = depHours * 60 + depMinutes;
    let arrTotalMinutes = arrHours * 60 + arrMinutes;
    
    // Handle next day arrival (if arrival time is earlier than departure, assume next day)
    if (arrTotalMinutes < depTotalMinutes) {
        arrTotalMinutes += 24 * 60; // Add 24 hours
    }
    
    // Calculate difference in minutes
    const diffMinutes = arrTotalMinutes - depTotalMinutes;
    
    // Convert to hours and minutes
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    // Format as "Xh Ym"
    durationInput.value = `${hours}h ${minutes}m`;
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Check session and load admin data
    try {
        const sessionResponse = await fetch('/api/session', {
            credentials: 'include'
        });
        const sessionData = await sessionResponse.json();
        
        // Check if session was terminated
        if (sessionData.sessionTerminated || (sessionData.error === 'Session terminated')) {
            alert(sessionData.message || 'Session terminated. Please login again.');
            window.location.href = '/admin/login.html';
            return;
        }
        
        if (sessionData.authenticated && sessionData.user.userType === 'admin') {
            adminData = sessionData.user;
            document.getElementById('userName').textContent = `Welcome, ${adminData.fullName || 'Admin'}`;
            document.getElementById('adminName').textContent = adminData.fullName || 'Admin';
            
            // Set enterprise name
            if (adminData.enterpriseName) {
                document.getElementById('enterpriseNameDisplay').textContent = adminData.enterpriseName;
                document.getElementById('enterpriseName').value = adminData.enterpriseName;
            }
            
            // Set minimum date to today
            const dateInput = document.getElementById('date');
            if (dateInput) {
                const today = new Date().toISOString().split('T')[0];
                dateInput.setAttribute('min', today);
            }
            
            // Add event listeners for auto-calculating duration
            const departureTimeInput = document.getElementById('departureTime');
            const arrivalTimeInput = document.getElementById('arrivalTime');
            
            if (departureTimeInput && arrivalTimeInput) {
                departureTimeInput.addEventListener('change', calculateDuration);
                departureTimeInput.addEventListener('input', calculateDuration);
                arrivalTimeInput.addEventListener('change', calculateDuration);
                arrivalTimeInput.addEventListener('input', calculateDuration);
            }
            
            // Load buses (this now also populates allBuses and filter)
            await loadBuses();
            
            // Load bookings after buses are loaded
            await loadBookings();
            
            // Update overview stats
            updateOverviewStats();
            
            // Establish SSE connection for real-time updates
            connectSSE();
        } else {
            alert('Please login as admin to continue');
            window.location.href = '/admin/login.html';
        }
    } catch (error) {
        console.error('Error checking session:', error);
        window.location.href = '/admin/login.html';
    }
});

// Note: Manual refresh functionality removed - SSE handles real-time updates automatically

// Connect to Server-Sent Events for real-time updates
function connectSSE() {
    // Close existing connection if any
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    try {
        eventSource = new EventSource('/api/admin/stream', {
            withCredentials: true
        });
        
        eventSource.onopen = () => {
            console.log('SSE connection established');
        };
        
        // Handle all event types
        eventSource.addEventListener('initial', (event) => {
            try {
                const data = JSON.parse(event.data);
                handleSSEMessage('initial', data);
            } catch (error) {
                console.error('Error parsing SSE initial message:', error);
            }
        });
        
        eventSource.addEventListener('booking_created', (event) => {
            try {
                const data = JSON.parse(event.data);
                handleSSEMessage('booking_created', data);
            } catch (error) {
                console.error('Error parsing SSE booking_created message:', error);
            }
        });
        
        eventSource.addEventListener('bus_created', (event) => {
            try {
                const data = JSON.parse(event.data);
                handleSSEMessage('bus_created', data);
            } catch (error) {
                console.error('Error parsing SSE bus_created message:', error);
            }
        });
        
        eventSource.addEventListener('bus_updated', (event) => {
            try {
                const data = JSON.parse(event.data);
                handleSSEMessage('bus_updated', data);
            } catch (error) {
                console.error('Error parsing SSE bus_updated message:', error);
            }
        });
        
        eventSource.addEventListener('bus_cancelled', (event) => {
            try {
                const data = JSON.parse(event.data);
                handleSSEMessage('bus_cancelled', data);
            } catch (error) {
                console.error('Error parsing SSE bus_cancelled message:', error);
            }
        });
        
        eventSource.addEventListener('booking_cancelled', (event) => {
            try {
                const data = JSON.parse(event.data);
                handleSSEMessage('booking_cancelled', data);
            } catch (error) {
                console.error('Error parsing SSE booking_cancelled message:', error);
            }
        });
        
        eventSource.addEventListener('error', (event) => {
            try {
                const data = JSON.parse(event.data);
                handleSSEMessage('error', data);
            } catch (error) {
                console.error('Error parsing SSE error message:', error);
            }
        });
        
        eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                if (eventSource && eventSource.readyState === EventSource.CLOSED) {
                    console.log('Attempting to reconnect SSE...');
                    connectSSE();
                }
            }, 3000);
        };
    } catch (error) {
        console.error('Error establishing SSE connection:', error);
    }
}

// Handle SSE messages and update UI
function handleSSEMessage(eventType, data) {
    console.log('Received SSE message:', eventType, data);
    
    if (eventType === 'initial' || eventType === 'booking_created' || 
        eventType === 'bus_created' || eventType === 'bus_updated' || 
        eventType === 'bus_cancelled' || eventType === 'booking_cancelled') {
        
        // Update data arrays
        if (data.buses) {
            const fetchedBuses = data.buses || [];
            buses = fetchedBuses;
            allBuses = fetchedBuses;
            
            // Sort buses by date
            buses.sort((a, b) => {
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                return dateA - dateB;
            });
            
            filteredBuses = [...buses];
            populateBusFilter();
            displayBuses();
        }
        
        if (data.bookings) {
            allBookings = Array.isArray(data.bookings) ? [...data.bookings] : [];
            
            // Reapply filters if active
            const filterBus = document.getElementById('filterBus')?.value || '';
            const filterDate = document.getElementById('filterDate')?.value || '';
            const filterStatus = document.getElementById('filterStatus')?.value || '';
            const hasActiveFilters = filterBus || filterDate || filterStatus;
            
            if (hasActiveFilters) {
                filteredBookings = allBookings.filter(booking => {
                    if (filterBus && (booking.busId !== parseInt(filterBus))) return false;
                    if (filterDate && booking.date?.trim() !== filterDate) return false;
                    if (filterStatus && booking.status !== filterStatus) return false;
                    return true;
                });
            } else {
                filteredBookings = [...allBookings];
            }
            
            displayBookings();
            displayBuses(); // Update bus cards with new booking counts
            updateOverviewStats();
        }
        
        // Show notification for real-time updates (except initial load)
        if (eventType !== 'initial') {
            // Special handling for booking cancellation - show popup notification
            if (eventType === 'booking_cancelled' && data.cancelledBy === 'customer') {
                showBookingCancellationNotification(data);
            } else {
                showSuccess(`Real-time update: ${eventType.replace('_', ' ')}`);
            }
        }
    } else if (eventType === 'error') {
        console.error('SSE error:', data);
        showError(data.message || 'Error receiving real-time update');
    }
}

// Note: Manual refresh is no longer needed as SSE provides real-time updates automatically

// Load all buses for filter dropdown (now just populates filter from already-loaded data)
async function loadAllBusesForFilter() {
    // No longer needs to make API call - data is already loaded by loadBuses()
    // Just populate the filter if buses are already loaded
    if (allBuses.length > 0) {
        populateBusFilter();
    }
}

// Populate bus filter dropdown
function populateBusFilter() {
    const filterBus = document.getElementById('filterBus');
    filterBus.innerHTML = '<option value="">All Buses</option>';
    
    allBuses.forEach(bus => {
        const option = document.createElement('option');
        option.value = bus.busId || bus.id;
        option.textContent = `${bus.busName} (${bus.from} → ${bus.to})`;
        filterBus.appendChild(option);
    });
}

// Load buses for this admin (with retry logic)
async function loadBuses(retryCount = 0) {
    const maxRetries = 2;
    const retryDelay = 500; // 500ms delay between retries
    
    try {
        // Add timestamp to prevent caching
        const timestamp = Date.now();
        const response = await fetch(`/api/buses/admin?_=${timestamp}`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        const data = await response.json();
        
        if (response.ok) {
            const fetchedBuses = data.buses || [];
            
            // Store in both variables (same data, different uses)
            buses = fetchedBuses;
            allBuses = fetchedBuses;
            
            // Sort buses by date (ascending - earliest first)
            buses.sort((a, b) => {
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                return dateA - dateB;
            });
            
            // Initialize filtered buses with all buses
            filteredBuses = [...buses];
            
            // Populate filter dropdown
            populateBusFilter();
            
            // Display buses
            displayBuses();
        } else {
            // If it's an auth error and we haven't retried yet, refresh session and retry
            if ((response.status === 401 || response.status === 403) && retryCount < maxRetries) {
                console.log(`Auth error detected. Refreshing session and retrying loadBuses (attempt ${retryCount + 1}/${maxRetries})...`);
                
                // Refresh session first to ensure it's valid
                try {
                    const sessionResponse = await fetch('/api/session', {
                        credentials: 'include',
                        cache: 'no-cache'
                    });
                    const sessionData = await sessionResponse.json();
                    
                    if (sessionData.authenticated && sessionData.user.userType === 'admin') {
                        // Session is valid, wait a bit longer for session to propagate
                        await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1) + 300));
                        return loadBuses(retryCount + 1);
                    } else {
                        // Session is invalid, redirect to login
                        console.error('Session invalid, redirecting to login');
                        window.location.href = '/admin/login.html';
                        return;
                    }
                } catch (sessionError) {
                    console.error('Error refreshing session:', sessionError);
                    // Still retry the original request
                    await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1) + 300));
                    return loadBuses(retryCount + 1);
                }
            }
            
            showError(data.error || 'Failed to load buses');
        }
    } catch (error) {
        // If it's a network error and we haven't retried yet, wait and retry
        if (retryCount < maxRetries) {
            console.log(`Retrying loadBuses due to error (attempt ${retryCount + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
            return loadBuses(retryCount + 1);
        }
        
        console.error('Error loading buses:', error);
        showError('Error loading buses. Please try again.');
    }
}

// Load bookings for this admin (with retry logic)
async function loadBookings(retryCount = 0) {
    const maxRetries = 2;
    const retryDelay = 500; // 500ms delay between retries
    
    try {
        // Add timestamp to prevent caching
        const timestamp = Date.now();
        const response = await fetch(`/api/bookings/admin?_=${timestamp}`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        const data = await response.json();
        
        console.log('Bookings API response:', { 
            status: response.status, 
            statusText: response.statusText,
            bookingsCount: data.bookings?.length || 0,
            data 
        });
        
        if (response.ok) {
            // Force update of bookings array (create new array reference)
            allBookings = Array.isArray(data.bookings) ? [...data.bookings] : [];
            
            // Check if filters are currently applied
            const filterBus = document.getElementById('filterBus')?.value || '';
            const filterDate = document.getElementById('filterDate')?.value || '';
            const filterStatus = document.getElementById('filterStatus')?.value || '';
            const hasActiveFilters = filterBus || filterDate || filterStatus;
            
            if (hasActiveFilters) {
                // Reapply filters with new data
                filteredBookings = allBookings.filter(booking => {
                    // Filter by bus
                    if (filterBus && (booking.busId !== parseInt(filterBus))) {
                        return false;
                    }
                    
                    // Filter by date
                    if (filterDate) {
                        const bookingDate = booking.date ? booking.date.trim() : '';
                        if (bookingDate !== filterDate) {
                            return false;
                        }
                    }
                    
                    // Filter by status
                    if (filterStatus && booking.status !== filterStatus) {
                        return false;
                    }
                    
                    return true;
                });
            } else {
                // No filters, show all bookings
                filteredBookings = [...allBookings];
            }
            
            console.log('Loaded bookings:', allBookings.length);
            console.log('Filtered bookings:', filteredBookings.length);
            console.log('Sample booking:', allBookings[0]);
            
            // Always update displays, regardless of which tab is active
            displayBookings();
            // Refresh bus display to show updated booking counts
            displayBuses();
            
            // Update overview stats to reflect new bookings
            updateOverviewStats();
        } else {
            // Check if session was terminated
            if (data.sessionTerminated || (data.error === 'Session terminated')) {
                alert(data.message || 'Session terminated. Please login again.');
                window.location.href = '/admin/login.html';
                return;
            }
            
            // If it's an auth error and we haven't retried yet, refresh session and retry
            if ((response.status === 401 || response.status === 403) && retryCount < maxRetries) {
                console.log(`Auth error detected. Refreshing session and retrying loadBookings (attempt ${retryCount + 1}/${maxRetries})...`);
                
                // Refresh session first to ensure it's valid
                try {
                    const sessionResponse = await fetch('/api/session', {
                        credentials: 'include',
                        cache: 'no-cache'
                    });
                    const sessionData = await sessionResponse.json();
                    
                    // Check if session was terminated
                    if (sessionData.sessionTerminated || (sessionData.error === 'Session terminated')) {
                        alert(sessionData.message || 'Session terminated. Please login again.');
                        window.location.href = '/admin/login.html';
                        return;
                    }
                    
                    if (sessionData.authenticated && sessionData.user.userType === 'admin') {
                        // Session is valid, wait a bit longer for session to propagate
                        await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1) + 300));
                        return loadBookings(retryCount + 1);
                    } else {
                        // Session is invalid, redirect to login
                        console.error('Session invalid, redirecting to login');
                        window.location.href = '/admin/login.html';
                        return;
                    }
                } catch (sessionError) {
                    console.error('Error refreshing session:', sessionError);
                    // Still retry the original request
                    await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1) + 300));
                    return loadBookings(retryCount + 1);
                }
            }
            
            console.error('Failed to load bookings:', data.error);
            const bookingsListDiv = document.getElementById('bookingsList');
            if (bookingsListDiv) {
                bookingsListDiv.innerHTML = `
                    <div class="no-data">
                        <div class="no-data-icon">⚠️</div>
                        <p>Error loading bookings: ${data.error || 'Unknown error'}</p>
                    </div>
                `;
            }
            showError(data.error || 'Failed to load bookings');
        }
    } catch (error) {
        // If it's a network error and we haven't retried yet, wait and retry
        if (retryCount < maxRetries) {
            console.log(`Retrying loadBookings due to error (attempt ${retryCount + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
            return loadBookings(retryCount + 1);
        }
        
        console.error('Error loading bookings:', error);
        const bookingsListDiv = document.getElementById('bookingsList');
        if (bookingsListDiv) {
            bookingsListDiv.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">⚠️</div>
                    <p>Error loading bookings. Please refresh the page.</p>
                </div>
            `;
        }
        showError('Error loading bookings. Please try again.');
    }
}

// Update overview statistics
function updateOverviewStats() {
    // Filter out cancelled buses (only count active buses)
    const activeBuses = buses.filter(bus => bus.status !== 'cancelled');
    document.getElementById('totalBuses').textContent = activeBuses.length;
    
    // Filter out cancelled bookings and bookings from cancelled buses
    // Create a map of cancelled bus IDs for quick lookup
    const cancelledBusIds = new Set();
    allBuses.forEach(bus => {
        if (bus.status === 'cancelled') {
            cancelledBusIds.add(parseInt(bus.busId || bus.id));
        }
    });
    buses.forEach(bus => {
        if (bus.status === 'cancelled') {
            cancelledBusIds.add(parseInt(bus.busId || bus.id));
        }
    });
    
    // Filter bookings: exclude cancelled bookings and bookings from cancelled buses
    const activeBookings = allBookings.filter(booking => {
        const bookingStatus = booking.status?.toLowerCase();
        const busId = parseInt(booking.busId);
        // Exclude if booking is cancelled or bus is cancelled
        return bookingStatus !== 'cancelled' && !cancelledBusIds.has(busId);
    });
    
    document.getElementById('totalBookings').textContent = activeBookings.length;
    
    // Calculate total revenue (only from active bookings)
    const totalRevenue = activeBookings.reduce((sum, booking) => {
        return sum + (parseFloat(booking.totalAmount) || 0);
    }, 0);
    document.getElementById('totalRevenue').textContent = `₹${formatPrice(totalRevenue)}`;
    
    // Calculate total passengers (only from active bookings)
    const totalPassengers = activeBookings.reduce((sum, booking) => {
        return sum + (booking.passengers ? booking.passengers.length : 0);
    }, 0);
    document.getElementById('totalPassengers').textContent = totalPassengers;
    
    // Update pie chart (will use activeBookings)
    updateBookingsChart(activeBookings);
}

// Update pie chart showing bookings by bus
function updateBookingsChart(bookingsToUse = null) {
    // Use provided bookings or default to allBookings
    const bookings = bookingsToUse !== null ? bookingsToUse : allBookings;
    
    // Create bus map for quick lookup (only active buses)
    const busMap = {};
    allBuses.forEach(bus => {
        const busId = parseInt(bus.busId || bus.id);
        // Only include active buses in the map
        if (bus.status !== 'cancelled') {
            busMap[busId] = bus;
        }
    });
    buses.forEach(bus => {
        const busId = parseInt(bus.busId || bus.id);
        // Only include active buses in the map
        if (bus.status !== 'cancelled' && !busMap[busId]) {
            busMap[busId] = bus;
        }
    });
    
    // Count bookings per bus (only for active buses)
    const bookingsByBus = {};
    bookings.forEach(booking => {
        const busId = parseInt(booking.busId);
        // Only count if bus is active
        if (busMap[busId]) {
            if (!bookingsByBus[busId]) {
                bookingsByBus[busId] = {
                    busId: busId,
                    count: 0,
                    busName: busMap[busId].busName || `Bus ${busId}`
                };
            }
            bookingsByBus[busId].count++;
        }
    });
    
    // Convert to arrays for chart
    const busNames = [];
    const bookingCounts = [];
    const colors = [];
    
    // Sort by booking count (descending) for better visualization
    const sortedBuses = Object.values(bookingsByBus).sort((a, b) => b.count - a.count);
    
    // Generate colors - use a color palette
    const colorPalette = [
        '#C9A961', '#B8860B', '#DAA520', '#F4A460', '#CD853F',
        '#DEB887', '#D2B48C', '#BC9A6A', '#A0826D', '#8B7355',
        '#6B5B4F', '#5C4A3A', '#4A3A2A', '#3A2A1A', '#2A1A0A'
    ];
    
    sortedBuses.forEach((bus, index) => {
        busNames.push(`${bus.busName} (${bus.count})`);
        bookingCounts.push(bus.count);
        colors.push(colorPalette[index % colorPalette.length]);
    });
    
    // Get chart container
    const chartContainer = document.querySelector('.chart-wrapper');
    if (!chartContainer) return;
    
    // If no bookings, show a message
    if (sortedBuses.length === 0) {
        if (bookingsChart) {
            bookingsChart.destroy();
            bookingsChart = null;
        }
        chartContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No bookings data available yet.</p>';
        return;
    }
    
    // Restore canvas if it was replaced with message
    if (!document.getElementById('bookingsPieChart')) {
        chartContainer.innerHTML = '<canvas id="bookingsPieChart"></canvas>';
    }
    
    // Get canvas
    const ctx = document.getElementById('bookingsPieChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (bookingsChart) {
        bookingsChart.destroy();
    }
    
    // Create new chart
    bookingsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: busNames,
            datasets: [{
                label: 'Bookings',
                data: bookingCounts,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} bookings (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Display buses
function displayBuses() {
    const busesListDiv = document.getElementById('busesList');
    
    if (filteredBuses.length === 0) {
        busesListDiv.innerHTML = `
            <div class="no-data">
                <div class="no-data-icon">🚌</div>
                <p>${buses.length === 0 ? 'No buses scheduled yet. Add a new bus to get started!' : 'No buses found matching the filter criteria.'}</p>
            </div>
        `;
        return;
    }
    
    // Create a map of cancelled bus IDs for quick lookup
    const cancelledBusIds = new Set();
    allBuses.forEach(bus => {
        if (bus.status === 'cancelled') {
            cancelledBusIds.add(parseInt(bus.busId || bus.id));
        }
    });
    buses.forEach(bus => {
        if (bus.status === 'cancelled') {
            cancelledBusIds.add(parseInt(bus.busId || bus.id));
        }
    });
    
    // Calculate booked seats for each bus from all bookings
    // Exclude cancelled bookings and bookings from cancelled buses
    const busBookingsMap = {};
    console.log('Calculating booked seats. Total bookings:', allBookings.length);
    allBookings.forEach(booking => {
        const bookingStatus = booking.status?.toLowerCase();
        const busId = parseInt(booking.busId);
        
        // Only count confirmed bookings from active (non-cancelled) buses
        if (bookingStatus === 'confirmed' && !cancelledBusIds.has(busId)) {
            console.log(`Processing booking ${booking.bookingId} for bus ${busId}, seats:`, booking.seats);
            if (!busBookingsMap[busId]) {
                busBookingsMap[busId] = {
                    totalBookedSeats: 0,
                    bookedSeaters: 0,
                    bookedSleepers: 0,
                    totalBookings: 0,
                    totalRevenue: 0
                };
            }
            // Count booked seats (sum of all seats across all bookings for this bus)
            if (Array.isArray(booking.seats)) {
                busBookingsMap[busId].totalBookedSeats += booking.seats.length;
            }
            
            // Count booked seaters and sleepers from passenger data
            if (Array.isArray(booking.passengers)) {
                booking.passengers.forEach(passenger => {
                    if (passenger && passenger.seatType === 'seater') {
                        busBookingsMap[busId].bookedSeaters++;
                    } else if (passenger && passenger.seatType === 'sleeper') {
                        busBookingsMap[busId].bookedSleepers++;
                    }
                });
            }
            
            // Add revenue from this booking
            const bookingAmount = parseFloat(booking.totalAmount) || 0;
            busBookingsMap[busId].totalRevenue += bookingAmount;
            
            busBookingsMap[busId].totalBookings++;
        }
    });
    console.log('Bus bookings map:', busBookingsMap);
    
    busesListDiv.innerHTML = filteredBuses.map(bus => {
        const busId = parseInt(bus.busId || bus.id);
        const totalSeats = bus.totalSeats || 32;
        
        // Calculate total seater and sleeper seats (same logic as customer-booking.js)
        const sleeperSeats = Math.min(12, Math.floor(totalSeats * 0.375)); // ~37.5% sleeper
        const seaterSeats = totalSeats - sleeperSeats;
        
        const bookingInfo = busBookingsMap[busId] || { 
            totalBookedSeats: 0, 
            bookedSeaters: 0, 
            bookedSleepers: 0, 
            totalBookings: 0,
            totalRevenue: 0
        };
        const bookedSeats = bookingInfo.totalBookedSeats;
        const bookedSeaters = bookingInfo.bookedSeaters || 0;
        const bookedSleepers = bookingInfo.bookedSleepers || 0;
        const remainingSeats = Math.max(0, totalSeats - bookedSeats);
        const remainingSeaters = Math.max(0, seaterSeats - bookedSeaters);
        const remainingSleepers = Math.max(0, sleeperSeats - bookedSleepers);
        const bookingCount = bookingInfo.totalBookings;
        const busRevenue = bookingInfo.totalRevenue || 0;
        
        // Calculate booking percentage
        const bookingPercentage = totalSeats > 0 ? ((bookedSeats / totalSeats) * 100).toFixed(1) : 0;
        
        // Determine availability status and color
        let availabilityStatus = '';
        let availabilityColor = '#4CAF50'; // Green
        if (remainingSeats === 0) {
            availabilityStatus = 'Fully Booked';
            availabilityColor = '#f44336'; // Red
        } else if (remainingSeats <= 5) {
            availabilityStatus = 'Almost Full';
            availabilityColor = '#ff9800'; // Orange
        } else {
            availabilityStatus = 'Available';
            availabilityColor = '#4CAF50'; // Green
        }
        
        return `
        <div class="bus-card-admin">
            <div class="bus-info-admin">
                <h3>${bus.busName}</h3>
                <div class="bus-details-grid">
                    <div class="bus-detail-item">
                        <strong>Route:</strong> ${bus.from} → ${bus.to}
                    </div>
                    <div class="bus-detail-item">
                        <strong>Date:</strong> ${bus.date ? new Date(bus.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                    </div>
                    <div class="bus-detail-item">
                        <strong>Time:</strong> ${formatTime(bus.departureTime)} - ${formatTime(bus.arrivalTime)}
                    </div>
                    <div class="bus-detail-item">
                        <strong>Duration:</strong> ${bus.duration}
                    </div>
                    <div class="bus-detail-item">
                        <strong>Type:</strong> ${bus.busType}
                    </div>
                    <div class="bus-detail-item">
                        <strong>Total Seats:</strong> ${totalSeats}
                    </div>
                    <div class="bus-detail-item">
                        <strong>Booked Seats:</strong> ${bookedSeats} (${bookingCount} booking${bookingCount !== 1 ? 's' : ''})
                    </div>
                    <div class="bus-detail-item">
                        <strong>Seater Availability:</strong> ${remainingSeaters} / ${seaterSeats} available
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">${bookedSeaters} booked</div>
                    </div>
                    <div class="bus-detail-item">
                        <strong>Sleeper Availability:</strong> ${remainingSleepers} / ${sleeperSeats} available
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">${bookedSleepers} booked</div>
                    </div>
                    <div class="bus-detail-item" style="background: ${availabilityColor}15; border-left: 4px solid ${availabilityColor};">
                        <strong>Total Remaining Seats:</strong> <span style="color: ${availabilityColor}; font-weight: bold; font-size: 18px;">${remainingSeats}</span>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">${availabilityStatus} • ${bookingPercentage}% booked</div>
                    </div>
                    <div class="bus-detail-item">
                        <strong>Price:</strong> ₹${formatPrice(bus.seaterPrice)} (Seater) / ₹${formatPrice(bus.sleeperPrice)} (Sleeper)
                    </div>
                    <div class="bus-detail-item" style="background: #2196F315; border-left: 4px solid #2196F3;">
                        <strong>Revenue:</strong> <span style="color: #2196F3; font-weight: bold; font-size: 18px;">₹${formatPrice(busRevenue)}</span>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">From ${bookingCount} booking${bookingCount !== 1 ? 's' : ''}</div>
                    </div>
                </div>
            </div>
            <div class="bus-actions">
                <button class="btn-edit" onclick="editBus(${busId})">✏️ Edit</button>
                <button class="btn-delete" onclick="deleteBus(${busId})">🗑️ Delete</button>
            </div>
        </div>
    `;
    }).join('');
}

// Display bookings
function displayBookings() {
    const bookingsListDiv = document.getElementById('bookingsList');
    
    if (!bookingsListDiv) {
        console.error('bookingsList element not found');
        return;
    }
    
    console.log('Displaying bookings:', {
        allBookings: allBookings.length,
        filteredBookings: filteredBookings.length,
        allBuses: allBuses.length
    });
    
    if (filteredBookings.length === 0) {
        bookingsListDiv.innerHTML = `
            <div class="no-data">
                <div class="no-data-icon">🎫</div>
                <p>No bookings found. ${allBookings.length === 0 ? 'No bookings yet.' : 'Try adjusting your filters.'}</p>
            </div>
        `;
        return;
    }
    
    // Get bus names for display - use both allBuses and buses arrays
    const busMap = {};
    
    // Add buses from allBuses (for filter dropdown)
    allBuses.forEach(bus => {
        const busId = parseInt(bus.busId || bus.id);
        busMap[busId] = bus;
    });
    
    // Also add buses from buses array (admin's buses)
    buses.forEach(bus => {
        const busId = parseInt(bus.busId || bus.id);
        if (!busMap[busId]) {
            busMap[busId] = bus;
        }
    });
    
    console.log('Bus map:', busMap);
    console.log('Booking busIds:', filteredBookings.map(b => ({ busId: b.busId, type: typeof b.busId })));
    
    bookingsListDiv.innerHTML = filteredBookings.map(booking => {
        const bookingBusId = parseInt(booking.busId);
        const bus = busMap[bookingBusId];
        const busName = bus ? bus.busName : `Bus ID: ${booking.busId}`;
        const route = bus ? `${bus.from} → ${bus.to}` : 'N/A';
        
        console.log(`Booking ${booking.bookingId}: busId=${bookingBusId}, found=${!!bus}, route=${route}`);
        
        return `
            <div class="booking-card">
                <div class="booking-header">
                    <div>
                        <div class="booking-id">${booking.bookingId}</div>
                        <div style="font-size: 12px; color: #999; margin-top: 5px;">
                            Created: ${formatDateTime(booking.createdAt)}
                        </div>
                    </div>
                    <div class="booking-status status-${booking.status}">
                        ${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </div>
                </div>
                
                <div class="booking-info-grid">
                    <div class="info-item">
                        <div class="info-label">Bus</div>
                        <div class="info-value">${busName}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Route</div>
                        <div class="info-value">${route}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Travel Date</div>
                        <div class="info-value">${formatDate(booking.date)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Seats</div>
                        <div class="info-value">
                            <span class="seats-badge">${booking.seats.join(', ')}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Total Amount</div>
                        <div class="info-value">₹${formatPrice(booking.totalAmount)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Passengers</div>
                        <div class="info-value">${booking.passengers ? booking.passengers.length : 0}</div>
                    </div>
                </div>
                
                <div class="passengers-section">
                    <div class="passengers-title">Passenger Details</div>
                    <div class="passengers-list">
                        ${(booking.passengers || []).map((passenger, index) => `
                            <div class="passenger-item">
                                <div class="passenger-detail">
                                    <strong>Name</strong>
                                    <span>${passenger.name}</span>
                                </div>
                                <div class="passenger-detail">
                                    <strong>Age</strong>
                                    <span>${passenger.age} years</span>
                                </div>
                                <div class="passenger-detail">
                                    <strong>Gender</strong>
                                    <span>${passenger.gender}</span>
                                </div>
                                <div class="passenger-detail">
                                    <strong>Seat Number</strong>
                                    <span>${passenger.seatNumber}</span>
                                </div>
                                <div class="passenger-detail">
                                    <strong>Seat Type</strong>
                                    <span>${passenger.seatType || 'N/A'}</span>
                                </div>
                                <div class="passenger-detail">
                                    <strong>Price</strong>
                                    <span>₹${passenger.price ? formatPrice(passenger.price) : 'N/A'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Apply filters
function applyFilters() {
    const filterBus = document.getElementById('filterBus').value;
    const filterDate = document.getElementById('filterDate').value;
    const filterStatus = document.getElementById('filterStatus').value;
    
    filteredBookings = allBookings.filter(booking => {
        // Filter by bus
        if (filterBus && (booking.busId !== parseInt(filterBus))) {
            return false;
        }
        
        // Filter by date
        if (filterDate) {
            const bookingDate = booking.date ? booking.date.trim() : '';
            if (bookingDate !== filterDate) {
                return false;
            }
        }
        
        // Filter by status
        if (filterStatus && booking.status !== filterStatus) {
            return false;
        }
        
        return true;
    });
    
    displayBookings();
}

// Clear filters
function clearFilters() {
    document.getElementById('filterBus').value = '';
    document.getElementById('filterDate').value = '';
    document.getElementById('filterStatus').value = '';
    filteredBookings = [...allBookings];
    displayBookings();
}

// Apply bus filters
function applyBusFilters() {
    const filterDate = document.getElementById('filterBusDate').value;
    
    filteredBuses = buses.filter(bus => {
        // Filter by date
        if (filterDate) {
            const busDate = bus.date ? bus.date.split('T')[0] : '';
            if (busDate !== filterDate) {
                return false;
            }
        }
        return true;
    });
    
    displayBuses();
}

// Clear bus filters
function clearBusFilters() {
    document.getElementById('filterBusDate').value = '';
    filteredBuses = [...buses];
    displayBuses();
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Format date time
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Switch tabs
function switchTab(tabName, buttonElement) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (buttonElement) {
        buttonElement.classList.add('active');
    } else {
        // If called programmatically, find the right button
        const buttons = document.querySelectorAll('.tab-button');
        const tabMap = { 'overview': 0, 'buses': 1, 'add-bus': 2, 'bookings': 3 };
        if (tabMap[tabName] !== undefined) {
            buttons[tabMap[tabName]].classList.add('active');
        }
    }
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Reset form if switching to add bus tab (and not editing)
    if (tabName === 'add-bus') {
        const form = document.getElementById('addBusForm');
        if (!form.dataset.editBusId) {
            form.reset();
            if (adminData && adminData.enterpriseName) {
                document.getElementById('enterpriseName').value = adminData.enterpriseName;
            }
            form.querySelector('button[type="submit"]').textContent = 'Schedule Bus';
            // Clear duration when form is reset
            document.getElementById('duration').value = '';
        }
    }
    
    // Reload data when switching to certain tabs
    if (tabName === 'overview') {
        updateOverviewStats();
    } else if (tabName === 'bookings') {
        // Ensure bookings are loaded
        if (allBookings.length === 0) {
            loadBookings();
        }
    }
}

// Add/Update bus form submission
// Bus form validation functions
function validateBusName(busName) {
    const errors = [];
    
    if (!busName || busName.trim() === '') {
        errors.push('Bus name is required');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const trimmed = busName.trim();
    if (trimmed.length < 2) {
        errors.push('Bus name must be at least 2 characters long');
    }
    if (trimmed.length > 100) {
        errors.push('Bus name must not exceed 100 characters');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function validateLocation(location, fieldName) {
    const errors = [];
    
    if (!location || location.trim() === '') {
        errors.push(`${fieldName} is required`);
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const trimmed = location.trim();
    if (trimmed.length < 2) {
        errors.push(`${fieldName} must be at least 2 characters long`);
    }
    if (trimmed.length > 50) {
        errors.push(`${fieldName} must not exceed 50 characters`);
    }
    
    const locationRegex = /^[a-zA-Z\s-]+$/;
    if (!locationRegex.test(trimmed)) {
        errors.push(`${fieldName} must contain only letters, spaces, and hyphens`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function validateTime(time, fieldName) {
    const errors = [];
    
    if (!time || time.trim() === '') {
        errors.push(`${fieldName} is required`);
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time.trim())) {
        errors.push(`${fieldName} must be in HH:MM format (24-hour)`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function validateDuration(duration) {
    const errors = [];
    
    if (!duration || duration.trim() === '') {
        errors.push('Duration is required');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const trimmed = duration.trim();
    if (trimmed.length < 1) {
        errors.push('Duration is required');
    }
    if (trimmed.length > 20) {
        errors.push('Duration must not exceed 20 characters');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function validatePrice(price, fieldName, min = 0, max = 100000) {
    const errors = [];
    
    if (price === undefined || price === null || price === '') {
        errors.push(`${fieldName} is required`);
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) {
        errors.push(`${fieldName} must be a number`);
    } else {
        if (numPrice < min) {
            errors.push(`${fieldName} must be at least ${min}`);
        }
        if (numPrice > max) {
            errors.push(`${fieldName} must not exceed ${max}`);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        value: numPrice
    };
}

function validateBusType(busType) {
    const errors = [];
    const validTypes = ['AC Seater/Sleeper', 'Non-AC Seater/Sleeper'];
    
    if (!busType || busType.trim() === '') {
        errors.push('Bus type is required');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    if (!validTypes.includes(busType)) {
        errors.push(`Bus type must be one of: ${validTypes.join(', ')}`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function validateTotalSeats(totalSeats) {
    const errors = [];
    
    if (totalSeats === undefined || totalSeats === null || totalSeats === '') {
        errors.push('Total seats is required');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const numSeats = parseInt(totalSeats);
    if (isNaN(numSeats)) {
        errors.push('Total seats must be a number');
    } else {
        if (numSeats < 1) {
            errors.push('Total seats must be at least 1');
        }
        if (numSeats > 50) {
            errors.push('Total seats must not exceed 50');
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

document.getElementById('addBusForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const editBusId = form.dataset.editBusId;
    
    if (editBusId) {
        // Update existing bus
        await updateBus(parseInt(editBusId));
    } else {
        // Add new bus
        hideMessages();
        
        // Ensure duration is calculated before submission
        calculateDuration();
        
        const formData = {
            busName: document.getElementById('busName').value.trim(),
            enterpriseName: document.getElementById('enterpriseName').value.trim(),
            from: document.getElementById('from').value.trim(),
            to: document.getElementById('to').value.trim(),
            date: document.getElementById('date').value,
            departureTime: document.getElementById('departureTime').value,
            arrivalTime: document.getElementById('arrivalTime').value,
            duration: document.getElementById('duration').value.trim(),
            seaterPrice: document.getElementById('seaterPrice').value,
            sleeperPrice: document.getElementById('sleeperPrice').value,
            busType: document.getElementById('busType').value,
            totalSeats: document.getElementById('totalSeats').value
        };
        
        // Validate all fields
        const allErrors = [];
        
        // Bus name validation
        const busNameValidation = validateBusName(formData.busName);
        if (!busNameValidation.isValid) {
            allErrors.push(...busNameValidation.errors);
        }
        
        // From location validation
        const fromValidation = validateLocation(formData.from, 'From location');
        if (!fromValidation.isValid) {
            allErrors.push(...fromValidation.errors);
        }
        
        // To location validation
        const toValidation = validateLocation(formData.to, 'To location');
        if (!toValidation.isValid) {
            allErrors.push(...toValidation.errors);
        }
        
        // Check from and to are different
        if (formData.from.toLowerCase() === formData.to.toLowerCase()) {
            allErrors.push('From and To locations cannot be the same');
        }
        
        // Departure time validation
        const departureTimeValidation = validateTime(formData.departureTime, 'Departure time');
        if (!departureTimeValidation.isValid) {
            allErrors.push(...departureTimeValidation.errors);
        }
        
        // Arrival time validation
        const arrivalTimeValidation = validateTime(formData.arrivalTime, 'Arrival time');
        if (!arrivalTimeValidation.isValid) {
            allErrors.push(...arrivalTimeValidation.errors);
        }
        
        // Duration validation
        const durationValidation = validateDuration(formData.duration);
        if (!durationValidation.isValid) {
            allErrors.push(...durationValidation.errors);
        }
        
        // Seater price validation
        const seaterPriceValidation = validatePrice(formData.seaterPrice, 'Seater price');
        if (!seaterPriceValidation.isValid) {
            allErrors.push(...seaterPriceValidation.errors);
        }
        
        // Sleeper price validation
        const sleeperPriceValidation = validatePrice(formData.sleeperPrice, 'Sleeper price');
        if (!sleeperPriceValidation.isValid) {
            allErrors.push(...sleeperPriceValidation.errors);
        }
        
        // Check sleeper price > seater price
        if (seaterPriceValidation.isValid && sleeperPriceValidation.isValid) {
            if (sleeperPriceValidation.value <= seaterPriceValidation.value) {
                allErrors.push('Sleeper price must be higher than seater price');
            }
        }
        
        // Bus type validation
        const busTypeValidation = validateBusType(formData.busType);
        if (!busTypeValidation.isValid) {
            allErrors.push(...busTypeValidation.errors);
        }
        
        // Total seats validation
        const totalSeatsValidation = validateTotalSeats(formData.totalSeats);
        if (!totalSeatsValidation.isValid) {
            allErrors.push(...totalSeatsValidation.errors);
        }
        
        // Show all errors if any
        if (allErrors.length > 0) {
            showError('Validation errors:\n' + allErrors.join('\n'));
            return;
        }
        
        // Convert to proper types for submission
        formData.seaterPrice = parseFloat(formData.seaterPrice);
        formData.sleeperPrice = parseFloat(formData.sleeperPrice);
        formData.totalSeats = parseInt(formData.totalSeats);
        
        try {
            const response = await fetch('/api/buses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showSuccess('Bus scheduled successfully!');
                form.reset();
                document.getElementById('enterpriseName').value = adminData.enterpriseName;
                await loadBuses();
                updateOverviewStats();
                // Switch to buses tab after 1 second
                setTimeout(() => {
                    const busesButton = document.querySelectorAll('.tab-button')[1];
                    switchTab('buses', busesButton);
                }, 1000);
            } else {
                showError(data.error || 'Failed to schedule bus');
            }
        } catch (error) {
            console.error('Error adding bus:', error);
            showError('An error occurred. Please try again.');
        }
    }
});

// Edit bus
function editBus(busId) {
    const bus = buses.find(b => (b.busId || b.id) === busId);
    if (!bus) {
        showError('Bus not found');
        return;
    }
    
    // Populate form with bus data
    document.getElementById('busName').value = bus.busName;
    document.getElementById('from').value = bus.from;
    document.getElementById('to').value = bus.to;
    document.getElementById('date').value = bus.date ? bus.date.split('T')[0] : '';
    // Format time to HH:MM format (database might return HH:MM:SS)
    document.getElementById('departureTime').value = formatTime(bus.departureTime);
    document.getElementById('arrivalTime').value = formatTime(bus.arrivalTime);
    // Recalculate duration based on times (will auto-update)
    calculateDuration();
    document.getElementById('seaterPrice').value = bus.seaterPrice;
    document.getElementById('sleeperPrice').value = bus.sleeperPrice;
    document.getElementById('busType').value = bus.busType;
    document.getElementById('totalSeats').value = bus.totalSeats;
    
    // Switch to add bus tab
    const addBusButton = document.querySelectorAll('.tab-button')[2];
    switchTab('add-bus', addBusButton);
    
    // Change form to edit mode
    const form = document.getElementById('addBusForm');
    form.dataset.editBusId = busId;
    form.querySelector('button[type="submit"]').textContent = 'Update Bus';
    
    // Scroll to form
    document.getElementById('addBusForm').scrollIntoView({ behavior: 'smooth' });
}

// Update bus
async function validateBusFormData(formData, isUpdate = false) {
    const allErrors = [];
    
    // Bus name validation (required for add, optional for update)
    if (!isUpdate || formData.busName) {
        const busNameValidation = validateBusName(formData.busName || '');
        if (!busNameValidation.isValid) {
            allErrors.push(...busNameValidation.errors);
        }
    }
    
    // From location validation (optional for update)
    if (!isUpdate || formData.from) {
        const fromValidation = validateLocation(formData.from || '', 'From location');
        if (!fromValidation.isValid) {
            allErrors.push(...fromValidation.errors);
        }
    }
    
    // To location validation (optional for update)
    if (!isUpdate || formData.to) {
        const toValidation = validateLocation(formData.to || '', 'To location');
        if (!toValidation.isValid) {
            allErrors.push(...toValidation.errors);
        }
    }
    
    // Check from and to are different if both provided
    if (formData.from && formData.to && formData.from.toLowerCase() === formData.to.toLowerCase()) {
        allErrors.push('From and To locations cannot be the same');
    }
    
    // Departure time validation (optional for update)
    if (!isUpdate || formData.departureTime) {
        const departureTimeValidation = validateTime(formData.departureTime || '', 'Departure time');
        if (!departureTimeValidation.isValid) {
            allErrors.push(...departureTimeValidation.errors);
        }
    }
    
    // Arrival time validation (optional for update)
    if (!isUpdate || formData.arrivalTime) {
        const arrivalTimeValidation = validateTime(formData.arrivalTime || '', 'Arrival time');
        if (!arrivalTimeValidation.isValid) {
            allErrors.push(...arrivalTimeValidation.errors);
        }
    }
    
    // Duration validation (optional for update)
    if (!isUpdate || formData.duration) {
        const durationValidation = validateDuration(formData.duration || '');
        if (!durationValidation.isValid) {
            allErrors.push(...durationValidation.errors);
        }
    }
    
    // Seater price validation (optional for update)
    if (!isUpdate || formData.seaterPrice !== undefined) {
        const seaterPriceValidation = validatePrice(formData.seaterPrice, 'Seater price');
        if (!seaterPriceValidation.isValid) {
            allErrors.push(...seaterPriceValidation.errors);
        }
    }
    
    // Sleeper price validation (optional for update)
    if (!isUpdate || formData.sleeperPrice !== undefined) {
        const sleeperPriceValidation = validatePrice(formData.sleeperPrice, 'Sleeper price');
        if (!sleeperPriceValidation.isValid) {
            allErrors.push(...sleeperPriceValidation.errors);
        }
    }
    
    // Check sleeper price > seater price if both provided
    if (formData.seaterPrice !== undefined && formData.sleeperPrice !== undefined) {
        const seaterVal = parseFloat(formData.seaterPrice);
        const sleeperVal = parseFloat(formData.sleeperPrice);
        if (!isNaN(seaterVal) && !isNaN(sleeperVal) && sleeperVal <= seaterVal) {
            allErrors.push('Sleeper price must be higher than seater price');
        }
    }
    
    // Bus type validation (optional for update)
    if (!isUpdate || formData.busType) {
        const busTypeValidation = validateBusType(formData.busType || '');
        if (!busTypeValidation.isValid) {
            allErrors.push(...busTypeValidation.errors);
        }
    }
    
    // Total seats validation (optional for update)
    if (!isUpdate || formData.totalSeats !== undefined) {
        const totalSeatsValidation = validateTotalSeats(formData.totalSeats || '');
        if (!totalSeatsValidation.isValid) {
            allErrors.push(...totalSeatsValidation.errors);
        }
    }
    
    return {
        isValid: allErrors.length === 0,
        errors: allErrors
    };
}

async function updateBus(busId) {
    hideMessages();
    
    // Ensure duration is calculated before submission
    calculateDuration();
    
    const formData = {
        busName: document.getElementById('busName').value.trim(),
        from: document.getElementById('from').value.trim(),
        to: document.getElementById('to').value.trim(),
        date: document.getElementById('date').value,
        departureTime: document.getElementById('departureTime').value,
        arrivalTime: document.getElementById('arrivalTime').value,
        duration: document.getElementById('duration').value.trim(),
        seaterPrice: document.getElementById('seaterPrice').value,
        sleeperPrice: document.getElementById('sleeperPrice').value,
        busType: document.getElementById('busType').value,
        totalSeats: document.getElementById('totalSeats').value
    };
    
    // Validate all fields using the validation function
    const validation = await validateBusFormData(formData, true);
    if (!validation.isValid) {
        showError('Validation errors:\n' + validation.errors.join('\n'));
        return;
    }
    
    // Convert to proper types for submission
    formData.seaterPrice = parseFloat(formData.seaterPrice);
    formData.sleeperPrice = parseFloat(formData.sleeperPrice);
    formData.totalSeats = parseInt(formData.totalSeats);
    
    try {
        const response = await fetch(`/api/buses/${busId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Bus updated successfully!');
            const form = document.getElementById('addBusForm');
            form.reset();
            document.getElementById('enterpriseName').value = adminData.enterpriseName;
            delete form.dataset.editBusId;
            form.querySelector('button[type="submit"]').textContent = 'Schedule Bus';
            await loadBuses();
            updateOverviewStats();
            setTimeout(() => {
                const busesButton = document.querySelectorAll('.tab-button')[1];
                switchTab('buses', busesButton);
            }, 1000);
        } else {
            showError(data.error || 'Failed to update bus');
        }
    } catch (error) {
        console.error('Error updating bus:', error);
        showError('An error occurred. Please try again.');
    }
}

// Delete bus
async function deleteBus(busId) {
    if (!confirm('Are you sure you want to delete this bus? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/buses/${busId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Bus deleted successfully!');
            await loadBuses();
            updateOverviewStats();
        } else {
            showError(data.error || 'Failed to delete bus');
        }
    } catch (error) {
        console.error('Error deleting bus:', error);
        showError('An error occurred. Please try again.');
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Show success message
function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

// Show popup notification when customer cancels booking
function showBookingCancellationNotification(data) {
    // Remove existing notification if any
    const existingNotification = document.getElementById('bookingCancellationNotification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Find booking details from allBookings (updated by SSE)
    const cancelledBooking = allBookings.find(b => b.bookingId === data.bookingId);
    
    // Find bus details
    const bus = allBuses.find(b => (b.busId || b.id) === data.busId) || 
               buses.find(b => (b.busId || b.id) === data.busId);
    const busName = bus ? `${bus.enterpriseName || 'Bus Service'} - ${bus.busName}` : `Bus ID: ${data.busId}`;
    
    // Get seats from data or booking
    const seats = (data.seats && data.seats.length > 0) ? data.seats : 
                 (cancelledBooking && cancelledBooking.seats) ? cancelledBooking.seats : [];
    const seatsText = seats.length > 0 ? `Seats ${seats.join(', ')} are now available.` : '';
    
    // Create notification banner
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
        <button onclick="this.parentElement.remove(); updateBodyPadding();" 
                style="background: rgba(255,255,255,0.2); color: white; border: 2px solid white; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 18px; font-weight: bold; transition: background 0.2s;" 
                onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
    `;
    
    // Add animation style if not already added
    if (!document.getElementById('adminNotificationStyles')) {
        const style = document.createElement('style');
        style.id = 'adminNotificationStyles';
        style.textContent = `
            @keyframes slideDown {
                from {
                    transform: translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Helper function to update body padding
    window.updateBodyPadding = function() {
        const otherNotifications = document.querySelectorAll('[id$="Notification"]');
        if (otherNotifications.length === 0) {
            document.body.style.paddingTop = '';
        }
    };
    
    // Add padding to body to account for fixed notification
    const currentPadding = document.body.style.paddingTop;
    if (!currentPadding || currentPadding === '') {
        document.body.style.paddingTop = '80px';
    }
    
    document.body.insertBefore(notification, document.body.firstChild);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
            updateBodyPadding();
        }
    }, 10000);
}

// Hide messages
function hideMessages() {
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
}

// Logout function
async function logout() {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/admin/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/admin/login.html';
    }
}
