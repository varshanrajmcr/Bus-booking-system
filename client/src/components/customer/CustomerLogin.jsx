import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setUser, setUserName } from '../../store/slices/authSlice';
import { setErrorMessage, setSuccessMessage, clearMessages } from '../../store/slices/uiSlice';
import { validateEmailFormat } from '../../utils/validation';
import { storeTokens, getAccessToken } from '../../utils/jwtUtils';
import { setActiveCustomerSession, clearExplicitLogout, getActiveCustomerSession } from '../../utils/browserSessionManager';
import api from '../../services/api';
import AnimatedBackground from '../common/AnimatedBackground';
import AnimatedBus from '../common/AnimatedBus';
import LogoSection from '../common/LogoSection';

function CustomerLogin() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const { errorMessage, successMessage } = useAppSelector((state) => state.ui);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Check for message in URL
    const message = searchParams.get('message');
    if (message) {
      dispatch(setErrorMessage(decodeURIComponent(message)));
    }
    return () => {
      dispatch(clearMessages());
    };
  }, [searchParams, dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearMessages());

    const formData = {
      email: email.trim(),
      password: password,
      userType: 'customer'
    };

    // Email validation
    const emailValidation = validateEmailFormat(formData.email);
    if (!emailValidation.isValid) {
      dispatch(setErrorMessage(
        '<strong>Invalid email format:</strong><ul>' +
        emailValidation.errors.map(err => '<li>' + err + '</li>').join('') +
        '</ul>'
      ));
      return;
    }

    // Password validation
    if (!formData.password || formData.password.trim() === '') {
      dispatch(setErrorMessage('Password is required'));
      return;
    }

    // Check if user is already logged in
    const activeCustomerId = getActiveCustomerSession();
    const existingToken = getAccessToken();
    if (activeCustomerId && existingToken) {
      // Check if the token is still valid
      try {
        const payload = JSON.parse(atob(existingToken.split('.')[1]));
        const tokenUserId = payload.userId?.toString();
        if (tokenUserId === activeCustomerId) {
          // Same user is already logged in - redirect to dashboard
          dispatch(setSuccessMessage('You are already logged in. Redirecting to dashboard...'));
          setTimeout(() => {
            navigate('/customer/dashboard', { replace: true });
          }, 1500);
          return;
        }
      } catch (e) {
        // Token invalid, proceed with login
      }
    }

    try {
      const response = await api.post('/customer/login', formData);
      
      if (response.data.tokens) {
        console.log('[LOGIN] Received tokens from server for:', response.data.user);
        storeTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
        
        // Verify token was stored correctly
        const storedToken = sessionStorage.getItem('jwt_access_token');
        if (storedToken) {
          try {
            const payload = JSON.parse(atob(storedToken.split('.')[1]));
            console.log('[LOGIN] Verified stored token contains:', {
              userId: payload.userId,
              email: payload.email,
              fullName: payload.fullName
            });
          } catch (e) {
            console.error('[LOGIN] Error verifying stored token:', e);
          }
        }
      }

      // Update Redux auth state
      if (response.data.user) {
        dispatch(setUser(response.data.user));
        dispatch(setUserName(`Welcome, ${response.data.user.fullName || 'User'}`));
        // Set browser-wide active customer session
        setActiveCustomerSession(response.data.user.customerId);
        clearExplicitLogout();
      }

      dispatch(setSuccessMessage(response.data.message || 'Login successful! Redirecting...'));
      setTimeout(() => {
        navigate('/customer/dashboard', { replace: true });
      }, 1500);
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          (error.message?.includes('Network Error') || error.code === 'ERR_NETWORK' 
                            ? 'Cannot connect to server. Please check your internet connection and ensure the backend is running.' 
                            : 'An error occurred. Please try again.');
      dispatch(setErrorMessage(errorMessage));
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
            <h1>Customer Login <span className="user-type-badge customer-badge">Customer</span></h1>
            <p className="subtitle">Welcome back! Please login to continue</p>
            
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
            
            <form id="loginForm" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <button type="submit" className="btn">Login</button>
            </form>
            
            <p className="link-text">
              Don't have an account? <a href="/customer/signup" onClick={(e) => { e.preventDefault(); navigate('/customer/signup'); }}>Sign up here</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default CustomerLogin;

