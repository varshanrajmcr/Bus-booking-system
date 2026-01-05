let allBookings = [];
let filteredBookings = [];
let allBuses = [];

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

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    // Check session and load user name
    try {
        const sessionResponse = await fetch('/api/session', {
            credentials: 'include'
        });
        const sessionData = await sessionResponse.json();
        
        if (sessionData.authenticated && sessionData.user.userType === 'customer') {
            document.getElementById('userName').textContent = `Welcome, ${sessionData.user.fullName || 'User'}`;
            // Load buses first, then bookings (so buses are available when displaying)
            await loadAllBuses();
            await loadBookings();
            // Check for cancelled bookings and show notification
            checkForCancelledBookings();
        } else {
            alert('Please login to continue');
            window.location.href = '/customer/login.html';
        }
    } catch (error) {
        console.error('Error checking session:', error);
        window.location.href = '/customer/login.html';
    }
});

// Load all buses for route display
async function loadAllBuses() {
    try {
        const response = await fetch('/api/buses', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok) {
            allBuses = data.buses || [];
            console.log('Loaded buses:', allBuses.length);
            // If bookings are already loaded, refresh the display
            if (allBookings.length > 0) {
                displayBookings();
            }
        } else {
            console.error('Failed to load buses:', data.error);
        }
    } catch (error) {
        console.error('Error loading buses:', error);
    }
}

