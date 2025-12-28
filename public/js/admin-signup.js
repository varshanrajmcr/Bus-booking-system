// Full name validation function
function validateFullName(fullName) {
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
function validatePhone(phone) {
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

// Enterprise name validation function
function validateEnterpriseName(enterpriseName) {
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

// Email validation function
function validateEmailFormat(email) {
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

// Password validation function
function validatePasswordStrength(password) {
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

// Real-time password validation feedback
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('password');
    const passwordRequirements = document.getElementById('passwordRequirements');
    
    if (passwordInput && passwordRequirements) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const validation = validatePasswordStrength(password);
            
            // Update requirement indicators
            updateRequirement('req-length', password.length >= 8);
            updateRequirement('req-number', /\d/.test(password));
            updateRequirement('req-special', /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password));
            updateRequirement('req-upper', /[A-Z]/.test(password));
            updateRequirement('req-lower', /[a-z]/.test(password));
        });
    }
});

function updateRequirement(id, isValid) {
    const element = document.getElementById(id);
    if (element) {
        if (isValid) {
            element.classList.add('valid');
            element.classList.remove('invalid');
        } else {
            element.classList.add('invalid');
            element.classList.remove('valid');
        }
    }
}

document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const formData = {
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        enterpriseName: document.getElementById('enterpriseName').value.trim(),
        adminKey: document.getElementById('adminKey').value,
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        userType: 'admin'
    };
    
    // Full name validation
    const fullNameValidation = validateFullName(formData.fullName);
    if (!fullNameValidation.isValid) {
        errorDiv.innerHTML = '<strong>Invalid full name:</strong><ul>' + 
            fullNameValidation.errors.map(err => '<li>' + err + '</li>').join('') + 
            '</ul>';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Email validation
    const emailValidation = validateEmailFormat(formData.email);
    if (!emailValidation.isValid) {
        errorDiv.innerHTML = '<strong>Invalid email format:</strong><ul>' + 
            emailValidation.errors.map(err => '<li>' + err + '</li>').join('') + 
            '</ul>';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Phone validation
    const phoneValidation = validatePhone(formData.phone);
    if (!phoneValidation.isValid) {
        errorDiv.innerHTML = '<strong>Invalid phone number:</strong><ul>' + 
            phoneValidation.errors.map(err => '<li>' + err + '</li>').join('') + 
            '</ul>';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Enterprise name validation
    const enterpriseNameValidation = validateEnterpriseName(formData.enterpriseName);
    if (!enterpriseNameValidation.isValid) {
        errorDiv.innerHTML = '<strong>Invalid enterprise name:</strong><ul>' + 
            enterpriseNameValidation.errors.map(err => '<li>' + err + '</li>').join('') + 
            '</ul>';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Admin key validation
    if (!formData.adminKey || formData.adminKey.trim() === '') {
        errorDiv.textContent = 'Admin key is required!';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Password match validation
    if (formData.password !== formData.confirmPassword) {
        errorDiv.textContent = 'Passwords do not match!';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Password strength validation
    const passwordValidation = validatePasswordStrength(formData.password);
    if (!passwordValidation.isValid) {
        errorDiv.innerHTML = '<strong>Password does not meet requirements:</strong><ul>' + 
            passwordValidation.errors.map(err => '<li>' + err + '</li>').join('') + 
            '</ul>';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/admin/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            successDiv.textContent = data.message || 'Admin signup successful! Redirecting...';
            successDiv.style.display = 'block';
            setTimeout(() => {
                window.location.href = '/admin/login.html';
            }, 2000);
        } else {
            errorDiv.textContent = data.error || 'Signup failed. Please check your admin key.';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.style.display = 'block';
        console.error('Error:', error);
    }
});

