const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/my-tasks', requireRole(['Volunteer']), taskController.getMyTasks);

router.post('/', requireRole(['Admin']), taskController.createTask);

router.get('/', requireRole(['Admin', 'NGO']), taskController.getAllTasks);

router.put('/:id/assign', requireRole(['Admin']), taskController.assignTask);

router.delete('/:id', requireRole(['Admin']), taskController.deleteTask);

router.patch('/:id/status', requireRole(['Volunteer', 'Admin']), taskController.updateTaskStatus);

router.get('/:id', taskController.getTaskById);

module.exports = router;
