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

// Set minimum date to today
document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('travelDate').setAttribute('min', today);
    
    // Check session and load user name
    try {
        const sessionResponse = await fetch('/api/session', {
            credentials: 'include'
        });
        const sessionData = await sessionResponse.json();
        
        // Check if session was terminated
        if (sessionData.sessionTerminated || (sessionData.error === 'Session terminated')) {
            alert(sessionData.message || 'Another user has logged into this account. Please login again.');
            window.location.href = '/customer/login.html';
            return;
        }
        
        if (sessionData.authenticated && sessionData.user.userType === 'customer') {
            document.getElementById('userName').textContent = `Welcome, ${sessionData.user.fullName || 'User'}`;
            // Check for cancelled bookings and show notification
            await checkForCancelledBookings();
        } else {
            alert('Please login to continue');
            window.location.href = '/customer/login.html';
        }
    } catch (error) {
        console.error('Error checking session:', error);
        window.location.href = '/customer/login.html';
    }
});

// Check for cancelled bookings and show notification
async function checkForCancelledBookings() {
    try {
        const [bookingsResponse, busesResponse] = await Promise.all([
            fetch('/api/bookings/customer', { credentials: 'include' }),
            fetch('/api/buses', { credentials: 'include' })
        ]);
        
        const bookingsData = await bookingsResponse.json();
        const busesData = await busesResponse.json();
        
        // Check if session was terminated
        if (bookingsData.sessionTerminated || (bookingsData.error === 'Session terminated')) {
            alert(bookingsData.message || 'Another user has logged into this account. Please login again.');
            window.location.href = '/customer/login.html';
            return;
        }
        
        if (bookingsResponse.ok && bookingsData.bookings && busesResponse.ok && busesData.buses) {
            const cancelledBookings = bookingsData.bookings.filter(booking => booking.status === 'cancelled');
            
            // Create a map of busId -> bus status for quick lookup
            const busStatusMap = {};
            busesData.buses.forEach(bus => {
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
    } catch (error) {
        console.error('Error checking for cancelled bookings:', error);
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
        ? `⚠️ Important: Your bus booking (${cancelledBookings[0].bookingId}) has been cancelled by the operator. Please check your bookings for details.`
        : `⚠️ Important: ${cancelledBookings.length} of your bus bookings have been cancelled by the operator. Please check your bookings for details.`;
    
    notification.innerHTML = `
        <div style="flex: 1; display: flex; align-items: center; gap: 15px;">
            <span style="font-size: 24px;">⚠️</span>
            <div>
                <strong style="font-size: 16px; display: block; margin-bottom: 5px;">Bus Cancellation Notice</strong>
                <span style="font-size: 14px;">${message}</span>
            </div>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
            <a href="/customer/bookings.html" style="background: white; color: #ff6b6b; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">View Bookings</a>
            <button onclick="this.parentElement.parentElement.remove()" style="background: rgba(255,255,255,0.2); color: white; border: 2px solid white; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 18px; font-weight: bold; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
        </div>
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

// Location validation function
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

// Date validation function
function validateTravelDate(date) {
    const errors = [];
    
    if (!date || date.trim() === '') {
        errors.push('Travel date is required');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        errors.push('Date must be in YYYY-MM-DD format');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const travelDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(travelDate.getTime())) {
        errors.push('Invalid date');
    } else if (travelDate < today) {
        errors.push('Travel date cannot be in the past');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Passengers validation function
function validatePassengers(passengers) {
    const errors = [];
    
    if (passengers === undefined || passengers === null) {
        return {
            isValid: true,
            errors: errors
        };
    }
    
    const numPassengers = parseInt(passengers);
    if (isNaN(numPassengers)) {
        errors.push('Passengers must be a number');
    } else if (numPassengers < 1) {
        errors.push('Passengers must be at least 1');
    } else if (numPassengers > 10) {
        errors.push('Passengers must not exceed 10');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Search form submission
document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Track bus search initiation
    if (window.routeTracker) {
        window.routeTracker.trackAction('bus_search_initiated', {
            from: document.getElementById('fromLocation').value,
            to: document.getElementById('toLocation').value,
            date: document.getElementById('travelDate').value,
            passengers: document.getElementById('passengers').value
        });
    }
    
    const searchData = {
        from: document.getElementById('fromLocation').value.trim(),
        to: document.getElementById('toLocation').value.trim(),
        date: document.getElementById('travelDate').value,
        passengers: parseInt(document.getElementById('passengers').value)
    };
    
    // Validate from location
    const fromValidation = validateLocation(searchData.from, 'From location');
    if (!fromValidation.isValid) {
        alert('Validation Error:\n' + fromValidation.errors.join('\n'));
        return;
    }
    
    // Validate to location
    const toValidation = validateLocation(searchData.to, 'To location');
    if (!toValidation.isValid) {
        alert('Validation Error:\n' + toValidation.errors.join('\n'));
        return;
    }
    
    // Validate from and to are different
    if (searchData.from.toLowerCase() === searchData.to.toLowerCase()) {
        alert('From and To locations cannot be the same!');
        return;
    }
    
    // Validate date
    const dateValidation = validateTravelDate(searchData.date);
    if (!dateValidation.isValid) {
        alert('Validation Error:\n' + dateValidation.errors.join('\n'));
        return;
    }
    
    // Validate passengers (optional)
    const passengersValidation = validatePassengers(searchData.passengers);
    if (!passengersValidation.isValid) {
        alert('Validation Error:\n' + passengersValidation.errors.join('\n'));
        return;
    }
    
    // Show loading
    document.getElementById('loadingMessage').style.display = 'block';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('busResults').innerHTML = '';
    
    try {
        const response = await fetch('/api/buses/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(searchData)
        });
        
        const data = await response.json();
        
        document.getElementById('loadingMessage').style.display = 'none';
        
        if (response.ok && data.buses && data.buses.length > 0) {
            // Check if there's a warning about insufficient seats
            if (data.warning) {
                showSeatAvailabilityWarning(data.warning, searchData);
            }
            displayBuses(data.buses, searchData);
        } else {
            document.getElementById('noResults').style.display = 'block';
        }
    } catch (error) {
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('noResults').style.display = 'block';
        console.error('Error:', error);
    }
});

// Display buses
function displayBuses(buses, searchData) {
    const resultsDiv = document.getElementById('busResults');
    resultsDiv.innerHTML = '';
    
    buses.forEach(bus => {
        const busCard = document.createElement('div');
        busCard.className = 'bus-card';
        busCard.innerHTML = `
            <div class="bus-info">
                <div class="bus-route">
                    <div class="route-line">
                        <div class="route-segment departure-segment">
                            <div class="time-label"> ⏰ Departure</div>
                            <div class="route-time departure-time">${formatTime(bus.departureTime)}</div>
                            <div class="route-location">${bus.from}</div>
                        </div>
                        <div class="route-arrow">→</div>
                        <div class="route-segment arrival-segment">
                            <div class="time-label"> ⏰ Arrival</div>
                            <div class="route-time arrival-time">${formatTime(bus.arrivalTime)}</div>
                            <div class="route-location">  ${ bus.to}</div>
                        </div>
                    </div>
                </div>
                <div class="bus-details">
                    <div class="detail-item">
                        <span>🚌</span>
                        <span>${bus.busName}</span>
                    </div>
                    <div class="detail-item">
                        <span>⏱️</span>
                        <span>${bus.duration}</span>
                    </div>
                    <div class="detail-item">
                        <span>💺</span>
                        <span>${bus.availableSeatsForDate !== undefined ? bus.availableSeatsForDate : bus.availableSeats} seats available</span>
                        ${bus.bookedSeatsCount > 0 ? `<small style="display: block; color: #666; font-size: 12px; margin-top: 2px;">${bus.bookedSeatsCount} seat(s) already booked</small>` : ''}
                    </div>
                    <div class="detail-item">
                        <span>🛣️</span>
                        <span>${bus.busType}</span>
                    </div>
                </div>
            </div>
            <div class="enterprise-name-section" style="display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 15px; background: linear-gradient(135deg, #D4AF37 0%, #C9A961 100%); color: #000000; border-radius: 8px; font-weight: 600; font-size: 14px; letter-spacing: 0.5px; width: 100%; align-self: stretch;">
                ${bus.enterpriseName || 'Bus Service'}
            </div>
            <div class="bus-price-section">
                <div class="price">₹${formatPrice(bus.seaterPrice || bus.price)} - ₹${formatPrice(bus.sleeperPrice || (bus.price + 600))}</div>
                <div class="price-label">Seater - Sleeper</div>
                <button class="btn-book" onclick="bookBus(${bus.busId || bus.id}, '${searchData.date}', ${searchData.passengers})">
                    Book Now
                </button>
            </div>
        `;
        resultsDiv.appendChild(busCard);
    });
}

// Show warning message when no single bus has enough seats
function showSeatAvailabilityWarning(warning, searchData) {
    // Remove existing warning if any
    const existingWarning = document.getElementById('seatAvailabilityWarning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    const warningDiv = document.createElement('div');
    warningDiv.id = 'seatAvailabilityWarning';
    warningDiv.style.cssText = `
        background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%);
        border: 2px solid #ffc107;
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
        box-shadow: 0 4px 15px rgba(255, 193, 7, 0.3);
    `;
    
    let warningHTML = `
        <div style="display: flex; align-items: start; gap: 15px;">
            <div style="font-size: 32px;">⚠️</div>
            <div style="flex: 1;">
                <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 18px;">Seat Availability Notice</h3>
                <p style="margin: 0 0 15px 0; color: #856404; font-size: 14px; line-height: 1.6;">
                    ${warning.message}
                </p>
    `;
    
    if (warning.totalAvailableSeats >= warning.requestedSeats) {
        warningHTML += `
                <div style="background: white; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <p style="margin: 0 0 10px 0; color: #333; font-weight: 600; font-size: 14px;">
                        💡 <strong>Solution:</strong> You can book seats from multiple buses to accommodate all ${warning.requestedSeats} passengers.
                    </p>
                    <p style="margin: 0; color: #666; font-size: 13px;">
                        Total available seats: <strong>${warning.totalAvailableSeats}</strong> | Required: <strong>${warning.requestedSeats}</strong>
                    </p>
                </div>
                <div style="background: white; border-radius: 8px; padding: 15px;">
                    <p style="margin: 0 0 10px 0; color: #333; font-weight: 600; font-size: 14px;">Available Buses:</p>
                    <div style="display: grid; gap: 10px;">
        `;
        
        warning.availableBuses.forEach((bus, index) => {
            warningHTML += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f9f9f9; border-radius: 6px; border-left: 3px solid #ffc107;">
                            <div>
                                <strong style="color: #333; font-size: 14px;">${bus.enterpriseName || 'Bus Service'} - ${bus.busName}</strong>
                                <div style="font-size: 12px; color: #666; margin-top: 3px;">
                                    ${bus.from} → ${bus.to} | ${formatTime(bus.departureTime)} - ${formatTime(bus.arrivalTime)}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: #C9A961; font-weight: 600; font-size: 16px;">${bus.availableSeats} seats</div>
                                <button onclick="bookBus(${bus.busId}, '${searchData.date}', ${bus.availableSeats})" 
                                        style="margin-top: 5px; padding: 6px 15px; background: #C9A961; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 600; transition: background 0.3s;"
                                        onmouseover="this.style.background='#B8860B'" 
                                        onmouseout="this.style.background='#C9A961'">
                                    Book ${bus.availableSeats} seat${bus.availableSeats > 1 ? 's' : ''}
                                </button>
                            </div>
                        </div>
            `;
        });
        
        warningHTML += `
                    </div>
                </div>
        `;
    } else {
        warningHTML += `
                <div style="background: #ffebee; border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #f44336;">
                    <p style="margin: 0; color: #c62828; font-size: 14px;">
                        <strong>Insufficient Seats:</strong> Only ${warning.totalAvailableSeats} seat(s) available across all buses, but you need ${warning.requestedSeats}.
                    </p>
                </div>
                <div style="background: white; border-radius: 8px; padding: 15px;">
                    <p style="margin: 0 0 10px 0; color: #333; font-weight: 600; font-size: 14px;">Available Buses:</p>
                    <div style="display: grid; gap: 10px;">
        `;
        
        warning.availableBuses.forEach((bus) => {
            warningHTML += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f9f9f9; border-radius: 6px; border-left: 3px solid #ffc107;">
                            <div>
                                <strong style="color: #333; font-size: 14px;">${bus.enterpriseName || 'Bus Service'} - ${bus.busName}</strong>
                                <div style="font-size: 12px; color: #666; margin-top: 3px;">
                                    ${bus.from} → ${bus.to} | ${formatTime(bus.departureTime)} - ${formatTime(bus.arrivalTime)}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: #C9A961; font-weight: 600; font-size: 16px;">${bus.availableSeats} seats</div>
                                <button onclick="bookBus(${bus.busId}, '${searchData.date}', ${bus.availableSeats})" 
                                        style="margin-top: 5px; padding: 6px 15px; background: #C9A961; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 600; transition: background 0.3s;"
                                        onmouseover="this.style.background='#B8860B'" 
                                        onmouseout="this.style.background='#C9A961'">
                                    Book ${bus.availableSeats} seat${bus.availableSeats > 1 ? 's' : ''}
                                </button>
                            </div>
                        </div>
            `;
        });
        
        warningHTML += `
                    </div>
                </div>
        `;
    }
    
    warningHTML += `
            </div>
        </div>
    `;
    
    warningDiv.innerHTML = warningHTML;
    
    // Insert warning before bus results
    const busResults = document.getElementById('busResults');
    if (busResults) {
        busResults.parentNode.insertBefore(warningDiv, busResults);
    }
}

// Book bus function
function bookBus(busId, date, passengers) {
    // Store booking data
    const bookingData = {
        busId,
        date,
        passengers
    };
    
    // Redirect to booking page 
    localStorage.setItem('bookingData', JSON.stringify(bookingData));
    const userConfirmed = confirm('Are you sure you want to book this bus?');
    if (userConfirmed) {
        window.location.href = '/customer/booking.html';
    } else {
        return;
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

