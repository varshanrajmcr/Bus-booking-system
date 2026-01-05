import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAppDispatch } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import { clearTokens } from '../../utils/jwtUtils';
import { setExplicitLogout } from '../../utils/browserSessionManager';
import api from '../../services/api';

function Navbar({ userName, showBookingsLink = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const isAdmin = location.pathname.startsWith('/admin');

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Set explicit logout flag to prevent auto-redirect
      setExplicitLogout(isAdmin ? 'admin' : 'customer');
      // Clear JWT tokens and Redux state
      clearTokens();
      dispatch(logout());
      navigate(isAdmin ? '/admin/login' : '/customer/login');
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <h2>
          <img src="/images/logo.jpg" alt="JourneyJunction Logo" className="nav-logo" /> 
          JourneyJunction
        </h2>
        <div className="nav-links">
          {showBookingsLink && (
            <Link 
              to="/customer/bookings" 
              style={{
                color: 'white', 
                textDecoration: 'none', 
                marginRight: '20px', 
                padding: '8px 15px', 
                background: '#97d700', 
                borderRadius: '5px', 
                transition: 'background 0.3s'
              }}
              onMouseOver={(e) => e.target.style.background = '#97d700'}
              onMouseOut={(e) => e.target.style.background = '#97d700'}
            >
              My Bookings
            </Link>
          )}
          <span id="userName">{userName}</span>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

