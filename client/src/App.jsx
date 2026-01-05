import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { setNavigate } from './utils/navigation';
import { 
  getActiveCustomerSession, 
  getActiveAdminSession, 
  isExplicitLogout,
  clearActiveCustomerSession,
  clearActiveAdminSession,
  setActiveCustomerSession,
  setActiveAdminSession
} from './utils/browserSessionManager';
import Landing from './components/Landing';
import CustomerLogin from './components/customer/CustomerLogin';
import CustomerSignup from './components/customer/CustomerSignup';
import CustomerDashboard from './components/customer/CustomerDashboard';
import Booking from './components/customer/Booking';
import Bookings from './components/customer/Bookings';
import AdminLogin from './components/admin/AdminLogin';
import AdminSignup from './components/admin/AdminSignup';
import AdminDashboard from './components/admin/AdminDashboard';

// Inner component to access navigate hook
function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Set navigate function for use in interceptors
  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);
  
  // Auto-redirect on tab reopen if valid session exists
  useEffect(() => {
    const checkAndRedirect = async () => {
      const path = location.pathname;
      
      // Handle login/signup pages - redirect to dashboard if already logged in
      if (path.includes('/login') || path.includes('/signup') || path === '/') {
        // Check for active customer session
        const activeCustomerId = getActiveCustomerSession();
        if (activeCustomerId && !isExplicitLogout('customer') && path === '/customer/login') {
          try {
            const response = await fetch('/api/session?type=customer', {
              credentials: 'include'
            });
            const data = await response.json();
              if (data.authenticated && data.user.userType === 'customer') {
                // Valid session exists - ensure it's stored in localStorage
                if (data.user.customerId) {
                  setActiveCustomerSession(data.user.customerId);
                }
                // Redirect to dashboard
                console.log('[App] Auto-redirecting customer to dashboard');
                navigate('/customer/dashboard', { replace: true });
              } else {
                // Session invalid, clear browser session
                clearActiveCustomerSession();
              }
          } catch (error) {
            console.error('[App] Error checking customer session:', error);
            clearActiveCustomerSession();
          }
        }
        
        // Check for active admin session
        const activeAdminId = getActiveAdminSession();
        if (activeAdminId && !isExplicitLogout('admin') && path === '/admin/login') {
          try {
            const response = await fetch('/api/session?type=admin', {
              credentials: 'include'
            });
            const data = await response.json();
            if (data.authenticated && data.user.userType === 'admin') {
              // Valid session exists - ensure it's stored in localStorage
              if (data.user.adminId) {
                setActiveAdminSession(data.user.adminId);
              }
              // Redirect to dashboard
              console.log('[App] Auto-redirecting admin to dashboard');
              navigate('/admin/dashboard', { replace: true });
            } else {
              // Session invalid, clear browser session
              clearActiveAdminSession();
            }
          } catch (error) {
            // Don't clear on network errors - let dashboard component handle it
            console.error('[App] Error checking admin session:', error);
            // Don't clear on transient errors - session might still be valid
          }
        }
      }
      
      // Handle direct dashboard access - verify session exists
      // Only check if explicit logout was NOT performed
      if (path.includes('/dashboard')) {
        if (path.includes('/admin/dashboard')) {
          // Only redirect if explicit logout was performed
          if (isExplicitLogout('admin')) {
            console.log('[App] Explicit logout detected, staying on login page');
            return;
          }
          
          // Check if there's an active session in localStorage
          const activeAdminId = getActiveAdminSession();
          if (activeAdminId) {
            // Active session exists - verify it's still valid
            try {
              const response = await fetch('/api/session?type=admin', {
                credentials: 'include'
              });
              const data = await response.json();
              if (data.authenticated && data.user.userType === 'admin') {
                // Session is valid - dashboard component will handle the rest
                // Also ensure session is stored (in case it was cleared)
                if (data.user.adminId) {
                  setActiveAdminSession(data.user.adminId);
                }
                console.log('[App] Admin session valid, allowing dashboard access');
              } else {
                // Session invalid, clear and let dashboard handle redirect
                console.log('[App] Admin session invalid, clearing browser session');
                clearActiveAdminSession();
              }
            } catch (error) {
              // Don't clear on network errors - let dashboard component handle it
              // Only clear if we get a definitive "not authenticated" response
              console.error('[App] Error checking admin session on dashboard:', error);
              // Don't clear on transient errors - session might still be valid
            }
          }
          // If no activeAdminId, let the dashboard component check the session cookie
          // It might still be valid even if localStorage is empty (e.g., after browser restart)
        } else if (path.includes('/customer/dashboard')) {
          // Only redirect if explicit logout was performed
          if (isExplicitLogout('customer')) {
            console.log('[App] Explicit logout detected, staying on login page');
            return;
          }
          
          // Let CustomerDashboard component handle session checking
          // This avoids duplicate session API calls
          // The component will check session and redirect if needed
        }
      }
    };
    
    checkAndRedirect();
  }, [navigate, location.pathname]);
  
  return (
    <Routes>
          <Route path="/" element={<Landing />} />
          
          {/* Customer Routes */}
          <Route path="/customer/login" element={<CustomerLogin />} />
          <Route path="/customer/signup" element={<CustomerSignup />} />
          <Route path="/customer/dashboard" element={<CustomerDashboard />} />
          <Route path="/customer/booking" element={<Booking />} />
          <Route path="/customer/bookings/:page" element={<Bookings />} />
          <Route path="/customer/bookings" element={<Bookings />} />
          
          {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/signup" element={<AdminSignup />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
    </Routes>
  );
}

function App() {
  return (
    <div style={{ width: '100%', minHeight: '100vh' }}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </div>
  );
}

export default App;

