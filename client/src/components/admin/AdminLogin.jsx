import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setUser, setUserName, setEnterpriseName } from '../../store/slices/authSlice';
import { setErrorMessage, setSuccessMessage, clearMessages } from '../../store/slices/uiSlice';
import { validateEmailFormat } from '../../utils/validation';
import { storeTokens } from '../../utils/jwtUtils';
import api from '../../services/api';
import AnimatedBackground from '../common/AnimatedBackground';
import AnimatedBus from '../common/AnimatedBus';
import LogoSection from '../common/LogoSection';

function AdminLogin() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const { errorMessage, successMessage } = useAppSelector((state) => state.ui);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      try {
        const response = await api.get('/session?type=admin');
        if (response.data.authenticated && response.data.user.userType === 'admin') {
          navigate('/admin/dashboard');
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
    };
    checkSession();

    // Check for message in URL
    const message = searchParams.get('message');
    if (message) {
      dispatch(setErrorMessage(decodeURIComponent(message)));
    }
    return () => {
      dispatch(clearMessages());
    };
  }, [navigate, searchParams, dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearMessages());

    const formData = {
      email: email.trim(),
      password: password,
      userType: 'admin'
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

    try {
      const response = await api.post('/admin/login', formData);
      
      if (response.data.tokens) {
        storeTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
      }

      // Update Redux auth state
      if (response.data.user) {
        dispatch(setUser(response.data.user));
        dispatch(setUserName(`Welcome, ${response.data.user.fullName || 'Admin'}`));
        if (response.data.user.enterpriseName) {
          dispatch(setEnterpriseName(response.data.user.enterpriseName));
        }
      }

      dispatch(setSuccessMessage(response.data.message || 'Login successful! Redirecting...'));
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 1500);
    } catch (error) {
      dispatch(setErrorMessage(error.response?.data?.error || 'An error occurred. Please try again.'));
    }
  };

  return (
    <>
      <AnimatedBackground />
      <AnimatedBus />

      <div className="page-wrapper">
        <LogoSection
          trustQuote='"Managing journeys with precision and care. We enable bus operators to deliver safe, reliable, and comfortable travel experiences for millions of passengers."'
          quoteAuthor="— Trusted by Bus Operators Nationwide"
        />
        
        <div className="vertical-divider"></div>
        
        <div className="form-section">
          <div className="container">
            <h1>Admin Login <span className="user-type-badge admin-badge">Admin</span></h1>
            <p className="subtitle">Admin portal for bus booking management</p>
            
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
              Don't have an account? <a href="/admin/signup" onClick={(e) => { e.preventDefault(); navigate('/admin/signup'); }}>Sign up here</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default AdminLogin;

