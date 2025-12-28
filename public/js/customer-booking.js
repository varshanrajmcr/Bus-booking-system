let selectedSeats = [];
let busData = null;
let bookingData = null;
let maxSeats = 0;
let seatPrice = 0;
let currentPassengerIndex = 1;
let passengerData = [];

// Initialize booking page
document.addEventListener('DOMContentLoaded', async () => {
    // Check session and load user name
    try {
        const sessionResponse = await fetch('/api/session', {
            credentials: 'include'
        });
        const sessionData = await sessionResponse.json();
        
        if (sessionData.authenticated && sessionData.user.userType === 'customer') {
            document.getElementById('userName').textContent = `Welcome, ${sessionData.user.fullName || 'User'}`;
        } else {
            alert('Please login to continue');
            window.location.href = '/customer/login.html';
            return;
        }
    } catch (error) {
        console.error('Error checking session:', error);
        window.location.href = '/customer/login.html';
        return;
    }
    
    // Get booking data from localStorage
    bookingData = JSON.parse(localStorage.getItem('bookingData') || '{}');
    
    if (!bookingData.busId) {
        showError('No bus selected. Please search and select a bus first.');
        setTimeout(() => {
            window.location.href = '/customer/dashboard.html';
        }, 2000);
        return;
    }
    
    // Fetch bus details
    try {
        const response = await fetch(`/api/buses/${bookingData.busId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok && data.bus) {
            busData = data.bus;
            // Use seaterPrice as base price (sleeper will be +600)
            seatPrice = busData.seaterPrice || busData.price || 0;
            maxSeats = bookingData.passengers || 1;
            
            displayBookingInfo();
            await initializeSeatLayout();
            // Initialize passenger data but don't show form until seats are selected
            initializePassengerData();
            document.getElementById('passengerFields').innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Please select your seats first</p>';
            document.getElementById('nextButton').style.display = 'none';
            document.getElementById('bookButton').style.display = 'none';
        } else {
            showError('Bus not found. Please try again.');
        }
    } catch (error) {
        showError('Error loading bus details. Please try again.');
        console.error('Error:', error);
    }
});

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

// Display booking information
function displayBookingInfo() {
    const infoDiv = document.getElementById('bookingInfo');
    // Format bus name with enterprise name
    const busDisplayName = busData.enterpriseName 
        ? `${busData.enterpriseName} - ${busData.busName}`
        : busData.busName;
    
    infoDiv.innerHTML = `
        <div class="booking-info-item">
            <div class="booking-info-label">Bus Name</div>
            <div class="booking-info-value">${busDisplayName}</div>
        </div>
        <div class="booking-info-item">
            <div class="booking-info-label">Route</div>
            <div class="booking-info-value">${busData.from} → ${busData.to}</div>
        </div>
        <div class="booking-info-item">
            <div class="booking-info-label">Date</div>
            <div class="booking-info-value">${formatDate(bookingData.date)}</div>
        </div>
        <div class="booking-info-item">
            <div class="booking-info-label">Time</div>
            <div class="booking-info-value">${formatTime(busData.departureTime)}</div>
        </div>
        <div class="booking-info-item">
            <div class="booking-info-label">Price</div>
            <div class="booking-info-value">₹${formatPrice(busData.seaterPrice || seatPrice)} (Seater) / ₹${formatPrice(busData.sleeperPrice || (seatPrice + 600))} (Sleeper)</div>
        </div>
        <div class="booking-info-item">
            <div class="booking-info-label">Seats to Book</div>
            <div class="booking-info-value">${maxSeats}</div>
        </div>
    `;
}

// Initialize seat layout
async function initializeSeatLayout() {
    const seatGrid = document.getElementById('seatGrid');
    seatGrid.innerHTML = '';
    
    // Fetch already booked seats and locked seats for this bus and date
    let occupiedSeats = [];
    let lockedSeats = [];
    try {
        // Ensure date is properly formatted (YYYY-MM-DD)
        const dateParam = encodeURIComponent(bookingData.date);
        const response = await fetch(`/api/bookings/seats/${bookingData.busId}/${dateParam}`, {
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            occupiedSeats = data.bookedSeats || [];
            lockedSeats = data.lockedSeats || [];
            console.log('Booked seats for bus', bookingData.busId, 'on', bookingData.date, ':', occupiedSeats);
            console.log('Locked seats for bus', bookingData.busId, 'on', bookingData.date, ':', lockedSeats);
        } else {
            console.error('Failed to fetch booked seats:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error fetching booked seats:', error);
    }
    
    // Create sleeper section (left - 2 columns × 6 rows)
    const sleeperSection = document.createElement('div');
    sleeperSection.className = 'sleeper-section';
    
    // Create walking space
    const walkingSpace = document.createElement('div');
    walkingSpace.className = 'walking-space';
    
    // Create seater section (right - 2 columns × 10 rows)
    const seaterSection = document.createElement('div');
    seaterSection.className = 'seater-section';
    
    // Use busData.totalSeats if available, otherwise default to 32
    const totalSeats = busData.totalSeats || 32;
    // Calculate sleeper and seater seats based on totalSeats
    // For now, keep the same ratio: 12 sleeper, rest seater (minimum 20 seater)
    const sleeperSeats = Math.min(12, Math.floor(totalSeats * 0.375)); // ~37.5% sleeper
    const seaterSeats = totalSeats - sleeperSeats;
    
    // Generate sleeper seats (1 to sleeperSeats)
    for (let i = 1; i <= sleeperSeats; i++) {
        const seat = document.createElement('div');
        seat.className = 'seat sleeper';
        seat.textContent = i;
        seat.dataset.seatNumber = i;
        seat.dataset.seatType = 'sleeper';
        
        // Check if seat is occupied (handle both number and string comparisons)
        const isOccupied = occupiedSeats.some(seatNum => seatNum === i || parseInt(seatNum) === i);
        const isLocked = lockedSeats.some(seatNum => seatNum === i || parseInt(seatNum) === i);
        
        if (isOccupied) {
            seat.classList.add('occupied');
            seat.title = 'This seat is already booked';
        } else if (isLocked) {
            seat.classList.add('locked');
            seat.title = 'This seat is temporarily reserved by another user';
        } else {
            seat.classList.add('available');
            seat.addEventListener('click', () => toggleSeat(i, seat));
        }
        
        sleeperSection.appendChild(seat);
    }
    
    // Generate seater seats (sleeperSeats+1 to totalSeats)
    for (let i = sleeperSeats + 1; i <= totalSeats; i++) {
        const seat = document.createElement('div');
        seat.className = 'seat seater';
        seat.textContent = i;
        seat.dataset.seatNumber = i;
        seat.dataset.seatType = 'seater';
        
        // Check if seat is occupied (handle both number and string comparisons)
        const isOccupied = occupiedSeats.some(seatNum => seatNum === i || parseInt(seatNum) === i);
        const isLocked = lockedSeats.some(seatNum => seatNum === i || parseInt(seatNum) === i);
        
        if (isOccupied) {
            seat.classList.add('occupied');
            seat.title = 'This seat is already booked';
        } else if (isLocked) {
            seat.classList.add('locked');
            seat.title = 'This seat is temporarily reserved by another user';
        } else {
            seat.classList.add('available');
            seat.addEventListener('click', () => toggleSeat(i, seat));
        }
        
        seaterSection.appendChild(seat);
    }
    
    // Append sections to grid
    seatGrid.appendChild(sleeperSection);
    seatGrid.appendChild(walkingSpace);
    seatGrid.appendChild(seaterSection);
}

// Generate random occupied seats (for demo purposes)
function generateOccupiedSeats(totalSeats, availableSeats) {
    const occupied = [];
    const occupiedCount = totalSeats - availableSeats;
    
    while (occupied.length < occupiedCount) {
        const randomSeat = Math.floor(Math.random() * totalSeats) + 1;
        if (!occupied.includes(randomSeat)) {
            occupied.push(randomSeat);
        }
    }
    
    return occupied;
}

// Toggle seat selection
function toggleSeat(seatNumber, seatElement) {
    // Prevent selecting occupied seats
    if (seatElement.classList.contains('occupied')) {
        alert('This seat is already booked. Please select a different seat.');
        return;
    }
    
    // Prevent selecting locked seats
    if (seatElement.classList.contains('locked')) {
        alert('This seat is temporarily reserved by another user. Please select a different seat or try again in a few moments.');
        return;
    }
    
    // Track seat selection
    if (window.routeTracker && busData) {
        window.routeTracker.trackSeatSelection(busData.busId || busData.id, [seatNumber]);
    }
    
    const index = selectedSeats.indexOf(seatNumber);
    
    if (index > -1) {
        // Deselect seat
        selectedSeats.splice(index, 1);
        seatElement.classList.remove('selected');
        seatElement.classList.add('available');
    } else {
        // Select seat (if under limit)
        if (selectedSeats.length < maxSeats) {
            selectedSeats.push(seatNumber);
            seatElement.classList.remove('available');
            seatElement.classList.add('selected');
        } else {
            alert(`You can only select ${maxSeats} seat(s) as per your search.`);
        }
    }
    
    updateSeatInfo();
    updateBookButton();
}

// Update seat information display
function updateSeatInfo() {
    const selectedSeatsSpan = document.getElementById('selectedSeats');
    const totalAmountSpan = document.getElementById('totalAmount');
    
    if (selectedSeats.length > 0) {
        selectedSeatsSpan.textContent = selectedSeats.sort((a, b) => a - b).join(', ');
        
        // Calculate total amount: use seaterPrice and sleeperPrice from bus data
        let totalAmount = 0;
        // Ensure prices are numbers, not strings
        const seaterPrice = parseFloat(busData.seaterPrice || seatPrice || 0);
        const sleeperPrice = parseFloat(busData.sleeperPrice || (seatPrice + 600) || 0);
        
        selectedSeats.forEach(seatNum => {
            const seatElement = document.querySelector(`[data-seat-number="${seatNum}"]`);
            const seatType = seatElement?.dataset.seatType;
            if (seatType === 'sleeper') {
                totalAmount += sleeperPrice;
            } else {
                totalAmount += seaterPrice;
            }
        });
        
        totalAmountSpan.textContent = `₹${formatPrice(totalAmount)}`;
        
        // If all seats are selected, show passenger form
        if (selectedSeats.length === maxSeats) {
            // Check if passenger form is already shown
            const passengerFields = document.getElementById('passengerFields');
            if (!passengerFields.querySelector('#passenger_name')) {
                showPassengerForm(1);
            }
        }
    } else {
        selectedSeatsSpan.textContent = 'None';
        totalAmountSpan.textContent = '₹0';
    }
}

// Initialize passenger data array
function initializePassengerData() {
    passengerData = [];
    const sortedSeats = [...selectedSeats].sort((a, b) => a - b);
    for (let i = 0; i < maxSeats; i++) {
        passengerData.push({
            name: '',
            age: '',
            gender: '',
            seatNumber: sortedSeats[i] ? parseInt(sortedSeats[i]) : null
        });
    }
}

// Generate passenger fields (show one at a time)
function generatePassengerFields() {
    initializePassengerData();
    updatePassengerCounter();
    showPassengerForm(1);
    updateNavigationButtons();
}

// Show passenger form for specific index
function showPassengerForm(passengerIndex) {
    const passengerFields = document.getElementById('passengerFields');
    const passenger = passengerData[passengerIndex - 1];
    const sortedSeats = [...selectedSeats].sort((a, b) => a - b);
    
    passengerFields.innerHTML = `
        <div class="passenger-field">
            <div class="passenger-number">Passenger ${passengerIndex} - Seat ${sortedSeats[passengerIndex - 1] || 'Not Selected'}</div>
            <label for="passenger_name">Full Name</label>
            <input type="text" id="passenger_name" name="passenger_name" required placeholder="Enter passenger name (letters and periods only)" value="${passenger.name || ''}" pattern="[a-zA-Z. ]+" title="Only letters and periods are allowed">
            <small id="nameError" style="color: #ff6b6b; display: none; font-size: 12px; margin-top: 5px;">Name should contain only letters (a-z, A-Z) and periods (.)</small>
            <label for="passenger_age" style="margin-top: 10px;">Age</label>
            <input type="number" id="passenger_age" name="passenger_age" required min="1" max="120" placeholder="Enter age" value="${passenger.age || ''}">
            <label for="passenger_gender" style="margin-top: 10px;">Gender</label>
            <select id="passenger_gender" name="passenger_gender" required style="width: 100%; padding: 12px 15px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px;">
                <option value="">Select Gender</option>
                <option value="Male" ${passenger.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option value="Female" ${passenger.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option value="Other" ${passenger.gender === 'Other' ? 'selected' : ''}>Other</option>
            </select>
        </div>
    `;
    
    // Add real-time validation for passenger name
    const nameInput = document.getElementById('passenger_name');
    const nameError = document.getElementById('nameError');
    if (nameInput) {
        nameInput.addEventListener('input', function() {
            const name = this.value.trim();
            if (name && !validatePassengerName(name)) {
                nameError.style.display = 'block';
                this.style.borderColor = '#ff6b6b';
            } else {
                nameError.style.display = 'none';
                this.style.borderColor = '';
            }
        });
    }
    
    currentPassengerIndex = passengerIndex;
    updatePassengerCounter();
    updateNavigationButtons();
}

// Update passenger counter
function updatePassengerCounter() {
    document.getElementById('currentPassenger').textContent = currentPassengerIndex;
    document.getElementById('totalPassengers').textContent = maxSeats;
}

// Save current passenger data
function saveCurrentPassengerData() {
    const name = document.getElementById('passenger_name')?.value.trim() || '';
    const age = document.getElementById('passenger_age')?.value || '';
    const gender = document.getElementById('passenger_gender')?.value || '';
    // Get the corresponding seat number for this passenger
    const sortedSeats = [...selectedSeats].sort((a, b) => a - b);
    const seatNumber = sortedSeats[currentPassengerIndex - 1] || null;
    
    if (name || age || gender) {
        passengerData[currentPassengerIndex - 1] = {
            name,
            age,
            gender,
            seatNumber: seatNumber ? parseInt(seatNumber) : null
        };
    }
}

// Validate passenger name (only letters and periods)
function validatePassengerName(name) {
    // Allow only letters (a-z, A-Z) and periods (.)
    const nameRegex = /^[a-zA-Z. ]+$/;
    return nameRegex.test(name) && name.trim().length > 0;
}

// Show next passenger
function showNextPassenger() {
    // Validate current form
    const name = document.getElementById('passenger_name')?.value.trim();
    const age = document.getElementById('passenger_age')?.value;
    const gender = document.getElementById('passenger_gender')?.value;
    
    if (!name || !age || !gender) {
        alert('Please fill all details for this passenger before proceeding.');
        return;
    }
    
    // Validate passenger name format
    if (!validatePassengerName(name)) {
        alert('Passenger name should contain only letters (a-z, A-Z) and periods (.). No numbers or special characters allowed.');
        document.getElementById('passenger_name').focus();
        return;
    }
    
    // Save current passenger data
    saveCurrentPassengerData();
    
    // Move to next passenger
    if (currentPassengerIndex < maxSeats) {
        showPassengerForm(currentPassengerIndex + 1);
    }
}

// Show previous passenger
function showPreviousPassenger() {
    // Save current passenger data
    saveCurrentPassengerData();
    
    // Move to previous passenger
    if (currentPassengerIndex > 1) {
        showPassengerForm(currentPassengerIndex - 1);
    }
}

// Update navigation buttons visibility
function updateNavigationButtons() {
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const bookButton = document.getElementById('bookButton');
    
    // Show/hide previous button
    if (currentPassengerIndex > 1) {
        prevButton.style.display = 'block';
    } else {
        prevButton.style.display = 'none';
    }
    
    // Show/hide next or book button
    if (currentPassengerIndex < maxSeats) {
        nextButton.style.display = 'block';
        bookButton.style.display = 'none';
    } else {
        nextButton.style.display = 'none';
        // Only show book button if seats are selected
        if (selectedSeats.length === maxSeats) {
            bookButton.style.display = 'block';
        }
    }
}

// Update book button state
function updateBookButton() {
    updateNavigationButtons();
}

// Handle form submission
document.getElementById('passengerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Save current passenger data before submitting
    saveCurrentPassengerData();
    
    if (selectedSeats.length !== maxSeats) {
        alert(`Please select exactly ${maxSeats} seat(s).`);
        return;
    }
    
    // Validate booking data
    if (!bookingData.busId) {
        alert('Bus ID is required');
        return;
    }
    
    const busIdNum = parseInt(bookingData.busId);
    if (isNaN(busIdNum) || busIdNum < 1) {
        alert('Invalid bus ID');
        return;
    }
    
    // Validate date
    if (!bookingData.date) {
        alert('Travel date is required');
        return;
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(bookingData.date)) {
        alert('Date must be in YYYY-MM-DD format');
        return;
    }
    
    const travelDate = new Date(bookingData.date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(travelDate.getTime())) {
        alert('Invalid date');
        return;
    }
    
    if (travelDate < today) {
        alert('Travel date cannot be in the past');
        return;
    }
    
    // Validate seats array
    if (!Array.isArray(selectedSeats) || selectedSeats.length === 0) {
        alert('Please select at least one seat');
        return;
    }
    
    if (selectedSeats.length > 10) {
        alert('Maximum 10 seats can be booked at once');
        return;
    }
    
    // Validate each seat number
    const totalSeats = busData.totalSeats || 50; // Use bus totalSeats, default to 50 if not available
    const seatNumbers = [];
    for (let i = 0; i < selectedSeats.length; i++) {
        const seatNum = parseInt(selectedSeats[i]);
        if (isNaN(seatNum) || seatNum < 1 || seatNum > totalSeats) {
            alert(`Seat ${i + 1} must be a number between 1 and ${totalSeats}`);
            return;
        }
        seatNumbers.push(seatNum);
    }
    
    // Check for duplicate seats
    const uniqueSeats = [...new Set(seatNumbers)];
    if (uniqueSeats.length !== selectedSeats.length) {
        alert('Duplicate seat numbers are not allowed');
        return;
    }
    
    // Validate passengers array length matches seats
    if (passengerData.length !== selectedSeats.length) {
        alert('Number of passengers must match number of seats');
        return;
    }
    
    // Validate all passenger details
    for (let i = 0; i < passengerData.length; i++) {
        const passenger = passengerData[i];
        
        // Check required fields
        if (!passenger.name || !passenger.age || !passenger.gender) {
            alert(`Please fill all details for Passenger ${i + 1}.`);
            showPassengerForm(i + 1);
            return;
        }
        
        // Validate passenger name format
        if (!validatePassengerName(passenger.name)) {
            alert(`Passenger ${i + 1}: Name should contain only letters (a-z, A-Z) and periods (.). No numbers or special characters allowed.`);
            showPassengerForm(i + 1);
            document.getElementById('passenger_name').focus();
            return;
        }
        
        // Validate age
        const age = parseInt(passenger.age);
        if (isNaN(age) || age < 1 || age > 120) {
            alert(`Passenger ${i + 1}: Age must be between 1 and 120`);
            showPassengerForm(i + 1);
            return;
        }
        
        // Validate gender
        const validGenders = ['Male', 'Female', 'Other'];
        if (!validGenders.includes(passenger.gender)) {
            alert(`Passenger ${i + 1}: Gender must be one of: ${validGenders.join(', ')}`);
            showPassengerForm(i + 1);
            return;
        }
        
        // Validate seat number matches
        const totalSeats = busData.totalSeats || 50; // Use bus totalSeats, default to 50 if not available
        const sortedSeats = [...selectedSeats].sort((a, b) => a - b);
        const expectedSeatNumber = sortedSeats[i] ? parseInt(sortedSeats[i]) : null;
        
        // If seatNumber is not set in passenger data, use the expected seat from selectedSeats
        let passengerSeatNum = passenger.seatNumber ? parseInt(passenger.seatNumber) : expectedSeatNumber;
        
        // If still no seat number, use the expected one
        if (!passengerSeatNum || isNaN(passengerSeatNum)) {
            if (expectedSeatNumber) {
                passenger.seatNumber = expectedSeatNumber;
                passengerSeatNum = expectedSeatNumber;
            } else {
                alert(`Passenger ${i + 1}: No seat assigned. Please select seats first.`);
                return;
            }
        }
        
        // Validate seat number is within valid range
        if (passengerSeatNum < 1 || passengerSeatNum > totalSeats) {
            alert(`Passenger ${i + 1}: Seat number must be between 1 and ${totalSeats}`);
            showPassengerForm(i + 1);
            return;
        }
        
        // Check if passenger seat number matches selected seat
        if (!selectedSeats.includes(passengerSeatNum)) {
            alert(`Passenger ${i + 1}: Seat number does not match selected seat`);
            showPassengerForm(i + 1);
            return;
        }
    }
    
    // Collect passenger details
    const passengers = [];
    let totalAmount = 0;
    // Ensure prices are numbers, not strings
    const seaterPrice = parseFloat(busData.seaterPrice || seatPrice || 0);
    const sleeperPrice = parseFloat(busData.sleeperPrice || (seatPrice + 600) || 0);
    
    for (let i = 0; i < passengerData.length; i++) {
        const seatNum = selectedSeats[i];
        const seatElement = document.querySelector(`[data-seat-number="${seatNum}"]`);
        const seatType = seatElement?.dataset.seatType;
        const seatPriceForThis = parseFloat(seatType === 'sleeper' ? sleeperPrice : seaterPrice);
        
        passengers.push({
            name: passengerData[i].name,
            age: parseInt(passengerData[i].age),
            gender: passengerData[i].gender,
            seatNumber: seatNum,
            seatType: seatType,
            price: seatPriceForThis
        });
        
        totalAmount += seatPriceForThis;
    }
    
    // Ensure totalAmount is a number
    totalAmount = parseFloat(totalAmount.toFixed(2));
    
    // Prepare booking data (customerId will come from session)
    const bookingPayload = {
        busId: bookingData.busId,
        date: bookingData.date,
        seats: selectedSeats.sort((a, b) => a - b),
        passengers: passengers,
        totalAmount: totalAmount
    };
    
    try {
        // Track booking attempt
        if (window.routeTracker) {
            window.routeTracker.trackAction('booking_attempt', {
                busId: busData.busId || busData.id,
                seatCount: selectedSeats.length,
                totalAmount: totalAmount
            });
        }
        
        const response = await fetch('/api/bookings/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(bookingPayload)
        });
        
        const data = await response.json();
        
        // Check if session was terminated
        if (data.sessionTerminated || (data.error === 'Session terminated')) {
            alert(data.message || 'Another user has logged into this account. Please login again.');
            window.location.href = '/customer/login.html';
            return;
        }
        
        if (response.ok) {
            alert('Booking confirmed! Your booking ID is: ' + data.bookingId);
            localStorage.removeItem('bookingData');
            window.location.href = '/customer/dashboard.html';
        } else if (response.status === 401 || response.status === 403) {
            alert('Session expired. Please login again.');
            window.location.href = '/customer/login.html';
        } else {
            showError(data.error || 'Booking failed. Please try again.');
        }
    } catch (error) {
        showError('An error occurred. Please try again.');
        console.error('Error:', error);
    }
});

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Go back to dashboard
function goBackToDashboard() {
    window.location.href = '/customer/dashboard.html';
}

// Logout function
async function logout() {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        localStorage.removeItem('bookingData');
        window.location.href = '/customer/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        localStorage.removeItem('bookingData');
        window.location.href = '/customer/login.html';
    }
}

