import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateFullName, validateEmailFormat, validatePhone, validatePasswordStrength } from '../../utils/validation';
import api from '../../services/api';
import AnimatedBackground from '../common/AnimatedBackground';
import AnimatedBus from '../common/AnimatedBus';
import LogoSection from '../common/LogoSection';

function CustomerSignup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });

  useEffect(() => {
    const body = document.body;
    body.classList.add('signup-page');
    return () => {
      body.classList.remove('signup-page');
    };
  }, []);

  const handlePasswordChange = (password) => {
    setPasswordRequirements({
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const data = {
      ...formData,
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      userType: 'customer'
    };

    // Full name validation
    const fullNameValidation = validateFullName(data.fullName);
    if (!fullNameValidation.isValid) {
      setErrorMessage(
        '<strong>Invalid full name:</strong><ul>' +
        fullNameValidation.errors.map(err => '<li>' + err + '</li>').join('') +
        '</ul>'
      );
      return;
    }

    // Email validation
    const emailValidation = validateEmailFormat(data.email);
    if (!emailValidation.isValid) {
      setErrorMessage(
        '<strong>Invalid email format:</strong><ul>' +
        emailValidation.errors.map(err => '<li>' + err + '</li>').join('') +
        '</ul>'
      );
      return;
    }

    // Phone validation
    const phoneValidation = validatePhone(data.phone);
    if (!phoneValidation.isValid) {
      setErrorMessage(
        '<strong>Invalid phone number:</strong><ul>' +
        phoneValidation.errors.map(err => '<li>' + err + '</li>').join('') +
        '</ul>'
      );
      return;
    }

    // Password match validation
    if (data.password !== data.confirmPassword) {
      setErrorMessage('Passwords do not match!');
      return;
    }

    // Password strength validation
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.isValid) {
      setErrorMessage(
        '<strong>Password does not meet requirements:</strong><ul>' +
        passwordValidation.errors.map(err => '<li>' + err + '</li>').join('') +
        '</ul>'
      );
      return;
    }

    try {
      const response = await api.post('/customer/signup', data);
      
      setSuccessMessage(response.data.message || 'Signup successful! Redirecting...');
      setTimeout(() => {
        navigate('/customer/login');
      }, 2000);
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Signup failed. Please try again.');
    }
  };

  return (
    <>
      <AnimatedBackground />
      <AnimatedBus />

      <div className="page-wrapper">
        <LogoSection
          trustQuote="Your journey is our commitment. We ensure safe, comfortable, and reliable bus travel experiences for millions of passengers every day."
          quoteAuthor="— Trusted by Travelers Nationwide"
        />
        
        <div className="vertical-divider"></div>
        
        <div className="form-section">
          <div className="container">
            <h1>Customer Signup <span className="user-type-badge customer-badge">Customer</span></h1>
            <p className="subtitle">Create your account to book bus tickets</p>
            
            {errorMessage && (
              <div 
                id="errorMessage" 
                className="error-message"
                dangerouslySetInnerHTML={{ __html: errorMessage }}
              />
            )}
            {successMessage && (
              <div id="successMessage" className="success-message">
                {successMessage}
              </div>
            )}
            
            <form id="signupForm" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    handlePasswordChange(e.target.value);
                  }}
                  required
                  minLength="8"
                />
                <div id="passwordRequirements" className="password-requirements">
                  <div id="req-length" className={`requirement ${passwordRequirements.length ? 'valid' : 'invalid'}`}>
                    At least 8 characters
                  </div>
                  <div id="req-upper" className={`requirement ${passwordRequirements.upper ? 'valid' : 'invalid'}`}>
                    One uppercase letter
                  </div>
                  <div id="req-lower" className={`requirement ${passwordRequirements.lower ? 'valid' : 'invalid'}`}>
                    One lowercase letter
                  </div>
                  <div id="req-number" className={`requirement ${passwordRequirements.number ? 'valid' : 'invalid'}`}>
                    One number
                  </div>
                  <div id="req-special" className={`requirement ${passwordRequirements.special ? 'valid' : 'invalid'}`}>
                    One special character
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                />
              </div>
              
              <button type="submit" className="btn">Sign Up</button>
            </form>
            
            <p className="link-text">
              Already have an account? <a href="/customer/login" onClick={(e) => { e.preventDefault(); navigate('/customer/login'); }}>Login here</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default CustomerSignup;

