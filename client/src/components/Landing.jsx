import { useNavigate } from 'react-router-dom';
import '../styles/landing.css';

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="landing-container">
        {/* Header */}
        <header className="landing-header">
          <div className="landing-logo">
            <h1>🚌 Bus Booking System</h1>
            <p className="tagline">Your Journey, Our Commitment</p>
          </div>
        </header>

        {/* Main Content */}
        <main className="landing-main">
          <div className="landing-content">
            <h2 className="landing-title">Welcome to Bus Booking System</h2>
            <p className="landing-subtitle">
              Book your bus tickets easily and manage your travel with ease
            </p>

            {/* User Type Selection */}
            <div className="user-type-selection">
              <div 
                className="user-type-card customer-card"
                onClick={() => navigate('/customer/login')}
              >
                <div className="card-icon">👤</div>
                <h3>Customer</h3>
                <p>Book buses, manage bookings, and track your journeys</p>
                <button className="card-button customer-button">
                  Continue as Customer →
                </button>
              </div>

              <div 
                className="user-type-card admin-card"
                onClick={() => navigate('/admin/login')}
              >
                <div className="card-icon">👨‍💼</div>
                <h3>Admin</h3>
                <p>Manage buses, bookings, and oversee operations</p>
                <button className="card-button admin-button">
                  Continue as Admin →
                </button>
              </div>
            </div>

            {/* Quick Links */}
            <div className="quick-links">
              <a 
                href="/customer/signup" 
                onClick={(e) => { e.preventDefault(); navigate('/customer/signup'); }}
                className="quick-link"
              >
                New Customer? Sign Up
              </a>
              <span className="link-separator">|</span>
              <a 
                href="/admin/signup" 
                onClick={(e) => { e.preventDefault(); navigate('/admin/signup'); }}
                className="quick-link"
              >
                New Admin? Sign Up
              </a>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="landing-footer">
          <p>&copy; {new Date().getFullYear()} Bus Booking System. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

export default Landing;

