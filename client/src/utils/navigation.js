/**
 * Navigation utility for use outside React components
 * Allows navigation from axios interceptors and other non-component code
 */

let navigateFunction = null;

/**
 * Set the navigate function from React Router
 * Should be called once when the app initializes
 * @param {Function} navigate - React Router's navigate function
 */
export function setNavigate(navigate) {
  navigateFunction = navigate;
}

/**
 * Navigate to a route (works outside React components)
 * @param {string} path - Path to navigate to
 * @param {Object} options - Navigation options
 */
export function navigate(path, options = {}) {
  if (navigateFunction) {
    navigateFunction(path, options);
  } else {
    // Fallback to window.location if navigate not set
    window.location.href = path;
  }
}

/**
 * Redirect to login page with optional alert message
 * Works both in React components and outside (interceptors, etc.)
 * @param {string} userType - 'admin' or 'customer'
 * @param {Object} options - Configuration options
 * @param {boolean} options.showAlert - Whether to show alert (default: false)
 * @param {string} options.alertMessage - Custom alert message (default: 'Please login to continue')
 * @param {string} options.message - Optional query parameter message for login page
 * @param {Function} options.navigate - Optional navigate function (if in component, pass useNavigate())
 */
export function redirectToLogin(userType, options = {}) {
  const {
    showAlert = false,
    alertMessage = 'Please login to continue',
    message = null,
    navigate: componentNavigate = null
  } = options;

  // Show alert if requested
  if (showAlert) {
    alert(alertMessage);
  }

  // Use component's navigate if provided, otherwise use stored navigate function
  const path = `/${userType}/login${message ? `?message=${encodeURIComponent(message)}` : ''}`;
  
  if (componentNavigate) {
    // In React component - use the navigate prop
    componentNavigate(path, { replace: true });
  } else {
    // Outside component - use stored navigate function
    navigate(path, { replace: true });
  }
}

