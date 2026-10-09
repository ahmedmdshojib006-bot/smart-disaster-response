# Smart Disaster Response & Relief Coordination Platform

A university capstone project for real-time disaster response coordination.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + React Router v6 |
| Backend | Node.js + Express.js |
| Database | MongoDB (Mongoose ODM) |
| Real-time | Socket.IO |
| Auth | JWT + bcryptjs |

---

## Quick Start

### Prerequisites

- Node.js v18+ (v24 recommended)
- A MongoDB connection string ([free Atlas cluster](https://cloud.mongodb.com))

---

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Open .env and fill in MONGO_URI and JWT_SECRET
npm run dev
```

Backend runs at: http://localhost:5000

Health check: http://localhost:5000/api/health

---

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# .env defaults work if backend is on port 5000
npm run dev
```

Frontend runs at: http://localhost:3000

---

## Environment Variables

### `backend/.env`

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string for signing JWTs |
| `JWT_EXPIRES_IN` | Token lifetime e.g. `7d` |
| `PORT` | Backend port (default: 5000) |
| `CLIENT_ORIGIN` | Frontend URL for CORS (default: http://localhost:3000) |

### `frontend/.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |
| `VITE_SOCKET_URL` | Socket.IO server URL |

---

## Project Structure

```
smart-disaster-response/
├── backend/           Express API + Socket.IO server
│   ├── config/        MongoDB connection
│   ├── controllers/   Route handler logic
│   ├── middleware/     JWT auth + role authorization
│   ├── models/        Mongoose schemas (User, Notification)
│   ├── routes/        Express routers
│   ├── services/      Notification service (team integration point)
│   └── socket/        Socket.IO auth and room management
│
├── frontend/          React + Vite SPA
│   └── src/
│       ├── api/        Axios instance with JWT interceptors
│       ├── components/ Navbar, NotificationBell, ProtectedRoute
│       ├── context/    AuthContext, SocketContext
│       ├── pages/      Login, Register, Dashboard pages (per role)
│       └── styles/     Global CSS
│
└── INTEGRATION.md     Team API + Socket.IO contracts
```

---

## Implemented Features

### Feature A: Authentication & RBAC
- User registration with bcrypt password hashing
- JWT login with role-based redirects
- 5 roles: Admin, Volunteer, NGO, Citizen, Donor
- Protected API routes (server-side middleware)
- Protected frontend routes (ProtectedRoute component)

### Feature B: Real-Time Notifications
- Socket.IO with JWT authentication
- Role-based and personal notification rooms
- NotificationBell component with unread count
- Persistent notifications in MongoDB
- Mark-as-read (single and all)

---

## Team Integration

See [INTEGRATION.md](./INTEGRATION.md) for:
- Full API endpoint reference
- Socket.IO event contract
- How to send notifications from the SOS module
- How to use auth middleware in new routes
