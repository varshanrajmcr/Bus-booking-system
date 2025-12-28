// Email validation function
export function validateEmailFormat(email) {
    const errors = [];
    
    if (!email || email.trim() === '') {
        errors.push('Email is required');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    // Check for @ symbol
    if (!email.includes('@')) {
        errors.push('Email must contain @ symbol');
    }
    
    // Check for valid domain (must have .com, .org, .net, etc.)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        if (!errors.includes('Email must contain @ symbol')) {
            errors.push('Email must have a valid domain (e.g., .com, .org, .net)');
        }
    }
    
    // Check for valid email format
    const strictEmailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!strictEmailRegex.test(email)) {
        if (errors.length === 0) {
            errors.push('Email format is invalid');
        }
    }
    
    // Check that @ is not at the beginning or end
    if (email.startsWith('@') || email.endsWith('@')) {
        errors.push('Email cannot start or end with @ symbol');
    }
    
    // Check that there's text before @
    const atIndex = email.indexOf('@');
    if (atIndex <= 0) {
        errors.push('Email must have text before @ symbol');
    }
    
    // Check that there's text after @
    if (atIndex >= email.length - 1) {
        errors.push('Email must have text after @ symbol');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Full name validation function
export function validateFullName(fullName) {
    const errors = [];
    
    if (!fullName || fullName.trim() === '') {
        errors.push('Full name is required');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const trimmed = fullName.trim();
    if (trimmed.length < 2) {
        errors.push('Full name must be at least 2 characters long');
    }
    if (trimmed.length > 100) {
        errors.push('Full name must not exceed 100 characters');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Phone validation function
export function validatePhone(phone) {
    const errors = [];
    
    if (!phone || phone.trim() === '') {
        errors.push('Phone is required');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone.trim())) {
        errors.push('Phone must be exactly 10 digits');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Password validation function
export function validatePasswordStrength(password) {
    const errors = [];
    
    // Minimum 8 characters
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    
    // At least one number
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    // At least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    }
    
    // At least one uppercase letter
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    // At least one lowercase letter
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Location validation function
export function validateLocation(location, fieldName) {
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
export function validateTravelDate(date) {
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
export function validatePassengers(passengers) {
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

// Enterprise name validation function
export function validateEnterpriseName(enterpriseName) {
    const errors = [];
    
    if (!enterpriseName || enterpriseName.trim() === '') {
        errors.push('Enterprise name is required');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const trimmed = enterpriseName.trim();
    if (trimmed.length < 2) {
        errors.push('Enterprise name must be at least 2 characters long');
    }
    if (trimmed.length > 50) {
        errors.push('Enterprise name must not exceed 50 characters');
    }
    
    const nameRegex = /^[a-zA-Z\s-]+$/;
    if (!nameRegex.test(trimmed)) {
        errors.push('Enterprise name must contain only letters, spaces, and hyphens');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Bus name validation function
export function validateBusName(busName) {
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

// Time validation function
export function validateTime(time, fieldName) {
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

// Duration validation function
export function validateDuration(duration) {
    const errors = [];
    
    if (!duration || duration.trim() === '') {
        errors.push('Duration is required');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    const trimmed = duration.trim();
    // More flexible regex to match "Xh Ym" format
    const durationRegex = /^\d+h\s\d+m$/;
    if (!durationRegex.test(trimmed)) {
        errors.push('Duration must be in format "Xh Ym" (e.g., "4h 30m")');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Price validation function
export function validatePrice(price, fieldName, min = 0, max = 100000) {
    const errors = [];
    
    if (price === undefined || price === null || price === '') {
        errors.push(`${fieldName} is required`);
        return {
            isValid: false,
            errors: errors,
            value: null
        };
    }
    
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) {
        errors.push(`${fieldName} must be a valid number`);
        return {
            isValid: false,
            errors: errors,
            value: null
        };
    }
    
    if (numPrice < min) {
        errors.push(`${fieldName} must be at least ${min}`);
    }
    if (numPrice > max) {
        errors.push(`${fieldName} must not exceed ${max}`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        value: numPrice
    };
}

// Bus type validation function
export function validateBusType(busType) {
    const errors = [];
    const validTypes = ['AC Seater/Sleeper', 'Non-AC Seater/Sleeper'];
    
    if (!busType || busType.trim() === '') {
        errors.push('Bus type is required');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    if (!validTypes.includes(busType.trim())) {
        errors.push(`Bus type must be one of: ${validTypes.join(', ')}`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Total seats validation function
export function validateTotalSeats(totalSeats) {
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
        errors.push('Total seats must be a valid number');
        return {
            isValid: false,
            errors: errors
        };
    }
    
    if (numSeats < 1) {
        errors.push('Total seats must be at least 1');
    }
    if (numSeats > 50) {
        errors.push('Total seats must not exceed 50');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Passenger name validation function (only letters and periods)
export function validatePassengerName(name) {
    if (!name || name.trim() === '') {
        return false;
    }
    // Allow only letters (a-z, A-Z) and periods (.)
    const nameRegex = /^[a-zA-Z. ]+$/;
    return nameRegex.test(name) && name.trim().length > 0;
}