// Load bookings for this customer
async function loadBookings() {
    try {
        const response = await fetch('/api/bookings/customer', {
            credentials: 'include'
        });
        const data = await response.json();
        
        console.log('Bookings API response:', { 
            status: response.status, 
            bookingsCount: data.bookings?.length || 0
        });
        
        if (response.ok) {
            allBookings = data.bookings || [];
            // Sort bookings by travel date (ascending - earliest first)
            allBookings.sort((a, b) => {
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                return dateA - dateB;
            });
            filteredBookings = [...allBookings];
            console.log('Loaded bookings:', allBookings.length);
            // Populate bus filter dropdown
            populateBusFilter();
            // Display bookings after buses are loaded (ensure buses are available)
            if (allBuses.length > 0) {
                displayBookings();
            } else {
                // If buses not loaded yet, wait a bit and try again
                setTimeout(() => {
                    if (allBuses.length > 0) {
                        populateBusFilter();
                        displayBookings();
                    }
                }, 500);
            }
            
            // Check for cancelled bookings and show notification
            checkForCancelledBookings();
        } else {
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

// Display bookings
function displayBookings() {
    const bookingsListDiv = document.getElementById('bookingsList');
    
    if (!bookingsListDiv) {
        console.error('bookingsList element not found');
        return;
    }
    
    if (filteredBookings.length === 0) {
        bookingsListDiv.innerHTML = `
            <div class="no-data">
                <div class="no-data-icon">🎫</div>
                <p>No bookings found. ${allBookings.length === 0 ? 'You haven\'t made any bookings yet.' : 'Try adjusting your filters.'}</p>
            </div>
        `;
        return;
    }
    
    // Create bus map for quick lookup
    const busMap = {};
    allBuses.forEach(bus => {
        const busId = parseInt(bus.busId || bus.id);
        busMap[busId] = bus;
    });
    
    console.log('Bus map:', busMap);
    console.log('Bookings to display:', filteredBookings.length);
    
    bookingsListDiv.innerHTML = filteredBookings.map(booking => {
        const bookingBusId = parseInt(booking.busId);
        const bus = busMap[bookingBusId];
        
        // Format bus name with enterprise name: "(EnterpriseName - BusName)"
        let busName;
        if (bus) {
            if (bus.enterpriseName && bus.busName) {
                busName = `(${bus.enterpriseName} - ${bus.busName})`;
            } else if (bus.busName) {
                busName = bus.busName;
            } else {
                busName = `Bus ID: ${booking.busId}`;
            }
        } else {
            busName = `Bus ID: ${booking.busId}`;
        }
        
        // Get route information
        const route = bus && bus.from && bus.to ? `${bus.from} → ${bus.to}` : 'N/A';
        
        console.log(`Booking ${booking.bookingId}: busId=${bookingBusId}, bus found=${!!bus}, route=${route}`);
        
        return `
            <div class="booking-card">
                ${booking.status === 'cancelled' ? `
                <div class="cancellation-notice">
                    This booking has been cancelled.
                </div>
                ` : ''}
                <div class="booking-header">
                    <div>
                        <div class="booking-id">${booking.bookingId}</div>
                        <div style="font-size: 12px; color: #999; margin-top: 5px;">
                            Created: ${formatDateTime(booking.createdAt)}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="booking-status status-${booking.status}">
                            ${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </div>
                        ${booking.status !== 'cancelled' ? `
                        <button onclick="cancelBooking('${booking.bookingId}')" 
                                class="btn-cancel-booking"
                                title="Cancel this booking">
                            Cancel Booking
                        </button>
                        ` : ''}
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
                                    <span>₹${passenger.price || 'N/A'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Populate bus filter dropdown with buses from customer's bookings
function populateBusFilter() {
    const filterBus = document.getElementById('filterBus');
    if (!filterBus) return;
    
    // Get unique bus IDs from bookings
    const uniqueBusIds = [...new Set(allBookings.map(booking => parseInt(booking.busId)))];
    
    // Clear existing options except "All Buses"
    filterBus.innerHTML = '<option value="">All Buses</option>';
    
    // Create bus map for lookup
    const busMap = {};
    allBuses.forEach(bus => {
        const busId = parseInt(bus.busId || bus.id);
        busMap[busId] = bus;
    });
    
    // Add buses that are in the customer's bookings
    uniqueBusIds.forEach(busId => {
        const bus = busMap[busId];
        if (bus) {
            const option = document.createElement('option');
            option.value = busId;
            // Format: "EnterpriseName - BusName (From → To)"
            let busLabel = '';
            if (bus.enterpriseName && bus.busName) {
                busLabel = `${bus.enterpriseName} - ${bus.busName}`;
            } else if (bus.busName) {
                busLabel = bus.busName;
            } else {
                busLabel = `Bus ID: ${busId}`;
            }
            
            if (bus.from && bus.to) {
                busLabel += ` (${bus.from} → ${bus.to})`;
            }
            
            option.textContent = busLabel;
            filterBus.appendChild(option);
        }
    });
}

// Apply filters
function applyFilters() {
    const filterBus = document.getElementById('filterBus')?.value || '';
    const filterDate = document.getElementById('filterDate').value;
    const filterStatus = document.getElementById('filterStatus').value;
    
    filteredBookings = allBookings.filter(booking => {
        // Filter by bus
        if (filterBus && parseInt(booking.busId) !== parseInt(filterBus)) {
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
    
    // Sort filtered bookings by travel date (ascending - earliest first)
    filteredBookings.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateA - dateB;
    });
    
    displayBookings();
}

// Clear filters
function clearFilters() {
    document.getElementById('filterBus').value = '';
    document.getElementById('filterDate').value = '';
    document.getElementById('filterStatus').value = '';
    filteredBookings = [...allBookings];
    // Sort filtered bookings by travel date (ascending - earliest first)
    filteredBookings.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateA - dateB;
    });
    displayBookings();
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

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Check for cancelled bookings and show notification
function checkForCancelledBookings() {
    const cancelledBookings = allBookings.filter(booking => booking.status === 'cancelled');
    
    if (cancelledBookings.length > 0) {
        // Create a map of busId -> bus status for quick lookup
        const busStatusMap = {};
        allBuses.forEach(bus => {
            busStatusMap[bus.busId || bus.id] = bus.status || 'active';
        });
        
        // Only show notification for bookings cancelled by admin (bus is also cancelled)
        const adminCancelledBookings = cancelledBookings.filter(booking => {
            const busStatus = busStatusMap[booking.busId];
            return busStatus === 'cancelled'; // Only show if bus is cancelled (admin cancelled the bus)
        });
        
        if (adminCancelledBookings.length > 0) {
            // Get list of booking IDs that have been notified (from sessionStorage)
            const notifiedBookings = JSON.parse(sessionStorage.getItem('notifiedCancelledBookings') || '[]');
            
            // Find new cancellations (not yet notified)
            const newCancellations = adminCancelledBookings.filter(
                booking => !notifiedBookings.includes(booking.bookingId)
            );
            
            if (newCancellations.length > 0) {
                // Show notification
                showCancellationNotification(newCancellations);
                
                // Mark these bookings as notified
                const updatedNotified = [...notifiedBookings, ...newCancellations.map(b => b.bookingId)];
                sessionStorage.setItem('notifiedCancelledBookings', JSON.stringify(updatedNotified));
            }
        }
    }
}

// Show cancellation notification
function showCancellationNotification(cancelledBookings) {
    // Remove existing notification if any
    const existingNotification = document.getElementById('cancellationNotification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification banner
    const notification = document.createElement('div');
    notification.id = 'cancellationNotification';
    notification.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
        color: white;
        padding: 20px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        animation: slideDown 0.5s ease-out;
    `;
    
    const message = cancelledBookings.length === 1
        ? `⚠️ Important: Your bus booking (${cancelledBookings[0].bookingId}) has been cancelled by the operator.`
        : `⚠️ Important: ${cancelledBookings.length} of your bus bookings have been cancelled by the operator.`;
    
    notification.innerHTML = `
        <div style="flex: 1; display: flex; align-items: center; gap: 15px;">
            <span style="font-size: 24px;">⚠️</span>
            <div>
                <strong style="font-size: 16px; display: block; margin-bottom: 5px;">Bus Cancellation Notice</strong>
                <span style="font-size: 14px;">${message}</span>
            </div>
        </div>
        <button onclick="this.parentElement.remove(); document.body.style.paddingTop = '';" style="background: rgba(255,255,255,0.2); color: white; border: 2px solid white; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 18px; font-weight: bold; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
    `;
    
    // Add animation style if not already added
    if (!document.getElementById('notificationStyles')) {
        const style = document.createElement('style');
        style.id = 'notificationStyles';
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
    
    // Add padding to body to account for fixed notification
    document.body.style.paddingTop = '80px';
    
    document.body.insertBefore(notification, document.body.firstChild);
    
    // Auto-hide after 30 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
            document.body.style.paddingTop = '';
        }
    }, 30000);
}

// Cancel booking function
async function cancelBooking(bookingId) {
    if (!bookingId) {
        showError('Invalid booking ID');
        return;
    }
    
    // Confirm cancellation
    const confirmed = confirm(`Are you sure you want to cancel booking ${bookingId}? This action cannot be undone.`);
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        // Check if session was terminated
        if (data.sessionTerminated || (data.error === 'Session terminated')) {
            alert(data.message || 'Another user has logged into this account. Please login again.');
            window.location.href = '/customer/login.html';
            return;
        }
        
        if (response.ok) {
            // Show simple success message (no popup notification - admin will get notified)
            showError(''); // Clear any previous errors
            const successDiv = document.createElement('div');
            successDiv.style.cssText = 'background: #e8f5e9; color: #2e7d32; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #2e7d32;';
            successDiv.textContent = 'Booking cancelled successfully.';
            const bookingsList = document.getElementById('bookingsList');
            if (bookingsList && bookingsList.parentNode) {
                bookingsList.parentNode.insertBefore(successDiv, bookingsList);
                setTimeout(() => successDiv.remove(), 3000);
            }
            // Reload bookings to reflect the cancellation
            await loadBookings();
        } else {
            alert(data.error || 'Failed to cancel booking. Please try again.');
        }
    } catch (error) {
        console.error('Error cancelling booking:', error);
        alert('An error occurred while cancelling the booking. Please try again.');
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/customer/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/customer/login.html';
    }
}

