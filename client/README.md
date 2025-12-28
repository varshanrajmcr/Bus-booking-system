# Bus Booking React Application

This is the React frontend for the Bus Booking System, converted from the original HTML/CSS/JS implementation.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The app will run on http://localhost:5173

## Build for Production

```bash
npm run build
```

This creates a `dist` folder with the production build. The backend server will serve this in production mode.

## Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── common/        # Shared components (Navbar, AnimatedBackground, etc.)
│   │   ├── customer/      # Customer-facing components
│   │   └── admin/         # Admin-facing components
│   ├── services/          # API service layer
│   ├── utils/             # Utility functions (validation, formatting, etc.)
│   ├── styles/             # CSS files (copied from original)
│   ├── App.jsx            # Main app component with routing
│   └── main.jsx           # Entry point
├── public/                 # Static assets
└── package.json
```

## Features

- **100% UI Parity**: All original HTML/CSS/JS functionality preserved
- **React Router**: Client-side routing
- **Axios**: API communication with session cookie support
- **Component-based**: Modular, reusable components
- **Type Safety**: Validation functions maintained from original

## Development Notes

- The app uses Vite for fast development and building
- API calls are proxied to `http://localhost:3000` during development
- All CSS files are preserved exactly as in the original
- Session management uses cookies (withCredentials: true)

