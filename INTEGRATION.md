# Smart Disaster Response Platform — Team Integration Guide

> **Branch**: `feature/auth-notifications`
> **Last Updated**: 2026-10-09

This document defines the API contracts, Socket.IO event specifications, and integration points that teammates developing other modules (SOS submission, volunteer task management, etc.) must use.

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [REST API Reference](#2-rest-api-reference)
3. [Socket.IO Event Reference](#3-socketio-event-reference)
4. [Integration Point — Sending Notifications](#4-integration-point--sending-notifications)
5. [Authorization Middleware Usage](#5-authorization-middleware-usage)
6. [User Roles Reference](#6-user-roles-reference)
7. [Environment Variables Required](#7-environment-variables-required)

---

## 1. Authentication Flow

```
User → POST /api/auth/login → { token, user }
         ↓
  Store token in localStorage('authToken')
         ↓
  Add header to all API requests: Authorization: Bearer <token>
         ↓
  Connect Socket.IO with: io(SOCKET_URL, { auth: { token } })
```

**Role-Based Dashboard Redirects (Frontend):**

| Role | Dashboard Route |
|------|----------------|
| Admin | `/dashboard/admin` |
| Volunteer | `/dashboard/volunteer` |
| NGO | `/dashboard/ngo` |
| Citizen | `/dashboard/citizen` |
| Donor | `/dashboard/donor` |

---

## 2. REST API Reference

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user. **Public — no token required.**

```json
// Request Body
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword123",
  "role": "Volunteer"
}
```

> ⚠️ `role` must be one of: `Volunteer`, `NGO`, `Citizen`, `Donor`.
> Sending `role: "Admin"` will be rejected. Admin accounts must be created directly in MongoDB by a database administrator.

```json
// Success Response — 201 Created
{
  "success": true,
  "message": "Registration successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "6650ab123...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "Volunteer"
  }
}
```

```json
// Error — 409 Conflict (duplicate email)
{ "success": false, "message": "Email already registered." }

// Error — 422 Validation failed
{ "success": false, "errors": ["Email must be valid", "Password must be at least 8 characters"] }
```

---

#### POST `/api/auth/login`
Login with email and password. **Public.**

```json
// Request Body
{
  "email": "jane@example.com",
  "password": "securepassword123"
}
```

```json
// Success Response — 200 OK
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "6650ab123...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "Volunteer"
  }
}
```

```json
// Error — 401 Unauthorized
{ "success": false, "message": "Invalid email or password." }
```

---

#### GET `/api/auth/me`
Get current authenticated user profile. **Requires auth token.**

```http
Authorization: Bearer <token>
```

```json
// Success Response — 200 OK
{
  "success": true,
  "user": {
    "_id": "6650ab123...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "Volunteer",
    "createdAt": "2026-10-09T07:00:00.000Z"
  }
}
```

---

#### POST `/api/auth/logout`
Signals logout. JWT is stateless — client must delete the stored token.

```json
// Success Response — 200 OK
{ "success": true, "message": "Logged out successfully. Please remove the token from client storage." }
```

---

### Notification Endpoints

> All notification endpoints require `Authorization: Bearer <token>`.

#### GET `/api/notifications`
Fetch notifications for the current user.

```json
// Success Response — 200 OK
{
  "success": true,
  "unreadCount": 2,
  "notifications": [
    {
      "_id": "665abc...",
      "type": "sos",
      "title": "New SOS Request",
      "message": "SOS from Mirpur area — flooding reported.",
      "isRead": false,
      "createdAt": "2026-10-09T13:00:00.000Z"
    }
  ]
}
```

---

#### PATCH `/api/notifications/read-all`
Mark all notifications as read.

```json
{ "success": true, "message": "All notifications marked as read." }
```

---

#### PATCH `/api/notifications/:id/read`
Mark one notification as read.

```json
{ "success": true, "notification": { "_id": "665abc...", "isRead": true } }
```

---

#### GET `/api/health`
Health check. **Public.**

```json
{ "status": "OK", "timestamp": "2026-10-09T13:00:00.000Z" }
```

---

## 3. Socket.IO Event Reference

### Connecting (Client Side)

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: localStorage.getItem('authToken'), // JWT token — required
  },
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

> ⚠️ If the token is missing or invalid, the server rejects the connection with `connect_error`. The frontend handles this gracefully.

---

### Room Architecture

After authentication, the server automatically joins each socket to:

| Room Name | Description |
|-----------|-------------|
| `user:<userId>` | Personal room for one specific user |
| `role:<roleName>` | Shared room for all users with a role |

---

### Events: Server → Client

#### `notification:new`
Emitted when a new notification is sent to the user's room.

```json
{
  "id": "665abc...",
  "type": "sos",
  "title": "New SOS Request",
  "message": "SOS from Mirpur area — flooding reported.",
  "createdAt": "2026-10-09T13:05:00.000Z"
}
```

| Type | Meaning |
|------|---------|
| `sos` | New SOS / help request |
| `weather` | Weather warning |
| `evacuation` | Evacuation notice |
| `general` | General announcement |

**Listening:**
```javascript
socket.on('notification:new', (notification) => {
  // Update UI badge count and notification list
});

// Clean up on unmount!
return () => socket.off('notification:new');
```

---

## 4. Integration Point — Sending Notifications

**This is how the SOS module (and any other module) sends notifications.**

```javascript
// In any backend route or controller:
const { sendNotification } = require('../services/notificationService');

// Get the Socket.IO instance attached to the Express app
const io = req.app.get('io');

// Example: After saving a new SOS request
await sendNotification({
  io,
  type: 'sos',
  title: 'New SOS Request',
  message: `SOS from ${location} — ${description}`,
  targetRole: 'Volunteer',    // Notify all Volunteers
});

// Also notify Admins
await sendNotification({
  io,
  type: 'sos',
  title: 'SOS Alert (Admin)',
  message: `Review SOS from ${location}`,
  targetRole: 'Admin',
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `io` | Socket.IO Server | ✅ | `req.app.get('io')` |
| `type` | string | ✅ | `sos`, `weather`, `evacuation`, `general` |
| `title` | string | ✅ | Short headline |
| `message` | string | ✅ | Notification body |
| `recipientUserId` | string | ❌ | Target one user by MongoDB ID |
| `targetRole` | string | ❌ | Target all users with a role |

> If neither option is set, falls back to notifying Admins only.

---

### Weather & Evacuation Alerts

Weather and evacuation alerts **must be triggered by an authorized Admin user** through an Admin UI (to be built). There is no live weather API — alerts are admin-sent.

> ⚠️ Do not fabricate real weather data unless a real API is connected.

---

## 5. Authorization Middleware Usage

```javascript
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Any authenticated user
router.get('/resource', protect, controller.get);

// Single role
router.delete('/resource/:id', protect, requireRole(['Admin']), controller.delete);

// Multiple roles
router.get('/tasks', protect, requireRole(['Admin', 'Volunteer']), controller.getTasks);
```

### Error Responses

| Scenario | Status | Message |
|----------|--------|---------|
| No token | 401 | "Not authenticated. Please log in." |
| Invalid / expired token | 401 | "Token is invalid or has expired." |
| User deleted | 401 | "User no longer exists." |
| Wrong role | 403 | "Access denied. Insufficient permissions." |

---

## 6. User Roles Reference

| Role | DB Value | Dashboard Route |
|------|----------|----------------|
| Administrator | `Admin` | `/dashboard/admin` |
| Field Volunteer | `Volunteer` | `/dashboard/volunteer` |
| NGO / Organization | `NGO` | `/dashboard/ngo` |
| Victim / Citizen | `Citizen` | `/dashboard/citizen` |
| Donor | `Donor` | `/dashboard/donor` |

> **Admin accounts** can only be created directly in MongoDB. The public `/register` endpoint rejects the `Admin` role.

---

## 7. Environment Variables Required

### Backend (`backend/.env`)

| Variable | Example | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb+srv://...` | MongoDB connection string |
| `JWT_SECRET` | `a-long-random-secret` | JWT signing secret |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `PORT` | `5000` | Server port |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Frontend URL for CORS |

### Frontend (`frontend/.env`)

| Variable | Example | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:5000` | Backend API URL |
| `VITE_SOCKET_URL` | `http://localhost:5000` | Socket.IO URL |

---

## 8. Member-3: Volunteer & Task Management Reference

### 8.1 Volunteer Profile & Registration
Volunteers can register with their skills, availability, and service area at `/register` or update them in `/dashboard/volunteer`.

**Fields stored in `User` document:**
- `skills`: `string[]` (e.g. `["First Aid", "Search & Rescue", "Medical Support"]`)
- `availability`: `'Available' | 'Busy' | 'Unavailable'` (default: `'Available'`)
- `serviceArea`: `string` (e.g. `"Dhaka (Mirpur)"`, `"Sylhet"`, `"Feni Parshuram"`)
- `phone`: `string` (emergency contact phone)

#### Endpoints:
- `GET /api/volunteers` — (Admin, NGO) List registered volunteers with task statistics and filters (`?availability=&serviceArea=&skill=&search=`).
- `GET /api/volunteers/profile` — (Volunteer) Get logged-in volunteer's profile and task summary counts.
- `PUT /api/volunteers/profile` — (Volunteer) Update own skills, availability, service area, and phone.

---

### 8.2 Task Lifecycle & State Machine
Tasks are assigned by Administrators to Volunteers and proceed through a strictly validated 4-step state machine:

```
[Assigned] ──► [Accepted] ──► [In Progress] ──► [Completed]
```

- **`Assigned`**: Initial state upon Admin assignment.
- **`Accepted`**: Volunteer acknowledges and accepts the assignment.
- **`In Progress`**: Volunteer begins field execution.
- **`Completed`**: Volunteer finalizes operation with optional completion notes and timestamp.

#### Task Endpoints:
- `POST /api/tasks` — (Admin) Create and assign task to a volunteer.
  ```json
  {
    "title": "Distribute relief dry food in Ward 4",
    "description": "Provide 100 food packets to stranded flood victims.",
    "taskType": "Food Distribution",
    "priority": "High",
    "serviceArea": "Feni Parshuram",
    "assignedTo": "<volunteerUserId>",
    "dueDate": "2026-10-15"
  }
  ```
- `GET /api/tasks` — (Admin, NGO) List and filter all platform tasks (`?status=&priority=&serviceArea=&assignedTo=`).
- `GET /api/tasks/my-tasks` — (Volunteer) Fetch tasks assigned to the currently authenticated volunteer (`?status=`).
- `GET /api/tasks/:id` — (Admin, NGO, Assigned Volunteer) Retrieve detailed task information and complete status history audit log.
- `PATCH /api/tasks/:id/status` — (Assigned Volunteer, Admin) Advance task lifecycle.
  ```json
  {
    "status": "Accepted", // or "In Progress", "Completed"
    "notes": "Arrived at location with supplies."
  }
  ```
- `PUT /api/tasks/:id/assign` — (Admin) Reassign task to a different volunteer.
- `DELETE /api/tasks/:id` — (Admin) Delete / cancel task.

