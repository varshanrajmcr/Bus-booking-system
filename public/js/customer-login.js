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

// Check if already logged in on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const sessionResponse = await fetch('/api/session', {
            credentials: 'include'
        });
        const sessionData = await sessionResponse.json();
        
        if (sessionData.authenticated && sessionData.user.userType === 'customer') {
            // Already logged in, redirect to dashboard
            window.location.href = '/customer/dashboard.html';
        }
    } catch (error) {
        console.error('Error checking session:', error);
        // Continue with login form if check fails
    }
});

// Check for message in URL parameters (for session termination)
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    if (message) {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.textContent = decodeURIComponent(message);
            errorDiv.style.display = 'block';
        }
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const formData = {
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        userType: 'customer'
    };
    
    // Email validation
    const emailValidation = validateEmailFormat(formData.email);
    if (!emailValidation.isValid) {
        errorDiv.innerHTML = '<strong>Invalid email format:</strong><ul>' + 
            emailValidation.errors.map(err => '<li>' + err + '</li>').join('') + 
            '</ul>';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Password validation
    if (!formData.password || formData.password.trim() === '') {
        errorDiv.textContent = 'Password is required';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/customer/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store JWT tokens if provided
            if (data.tokens) {
                if (typeof storeTokens === 'function') {
                    storeTokens(data.tokens.accessToken, data.tokens.refreshToken);
                } else {
                    // Fallback: load jwtUtils if not already loaded
                    const script = document.createElement('script');
                    script.src = '/js/jwtUtils.js';
                    script.onload = () => {
                        if (typeof storeTokens === 'function') {
                            storeTokens(data.tokens.accessToken, data.tokens.refreshToken);
                        }
                    };
                    document.head.appendChild(script);
                }
            }
            
            successDiv.textContent = data.message || 'Login successful! Redirecting...';
            successDiv.style.display = 'block';
            setTimeout(() => {
                window.location.href = '/customer/dashboard.html';
            }, 1500);
        } else {
            errorDiv.textContent = data.error || 'Invalid email or password.';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.style.display = 'block';
        console.error('Error:', error);
    }
});

