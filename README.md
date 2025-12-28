# Bus Booking System

A full-stack bus booking application with React frontend and Node.js/Express backend.

## Features

- 🚌 Bus search and booking
- 👥 Customer and Admin dashboards
- 📊 Real-time updates with Server-Sent Events (SSE)
- 🔐 Session-based authentication
- 📧 Email notifications (booking confirmations/cancellations)
- 🎨 Modern FlixBus-inspired UI
- 📱 Responsive design
- 🔄 Redux state management
- ⚡ Real-time seat availability

## Tech Stack

### Frontend
- React 18
- Vite
- React Router DOM
- Redux Toolkit
- Axios
- Chart.js

### Backend
- Node.js
- Express.js
- PostgreSQL
- Sequelize ORM
- BullMQ (Queue management)
- Redis
- Nodemailer
- Express-session

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── store/         # Redux store and slices
│   │   ├── services/      # API services
│   │   └── utils/         # Utility functions
│   ├── public/            # Static assets
│   └── netlify.toml       # Netlify configuration
├── routes/                   # Express routes
├── models/                  # Sequelize models
├── utils/                  # Backend utilities
├── middleware/              # Express middleware
└── server.js               # Main server file
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL
- Redis (for queue management)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/varshanrajmcr/Bus-booking-system.git
cd Bus-booking-system
```

2. Install backend dependencies:
```bash
npm install
```

3. Install frontend dependencies:
```bash
cd client
npm install
```

4. Set up environment variables:
```bash
# Create .env file in root directory
cp .env.example .env
# Edit .env with your database and Redis credentials
```

5. Initialize the database:
```bash
npm run init-db
```

6. Start the backend server:
```bash
npm start
# or
npm run dev  # with nodemon
```

7. Start the frontend (in a new terminal):
```bash
cd client
npm run dev
```

## Deployment

### Frontend (Netlify)
See [client/NETLIFY_DEPLOYMENT.md](client/NETLIFY_DEPLOYMENT.md) for detailed Netlify deployment instructions.

### Backend
Deploy to Heroku, Railway, Render, or any Node.js hosting service.

## Environment Variables

### Backend (.env)
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bus_booking_db
DB_USER=postgres
DB_PASSWORD=your_password
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
```

### Frontend (Netlify)
- `VITE_API_URL`: Your backend API URL (e.g., `https://your-backend.herokuapp.com/api`)

## License

MIT

## Author

Varshanraj MCR

