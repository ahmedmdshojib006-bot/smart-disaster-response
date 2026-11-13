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

## 8. Emergency SOS / Help Request Reference (Member-2)

> All SOS endpoints require `Authorization: Bearer <token>`.

### POST `/api/sos`
Submit an emergency distress signal. Supports both `multipart/form-data` (with optional photo file under field `photo`) and `application/json`.

```json
// Request (JSON or FormData)
{
  "latitude": 23.8103,
  "longitude": 90.4125,
  "address": "Mirpur-10, Block C, Road 4 (Rooftop)",
  "needs": ["rescue", "water", "food"],
  "numberOfPeople": 4,
  "description": "Ground floor submerged, 4 people trapped including elderly person."
}
```

```json
// Success Response — 201 Created
{
  "success": true,
  "message": "Emergency SOS request submitted successfully. Help is on the way.",
  "data": {
    "_id": "670189...",
    "victim": { "_id": "6650ab...", "name": "Jane Doe", "email": "jane@example.com" },
    "location": { "latitude": 23.8103, "longitude": 90.4125, "address": "Mirpur-10..." },
    "needs": ["rescue", "water", "food"],
    "numberOfPeople": 4,
    "photoUrl": "/uploads/sos-1728650000000-123456.jpg",
    "status": "Pending",
    "priority": "Critical",
    "createdAt": "2026-10-11T13:30:00.000Z"
  }
}
```

### GET `/api/sos/my`
Retrieve all SOS requests filed by the authenticated citizen/victim.

### GET `/api/sos`
Query all SOS requests across the disaster zone. **Roles:** `Admin`, `Volunteer`, `NGO`.
- Query params: `?status=Pending&need=rescue&priority=Critical`

### PATCH `/api/sos/:id/cancel`
Cancel an SOS request (Citizen who created it or Admin).

### PATCH `/api/sos/:id/status`
Update status and assign volunteer. **Roles:** `Admin`, `Volunteer`, `NGO`.
- Body: `{ "status": "In Progress", "assignedVolunteer": "<userId>", "note": "Team deployed" }`

### Real-Time Socket.IO Events
- **`sos:created`**: Emitted when a new SOS is created.
- **`sos:updated`**: Emitted whenever status changes or a volunteer is assigned.

---

## 9. Member-3: Volunteer & Task Management Reference

### 9.1 Volunteer Profile & Registration
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

### 9.2 Task Lifecycle & State Machine
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

---

## 10. Module 2: Relief Operations & Resource Monitoring (Member-3: Minhaz Chowdhury)

### 10.1 Feature Overview
Admins and NGOs can track resource inventory and distribution across disaster zones in Bangladesh, including real-time stock levels of Food, Water, Medicine, and Blankets, along with transparent audit logs of where, when, and how much has been distributed to shelters, relief camps, and affected communities.

### 10.2 Key Capabilities
1. **Multi-Category Stockpile Tracking**:
   - Manages stock levels across **Food** (rice, high-energy biscuits, baby food), **Water** (bottled water, purification tablets, jerrycans), **Medicine** (ORS sachets, trauma kits, waterborne disease antibiotics), **Blankets** (fleece thermal blankets, waterproof sleeping mats), and Emergency Kits.
   - Real-time stock status computation: `In Stock`, `Low Stock`, and `Out of Stock`.
2. **Server-Enforced Atomic Stock Deductions**:
   - Prevents over-distribution by verifying `quantityAvailable >= requestedQuantity` atomically before recording deliveries.
   - Automatically decrements available inventory and increments cumulative distributed totals.
   - Restores/refunds stock if a distribution operation is cancelled.
3. **Transparent Distribution Audit Logging**:
   - Records recipient type (`Shelter`, `Relief Camp`, `Affected Community`, `Household`, `Individual`), target district, upazila, estimated beneficiaries reached, transport method, and the authorized distributor (`Admin` or `NGO`).
   - Seamlessly integrates with Member-1's Shelter system by linking shelter destinations directly.
4. **Real-Time WebSockets (Socket.IO)**:
   - Emits instant updates for `resource:created`, `resource:updated`, `resource:restocked`, `resource:distributed`, and high-priority `resource:low_stock_alert`.

### 10.3 API Endpoints

#### GET `/api/resources`
Retrieve all inventory resources with filters. **Requires Auth.**
- Query params: `search`, `category`, `status`, `district`, `lowStockOnly`
- Returns: `{ success: true, count, resources }`

#### GET `/api/resources/stats`
Aggregated platform metrics. **Requires Auth.**
- Returns:
  ```json
  {
    "success": true,
    "stats": {
      "totalItems": 15,
      "totalAvailableStock": 8140,
      "totalDistributedStock": 3745,
      "lowStockCount": 3,
      "outOfStockCount": 2,
      "totalDistributionsCount": 42,
      "totalBeneficiariesReached": 12850,
      "categoryBreakdown": [
        { "category": "Food", "available": 742, "distributed": 808, "itemCount": 4 },
        { "category": "Water", "available": 5718, "distributed": 2282, "itemCount": 3 },
        { "category": "Medicine", "available": 423, "distributed": 327, "itemCount": 3 },
        { "category": "Blankets", "available": 1270, "distributed": 780, "itemCount": 3 }
      ],
      "topDistricts": [
        { "district": "Feni", "totalQuantity": 1650 },
        { "district": "Sylhet", "totalQuantity": 1120 }
      ]
    }
  }
  ```

#### POST `/api/resources`
Create a new relief supply item. **Requires Role: Admin or NGO.**
- Payload:
  ```json
  {
    "name": "Miniket Rice (25kg bags)",
    "category": "Food",
    "unit": "bags",
    "quantityAvailable": 500,
    "thresholdLowStock": 80,
    "warehouseDistrict": "Feni",
    "warehouseName": "Feni Central Relief Depot",
    "donorName": "Bangladesh Red Crescent Society (BDRCS)",
    "notes": "Store in elevated dry pallets"
  }
  ```

#### POST `/api/resources/distribute`
Log relief delivery and deduct stock atomically. **Requires Role: Admin or NGO.**
- Payload:
  ```json
  {
    "resourceId": "66f1234...",
    "quantity": 50,
    "recipientType": "Shelter",
    "shelterId": "66e5678...",
    "destinationName": "Sylhet Govt College Shelter",
    "district": "Sylhet",
    "upazila": "Sylhet Sadar",
    "beneficiaryCount": 180,
    "transportMethod": "Rescue Speedboat",
    "notes": "Emergency meal supplies delivered."
  }
  ```

#### POST `/api/resources/:id/restock`
Add incoming stock to an existing item. **Requires Role: Admin or NGO.**
- Payload:
  ```json
  {
    "quantityToAdd": 100,
    "donorName": "UNICEF Bangladesh",
    "notes": "New replenishment shipment arrived."
  }
  ```

#### GET `/api/resources/distributions/history`
Fetch distribution audit records with filtering. **Requires Auth.**
- Query params: `resourceId`, `category`, `district`, `recipientType`, `limit`


