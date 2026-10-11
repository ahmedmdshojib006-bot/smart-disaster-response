// routes/taskRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Task management endpoints (Member-3: Volunteer Task Management)
//
// Endpoints:
//   POST   /api/tasks            Admin: Assign a new task to a volunteer
//   GET    /api/tasks            Admin, NGO: List & filter all tasks
//   GET    /api/tasks/my-tasks   Volunteer: List tasks assigned to current volunteer
//   GET    /api/tasks/:id        Admin, NGO, Volunteer: Get specific task details
//   PATCH  /api/tasks/:id/status Volunteer, Admin: Advance lifecycle
//                                (Assigned -> Accepted -> In Progress -> Completed)
//   PUT    /api/tasks/:id/assign Admin: Reassign task to another volunteer
//   DELETE /api/tasks/:id        Admin: Delete/cancel task
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All task routes require an authenticated user
router.use(protect);

// ── Volunteer routes ─────────────────────────────────────────────────────────
// Volunteers see their own tasks
router.get('/my-tasks', requireRole(['Volunteer']), taskController.getMyTasks);

// ── Admin routes ─────────────────────────────────────────────────────────────
// Admin creates and assigns a task
router.post('/', requireRole(['Admin']), taskController.createTask);

// Admin or NGO lists all tasks across the platform
router.get('/', requireRole(['Admin', 'NGO']), taskController.getAllTasks);

// Admin reassigns a task to a different volunteer
router.put('/:id/assign', requireRole(['Admin']), taskController.assignTask);

// Admin deletes a task
router.delete('/:id', requireRole(['Admin']), taskController.deleteTask);

// ── Shared routes ────────────────────────────────────────────────────────────
// Status transitions: Accessible by Volunteer (for their assigned tasks) or Admin
router.patch('/:id/status', requireRole(['Volunteer', 'Admin']), taskController.updateTaskStatus);

// View specific task: Accessible by Admin, NGO, or assigned Volunteer
router.get('/:id', taskController.getTaskById);

module.exports = router;
