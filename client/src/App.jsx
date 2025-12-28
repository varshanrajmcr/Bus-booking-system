import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CustomerLogin from './components/customer/CustomerLogin';
import CustomerSignup from './components/customer/CustomerSignup';
import CustomerDashboard from './components/customer/CustomerDashboard';
import Booking from './components/customer/Booking';
import Bookings from './components/customer/Bookings';
import AdminLogin from './components/admin/AdminLogin';
import AdminSignup from './components/admin/AdminSignup';
import AdminDashboard from './components/admin/AdminDashboard';

function App() {
  return (
    <div style={{ width: '100%', minHeight: '100vh' }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/customer/login" replace />} />
          
          {/* Customer Routes */}
          <Route path="/customer/login" element={<CustomerLogin />} />
          <Route path="/customer/signup" element={<CustomerSignup />} />
          <Route path="/customer/dashboard" element={<CustomerDashboard />} />
          <Route path="/customer/booking" element={<Booking />} />
          <Route path="/customer/bookings" element={<Bookings />} />
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/signup" element={<AdminSignup />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;

